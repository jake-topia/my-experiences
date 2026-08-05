class PongUIManager extends SystemScript {
  systemName: string;

  // --- Configuration Reference ---
  config: any; // PongConfigSystem
  gameManager: any; // PongGameManager

  // --- UI Sprite IDs ---
  lobbySprites: PseudoList;
  countdownSpriteId: string;
  scoreRedSpriteId: string;
  scoreBlueSpriteId: string;
  scoreGreenSpriteId: string;
  scoreYellowSpriteId: string;
  gameOverSprites: PseudoList;
  activeScoreTeams: PseudoList;
  scoreLayoutStartX: number;
  scoreLayoutSpacing: number;
  playAreaSpriteId: string; // Central game board sprite
  currentPlayAreaColor: string; // Track current background color
  teamLaneSpriteIds: PseudoMap; // Team lane rectangles (e.g., { red: 'lane_red', blue: 'lane_blue' })

  // --- Lives Display (NEW) ---
  livesSpriteIds: PseudoMap; // teamId -> sprite ID for lives display

  // --- Win Count Display (NEW) ---
  winCountSpriteIds: PseudoMap; // teamId -> sprite ID for win count display

  // --- Round Summary (NEW - Phase 5) ---
  roundSummarySprites: PseudoList; // Sprite IDs for round summary display

  // --- Round Celebration & Countdown (NEW) ---
  roundCelebrationSprites: PseudoList; // Sprite IDs for round celebration
  roundCountdownSprites: PseudoList; // Sprite IDs for round countdown

  // --- Sudden Death Elimination Popup ---
  suddenDeathElimSprites: PseudoList; // Sprite IDs for elimination popup

  onInit() {
    console.log('[PongUI] Initializing UI manager');
    this.systemName = 'PongUIManager';

    // Get config
    scriptManager.attachSystem({ scriptId: 'PongConfigSystem' });
    this.config = scriptManager.getSystem({ systemName: 'PongConfigSystem' });

    // Initialize sprite tracking
    this.lobbySprites = [] as any;
    this.countdownSpriteId = 'pong_countdown';
    this.scoreRedSpriteId = '';
    this.scoreBlueSpriteId = '';
    this.scoreGreenSpriteId = '';
    this.scoreYellowSpriteId = '';
    this.gameOverSprites = [] as any;
    this.activeScoreTeams = [] as any;
    this.scoreLayoutStartX = 0;
    this.scoreLayoutSpacing = 200;
    this.playAreaSpriteId = 'pong_play_area';
    this.currentPlayAreaColor = '#1A1A1A'; // Dark gray default
    this.teamLaneSpriteIds = {} as PseudoMap;

    // Initialize lives display tracking (NEW)
    this.livesSpriteIds = {} as PseudoMap;

    // Initialize win count tracking (NEW)
    this.winCountSpriteIds = {} as PseudoMap;

    // Initialize round summary tracking (NEW - Phase 5)
    this.roundSummarySprites = [] as any;

    // Initialize celebration and countdown tracking (NEW)
    this.roundCelebrationSprites = [] as any;
    this.roundCountdownSprites = [] as any;

    // Initialize sudden death elimination popup tracking
    this.suddenDeathElimSprites = [] as any;
  }

  /**
   * Create or update the central play area sprite
   */
  createPlayArea() {
    if (!playerManager.isHost) return;

    // Remove existing if present
    if (spriteManager.getSprite(this.playAreaSpriteId)) {
      spriteManager.removeSprite(this.playAreaSpriteId);
    }

    // Create play area sprite with collision detection for camping system
    spriteManager.addSprite('rect', {
      uniqueId: this.playAreaSpriteId,
      positionX: this.config.playAreaX,
      positionY: this.config.playAreaY,
      width: this.config.playAreaWidth,
      height: this.config.playAreaHeight,
      fill: this.currentPlayAreaColor,
      checkCollisions: true, // Enable collision detection for camping
      collisionGroup: 'playarea', // Used to identify this sprite in collision events
    });

    console.log(
      '[PongUI] Created play area sprite at (' +
        this.config.playAreaX +
        ', ' +
        this.config.playAreaY +
        ') size ' +
        this.config.playAreaWidth +
        'x' +
        this.config.playAreaHeight,
    );
  }

  /**
   * Update play area background color (for high contrast with ball)
   */
  updatePlayAreaColor(newColor: string) {
    if (!playerManager.isHost) return;

    this.currentPlayAreaColor = newColor;

    if (spriteManager.getSprite(this.playAreaSpriteId)) {
      spriteManager.updateSprite(this.playAreaSpriteId, {
        fill: newColor,
      });
    }

    // Update paddle borders to maintain visibility
    if (this.gameManager && this.gameManager.paddleManager) {
      this.gameManager.paddleManager.updatePaddleBorderColors(newColor);
    }
  }

  /**
   * Remove play area sprite
   */
  removePlayArea() {
    if (!playerManager.isHost) return;

    if (spriteManager.getSprite(this.playAreaSpriteId)) {
      spriteManager.removeSprite(this.playAreaSpriteId);
    }
  }

  /**
   * Create team lane rectangles (visual indicators and goal zones)
   * Each team gets a colored rectangle in their lane area
   */
  createTeamLanes(playerCount: number) {
    if (!playerManager.isHost) return;

    // Remove any existing lane sprites
    this.removeTeamLanes();

    const laneWidth = this.config.laneWidth;
    const playAreaX = this.config.playAreaX;
    const playAreaY = this.config.playAreaY;
    const playAreaWidth = this.config.playAreaWidth;
    const playAreaHeight = this.config.playAreaHeight;

    if (playerCount === 2) {
      // Red team: top lane
      this.createLaneRect('red', 0, 0, this.config.worldWidth, laneWidth);

      // Blue team: bottom lane
      this.createLaneRect(
        'blue',
        0,
        this.config.worldHeight - laneWidth,
        this.config.worldWidth,
        laneWidth,
      );
    } else if (playerCount === 4) {
      // Red team: top lane
      this.createLaneRect('red', 0, 0, this.config.worldWidth, laneWidth);

      // Blue team: bottom lane
      this.createLaneRect(
        'blue',
        0,
        this.config.worldHeight - laneWidth,
        this.config.worldWidth,
        laneWidth,
      );

      // Green team: left lane (excluding corners taken by red/blue)
      this.createLaneRect('green', 0, laneWidth, laneWidth, playAreaHeight);

      // Yellow team: right lane (excluding corners taken by red/blue)
      this.createLaneRect(
        'yellow',
        this.config.worldWidth - laneWidth,
        laneWidth,
        laneWidth,
        playAreaHeight,
      );
    }

    console.log(
      '[PongUI] Created team lane rectangles for ' + playerCount + ' players',
    );
  }

  /**
   * Create a single lane rectangle for a team
   */
  createLaneRect(
    teamId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    if (!playerManager.isHost) return;

    const spriteId = 'pong_lane_' + teamId;
    const color = this.config.getTeamColor(teamId);
    const hexColor = '#' + ('000000' + color.toString(16)).slice(-6);

    // Make lanes semi-transparent (30% opacity effect by darkening)
    const dimmedColor = this.dimColor(hexColor, 0.3);

    spriteManager.addSprite('rect', {
      uniqueId: spriteId,
      positionX: x,
      positionY: y,
      width: width,
      height: height,
      fill: dimmedColor,
      checkCollisions: true,
      collisionGroup: 'lane_' + teamId, // Used for goal detection
    });

    this.teamLaneSpriteIds[teamId] = spriteId;
  }

  /**
   * Dim a hex color by a factor (0-1)
   */
  dimColor(hexColor: string, factor: number): string {
    const hex = hexColor.replace('#', '');
    const r = Math.floor(parseInt(hex.substring(0, 2), 16) * factor);
    const g = Math.floor(parseInt(hex.substring(2, 4), 16) * factor);
    const b = Math.floor(parseInt(hex.substring(4, 6), 16) * factor);

    const rHex = ('0' + r.toString(16)).slice(-2);
    const gHex = ('0' + g.toString(16)).slice(-2);
    const bHex = ('0' + b.toString(16)).slice(-2);

    return '#' + rHex + gHex + bHex;
  }

  /**
   * Remove all team lane sprites
   */
  removeTeamLanes() {
    if (!playerManager.isHost) return;

    const teams = ['red', 'blue', 'green', 'yellow'];
    for (let i = 0; i < teams.length; i++) {
      const teamId = teams[i];
      const spriteId = this.teamLaneSpriteIds[teamId];
      if (spriteId && spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
    }

    this.teamLaneSpriteIds = {} as PseudoMap;
  }

  /**
   * LOBBY: Show welcome message, player count requirement, and start button
   */
  showLobby(playerCount: number) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Showing lobby for ' + playerCount + ' players');

    this.clearAllUI();

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;

    // Start button (centered, shifted 70px left to fit in logo, only shown if 2 or 4 players)
    const startBtnY = centerY + 100;
    if (playerCount === 2 || playerCount === 4) {
      const startText = 'Start Game';
      const startWidth = startText.length * 14; // Estimate: 14px per char at fontSize 28
      const startBtnX = centerX - startWidth / 2 - 70; // Shifted 70px left for logo
      const startId = 'pong_lobby_start';

      spriteManager.addSprite('text', {
        uniqueId: startId,
        text: startText,
        positionX: startBtnX,
        positionY: startBtnY,
        fontSize: 28,
        isInteractive: true,
      });
      this.lobbySprites.push(startId);
    }

    // Instructions - Show player requirement (80px below start button)
    let instructText = 'Waiting for players... (Need 2 or 4 players)';
    let instructColor = '#FFAA00'; // Orange = waiting

    if (playerCount === 2) {
      instructText = '3-Round Tournament! Avatar → Buttons → Chaos!';
      instructColor = '#00FF00'; // Green = ready
    } else if (playerCount === 4) {
      instructText =
        '3-Round Tournament! Last player standing each round wins!';
      instructColor = '#00FF00'; // Green = ready
    }

    const instructWidth = instructText.length * 10; // Estimate: 10px per char at fontSize 20
    const instructX = centerX - instructWidth / 2;
    const instructY = startBtnY + 80; // 80px below start button
    const instructId = 'pong_lobby_instruct';

    spriteManager.addSprite('text', {
      uniqueId: instructId,
      text: instructText,
      positionX: instructX,
      positionY: instructY,
      fontSize: 20,
      fontColor: instructColor,
      isInteractive: false,
    });
    this.lobbySprites.push(instructId);

    // Player count display (below instructions)
    const playerCountText = 'Players: ' + playerCount + ' / 4';
    const playerCountWidth = playerCountText.length * 9;
    const playerCountX = centerX - playerCountWidth / 2;
    const playerCountY = instructY + 30; // Below instructions
    const playerCountId = 'pong_lobby_playercount';

    spriteManager.addSprite('text', {
      uniqueId: playerCountId,
      text: playerCountText,
      positionX: playerCountX,
      positionY: playerCountY,
      fontSize: 16,
      fontColor: '#FFFFFF',
      isInteractive: false,
    });
    this.lobbySprites.push(playerCountId);
  }

  /**
   * Update lobby display when player count changes
   */
  updateTeamSelection(gameManager: any) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Player count updated');

    // Get current player count and refresh lobby
    const currentPlayerCount = playerManager.getPlayerIds().length;
    this.showLobby(currentPlayerCount);
  }

  /**
   * Hide lobby UI
   */
  hideLobby() {
    if (!playerManager.isHost) return;

    console.log(
      '[PongUI] Hiding lobby - removing ' +
        this.lobbySprites.length +
        ' sprites',
    );

    let index = 0;
    while (index < this.lobbySprites.length) {
      const spriteId = this.lobbySprites[index];
      try {
        const sprite = spriteManager.getSprite(spriteId);
        if (sprite) {
          spriteManager.removeSprite(spriteId);
        }
      } catch (e) {
        console.warn('[PongUI] Error removing sprite ' + spriteId + ':', e);
      }
      index++;
    }

    this.lobbySprites = [] as any;
    console.log('[PongUI] Lobby hidden');
  }

  /**
   * COUNTDOWN: Show countdown number (giant centered text)
   */
  showCountdown(message: string) {
    if (!playerManager.isHost) return;

    try {
      const centerX = this.config.centerX;
      const centerY = this.config.centerY;

      // Manual width estimation for centering (like CTF)
      let offsetX = 0;
      if (message === 'GO!') {
        offsetX = 220; // Half-width for "GO!"
      } else if (message === '1') {
        offsetX = 70; // Half-width for narrow "1"
      } else {
        offsetX = 85; // Half-width for "2", "3", etc.
      }

      const countdownBoxHeight = 300;
      const centeredY = centerY - countdownBoxHeight / 2;

      const existing = spriteManager.getSprite(this.countdownSpriteId);
      if (existing) {
        spriteManager.updateSprite(this.countdownSpriteId, {
          text: message,
          positionX: centerX - offsetX,
          positionY: centeredY,
          fontSize: 250,
          fontColor: '#FFFFFF',
        });
      } else {
        spriteManager.addSprite('text', {
          uniqueId: this.countdownSpriteId,
          text: message,
          positionX: centerX - offsetX,
          positionY: centeredY,
          fontSize: 250,
          fontColor: '#FFFFFF',
        });
      }
    } catch (e) {
      console.error('[PongUI] Error showing countdown:', e);
    }
  }

  /**
   * Hide countdown
   */
  hideCountdown() {
    if (!playerManager.isHost) return;

    const sprite = spriteManager.getSprite(this.countdownSpriteId);
    if (sprite) {
      spriteManager.removeSprite(this.countdownSpriteId);
    }
  }

  /**
   * SCOREBOARD: Show team scores during gameplay
   * @param gameManager - reference to game manager to access team lists and scores directly
   */
  showScoreboard(gameManager: any) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Showing scoreboard');
    this.gameManager = gameManager;

    // Reset existing scoreboard before re-rendering layout
    this.hideScoreboard();

    // Get active teams by checking lengths directly on game manager
    const activeTeams: string[] = [];
    if (gameManager.teamRed.length > 0) activeTeams.push('red');
    if (gameManager.teamBlue.length > 0) activeTeams.push('blue');
    if (gameManager.teamGreen.length > 0) activeTeams.push('green');
    if (gameManager.teamYellow.length > 0) activeTeams.push('yellow');

    // Display scores at top of screen
    const teamCount = activeTeams.length;
    const spacing = 200;
    const startX = this.config.centerX - ((teamCount - 1) * spacing) / 2;

    this.activeScoreTeams = [] as any;
    // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
    for (let i = 0; i < activeTeams.length; i++) {
      this.activeScoreTeams.push(activeTeams[i]);
    }
    this.scoreLayoutStartX = startX;
    this.scoreLayoutSpacing = spacing;

    const teamScores: any = {
      red: this.getTeamScore(gameManager, 'red'),
      blue: this.getTeamScore(gameManager, 'blue'),
      green: this.getTeamScore(gameManager, 'green'),
      yellow: this.getTeamScore(gameManager, 'yellow'),
    };

    // Render each active team immediately so display appears before next update tick
    // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
    for (let j = 0; j < this.activeScoreTeams.length; j++) {
      const teamId = this.activeScoreTeams[j];
      if (!teamId) continue;
      const label = this.config.getTeamName(teamId) + ': ';
      const scoreValue = teamScores[teamId] || 0;
      this.renderOrUpdateScore(teamId, label + scoreValue);
    }
  }

  /**
   * Update scoreboard with new scores
   */
  updateScoreboard(
    scoreRed: number,
    scoreBlue: number,
    scoreGreen: number,
    scoreYellow: number,
  ) {
    if (!playerManager.isHost) return;
    if (!this.activeScoreTeams || this.activeScoreTeams.length === 0) return;

    const teamScores: any = {
      red: scoreRed,
      blue: scoreBlue,
      green: scoreGreen,
      yellow: scoreYellow,
    };

    // Update all active team score sprites
    // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
    for (let i = 0; i < this.activeScoreTeams.length; i++) {
      const teamId = this.activeScoreTeams[i];
      if (!teamId) continue;
      const scoreValue = teamScores[teamId] || 0;
      const label = this.config.getTeamName(teamId) + ': ';
      this.renderOrUpdateScore(teamId, label + scoreValue);
    }

    // Remove any lingering sprites for inactive teams
    const teams = ['red', 'blue', 'green', 'yellow'];
    // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
    for (let j = 0; j < teams.length; j++) {
      const teamId = teams[j];
      if (!this.isTeamActive(teamId)) {
        this.removeScoreSprite(teamId);
      }
    }
  }

  getScoreSpriteId(teamId: string): string {
    if (teamId === 'red') return this.scoreRedSpriteId;
    if (teamId === 'blue') return this.scoreBlueSpriteId;
    if (teamId === 'green') return this.scoreGreenSpriteId;
    if (teamId === 'yellow') return this.scoreYellowSpriteId;
    return '';
  }

  setScoreSpriteId(teamId: string, spriteId: string) {
    if (teamId === 'red') this.scoreRedSpriteId = spriteId;
    else if (teamId === 'blue') this.scoreBlueSpriteId = spriteId;
    else if (teamId === 'green') this.scoreGreenSpriteId = spriteId;
    else if (teamId === 'yellow') this.scoreYellowSpriteId = spriteId;
  }

  isTeamActive(teamId: string): boolean {
    if (!this.activeScoreTeams) return false;
    // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
    for (let i = 0; i < this.activeScoreTeams.length; i++) {
      if (this.activeScoreTeams[i] === teamId) {
        return true;
      }
    }
    return false;
  }

  getActiveTeamIndex(teamId: string): number {
    if (!this.activeScoreTeams) return -1;
    // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
    for (let i = 0; i < this.activeScoreTeams.length; i++) {
      if (this.activeScoreTeams[i] === teamId) {
        return i;
      }
    }
    return -1;
  }

  computeScoreX(teamId: string, text: string): number {
    const index = this.getActiveTeamIndex(teamId);
    if (index === -1) return this.config.centerX;
    const scoreWidth = text.length * 9;
    return (
      this.scoreLayoutStartX + index * this.scoreLayoutSpacing - scoreWidth / 2
    );
  }

  renderOrUpdateScore(teamId: string, text: string) {
    if (!this.isTeamActive(teamId)) {
      this.removeScoreSprite(teamId);
      return;
    }

    let spriteId = this.getScoreSpriteId(teamId);
    let sprite = spriteId ? spriteManager.getSprite(spriteId) : null;

    if (!sprite) {
      spriteId = 'pong_score_' + teamId;
      const positionX = this.computeScoreX(teamId, text);
      spriteManager.addSprite('text', {
        uniqueId: spriteId,
        text: text,
        positionX: positionX,
        positionY: 30,
        fontSize: 18,
        fontColor: '#FFFFFF',
        isInteractive: false,
      });
      this.setScoreSpriteId(teamId, spriteId);
      return;
    }

    try {
      const positionX = this.computeScoreX(teamId, text);
      spriteManager.updateSprite(spriteId, {
        text: text,
        positionX: positionX,
      });
    } catch (error) {
      console.error(
        '[PongUI] Error updating score sprite ' + spriteId + ':',
        error,
      );
    }
  }

  getTeamScore(gameManager: any, teamId: string): number {
    if (!gameManager) return 0;
    if (teamId === 'red') return gameManager.scoreRed || 0;
    if (teamId === 'blue') return gameManager.scoreBlue || 0;
    if (teamId === 'green') return gameManager.scoreGreen || 0;
    return gameManager.scoreYellow || 0;
  }

  /**
   * Hide scoreboard
   */
  hideScoreboard() {
    if (!playerManager.isHost) return;

    this.removeScoreSprite('red');
    this.removeScoreSprite('blue');
    this.removeScoreSprite('green');
    this.removeScoreSprite('yellow');

    this.activeScoreTeams = [] as any;
  }

  removeScoreSprite(teamId: string) {
    const spriteId = this.getScoreSpriteId(teamId);
    if (!spriteId) return;
    if (spriteManager.getSprite(spriteId)) {
      spriteManager.removeSprite(spriteId);
    }
    this.setScoreSpriteId(teamId, '');
  }

  /**
   * LIVES DISPLAY (NEW) - Show lives in each player's zone
   */
  showLivesDisplay(gameManager: any) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Showing lives display in player zones');
    this.gameManager = gameManager;

    // Get active teams
    const activeTeams: string[] = [];
    if (gameManager.teamRed.length > 0) activeTeams.push('red');
    if (gameManager.teamBlue.length > 0) activeTeams.push('blue');
    if (gameManager.teamGreen.length > 0) activeTeams.push('green');
    if (gameManager.teamYellow.length > 0) activeTeams.push('yellow');

    const playerCount = activeTeams.length;

    // Render lives for each active team
    for (let i = 0; i < activeTeams.length; i++) {
      const teamId = activeTeams[i];
      const lives = this.getTeamLives(gameManager, teamId);
      this.renderOrUpdateLives(teamId, lives, playerCount);
    }
  }

  /**
   * Update lives display for all players
   */
  updateLivesDisplay(gameManager: any) {
    if (!playerManager.isHost) return;

    // Get active teams
    const activeTeams: string[] = [];
    if (gameManager.teamRed.length > 0) activeTeams.push('red');
    if (gameManager.teamBlue.length > 0) activeTeams.push('blue');
    if (gameManager.teamGreen.length > 0) activeTeams.push('green');
    if (gameManager.teamYellow.length > 0) activeTeams.push('yellow');

    const playerCount = activeTeams.length;

    // Update each team's lives
    for (let i = 0; i < activeTeams.length; i++) {
      const teamId = activeTeams[i];
      const lives = this.getTeamLives(gameManager, teamId);
      this.renderOrUpdateLives(teamId, lives, playerCount);
    }
  }

  /**
   * Render or update lives sprite for a team
   */
  renderOrUpdateLives(teamId: string, lives: number, playerCount: number) {
    if (!playerManager.isHost) return;

    const spriteId = 'pong_lives_' + teamId;

    // Use compact format for side players (green/yellow) - just hearts
    // Use full format for top/bottom players (red/blue)
    const isSidePlayer = teamId === 'green' || teamId === 'yellow';
    let text = '';

    if (isSidePlayer) {
      // Compact vertical-friendly format: just number + heart
      text = lives + '❤️';
    } else {
      // Full horizontal format
      text = '❤️ ' + lives + ' ' + this.config.uiText.livesLabel;
    }

    // Calculate position in player's zone
    // Text needs to be manually centered by calculating width
    const fontSize = isSidePlayer ? 28 : 32; // Slightly smaller for side players
    const charWidth = fontSize * 0.6; // Approximate character width
    const textWidth = text.length * charWidth;

    let posX = 0;
    let posY = 0;

    if (teamId === 'red') {
      // Top zone - center horizontally, near top
      posX = this.config.centerX - textWidth / 2;
      posY = this.config.laneWidth / 2 - fontSize / 2;
    } else if (teamId === 'blue') {
      // Bottom zone - center horizontally, near bottom
      posX = this.config.centerX - textWidth / 2;
      posY = this.config.worldHeight - this.config.laneWidth / 2 - fontSize / 2;
    } else if (teamId === 'green') {
      // Left zone - center in lane, compact format
      posX = this.config.laneWidth / 2 - textWidth / 2;
      posY = this.config.centerY - fontSize / 2;
    } else if (teamId === 'yellow') {
      // Right zone - center in lane, compact format
      posX = this.config.worldWidth - this.config.laneWidth / 2 - textWidth / 2;
      posY = this.config.centerY - fontSize / 2;
    }

    // Check if sprite exists
    const existing = spriteManager.getSprite(spriteId);

    if (!existing) {
      // Create new sprite
      spriteManager.addSprite('text', {
        uniqueId: spriteId,
        text: text,
        positionX: posX,
        positionY: posY,
        fontSize: fontSize,
        fontColor: '#FFFFFF',
        isInteractive: false,
      });
      this.livesSpriteIds[teamId] = spriteId;
    } else {
      // Update existing sprite
      spriteManager.updateSprite(spriteId, {
        text: text,
        positionX: posX,
        positionY: posY,
      });
    }
  }

  /**
   * Get lives for a team
   */
  getTeamLives(gameManager: any, teamId: string): number {
    if (!gameManager) return 0;
    if (teamId === 'red') return gameManager.livesRed || 0;
    if (teamId === 'blue') return gameManager.livesBlue || 0;
    if (teamId === 'green') return gameManager.livesGreen || 0;
    return gameManager.livesYellow || 0;
  }

  /**
   * Hide lives display
   */
  hideLivesDisplay() {
    if (!playerManager.isHost) return;

    const teams = ['red', 'blue', 'green', 'yellow'];
    for (let i = 0; i < teams.length; i++) {
      const teamId = teams[i];
      const spriteId = this.livesSpriteIds[teamId];
      if (spriteId && spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
    }

    this.livesSpriteIds = {} as PseudoMap;
  }

  /**
   * GAME OVER: Show winner and final scores
   */
  showGameOver(winnerName: string, gameManager: any) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Showing game over - winner: ' + winnerName);

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;

    // Winner announcement
    // Check if this is a tie message (doesn't end with "Wins!")
    const isTie = winnerName.indexOf('Tie!') > 0;
    const winnerText = isTie ? winnerName : winnerName + ' Wins!';
    const winnerId = 'pong_gameover_winner';

    // Estimate text width for proper centering (fontSize 50)
    // Average character width is roughly 25px at fontSize 50
    // IMPORTANT: Calculate width AFTER determining final text (with " Wins!" appended)
    const estimatedWidth = winnerText.length * 25;
    const winnerX = centerX - estimatedWidth / 2;

    spriteManager.addSprite('text', {
      uniqueId: winnerId,
      text: winnerText,
      positionX: winnerX,
      positionY: centerY - 100,
      fontSize: 50,
      fontColor: '#FFFFFF',
      isInteractive: false,
    });
    this.gameOverSprites.push(winnerId);

    // Final scores
    let scoreY = centerY;
    const teams = ['red', 'blue', 'green', 'yellow'];
    let index = 0;
    while (index < teams.length) {
      const teamId = teams[index];
      const score = this.getTeamScore(gameManager, teamId);

      if (score === 0) {
        index++;
        continue; // Skip teams that didn't play
      }

      const teamName = this.config.getTeamName(teamId);
      const scoreText = teamName + ': ' + score;
      const scoreId = 'pong_gameover_score_' + teamId;

      // Estimate text width for centering (fontSize 24)
      // Average character width is roughly 14px at fontSize 24
      const estimatedWidth = scoreText.length * 14;
      const scoreX = centerX - estimatedWidth / 2;

      spriteManager.addSprite('text', {
        uniqueId: scoreId,
        text: scoreText,
        positionX: scoreX,
        positionY: scoreY,
        fontSize: 24,
        fontColor: '#FFFFFF',
        isInteractive: false,
      });
      this.gameOverSprites.push(scoreId);

      scoreY += 40;
      index++;
    }

    // Restart button - increased gap from 150 to 200
    const restartText = 'Play Again';
    const restartId = 'pong_gameover_restart';

    // Estimate text width for centering (fontSize 28)
    // Average character width is roughly 16px at fontSize 28
    const restartWidth = restartText.length * 16;
    const restartX = centerX - restartWidth / 2;

    spriteManager.addSprite('text', {
      uniqueId: restartId,
      text: restartText,
      positionX: restartX,
      positionY: centerY + 200,
      fontSize: 28,
      fontColor: '#FFFFFF',
      isInteractive: true,
    });
    this.gameOverSprites.push(restartId);
  }

  /**
   * Hide game over screen
   */
  hideGameOver() {
    if (!playerManager.isHost) return;

    let index = 0;
    while (index < this.gameOverSprites.length) {
      const spriteId = this.gameOverSprites[index];
      if (spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
      index++;
    }

    this.gameOverSprites = [] as any;
  }

  /**
   * Show round summary between rounds (NEW - Phase 5)
   */
  showRoundSummary(winnerText: string, nextRound: number, gameManager: any) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Showing round summary:', winnerText);

    // Hide any existing round summary
    this.hideRoundSummary();

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;

    // Background overlay
    const bgId = 'round_summary_bg';
    spriteManager.addSprite('rect', {
      uniqueId: bgId,
      positionX: centerX - 400,
      positionY: centerY - 250,
      width: 800,
      height: 500,
      fill: '#000000',
      opacity: 0.9,
    });
    this.roundSummarySprites.push(bgId);

    // Round complete title
    const titleId = 'round_summary_title';
    spriteManager.addSprite('text', {
      uniqueId: titleId,
      text: 'Round ' + gameManager.currentRound + ' Complete!',
      positionX: centerX - 200,
      positionY: centerY - 200,
      fontSize: 48,
      fontColor: '#FFFFFF',
    });
    this.roundSummarySprites.push(titleId);

    // Winner text
    const winnerId = 'round_summary_winner';
    spriteManager.addSprite('text', {
      uniqueId: winnerId,
      text: winnerText,
      positionX: centerX - 250,
      positionY: centerY - 120,
      fontSize: 36,
      fontColor: '#FFD700', // Gold
    });
    this.roundSummarySprites.push(winnerId);

    // Round standings title
    const standingsId = 'round_summary_standings_title';
    spriteManager.addSprite('text', {
      uniqueId: standingsId,
      text: 'Tournament Standings',
      positionX: centerX - 180,
      positionY: centerY - 40,
      fontSize: 32,
      fontColor: '#FFFFFF',
    });
    this.roundSummarySprites.push(standingsId);

    // Show round wins for each team
    const activeTeams: string[] = [];
    if (gameManager.teamRed.length > 0) activeTeams.push('red');
    if (gameManager.teamBlue.length > 0) activeTeams.push('blue');
    if (gameManager.teamGreen.length > 0) activeTeams.push('green');
    if (gameManager.teamYellow.length > 0) activeTeams.push('yellow');

    let yOffset = 20;
    for (let i = 0; i < activeTeams.length; i++) {
      const teamId = activeTeams[i];
      const teamName = this.config.getTeamName(teamId);
      const roundWins = gameManager.roundWins[teamId] || 0;
      const teamEmoji = this.config.getTeamEmoji(teamId);

      const standingId = 'round_summary_standing_' + teamId;
      spriteManager.addSprite('text', {
        uniqueId: standingId,
        text: teamEmoji + ' ' + teamName + ': ' + roundWins + ' wins',
        positionX: centerX - 150,
        positionY: centerY + yOffset,
        fontSize: 28,
        fontColor:
          '#' +
          ('000000' + this.config.getTeamColor(teamId).toString(16)).slice(-6),
      });
      this.roundSummarySprites.push(standingId);
      yOffset += 40;
    }

    // Next round info
    const nextRoundId = 'round_summary_next';
    let nextRoundText = 'Next: Round ' + nextRound;
    if (nextRound === 2) {
      nextRoundText += ' - Coordinate Tracking Mode';
    } else if (nextRound === 3) {
      nextRoundText += ' - Body Paddle Mode';
    }

    spriteManager.addSprite('text', {
      uniqueId: nextRoundId,
      text: nextRoundText,
      positionX: centerX - 280,
      positionY: centerY + yOffset + 40,
      fontSize: 28,
      fontColor: '#00FF00', // Green
    });
    this.roundSummarySprites.push(nextRoundId);

    console.log(
      '[PongUI] Round summary displayed with ' +
        this.roundSummarySprites.length +
        ' sprites',
    );
  }

  /**
   * Hide round summary (NEW - Phase 5)
   */
  hideRoundSummary() {
    if (!playerManager.isHost) return;

    let index = 0;
    while (index < this.roundSummarySprites.length) {
      const spriteId = this.roundSummarySprites[index];
      if (spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
      index++;
    }

    this.roundSummarySprites = [] as any;
  }

  /**
   * Show or update win count for all active players (NEW)
   */
  showWinCount(gameManager: any) {
    if (!playerManager.isHost) return;

    const activeTeams: string[] = [];
    if (gameManager.teamRed.length > 0) activeTeams.push('red');
    if (gameManager.teamBlue.length > 0) activeTeams.push('blue');
    if (gameManager.teamGreen.length > 0) activeTeams.push('green');
    if (gameManager.teamYellow.length > 0) activeTeams.push('yellow');

    const playerCount = activeTeams.length;

    for (let i = 0; i < activeTeams.length; i++) {
      const teamId = activeTeams[i];
      const wins = gameManager.roundWins[teamId] || 0;
      this.renderOrUpdateWinCount(teamId, wins, playerCount);
    }
  }

  /**
   * Render or update win count sprite for a team (NEW)
   */
  renderOrUpdateWinCount(teamId: string, wins: number, playerCount: number) {
    if (!playerManager.isHost) return;

    const spriteId = 'pong_wins_' + teamId;

    // Use compact format for side players (green/yellow)
    const isSidePlayer = teamId === 'green' || teamId === 'yellow';
    let text = '';

    if (isSidePlayer) {
      // Compact format: just "W:X"
      text = 'W:' + wins;
    } else {
      // Full format
      text = this.config.uiText.winsLabel + ': ' + wins;
    }

    // Calculate position in player's zone (below lives display)
    // Text needs to be manually centered by calculating width
    const fontSize = isSidePlayer ? 20 : 24;
    const charWidth = fontSize * 0.6; // Approximate character width
    const textWidth = text.length * charWidth;

    let posX = 0;
    let posY = 0;

    if (teamId === 'red') {
      posX = this.config.centerX - textWidth / 2;
      posY = this.config.laneWidth / 2 + 30; // Below lives
    } else if (teamId === 'blue') {
      posX = this.config.centerX - textWidth / 2;
      posY = this.config.worldHeight - this.config.laneWidth / 2 + 30;
    } else if (teamId === 'green') {
      posX = this.config.laneWidth / 2 - textWidth / 2;
      posY = this.config.centerY + 30;
    } else if (teamId === 'yellow') {
      posX = this.config.worldWidth - this.config.laneWidth / 2 - textWidth / 2;
      posY = this.config.centerY + 30;
    }

    const existing = spriteManager.getSprite(spriteId);

    if (!existing) {
      spriteManager.addSprite('text', {
        uniqueId: spriteId,
        text: text,
        positionX: posX,
        positionY: posY,
        fontSize: fontSize,
        fontColor: '#FFFFFF',
        isInteractive: false,
      });
      this.winCountSpriteIds[teamId] = spriteId;
    } else {
      spriteManager.updateSprite(spriteId, {
        text: text,
        positionX: posX,
        positionY: posY,
      });
    }
  }

  /**
   * Hide all win count displays (NEW)
   */
  hideWinCount() {
    if (!playerManager.isHost) return;

    const teams = ['red', 'blue', 'green', 'yellow'];
    for (let i = 0; i < teams.length; i++) {
      const spriteId = this.winCountSpriteIds[teams[i]];
      if (spriteId && spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
    }
    this.winCountSpriteIds = {} as PseudoMap;
  }

  /**
   * Show sudden death elimination message (auto-hides after 2 seconds)
   * Used when a player is eliminated in sudden death but game continues
   */
  showSuddenDeathElimination(playerName: string) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Showing sudden death elimination:', playerName);

    // Clear any existing elimination popup
    this.hideSuddenDeathElimination();

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;

    // Background overlay (smaller than round celebration)
    const bgId = 'sudden_death_elim_bg';
    spriteManager.addSprite('rect', {
      uniqueId: bgId,
      positionX: centerX - 300,
      positionY: centerY - 80,
      width: 600,
      height: 160,
      fill: '#330000',
      opacity: 0.9,
    });

    // Eliminated text
    const elimText = playerName + ' Eliminated!';
    const elimFontSize = 40;
    const elimWidth = elimText.length * elimFontSize * 0.5;
    const elimId = 'sudden_death_elim_text';
    spriteManager.addSprite('text', {
      uniqueId: elimId,
      text: elimText,
      positionX: centerX - elimWidth / 2,
      positionY: centerY - 20,
      fontSize: elimFontSize,
      fontColor: '#FF4444',
    });

    // Store sprite IDs for cleanup
    this.suddenDeathElimSprites = [bgId, elimId] as any;

    // Note: Timer to auto-hide is created by GameManager (timer events only work in the script that creates them)

    console.log('[PongUI] Sudden death elimination displayed');
  }

  /**
   * Hide sudden death elimination popup
   */
  hideSuddenDeathElimination() {
    if (!playerManager.isHost) return;
    if (!this.suddenDeathElimSprites) return;

    let index = 0;
    while (index < this.suddenDeathElimSprites.length) {
      const spriteId = this.suddenDeathElimSprites[index];
      if (spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
      index++;
    }

    this.suddenDeathElimSprites = [] as any;
  }

  /**
   * Show round winner celebration (3 seconds) (NEW)
   */
  showRoundCelebration(winnerText: string, roundNumber: number) {
    if (!playerManager.isHost) return;

    console.log('[PongUI] Showing celebration:', winnerText);

    this.hideRoundCelebration();

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;

    // Background overlay
    const bgId = 'round_celebration_bg';
    spriteManager.addSprite('rect', {
      uniqueId: bgId,
      positionX: centerX - 400,
      positionY: centerY - 200,
      width: 800,
      height: 400,
      fill: '#000000',
      opacity: 0.9,
    });
    this.roundCelebrationSprites.push(bgId);

    // Title text (centered)
    let titleText = '';
    let titleFontSize = 48;

    // For tournament (round 3 complete), use larger celebration text
    if (roundNumber === 3) {
      titleText = winnerText; // Tournament winner/tie message
      titleFontSize = 48; // Keep consistent size for better centering
    } else {
      titleText = this.config.uiText.roundComplete.replace(
        '{round}',
        roundNumber.toString(),
      );
    }

    // Calculate width based on actual fontSize being used (0.5 factor for better accuracy)
    const titleCharWidth = titleFontSize * 0.5;
    const titleWidth = titleText.length * titleCharWidth;
    const titleId = 'round_celebration_title';
    spriteManager.addSprite('text', {
      uniqueId: titleId,
      text: titleText,
      positionX: centerX - titleWidth / 2,
      positionY: centerY - 80,
      fontSize: titleFontSize,
      fontColor: '#FFD700',
    });
    this.roundCelebrationSprites.push(titleId);

    // Winner text (only for rounds 1 & 2, not tournament)
    if (roundNumber < 3) {
      const winnerCharWidth = 56 * 0.5; // fontSize 56, 0.5 factor
      const winnerWidth = winnerText.length * winnerCharWidth;
      const winnerId = 'round_celebration_winner';
      spriteManager.addSprite('text', {
        uniqueId: winnerId,
        text: winnerText,
        positionX: centerX - winnerWidth / 2,
        positionY: centerY + 40,
        fontSize: 56,
        fontColor: '#FFFFFF',
      });
      this.roundCelebrationSprites.push(winnerId);
    }

    console.log('[PongUI] Round celebration displayed');
  }

  /**
   * Hide round celebration (NEW)
   */
  hideRoundCelebration() {
    if (!playerManager.isHost) return;

    let index = 0;
    while (index < this.roundCelebrationSprites.length) {
      const spriteId = this.roundCelebrationSprites[index];
      if (spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
      index++;
    }

    this.roundCelebrationSprites = [] as any;
  }

  /**
   * Show round countdown with instructions (5 seconds with 1-second intervals) (NEW)
   */
  showRoundCountdown(roundNumber: number, secondsRemaining: number) {
    if (!playerManager.isHost) return;

    this.hideRoundCountdown();

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;

    // Background overlay
    const bgId = 'round_countdown_bg';
    spriteManager.addSprite('rect', {
      uniqueId: bgId,
      positionX: centerX - 450,
      positionY: centerY - 250,
      width: 900,
      height: 500,
      fill: roundNumber === 4 ? '#330000' : '#000000', // Dark red for sudden death
      opacity: 0.85,
    });
    this.roundCountdownSprites.push(bgId);

    // Round title
    const titleId = 'round_countdown_title';
    let modeName = '';
    let instructKey = 'button';
    let roundTitle = '';
    let titleColor = '#00FF00';

    if (roundNumber === 4) {
      // SUDDEN DEATH - special formatting
      roundTitle = 'SUDDEN DEATH';
      titleColor = '#FF0000';
      instructKey = 'suddendeath';
    } else if (roundNumber === 1) {
      // Round 1: Avatar/Coordinate tracking (intuitive for new players)
      modeName = this.config.uiText.roundModes.coordinate;
      instructKey = 'coordinate';
      roundTitle = this.config.uiText.roundTitle
        .replace('{round}', roundNumber.toString())
        .replace('{mode}', modeName);
    } else if (roundNumber === 2) {
      // Round 2: Button control mode
      modeName = this.config.uiText.roundModes.button;
      instructKey = 'button';
      roundTitle = this.config.uiText.roundTitle
        .replace('{round}', roundNumber.toString())
        .replace('{mode}', modeName);
    } else if (roundNumber === 3) {
      modeName = this.config.uiText.roundModes.bodypaddle;
      instructKey = 'bodypaddle';
      roundTitle = this.config.uiText.roundTitle
        .replace('{round}', roundNumber.toString())
        .replace('{mode}', modeName);
    }

    const titleFontSize = 48;
    const titleWidth = roundTitle.length * titleFontSize * 0.5;

    spriteManager.addSprite('text', {
      uniqueId: titleId,
      text: roundTitle,
      positionX: centerX - titleWidth / 2,
      positionY: centerY - 180,
      fontSize: titleFontSize,
      fontColor: titleColor,
    });
    this.roundCountdownSprites.push(titleId);

    // Instructions based on round
    const instructId = 'round_countdown_instruct';
    let instructions = this.config.uiText.roundInstructions[instructKey];
    if (!instructions && instructKey === 'suddendeath') {
      instructions = 'One life each. Last one standing wins!';
    }
    const instructFontSize = 24;
    const instructWidth = instructions.length * instructFontSize * 0.5;

    spriteManager.addSprite('text', {
      uniqueId: instructId,
      text: instructions,
      positionX: centerX - instructWidth / 2,
      positionY: centerY - 80,
      fontSize: instructFontSize,
      fontColor: roundNumber === 4 ? '#FFD700' : '#FFFFFF', // Gold for sudden death
    });
    this.roundCountdownSprites.push(instructId);

    // Add button hint visual for Round 2 (Button mode)
    if (roundNumber === 2) {
      // Show emoji button representation: ◀️ [paddle] ▶️
      const buttonHintId = 'round_countdown_button_hint';
      const buttonHintText = '◀️  ▬▬▬  ▶️';
      const buttonHintFontSize = 40;
      const buttonHintWidth = buttonHintText.length * buttonHintFontSize * 0.5;
      spriteManager.addSprite('text', {
        uniqueId: buttonHintId,
        text: buttonHintText,
        positionX: centerX - buttonHintWidth / 2,
        positionY: centerY - 30,
        fontSize: buttonHintFontSize,
        fontColor: '#FFFF00',
      });
      this.roundCountdownSprites.push(buttonHintId);

      // Additional hint below button visual
      const buttonExtraId = 'round_countdown_button_extra';
      const buttonExtraText = 'Look for buttons in your lane!';
      const buttonExtraFontSize = 18;
      const buttonExtraWidth =
        buttonExtraText.length * buttonExtraFontSize * 0.5;
      spriteManager.addSprite('text', {
        uniqueId: buttonExtraId,
        text: buttonExtraText,
        positionX: centerX - buttonExtraWidth / 2,
        positionY: centerY + 10,
        fontSize: buttonExtraFontSize,
        fontColor: '#AAFFAA',
      });
      this.roundCountdownSprites.push(buttonExtraId);
    }

    // Countdown number (centered) - positioned lower for Round 2 to make room for button hint
    const countId = 'round_countdown_number';
    const countFontSize = 120;
    const countText = secondsRemaining.toString();
    const countWidth = countText.length * countFontSize * 0.5;
    const countY = roundNumber === 2 ? centerY + 60 : centerY + 20;
    spriteManager.addSprite('text', {
      uniqueId: countId,
      text: countText,
      positionX: centerX - countWidth / 2,
      positionY: countY,
      fontSize: countFontSize,
      fontColor: '#FFD700',
    });
    this.roundCountdownSprites.push(countId);

    // Starting message - adjust position for Round 2
    const startId = 'round_countdown_start';
    const startText = this.config.uiText.startingIn;
    const startFontSize = 32;
    const startWidth = startText.length * startFontSize * 0.5;
    const startY = roundNumber === 2 ? centerY + 200 : centerY + 160;
    spriteManager.addSprite('text', {
      uniqueId: startId,
      text: startText,
      positionX: centerX - startWidth / 2,
      positionY: startY,
      fontSize: startFontSize,
      fontColor: '#AAAAAA',
    });
    this.roundCountdownSprites.push(startId);
  }

  /**
   * Update just the countdown number (NEW)
   */
  updateRoundCountdownNumber(secondsRemaining: number) {
    if (!playerManager.isHost) return;

    const countId = 'round_countdown_number';
    const sprite = spriteManager.getSprite(countId);
    if (sprite) {
      spriteManager.updateSprite(countId, {
        text: secondsRemaining.toString(),
      });
    }
  }

  /**
   * Hide round countdown (NEW)
   */
  hideRoundCountdown() {
    if (!playerManager.isHost) return;

    let index = 0;
    while (index < this.roundCountdownSprites.length) {
      const spriteId = this.roundCountdownSprites[index];
      if (spriteManager.getSprite(spriteId)) {
        spriteManager.removeSprite(spriteId);
      }
      index++;
    }

    this.roundCountdownSprites = [] as any;
  }

  /**
   * Show SUDDEN DEATH announcement (NEW)
   */
  showSuddenDeathAnnouncement() {
    if (!playerManager.isHost) return;

    this.hideRoundCountdown(); // Clear any existing countdown

    const centerX = this.config.centerX;
    const centerY = this.config.centerY;

    // Background overlay (dark red/dramatic)
    const bgId = 'sudden_death_bg';
    spriteManager.addSprite('rect', {
      uniqueId: bgId,
      positionX: centerX - 500,
      positionY: centerY - 300,
      width: 1000,
      height: 600,
      fill: '#330000', // Dark red
      opacity: 0.9,
    });
    this.roundCountdownSprites.push(bgId);

    // "SUDDEN DEATH!" title
    const titleId = 'sudden_death_title';
    const titleText = this.config.uiText.suddenDeathTitle;
    const sdTitleFontSize = 64;
    const titleWidth = titleText.length * sdTitleFontSize * 0.5;

    spriteManager.addSprite('text', {
      uniqueId: titleId,
      text: titleText,
      positionX: centerX - titleWidth / 2,
      positionY: centerY - 180,
      fontSize: sdTitleFontSize,
      fontColor: '#FF0000', // Bright red
    });
    this.roundCountdownSprites.push(titleId);

    // Rules text
    const rulesId = 'sudden_death_rules';
    const rulesText = this.config.uiText.suddenDeathRules;
    const rulesFontSize = 28;
    const rulesWidth = rulesText.length * rulesFontSize * 0.5;

    spriteManager.addSprite('text', {
      uniqueId: rulesId,
      text: rulesText,
      positionX: centerX - rulesWidth / 2,
      positionY: centerY - 60,
      fontSize: rulesFontSize,
      fontColor: '#FFD700', // Gold
    });
    this.roundCountdownSprites.push(rulesId);

    // "Starting in 3..." message
    const startId = 'sudden_death_start';
    const startText = 'Starting in 3...';
    const sdStartFontSize = 32;
    const startWidth = startText.length * sdStartFontSize * 0.5;

    spriteManager.addSprite('text', {
      uniqueId: startId,
      text: startText,
      positionX: centerX - startWidth / 2,
      positionY: centerY + 100,
      fontSize: sdStartFontSize,
      fontColor: '#FFFFFF',
    });
    this.roundCountdownSprites.push(startId);

    console.log('[PongUI] Showing SUDDEN DEATH announcement');
  }

  /**
   * Clear all UI elements
   */
  clearAllUI() {
    this.hideLobby();
    this.hideCountdown();
    this.hideScoreboard();
    this.hideLivesDisplay(); // NEW - clear lives display
    this.hideWinCount(); // NEW - clear win count display
    this.hideRoundSummary(); // NEW - Phase 5
    this.hideRoundCelebration(); // NEW - clear celebration
    this.hideRoundCountdown(); // NEW - clear round countdown
    this.hideGameOver();
  }

  /**
   * Clear all UI sprites (for host leave cleanup)
   */
  clearAllUISprites() {
    console.log('[PongUI] Clearing all UI sprites');
    this.clearAllUI();
  }
}
