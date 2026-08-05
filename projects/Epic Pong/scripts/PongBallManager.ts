class PongBallManager extends SystemScript {
  systemName: string;

  // --- Configuration Reference ---
  config: any; // PongConfigSystem
  gameManager: any; // PongGameManager
  paddleManager: any; // PongPaddleManager

  // --- Ball State (now supporting multiple balls) ---
  balls: any[]; // Array of ball objects: { id, x, y, velX, velY, speed, isActive }
  goalJustScored: boolean; // Prevents multiple goal triggers
  pendingGoals: any[]; // Goals to process after physics step

  // --- Player Count (for goal detection) ---
  playerCount: number;
  originalPlayerCount: number; // Original layout (2 or 4) - determines which edges are goal zones
  eliminatedTeams: string[]; // Teams eliminated in sudden death (walls, not goals)
  debugLogging: boolean;
  lastTouchPlayerId: number;
  lastTouchTeam: string;
  resetTimeoutId: any;

  // --- Fair Ball Launch Queue ---
  targetQueue: string[]; // Randomized queue of teams for fair ball targeting

  // --- Ball Emoji System ---
  teamEmojis: any; // Team -> emoji arrays
  funnyEmojis: string[]; // Fun emoji variations to occasionally use
  ballHitCount: number; // Track hits to trigger funny emojis

  onInit() {
    this.debugLogging = false;
    this.logDebug('[PongBM] Initializing ball manager');
    this.systemName = 'PongBallManager';

    // Get config
    scriptManager.attachSystem({ scriptId: 'PongConfigSystem' });
    this.config = scriptManager.getSystem({ systemName: 'PongConfigSystem' });

    // Get paddle manager reference
    this.paddleManager = scriptManager.getSystem({
      systemName: 'PongPaddleManager',
    });

    // Initialize ball state
    this.balls = []; // Array of ball objects
    this.goalJustScored = false;
    this.pendingGoals = []; // Goals to process after physics
    this.playerCount = 2;
    this.originalPlayerCount = 2; // Default to 2-player layout
    this.eliminatedTeams = []; // No teams eliminated initially
    this.targetQueue = []; // Fair ball launch queue - starts empty, filled on first use
    this.lastTouchPlayerId = 0;
    this.lastTouchTeam = '';
    this.resetTimeoutId = null;

    // Initialize ball emoji system
    this.ballHitCount = 0;
    this.teamEmojis = {
      red: ['🔴', '❤️', '🍎', '🎯'],
      blue: ['🔵', '💙', '🫐', '🧿'],
      green: ['🟢', '💚', '🥒', '🍀'],
      yellow: ['🟡', '💛', '⭐', '🌟'],
      white: ['⚪', '🤍', '⚾', '🥏'], // Default/neutral
    };
    this.funnyEmojis = [
      '🎱',
      '🏀',
      '⚽',
      '🎾',
      '🏐',
      '🥎',
      '🏈',
      '🎳',
      '💀',
      '👻',
      '🤪',
      '😈',
      '🔥',
      '💥',
      '⚡',
      '🌀',
      '💫',
      '🚀',
      '☄️',
      '🍩',
      '🍪',
      '🧀',
    ];
  }

  /**
   * Check if a team has been eliminated (their zone is now a wall)
   */
  isTeamEliminated(teamId: string): boolean {
    for (let i = 0; i < this.eliminatedTeams.length; i++) {
      if (this.eliminatedTeams[i] === teamId) return true;
    }
    return false;
  }

  /**
   * Mark a team as eliminated (called by GameManager during sudden death or player leave)
   */
  setTeamEliminated(teamId: string) {
    if (!this.isTeamEliminated(teamId)) {
      this.eliminatedTeams.push(teamId);
      console.log(
        '[PongBM] Team ' +
          teamId +
          ' marked as eliminated - their zone is now a wall',
      );

      // Also remove this team from the current target queue if present
      this.removeTeamFromQueue(teamId);
    }
  }

  /**
   * Remove a team from the target queue (e.g., when they leave or are eliminated)
   */
  removeTeamFromQueue(teamId: string) {
    const newQueue: string[] = [];
    for (let i = 0; i < this.targetQueue.length; i++) {
      if (this.targetQueue[i] !== teamId) {
        newQueue.push(this.targetQueue[i]);
      }
    }
    if (newQueue.length !== this.targetQueue.length) {
      console.log(
        '[PongBM] Removed ' +
          teamId +
          ' from target queue. Queue is now: ' +
          newQueue.join(','),
      );
    }
    this.targetQueue = newQueue;
  }

  /**
   * Clear eliminated teams (called when starting new round/tournament)
   */
  clearEliminatedTeams() {
    this.eliminatedTeams = [];
    this.targetQueue = []; // Reset queue so it refills with fresh shuffle for new round
    console.log('[PongBM] Cleared eliminated teams list and target queue');
  }

  logDebug(message: string, arg1?: any, arg2?: any) {
    if (!this.debugLogging) return;
    if (arg2 !== undefined) {
      console.log(message, arg1, arg2);
    } else if (arg1 !== undefined) {
      console.log(message, arg1);
    } else {
      console.log(message);
    }
  }

  /**
   * Refill and shuffle the target queue with all active (non-eliminated) teams.
   * Uses Fisher-Yates shuffle for fair randomization.
   */
  refillAndShuffleTargetQueue() {
    // Build list of active teams based on originalPlayerCount and eliminatedTeams
    const allTeams: string[] = ['red', 'blue'];
    if (this.originalPlayerCount === 4) {
      allTeams.push('green');
      allTeams.push('yellow');
    }

    // Filter out eliminated teams
    const activeTeams: string[] = [];
    for (let i = 0; i < allTeams.length; i++) {
      if (!this.isTeamEliminated(allTeams[i])) {
        activeTeams.push(allTeams[i]);
      }
    }

    // Fisher-Yates shuffle
    const shuffled = activeTeams.slice(); // copy
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }

    this.targetQueue = shuffled;
    console.log(
      '[PongBM] Refilled target queue: ' + this.targetQueue.join(','),
    );
  }

  /**
   * Get the next target team from the queue (round-robin fair system).
   * Refills and shuffles the queue if empty.
   */
  popNextTarget(): string {
    if (this.targetQueue.length === 0) {
      this.refillAndShuffleTargetQueue();
    }
    // Get first element manually (shift() may not work correctly on this platform)
    const target = this.targetQueue[0];
    // Remove first element by creating new array without it
    const newQueue: string[] = [];
    for (let i = 1; i < this.targetQueue.length; i++) {
      newQueue.push(this.targetQueue[i]);
    }
    this.targetQueue = newQueue;
    console.log(
      '[PongBM] Ball target: ' +
        target +
        ' (remaining in queue: ' +
        this.targetQueue.join(',') +
        ')',
    );
    return target;
  }

  /**
   * Reset ball to center with fair round-robin targeting
   * @param _targetTeam - IGNORED: kept for API compatibility, queue system now handles all targeting
   */
  resetBall(_targetTeam?: string) {
    if (!playerManager.isHost) return;

    // Always use round-robin queue for fair targeting (ignore any explicit target)
    const actualTarget = this.popNextTarget();

    this.logDebug('[PongBM] Resetting ball, target from queue:', actualTarget);

    // Reset goal flag to allow new goals
    this.goalJustScored = false;

    // Reset hit count for fresh funny emoji timing
    this.ballHitCount = 0;

    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    // Remove all existing balls
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const sprite = spriteManager.getSprite(ball.id);
      if (sprite) {
        spriteManager.removeSprite(ball.id);
      }
    }
    this.balls = [];

    // Position at center
    const ballX = this.config.centerX;
    const ballY = this.config.centerY;
    this.lastTouchPlayerId = 0;
    this.lastTouchTeam = '';

    let angle: number;

    // Aim toward the target team with ~20° angle variation for fairness
    // Red = top, Blue = bottom, Green = left, Yellow = right
    let baseAngle: number;
    if (actualTarget === 'red') {
      baseAngle = -Math.PI / 2; // 270 degrees (up toward red)
    } else if (actualTarget === 'blue') {
      baseAngle = Math.PI / 2; // 90 degrees (down toward blue)
    } else if (actualTarget === 'green') {
      baseAngle = Math.PI; // 180 degrees (left toward green)
    } else {
      // yellow
      baseAngle = 0; // 0 degrees (right toward yellow)
    }

    // Add ~20° angle variation (±10° = π/18 radians) for fairness
    // This prevents predictable ball patterns while still directing toward target
    const maxVariance = Math.PI / 9; // ~20 degrees total variation
    const variance = (Math.random() - 0.5) * 2 * maxVariance; // Range: -20° to +20°
    angle = baseAngle + variance;

    const speed = this.config.ballSpeedInitial;
    const ballVelX = Math.cos(angle) * speed;
    const ballVelY = Math.sin(angle) * speed;

    this.logDebug('[PongBM] Ball position: (' + ballX + ', ' + ballY + ')');
    this.logDebug(
      '[PongBM] Ball velocity: (' + ballVelX + ', ' + ballVelY + ')',
    );
    this.logDebug('[PongBM] Ball angle (degrees): ' + (angle * 180) / Math.PI);

    // Create primary ball sprite (emoji-based)
    const ballId = 'pong_ball';
    const ballEmoji = this.teamEmojis.white[0]; // Start white
    const ballFontSize = this.config.ballSize + 10; // Emoji needs slightly larger font

    spriteManager.addSprite('text', {
      uniqueId: ballId,
      text: ballEmoji,
      positionX: ballX - ballFontSize / 2, // Center emoji
      positionY: ballY - ballFontSize / 2,
      fontSize: ballFontSize,
      checkCollisions: true,
    });

    // Add to balls array
    this.balls.push({
      id: ballId,
      x: ballX,
      y: ballY,
      velX: ballVelX,
      velY: ballVelY,
      speed: speed,
      isActive: true,
    });

    this.logDebug('[PongBM] Ball is now active');
  }

  /**
   * Spawn an additional ball (multiball feature)
   * Creates a new ball with random direction for added chaos
   * Supports unlimited balls - each gets a unique ID
   */
  spawnAdditionalBall() {
    if (!playerManager.isHost) return;

    // Generate unique ball ID based on current ball count
    var ballNumber = this.balls.length + 1;
    var newBallId = 'pong_ball_' + ballNumber;

    // Extra ball colors to cycle through
    var extraBallColors = [
      '#FF00FF',
      '#00FFFF',
      '#FFFF00',
      '#FF8800',
      '#88FF00',
      '#FF0088',
    ];
    var colorIndex = (ballNumber - 2) % extraBallColors.length; // -2 because ball 1 is white
    var ballColor = extraBallColors[colorIndex];

    // Position at center with slight offset
    var offsetX = (Math.random() - 0.5) * 50;
    var offsetY = (Math.random() - 0.5) * 50;
    var ballX = this.config.centerX + offsetX;
    var ballY = this.config.centerY + offsetY;

    // Random angle
    var angle = Math.random() * 2 * Math.PI;
    var speed = this.config.ballSpeedInitial;
    var ballVelX = Math.cos(angle) * speed;
    var ballVelY = Math.sin(angle) * speed;

    // Extra balls use fun emojis cycling through the list
    var emojiIndex = (ballNumber - 2) % this.funnyEmojis.length;
    var ballEmoji = this.funnyEmojis[emojiIndex];
    var ballFontSize = this.config.ballSize + 10;

    // Create ball sprite (emoji-based)
    spriteManager.addSprite('text', {
      uniqueId: newBallId,
      text: ballEmoji,
      positionX: ballX - ballFontSize / 2,
      positionY: ballY - ballFontSize / 2,
      fontSize: ballFontSize,
      checkCollisions: true,
    });

    // Add to balls array
    this.balls.push({
      id: newBallId,
      x: ballX,
      y: ballY,
      velX: ballVelX,
      velY: ballVelY,
      speed: speed,
      isActive: true,
    });

    console.log(
      '[PongBM] Spawned ball #' +
        ballNumber +
        ' (' +
        newBallId +
        ') at (' +
        ballX +
        ', ' +
        ballY +
        ') color=' +
        ballColor,
    );
  }

  /**
   * Legacy alias for backward compatibility
   */
  spawnSecondBall() {
    this.spawnAdditionalBall();
  }

  /**
   * Stop ball movement
   */
  stopBall() {
    if (!playerManager.isHost) return;

    // Stop and remove all balls from the array
    for (var i = 0; i < this.balls.length; i++) {
      this.balls[i].isActive = false;
      this.balls[i].velX = 0;
      this.balls[i].velY = 0;
      // Remove the sprite
      var sprite = spriteManager.getSprite(this.balls[i].id);
      if (sprite) {
        spriteManager.removeSprite(this.balls[i].id);
      }
    }

    // Also check for any orphan ball sprites (safety cleanup)
    // Check up to 10 possible ball IDs
    for (var j = 1; j <= 10; j++) {
      var ballId = j === 1 ? 'pong_ball' : 'pong_ball_' + j;
      var orphanSprite = spriteManager.getSprite(ballId);
      if (orphanSprite) {
        spriteManager.removeSprite(ballId);
      }
    }

    // Clear the balls array since all sprites are gone
    this.balls = [];

    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  }

  /**
   * Handle collision events
   */
  onSpriteCollisionStart({
    sprite1,
    sprite2,
  }: {
    sprite1: PseudoSprite;
    sprite2: PseudoSprite;
  }) {
    if (!playerManager.isHost) return;
    if (this.balls.length === 0) return;
    if (!sprite1 || !sprite2) return;

    const spriteAId = sprite1.uniqueId || '';
    const spriteBId = sprite2.uniqueId || '';

    // Check if either sprite is a ball
    let ballSprite: PseudoSprite | null = null;
    let ballId = '';
    let otherSprite: PseudoSprite | null = null;

    // Check if sprite1 is a ball
    for (let i = 0; i < this.balls.length; i++) {
      if (spriteAId === this.balls[i].id) {
        ballSprite = sprite1;
        ballId = spriteAId;
        otherSprite = sprite2;
        break;
      }
    }

    // If not found, check if sprite2 is a ball
    if (!ballSprite) {
      for (let i = 0; i < this.balls.length; i++) {
        if (spriteBId === this.balls[i].id) {
          ballSprite = sprite2;
          ballId = spriteBId;
          otherSprite = sprite1;
          break;
        }
      }
    }

    // Neither sprite is a ball
    if (!ballSprite || !otherSprite || !ballId) return;

    const otherId = otherSprite.uniqueId || '';

    // Only handle paddle collisions (not ball-to-ball, those are handled in physics)
    if (otherId.indexOf('paddle_') !== 0) return;

    const paddleX =
      otherSprite.positionX !== undefined
        ? otherSprite.positionX
        : spriteManager.getProperty(otherId, 'positionX') || 0;
    const paddleY =
      otherSprite.positionY !== undefined
        ? otherSprite.positionY
        : spriteManager.getProperty(otherId, 'positionY') || 0;

    const paddlePlayerId = this.extractPlayerIdFromPaddleId(otherId);
    if (paddlePlayerId > 0) {
      this.lastTouchPlayerId = paddlePlayerId;
      if (!this.gameManager) {
        this.gameManager = scriptManager.getSystem({
          systemName: 'PongGameManager',
        });
      }
      if (this.gameManager && this.gameManager.getPlayerTeam) {
        const lastTeam = this.gameManager.getPlayerTeam(paddlePlayerId);
        this.lastTouchTeam = lastTeam || '';
      }
    }

    this.logDebug(
      '[PongBM] Ball collided with paddle: ' +
        otherId +
        ' at (' +
        paddleX +
        ', ' +
        paddleY +
        ')',
    );

    // Find the ball object
    let ball = null;
    for (let i = 0; i < this.balls.length; i++) {
      if (this.balls[i].id === ballId) {
        ball = this.balls[i];
        break;
      }
    }
    if (!ball) return;

    const normal = { x: 0, y: 0 };
    if (Math.abs(ball.y - paddleY) > Math.abs(ball.x - paddleX)) {
      normal.y = ball.y < paddleY ? -1 : 1;
      this.logDebug('[PongBM] Vertical collision - normal.y = ' + normal.y);
    } else {
      normal.x = ball.x < paddleX ? -1 : 1;
      this.logDebug('[PongBM] Horizontal collision - normal.x = ' + normal.x);
    }

    this.handlePaddleCollision(ball, { hit: true, normal: normal });
  }

  /**
   * Set player count for goal detection
   * @param count - current active player count
   * @param isOriginal - if true, also set originalPlayerCount (only on game start)
   */
  setPlayerCount(count: number, isOriginal?: boolean) {
    this.playerCount = count;
    if (isOriginal) {
      this.originalPlayerCount = count;
      console.log(
        '[PongBM] Set original player count to ' +
          count +
          ' (determines goal zone layout)',
      );
    }
  }

  /**
   * Update ball physics (called each frame)
   */
  onPhysicsStep() {
    if (!playerManager.isHost) return;
    if (this.balls.length === 0) return;

    // Update each ball
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (!ball.isActive) continue;

      // Update position
      ball.x += ball.velX;
      ball.y += ball.velY;

      // Check wall collisions and goals (queues goals, doesn't call onScore yet)
      this.checkWallCollisions(ball);

      // Check ball-to-ball collisions
      for (let j = i + 1; j < this.balls.length; j++) {
        const otherBall = this.balls[j];
        if (!otherBall.isActive) continue;
        this.checkBallToBallCollision(ball, otherBall);
      }

      // Update sprite position (only if still active)
      // Text sprites need offset adjustment for centering
      if (ball.isActive) {
        const ballFontSize = this.config.ballSize + 10;
        spriteManager.updateSprite(ball.id, {
          positionX: ball.x - ballFontSize / 2,
          positionY: ball.y - ballFontSize / 2,
        });
      }
    }

    // Remove inactive balls after physics loop completes
    for (let i = this.balls.length - 1; i >= 0; i--) {
      if (!this.balls[i].isActive) {
        this.balls.splice(i, 1);
      }
    }

    // Process all pending goals AFTER physics and array manipulation
    if (this.pendingGoals.length > 0) {
      // Process goals (use for loop instead of shift())
      for (let i = 0; i < this.pendingGoals.length; i++) {
        const goal = this.pendingGoals[i];
        if (goal) {
          this.handleGoal(goal.team, goal.ballId);
        }
      }
      // Clear the pending goals array
      this.pendingGoals = [];
    }
  }

  /**
   * Check collisions with play area boundaries
   * Ball bounces off play area edges and triggers goals
   */
  checkWallCollisions(ball: any) {
    // Skip if ball is already inactive (goal already scored)
    if (!ball.isActive) return;

    const ballSize = this.config.ballSize;
    const playAreaX = this.config.playAreaX;
    const playAreaY = this.config.playAreaY;
    const playAreaWidth = this.config.playAreaWidth;
    const playAreaHeight = this.config.playAreaHeight;

    const playAreaRight = playAreaX + playAreaWidth;
    const playAreaBottom = playAreaY + playAreaHeight;

    // Check left edge of play area (green team goal in 4-player, or wall if eliminated)
    if (ball.x <= playAreaX) {
      ball.x = playAreaX;
      ball.velX = Math.abs(ball.velX);
      // Add slight angle variation on wall bounce (±12 degrees)
      var angleVar = (Math.random() - 0.5) * (Math.PI / 7.5);
      var mag = Math.sqrt(ball.velX * ball.velX + ball.velY * ball.velY);
      var ang = Math.atan2(ball.velY, ball.velX) + angleVar;
      ball.velX = Math.cos(ang) * mag;
      ball.velY = Math.sin(ang) * mag;
      this.changeRandomBallColor(ball.id);

      // Goal for green team if original layout was 4 players AND green is not eliminated
      // (In sudden death, originalPlayerCount stays 4 even though active players may be 2)
      if (
        this.originalPlayerCount === 4 &&
        ball.isActive &&
        !this.isTeamEliminated('green')
      ) {
        ball.isActive = false;
        this.pendingGoals.push({ team: 'green', ballId: ball.id });
        return;
      }
      // If green is eliminated, ball just bounces (already handled by velX reversal)
    }

    // Check right edge of play area (yellow team goal in 4-player, or wall if eliminated)
    if (ball.x + ballSize >= playAreaRight) {
      ball.x = playAreaRight - ballSize;
      ball.velX = -Math.abs(ball.velX);
      // Add slight angle variation on wall bounce (±12 degrees)
      var angleVar2 = (Math.random() - 0.5) * (Math.PI / 7.5);
      var mag2 = Math.sqrt(ball.velX * ball.velX + ball.velY * ball.velY);
      var ang2 = Math.atan2(ball.velY, ball.velX) + angleVar2;
      ball.velX = Math.cos(ang2) * mag2;
      ball.velY = Math.sin(ang2) * mag2;
      this.changeRandomBallColor(ball.id);

      // Goal for yellow team if original layout was 4 players AND yellow is not eliminated
      // (In sudden death, originalPlayerCount stays 4 even though active players may be 2)
      if (
        this.originalPlayerCount === 4 &&
        ball.isActive &&
        !this.isTeamEliminated('yellow')
      ) {
        ball.isActive = false;
        this.pendingGoals.push({ team: 'yellow', ballId: ball.id });
        return;
      }
      // If yellow is eliminated, ball just bounces (already handled by velX reversal)
    }

    // Check top edge of play area (red team goal for 2 or 4 players, or wall if eliminated)
    if (ball.y <= playAreaY && ball.isActive) {
      ball.y = playAreaY;
      ball.velY = Math.abs(ball.velY);
      // Add slight angle variation on wall bounce (±12 degrees)
      var angleVar3 = (Math.random() - 0.5) * (Math.PI / 7.5);
      var mag3 = Math.sqrt(ball.velX * ball.velX + ball.velY * ball.velY);
      var ang3 = Math.atan2(ball.velY, ball.velX) + angleVar3;
      ball.velX = Math.cos(ang3) * mag3;
      ball.velY = Math.sin(ang3) * mag3;
      this.changeRandomBallColor(ball.id);

      // Goal for red team if not eliminated
      if (!this.isTeamEliminated('red')) {
        ball.isActive = false;
        this.pendingGoals.push({ team: 'red', ballId: ball.id });
        return;
      }
      // If red is eliminated, ball just bounces (already handled by velY reversal)
    }

    // Check bottom edge of play area (blue team goal for 2 or 4 players, or wall if eliminated)
    if (ball.y + ballSize >= playAreaBottom && ball.isActive) {
      ball.y = playAreaBottom - ballSize;
      ball.velY = -Math.abs(ball.velY);
      // Add slight angle variation on wall bounce (±12 degrees)
      var angleVar4 = (Math.random() - 0.5) * (Math.PI / 7.5);
      var mag4 = Math.sqrt(ball.velX * ball.velX + ball.velY * ball.velY);
      var ang4 = Math.atan2(ball.velY, ball.velX) + angleVar4;
      ball.velX = Math.cos(ang4) * mag4;
      ball.velY = Math.sin(ang4) * mag4;
      this.changeRandomBallColor(ball.id);

      // Goal for blue team if not eliminated
      if (!this.isTeamEliminated('blue')) {
        ball.isActive = false;
        this.pendingGoals.push({ team: 'blue', ballId: ball.id });
        return;
      }
      // If blue is eliminated, ball just bounces (already handled by velY reversal)
    }
  }

  /**
   * Check ball-to-ball collision and bounce them apart
   */
  checkBallToBallCollision(ball1: any, ball2: any) {
    const ballSize = this.config.ballSize;
    const halfSize = ballSize / 2;

    // Calculate centers
    const ball1CenterX = ball1.x + halfSize;
    const ball1CenterY = ball1.y + halfSize;
    const ball2CenterX = ball2.x + halfSize;
    const ball2CenterY = ball2.y + halfSize;

    // Calculate distance between centers
    const dx = ball2CenterX - ball1CenterX;
    const dy = ball2CenterY - ball1CenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Check if balls are colliding (distance less than sum of radii)
    const minDistance = ballSize; // Two balls touching
    if (distance < minDistance && distance > 0) {
      // Normalize collision vector
      const nx = dx / distance;
      const ny = dy / distance;

      // Relative velocity
      const dvx = ball2.velX - ball1.velX;
      const dvy = ball2.velY - ball1.velY;

      // Relative velocity in collision normal direction
      const dvn = dvx * nx + dvy * ny;

      // Do not resolve if velocities are separating
      if (dvn < 0) return;

      // Reflect velocities (elastic collision with equal mass)
      ball1.velX += dvn * nx;
      ball1.velY += dvn * ny;
      ball2.velX -= dvn * nx;
      ball2.velY -= dvn * ny;

      // Separate balls to prevent overlap
      const overlap = minDistance - distance;
      const separateX = (overlap / 2) * nx;
      const separateY = (overlap / 2) * ny;
      ball1.x -= separateX;
      ball1.y -= separateY;
      ball2.x += separateX;
      ball2.y += separateY;

      // Change colors on collision
      this.changeRandomBallColor(ball1.id);
      this.changeRandomBallColor(ball2.id);

      console.log('[PongBM] Ball-to-ball collision detected');
    }
  }

  /**
   * Handle goal scored against a team
   * Called AFTER physics loop completes
   */
  handleGoal(scoredAgainstTeam: string, ballId: string) {
    console.log(
      '[PongBM] Goal scored against: ' +
        scoredAgainstTeam +
        ' by ball: ' +
        ballId,
    );

    // Remove the ball sprite (ball is already marked inactive and removed from array)
    const sprite = spriteManager.getSprite(ballId);
    if (sprite) {
      spriteManager.removeSprite(ballId);
    }

    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }

    if (!this.gameManager) {
      this.gameManager = scriptManager.getSystem({
        systemName: 'PongGameManager',
      });
    }

    // Pass the zone that was entered to game manager
    // Game manager will determine who gets the point based on player count
    if (this.gameManager) {
      this.gameManager.onScore(scoredAgainstTeam, this.lastTouchTeam);
    }

    this.lastTouchPlayerId = 0;
    this.lastTouchTeam = '';
  }

  /**
   * Handle paddle collision (bounce)
   */
  handlePaddleCollision(ball: any, collision: any) {
    // Get the paddle's team to determine correct bounce direction
    const paddleTeam = this.lastTouchTeam;

    // Determine correct bounce direction based on paddle position/team
    // This ensures ball always bounces AWAY from the paddle's goal
    if (paddleTeam === 'red') {
      // Red is at top (y = paddleOffset), ball should bounce DOWN (positive Y)
      ball.velY = Math.abs(ball.velY);
      // Reflect X normally
      if (collision.normal.x !== 0) {
        ball.velX = -ball.velX;
      }
    } else if (paddleTeam === 'blue') {
      // Blue is at bottom (y = worldHeight - paddleOffset), ball should bounce UP (negative Y)
      ball.velY = -Math.abs(ball.velY);
      // Reflect X normally
      if (collision.normal.x !== 0) {
        ball.velX = -ball.velX;
      }
    } else if (paddleTeam === 'green') {
      // Green is at left (x = paddleOffset), ball should bounce RIGHT (positive X)
      ball.velX = Math.abs(ball.velX);
      // Reflect Y normally
      if (collision.normal.y !== 0) {
        ball.velY = -ball.velY;
      }
    } else if (paddleTeam === 'yellow') {
      // Yellow is at right (x = worldWidth - paddleOffset), ball should bounce LEFT (negative X)
      ball.velX = -Math.abs(ball.velX);
      // Reflect Y normally
      if (collision.normal.y !== 0) {
        ball.velY = -ball.velY;
      }
    } else {
      // Fallback: use simple reflection if team not identified
      if (collision.normal.x !== 0) {
        ball.velX = -ball.velX;
      }
      if (collision.normal.y !== 0) {
        ball.velY = -ball.velY;
      }
    }

    // Increase speed slightly
    ball.speed = Math.min(
      ball.speed + this.config.ballSpeedIncrement,
      this.config.ballSpeedMax,
    );

    // Add random angle variation to prevent stuck horizontal/vertical patterns
    // Varies by ±20 degrees (π/9 radians)
    var currentAngle = Math.atan2(ball.velY, ball.velX);
    var angleVariation = (Math.random() - 0.5) * (Math.PI / 4.5); // ±20 degrees
    var newAngle = currentAngle + angleVariation;

    // Apply new angle with current speed
    ball.velX = Math.cos(newAngle) * ball.speed;
    ball.velY = Math.sin(newAngle) * ball.speed;

    // Move ball outside paddle to prevent double-collision
    const pushDistance = 3;
    ball.x += collision.normal.x * pushDistance;
    ball.y += collision.normal.y * pushDistance;

    // Change ball color on collision
    this.changeRandomBallColor(ball.id);

    // Flash the paddle
    if (this.paddleManager && collision.paddleId) {
      this.paddleManager.flashPaddle(collision.paddleId);
    }

    // Notify game manager of paddle hit (for multiball tracking)
    if (this.gameManager && this.gameManager.onPaddleHit) {
      this.gameManager.onPaddleHit();
    }
  }

  /**
   * Remove all balls
   */
  removeBall() {
    if (!playerManager.isHost) return;

    // Remove all balls
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      const sprite = spriteManager.getSprite(ball.id);
      if (sprite) {
        spriteManager.removeSprite(ball.id);
        console.log('[PongBM] Removed ball: ' + ball.id);
      }
    }

    // Clear the balls array
    this.balls = [];

    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
  }

  extractPlayerIdFromPaddleId(paddleId: string): number {
    const prefix = 'paddle_';
    if (paddleId.indexOf(prefix) !== 0) return -1;
    const suffixIndex = paddleId.lastIndexOf('_');
    if (suffixIndex === -1) return -1;
    const idStr = paddleId.substring(prefix.length, suffixIndex);
    const parsed = parseInt(idStr, 10);
    return isNaN(parsed) ? -1 : parsed;
  }

  resolveScoringTeam(scoredAgainstTeam: string): string {
    if (this.lastTouchTeam) return this.lastTouchTeam;
    if (!this.gameManager) return '';

    const teamOrder = ['red', 'blue', 'green', 'yellow'];
    for (let i = 0; i < teamOrder.length; i++) {
      const candidate = teamOrder[i];
      if (candidate === scoredAgainstTeam) continue;
      if (this.getTeamSize(candidate) > 0) return candidate;
    }
    return '';
  }

  getTeamSize(teamId: string): number {
    if (!this.gameManager) return 0;
    if (teamId === 'red')
      return this.gameManager.teamRed ? this.gameManager.teamRed.length : 0;
    if (teamId === 'blue')
      return this.gameManager.teamBlue ? this.gameManager.teamBlue.length : 0;
    if (teamId === 'green')
      return this.gameManager.teamGreen ? this.gameManager.teamGreen.length : 0;
    if (teamId === 'yellow')
      return this.gameManager.teamYellow
        ? this.gameManager.teamYellow.length
        : 0;
    return 0;
  }

  /**
   * Change ball emoji based on last hit team
   * Occasionally uses fun emojis for chaos!
   */
  changeRandomBallColor(ballId: string) {
    if (!playerManager.isHost) return;

    // Increment hit count
    this.ballHitCount++;

    // Color variations for background based on team
    const teamBgColors: any = {
      red: ['#1A0808', '#2D1010', '#1A0A0A', '#250C0C'],
      blue: ['#08081A', '#10102D', '#0A0A1A', '#0C0C25'],
      green: ['#081A08', '#102D10', '#0A1A0A', '#0C250C'],
      yellow: ['#1A1A08', '#2D2D10', '#1A1A0A', '#25250C'],
    };

    let ballEmoji = '';
    let bgColor = '#1A1A1A'; // Default dark

    // Every 10 hits, use a random funny emoji!
    if (this.ballHitCount % 10 === 0) {
      ballEmoji =
        this.funnyEmojis[Math.floor(Math.random() * this.funnyEmojis.length)];
      console.log('[PongBM] FUNNY BALL! ' + ballEmoji);
    } else if (this.lastTouchTeam && this.teamEmojis[this.lastTouchTeam]) {
      // Use team emoji
      const teamEmojiList = this.teamEmojis[this.lastTouchTeam];
      ballEmoji =
        teamEmojiList[Math.floor(Math.random() * teamEmojiList.length)];

      // Get team background color
      const bgColors = teamBgColors[this.lastTouchTeam];
      if (bgColors) {
        bgColor = bgColors[Math.floor(Math.random() * bgColors.length)];
      }
    } else {
      // Default white
      ballEmoji =
        this.teamEmojis.white[
          Math.floor(Math.random() * this.teamEmojis.white.length)
        ];
    }

    // Update ball emoji
    spriteManager.updateSprite(ballId, {
      text: ballEmoji,
    });

    // Update background color through UIManager (only for primary ball)
    if (
      ballId === 'pong_ball' &&
      this.gameManager &&
      this.gameManager.uiManager
    ) {
      this.gameManager.uiManager.updatePlayAreaColor(bgColor);
    }
  }
}
