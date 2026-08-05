class GameManager extends SystemScript {
  safeZoneY: number;
  safeZoneWidth: number;
  safeZoneHeight: number;
  currentState: string;
  timerManager: PseudoAny;
  stoplightManager: PseudoAny;
  movementDetector: PseudoAny;
  wallManager: PseudoAny;
  roundResultsManager: PseudoAny;
  hasStartedGame: boolean;
  barrierSprite: PseudoSprite | null;
  topBarrierSprite: PseudoSprite | null;
  finishLineSprite: PseudoSprite | null;
  leftWallSprite: PseudoSprite | null;
  rightWallSprite: PseudoSprite | null;
  lobbySprite: PseudoSprite | null;
  startButtonSprite: PseudoSprite | null;
  hostStartButtonSprite: PseudoSprite | null;
  lobbyBackgroundSprite: PseudoSprite | null;
  startButtonBackgroundSprite: PseudoSprite | null;
  hostStartButtonBackgroundSprite: PseudoSprite | null;
  notEnoughPlayersTimer: PseudoTimer | null;
  barrierY: number;
  finishLineY: number;
  worldWidth: number;
  worldHeight: number;
  hostId: number;
  lightControlMode: string;
  obstacleGenerationType: string;
  successfulRoundStartCount: number;
  maxSuccessfulRoundStartsBeforeClose: number;
  minimumPlayersToStart: number;
  isGameClosing: boolean;
  pendingLeaderId: number;
  roundSelectionLeaderId: number;
  maxRoundFinishers: number;
  autoModeRoundFinishCountdownSeconds: number;
  roundSelectionTeleportX: number;
  roundSelectionTeleportY: number;
  roundSelectionTeleportWidth: number;
  roundSelectionTeleportHeight: number;
  pendingActiveRoundSetup: boolean;
  pendingActiveRoundLeaderId: number;
  roundStartAnalyticsLogged: boolean;
  roundCompletionAnalyticsLogged: boolean;

  constructor() {
    if (!playerManager.isHost) return;
    this.safeZoneY = 1300;
    this.safeZoneWidth = 1500;
    this.safeZoneHeight = 200;
    this.barrierY = 1250;
    this.finishLineY = 160;
    this.worldWidth = 1500;
    this.worldHeight = 1500;
    this.currentState = 'WAITING';
    this.timerManager = null;
    this.stoplightManager = null;
    this.movementDetector = null;
    this.wallManager = null;
    this.roundResultsManager = null;
    this.hasStartedGame = false;
    this.barrierSprite = null;
    this.topBarrierSprite = null;
    this.finishLineSprite = null;
    this.leftWallSprite = null;
    this.rightWallSprite = null;
    this.lobbySprite = null;
    this.startButtonSprite = null;
    this.hostStartButtonSprite = null;
    this.lobbyBackgroundSprite = null;
    this.startButtonBackgroundSprite = null;
    this.hostStartButtonBackgroundSprite = null;
    this.notEnoughPlayersTimer = null;
    this.hostId = 0;
    this.lightControlMode = 'auto';
    this.obstacleGenerationType = 'set';
    this.successfulRoundStartCount = 0;
    this.maxSuccessfulRoundStartsBeforeClose = 8;
    this.minimumPlayersToStart = 2;
    this.isGameClosing = false;
    this.pendingLeaderId = 0;
    this.roundSelectionLeaderId = 0;
    this.maxRoundFinishers = 3;
    this.autoModeRoundFinishCountdownSeconds = 30;
    this.roundSelectionTeleportX = 450;
    this.roundSelectionTeleportY = 450;
    this.roundSelectionTeleportWidth = 600;
    this.roundSelectionTeleportHeight = 100;
    this.pendingActiveRoundSetup = false;
    this.pendingActiveRoundLeaderId = 0;
    this.roundStartAnalyticsLogged = false;
    this.roundCompletionAnalyticsLogged = false;
  }

  onInit() {
    if (playerManager.isHost) {
      this.hostId = playerManager.getMyPlayerId();
    }

    const playerIds = playerManager.getPlayerIds();
    for (let i = 0; i < playerIds.length; i++) {
      this.setInGameNameplate(playerIds[i]);
    }

    if (!playerManager.isHost) return;

    spriteManager.addSprite('topframe', { uniqueId: 'topframe', positionX: -145, positionY: -95, width: 1790, height: 200, checkCollisions: false });
    spriteManager.addSprite('bottomframe', { uniqueId: 'bottomframe', positionX: -145, positionY: 780, width: 1790, height: 200, checkCollisions: false });

    this.finishLineSprite = spriteManager.addSprite('finishLine', { uniqueId: 'finishLine', positionX: 0, positionY: 0, checkCollisions: false });
    spriteManager.addSprite('gameStage', { uniqueId: 'gameStage', positionX: 50, positionY: 200, checkCollisions: false });
    spriteManager.addSprite('safeZone', { uniqueId: 'safeZone', positionX: 0, positionY: this.safeZoneY, checkCollisions: false });

    this.leftWallSprite = spriteManager.addSprite('sideBarrier', { uniqueId: 'leftWall', positionX: 0, positionY: 0, checkCollisions: true, isImpassable: true, isPlayerControlled: false });
    if (this.leftWallSprite) this.leftWallSprite.attachComponent({ scriptId: 'SideWall' });

    this.rightWallSprite = spriteManager.addSprite('sideBarrier', { uniqueId: 'rightWall', positionX: this.worldWidth - 50, positionY: 0, checkCollisions: true, isImpassable: true, isPlayerControlled: false });
    if (this.rightWallSprite) this.rightWallSprite.attachComponent({ scriptId: 'SideWall' });

    this.ensureTopBoundaryBarrier();
    this.restoreBarrier();

    this.showLobby();
  }

  showLobby() {
    if (!playerManager.isHost) return;
    let hostName = 'Host';
    if (this.hostId) {
      const hostDetails = playerManager.getPlayerDetails(this.hostId);
      hostName = hostDetails && hostDetails.username ? hostDetails.username : 'Host';
    }

    const playerCount = playerManager.getPlayerIds().length;
    const lobbyText = `Waiting for ${hostName} to start the game...\n\nPlayers: ${playerCount}`;
    const lobbyBackgroundDimensions = this.getTextBackgroundDimensions(lobbyText, 40, 35, 12);

    this.lobbyBackgroundSprite = spriteManager.addSprite('baseRect', {
      uniqueId: 'lobbyMessageBackground',
      positionX: this.getCenteredTextBackgroundPositionX(lobbyBackgroundDimensions.width),
      positionY: 388,
      width: lobbyBackgroundDimensions.width,
      height: lobbyBackgroundDimensions.height,
      fill: "rgba(18, 22, 14, 1)",
      borderRadius: 18,
      topAdjust: 1000,
    });

    this.lobbySprite = spriteManager.addSprite('countdownText', {
      uniqueId: 'lobbyMessage',
      positionX: 0,
      positionY: 400,
      text: lobbyText,
      fontSize: 40,
      align: 'center',
      topAdjust: 2000,
    });

    const startButtonText = this.getStartButtonText();
    const startButtonBackgroundDimensions = this.getTextBackgroundDimensions(startButtonText, 40, 35, 12);

    this.startButtonBackgroundSprite = spriteManager.addSprite('baseRect', {
      uniqueId: 'startButtonBackground',
      positionX: this.getCenteredTextBackgroundPositionX(startButtonBackgroundDimensions.width),
      positionY: 738,
      width: startButtonBackgroundDimensions.width,
      height: startButtonBackgroundDimensions.height,
      fill: "rgba(18, 22, 14, 1)",
      borderRadius: 18,
      topAdjust: 1000,
      isPlayerControlled: true,
    });

    this.startButtonSprite = spriteManager.addSprite('countdownText', {
      uniqueId: 'startButton',
      positionX: 0,
      positionY: 750,
      text: startButtonText,
      fontSize: 40,
      align: 'center',
      isInteractive: true,
      isPlayerControlled: true,
      topAdjust: 2000,
    });

    this.ensureHostStartButton();
    if (playerCount > 0 && playerCount < this.minimumPlayersToStart) {
      this.setWorldActivity('GAME_WAITING');
    }
  }

  clearLobby() {
    this.clearNotEnoughPlayersTimer();
    if (this.lobbySprite) {
      spriteManager.removeSprite('lobbyMessage');
      this.lobbySprite = null;
    }
    if (this.lobbyBackgroundSprite) {
      spriteManager.removeSprite('lobbyMessageBackground');
      this.lobbyBackgroundSprite = null;
    }
    if (this.startButtonSprite) {
      spriteManager.removeSprite('startButton');
      this.startButtonSprite = null;
    }
    if (this.startButtonBackgroundSprite) {
      spriteManager.removeSprite('startButtonBackground');
      this.startButtonBackgroundSprite = null;
    }
    if (this.hostStartButtonSprite) {
      spriteManager.removeSprite('hostStartButton');
      this.hostStartButtonSprite = null;
    }
    if (this.hostStartButtonBackgroundSprite) {
      spriteManager.removeSprite('hostStartButtonBackground');
      this.hostStartButtonBackgroundSprite = null;
    }
  }

  onHostStart() {
    if (!this.hostId || this.hostId === 0) {
      this.hostId = playerManager.getMyPlayerId();
    }
    this.refreshModeConfiguration();
    this.timerManager = scriptManager.getSystem({ systemName: 'TimerManager' });
    this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
    this.movementDetector = scriptManager.getSystem({ systemName: 'MovementDetector' });
    this.wallManager = scriptManager.getSystem({ systemName: 'WallManager' });
    this.roundResultsManager = scriptManager.getSystem({ systemName: 'RoundResultsManager' });
    this.ensureTopBoundaryBarrier();

    if (this.currentState === 'WAITING') {
      if (this.lobbySprite) {
        this.updateLobbyPlayerCount();
      }
      this.ensureHostStartButton();
    }
  }

  getStartButtonText(): string {
    return 'Click here to start!';
  }

  getHostStartButtonPosition(): { positionX: number; positionY: number } | null {
    if (!this.hostId) return null;

    const hostDetails = playerManager.getPlayerDetails(this.hostId);
    if (!hostDetails) return null;

    return {
      positionX: hostDetails.x + -500,
      positionY: hostDetails.y + 10,
    };
  }

  ensureHostStartButton() {
    if (!playerManager.isHost) return;

    const hostButtonPosition = this.getHostStartButtonPosition();
    if (!hostButtonPosition) return;

    this.ensureHostStartButtonBackground(hostButtonPosition.positionX, hostButtonPosition.positionY);

    if (!this.hostStartButtonSprite) {
      this.hostStartButtonSprite = spriteManager.addSprite('countdownText', {
        uniqueId: 'hostStartButton',
        positionX: hostButtonPosition.positionX,
        positionY: hostButtonPosition.positionY,
        text: this.getStartButtonText(),
        fontSize: 32,
        align: 'center',
        isInteractive: true,
        isPlayerControlled: true,
        topAdjust: 2000,
      });
      return;
    }

    spriteManager.updateSprite('hostStartButton', {
      positionX: hostButtonPosition.positionX,
      positionY: hostButtonPosition.positionY,
      text: this.getStartButtonText(),
    });
  }

  updateHostStartButtonPosition() {
    if (!playerManager.isHost) return;
    if (!this.hostStartButtonSprite) {
      this.ensureHostStartButton();
      return;
    }

    const hostButtonPosition = this.getHostStartButtonPosition();
    if (!hostButtonPosition) return;

    this.ensureHostStartButtonBackground(hostButtonPosition.positionX, hostButtonPosition.positionY);

    spriteManager.updateSprite('hostStartButton', {
      positionX: hostButtonPosition.positionX,
      positionY: hostButtonPosition.positionY,
      text: this.getStartButtonText(),
      isInteractive: true,
    });
  }

  ensureHostStartButtonBackground(positionX: number, positionY: number) {
    const hostStartButtonBackgroundDimensions = this.getTextBackgroundDimensions(this.getStartButtonText(), 32, 30, 10);
    const backgroundPositionX = positionX + (this.worldWidth - hostStartButtonBackgroundDimensions.width) / 2;

    if (this.hostStartButtonBackgroundSprite) {
      spriteManager.updateSprite('hostStartButtonBackground', {
        positionX: backgroundPositionX,
        positionY: positionY - 10,
        width: hostStartButtonBackgroundDimensions.width,
        height: hostStartButtonBackgroundDimensions.height,
      });
      return;
    }

    this.hostStartButtonBackgroundSprite = spriteManager.addSprite('baseRect', {
      uniqueId: 'hostStartButtonBackground',
      positionX: backgroundPositionX,
      positionY: positionY - 10,
      width: hostStartButtonBackgroundDimensions.width,
      height: hostStartButtonBackgroundDimensions.height,
      fill: "rgba(18, 22, 14, 1)",
      borderRadius: 16,
      topAdjust: 1000,
      isPlayerControlled: true,
    });
  }

  getTextBackgroundDimensions(text: string, fontSize: number, horizontalPadding: number, verticalPadding: number): { width: number; height: number } {
    let longestLineLength = 0;
    let currentLineLength = 0;
    let lineCount = 1;

    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) === '\n') {
        if (currentLineLength > longestLineLength) longestLineLength = currentLineLength;
        currentLineLength = 0;
        lineCount++;
      } else {
        currentLineLength++;
      }
    }

    if (currentLineLength > longestLineLength) longestLineLength = currentLineLength;

    return {
      width: longestLineLength * fontSize * 0.63 + horizontalPadding * 2,
      height: lineCount * fontSize * 1.2 + verticalPadding * 2,
    };
  }

  getCenteredTextBackgroundPositionX(width: number): number {
    return (this.worldWidth - width) / 2;
  }

  clearNotEnoughPlayersTimer() {
    if (!this.notEnoughPlayersTimer) return;

    this.notEnoughPlayersTimer.destroy();
    this.notEnoughPlayersTimer = null;
  }

  showNotEnoughPlayersFeedback() {
    this.clearNotEnoughPlayersTimer();

    if (this.startButtonSprite) {
      spriteManager.updateSprite('startButton', {
        text: 'Not enough players',
      });
    }

    if (this.hostStartButtonSprite) {
      spriteManager.updateSprite('hostStartButton', {
        text: 'Not enough players',
      });
    }

    this.notEnoughPlayersTimer = timerManager.createTimer({
      autoplay: true,
      duration: 1500,
      loop: false,
      onComplete: () => {
        if (!playerManager.isHost) return;
        this.notEnoughPlayersTimer = null;
        if (this.currentState !== 'WAITING') return;

        if (this.startButtonSprite) {
          spriteManager.updateSprite('startButton', {
            text: this.getStartButtonText(),
          });
        }

        if (this.hostStartButtonSprite) {
          spriteManager.updateSprite('hostStartButton', {
            text: this.getStartButtonText(),
          });
        }
      },
    });
  }

  getConfigurationString(variableId: string, defaultValue: string): string {
    try {
      return stateManager.getVariable(variableId as any);
    } catch (error) {}
    return defaultValue;
  }

  refreshModeConfiguration() {
    const configuredLightControlMode = this.getConfigurationString('lightControlMode', 'auto');
    this.lightControlMode = configuredLightControlMode === 'user' ? 'user' : 'auto';

    const configuredObstacleGenerationType = this.getConfigurationString('obstacleGenerationType', 'set');
    this.obstacleGenerationType = configuredObstacleGenerationType === 'random' ? 'random' : 'set';
  }

  setInGameNameplate(playerId: number) {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    const username = playerDetails && playerDetails.username ? playerDetails.username : `Player ${playerId}`;
    playerManager.setNameplate(playerId, '\uD83D\uDEA6 ' + username + ' \uD83D\uDEA6');
  }

  onPlayerJoined({ playerId }) {
    this.logJoinAnalytics(playerId);
    this.setInGameNameplate(playerId);
    this.teleportToSafeZone(playerId);

    if (this.currentState === 'WAITING' && this.lobbySprite) {
      this.updateLobbyPlayerCount();
    }
  }

  updateLobbyPlayerCount() {
    const playerCount = playerManager.getPlayerIds().length;
    let hostName = 'Host';
    if (this.hostId) {
      const hostDetails = playerManager.getPlayerDetails(this.hostId);
      hostName = hostDetails && hostDetails.username ? hostDetails.username : 'Host';
    }
    const lobbyText = `Waiting for ${hostName} to start the game...\n\nPlayers: ${playerCount}`;
    const lobbyBackgroundDimensions = this.getTextBackgroundDimensions(lobbyText, 40, 35, 12);

    spriteManager.updateSprite('lobbyMessage', { text: lobbyText });

    if (this.lobbyBackgroundSprite) {
      spriteManager.updateSprite(this.lobbyBackgroundSprite.uniqueId, {
        positionX: this.getCenteredTextBackgroundPositionX(lobbyBackgroundDimensions.width),
        positionY: 388,
        width: lobbyBackgroundDimensions.width,
        height: lobbyBackgroundDimensions.height,
      });
    }
  }

  getRoundResultsManager() {
    if (!this.roundResultsManager) {
      this.roundResultsManager = scriptManager.getSystem({ systemName: 'RoundResultsManager' });
    }

    return this.roundResultsManager;
  }

  getTimerManager() {
    if (!this.timerManager) {
      this.timerManager = scriptManager.getSystem({ systemName: 'TimerManager' });
    }

    return this.timerManager;
  }

  onPlayerLeft({ playerId }) {
    if (!playerManager.isHost) return;

    this.teleportPlayerToOrigin(playerId);

    if (this.isGameClosing) return;

    if (this.currentState === 'WAITING' && this.lobbySprite) {
      this.updateLobbyPlayerCount();
      return;
    }

    if (this.currentState === 'ROUND_SELECTION') {
      if (!this.hasEnoughPlayersToStart()) {
        this.resetToWaitingState();
      }
      return;
    }

    if (this.currentState !== 'ACTIVE') return;

    this.evaluateRemainingPlayersAfterLeave();
  }

  teleportPlayerToOrigin(playerId: number) {
    try {
      playerManager.teleportPlayers([playerId], {
        distributionType: 'area',
        positionX: 0,
        positionY: 0,
        width: 1,
        height: 1,
      });
    } catch (error) {}
  }

  getConnectedPlayerIds(): number[] {
    return playerManager.getPlayerIds();
  }

  hasEnoughPlayersToStart(): boolean {
    return this.getConnectedPlayerIds().length >= this.minimumPlayersToStart;
  }

  isPlayerConnected(playerId: number): boolean {
    if (!playerId) return false;

    const playerIds = this.getConnectedPlayerIds();
    for (let i = 0; i < playerIds.length; i++) {
      if (playerIds[i] === playerId) return true;
    }

    return false;
  }

  getContenderPlayerIds(): number[] {
    const playerIds = this.getConnectedPlayerIds();
    const contenderPlayerIds: number[] = [];
    const roundResultsManager = this.getRoundResultsManager();

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      if (this.isPlayerCurrentLightController(playerId)) continue;
      if (roundResultsManager && roundResultsManager.isPlayerFinisher && roundResultsManager.isPlayerFinisher(playerId)) continue;
      contenderPlayerIds.push(playerId);
    }

    return contenderPlayerIds;
  }

  getRoundFinisherCount(): number {
    const roundResultsManager = this.getRoundResultsManager();
    if (!roundResultsManager || !roundResultsManager.getFinisherCount) return 0;
    return roundResultsManager.getFinisherCount();
  }

  isPlayerRoundFinisher(playerId: number): boolean {
    if (!playerId) return false;

    const roundResultsManager = this.getRoundResultsManager();
    if (!roundResultsManager || !roundResultsManager.isPlayerFinisher) return false;

    return roundResultsManager.isPlayerFinisher(playerId);
  }

  evaluateRemainingPlayersAfterLeave() {
    const playerIds = this.getConnectedPlayerIds();
    const contenderPlayerIds = this.getContenderPlayerIds();
    const finisherCount = this.getRoundFinisherCount();

    if (finisherCount === 0 && contenderPlayerIds.length === 1) {
      this.handlePlayerFinished(contenderPlayerIds[0]);
      return;
    }

    if (finisherCount > 0) {
      if (finisherCount >= this.maxRoundFinishers || contenderPlayerIds.length === 0) {
        this.completeRoundAfterFinish();
        return;
      }
    }

    if (this.lightControlMode !== 'user') return;
    if (contenderPlayerIds.length !== 0) return;
    if (playerIds.length !== 1) return;

    if (this.isPlayerCurrentLightController(playerIds[0])) {
      this.abortCurrentGame();
    }
  }

  onSpriteClicked(params: { event: PseudoAny; sprite: PseudoSprite }) {
    if (
      (params.sprite.uniqueId === 'startButton' || params.sprite.uniqueId === 'hostStartButton') &&
      this.currentState === 'WAITING'
    ) {
      this.startGame();
    }
  }

  startGame() {
    if (!playerManager.isHost) return;
    if (this.hasStartedGame) return;

    if (!this.hasEnoughPlayersToStart()) {
      this.showNotEnoughPlayersFeedback();
      return;
    }

    this.hasStartedGame = true;
    this.clearLobby();
    eventManager.emit('gameStart', {});
  }

  beginRoundCountdown() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'WAITING' && this.currentState !== 'ROUND_SELECTION') return;

    if (!this.hasEnoughPlayersToStart()) {
      if (this.currentState === 'WAITING') {
        this.showNotEnoughPlayersFeedback();
        return;
      }

      this.resetToWaitingState();
      return;
    }

    if (this.successfulRoundStartCount >= this.maxSuccessfulRoundStartsBeforeClose) {
      this.closeExperience();
      return;
    }

    this.getTimerManager();

    this.clearPendingActiveRoundSetup();
    this.restoreBarrier();
    this.roundStartAnalyticsLogged = false;
    this.roundCompletionAnalyticsLogged = false;
    this.currentState = 'COUNTDOWN';
    this.hasStartedGame = true;

    if (this.timerManager) {
      this.timerManager.startCountdown(5);
    }
  }

  teleportToSafeZone(playerId: number, keepXPosition: boolean = false, includeRoundFinishers: boolean = false) {
    if (!includeRoundFinishers && this.isPlayerRoundFinisher(playerId)) return;

    let teleportOptions;

    if (keepXPosition) {
      const playerDetails = playerManager.getPlayerDetails(playerId);
      const currentX = playerDetails && playerDetails.x !== undefined ? playerDetails.x : this.safeZoneWidth / 2;
      teleportOptions = { distributionType: 'area' as const, positionX: currentX, positionY: this.safeZoneY, height: 0, width: 0 };
    } else {
      teleportOptions = { distributionType: 'area' as const, positionX: 0, positionY: this.safeZoneY, height: this.safeZoneHeight, width: this.safeZoneWidth };
    }

    playerManager.teleportPlayers([playerId], teleportOptions);
  }

  onEvent_gameStart() {
    if (this.currentState !== 'WAITING') return;
    this.beginRoundCountdown();
  }

  createBarrier() {
    if (!playerManager.isHost) return;

    const existingBarrierSprite = spriteManager.getSprite('barrierLine');
    if (existingBarrierSprite) {
      spriteManager.removeSprite(existingBarrierSprite.uniqueId);
    }

    this.barrierSprite = spriteManager.addSprite('barrierLine', {
      uniqueId: 'barrierLine',
      positionX: 0,
      positionY: this.barrierY,
      checkCollisions: true,
      isImpassable: true,
      isPlayerControlled: false,
    });

    if (this.barrierSprite) {
      this.barrierSprite.attachComponent({ scriptId: 'BarrierLine' });
    }

    this.requestBarrierSync();
  }

  removeBarrier() {
    if (!playerManager.isHost) return;

    const existingBarrierSprite = spriteManager.getSprite('barrierLine');
    if (existingBarrierSprite) {
      spriteManager.removeSprite(existingBarrierSprite.uniqueId);
    }

    this.barrierSprite = null;
    this.requestBarrierSync();
  }

  restoreBarrier() {
    if (!playerManager.isHost) return;
    this.createBarrier();
  }

  ensureTopBoundaryBarrier() {
    if (!playerManager.isHost) return;

    const existingTopBarrierSprite = spriteManager.getSprite('topBoundaryBarrier');
    if (existingTopBarrierSprite) {
      spriteManager.removeSprite(existingTopBarrierSprite.uniqueId);
    }

    this.topBarrierSprite = spriteManager.addSprite('barrierLine', {
      uniqueId: 'topBoundaryBarrier',
      positionX: 0,
      positionY: -50,
      checkCollisions: true,
      isImpassable: true,
      isPlayerControlled: false,
    });

    if (this.topBarrierSprite) {
      this.topBarrierSprite.attachComponent({ scriptId: 'BarrierLine' });
    }

    this.requestBarrierSync();
  }

  requestBarrierSync() {
    if (!playerManager.isHost) return;
    (gameLoopManager as any).requestSync(true);
  }

  onEvent_allowMovement() {
    if (!playerManager.isHost) return;

    if (!this.roundStartAnalyticsLogged) {
      this.roundStartAnalyticsLogged = true;
      this.logStartAnalytics();
    }

    this.currentState = 'ACTIVE';
    this.setWorldActivity('GAME_ON');
    this.successfulRoundStartCount += 1;
    this.removeBarrier();
    this.refreshModeConfiguration();

    const roundResultsManager = this.getRoundResultsManager();
    if (roundResultsManager && roundResultsManager.startRound) {
      roundResultsManager.startRound();
    }

    const preferredLeaderId = this.pendingLeaderId;
    this.pendingLeaderId = 0;
    this.roundSelectionLeaderId = 0;
    this.pendingActiveRoundLeaderId = preferredLeaderId;
    this.pendingActiveRoundSetup = true;
  }

  clearPendingActiveRoundSetup() {
    this.pendingActiveRoundSetup = false;
    this.pendingActiveRoundLeaderId = 0;
  }

  finishPendingActiveRoundSetup() {
    if (!playerManager.isHost) return;
    if (!this.pendingActiveRoundSetup) return;

    if (this.currentState !== 'ACTIVE') {
      this.clearPendingActiveRoundSetup();
      return;
    }

    const preferredLeaderId = this.pendingActiveRoundLeaderId;
    this.clearPendingActiveRoundSetup();

    if (!this.wallManager) {
      this.wallManager = scriptManager.getSystem({ systemName: 'WallManager' });
    }
    if (this.wallManager && this.wallManager.spawnWalls) {
      try {
        this.wallManager.spawnWalls(this.obstacleGenerationType);
      } catch (error) {}
    }

    if (!this.stoplightManager) {
      this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
    }
    if (this.stoplightManager && this.stoplightManager.startLightControl) {
      this.stoplightManager.startLightControl(this.lightControlMode, preferredLeaderId);
    }

    if (!this.movementDetector) {
      this.movementDetector = scriptManager.getSystem({ systemName: 'MovementDetector' });
    }
    if (this.movementDetector && this.movementDetector.startMonitoring) {
      this.movementDetector.startMonitoring();
    }
  }

  onEvent_playerMovedDuringRed({ playerId }) {  //teleport
    if (this.isPlayerCurrentLightController(playerId)) return;

    // keep disabled for testing purposes:
    this.teleportToSafeZone(playerId, true);
  }

  isRedLightActive(): boolean {
    if (!this.stoplightManager) {
      this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
    }

    if (!this.stoplightManager || !this.stoplightManager.isRedLightActive) return false;

    return this.stoplightManager.isRedLightActive();
  }

  getCurrentLightControllerId(): number {
    if (!this.stoplightManager) {
      this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
    }

    if (!this.stoplightManager || !this.stoplightManager.getSyncedControllerId) return 0;

    return this.stoplightManager.getSyncedControllerId();
  }

  isPlayerCurrentLightController(playerId: number): boolean {
    if (this.lightControlMode !== 'user') return false;

    if (!this.stoplightManager) {
      this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
    }

    if (!this.stoplightManager || !this.stoplightManager.isPlayerController) return false;

    return this.stoplightManager.isPlayerController(playerId);
  }

  checkForWinner() {
    if (this.currentState !== 'ACTIVE') return;
    if (this.lightControlMode !== 'auto' && this.isRedLightActive()) return;

    const playerIds = playerManager.getPlayerIds();
    const roundResultsManager = this.getRoundResultsManager();

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      if (this.isPlayerCurrentLightController(playerId)) continue;
      if (roundResultsManager && roundResultsManager.isPlayerFinisher && roundResultsManager.isPlayerFinisher(playerId)) continue;

      const playerDetails = playerManager.getPlayerDetails(playerId);
      if (playerDetails && playerDetails.y < this.finishLineY) {
        this.handlePlayerFinished(playerId);
        if (this.currentState !== 'ACTIVE') return;
      }
    }
  }

  handlePlayerFinished(playerId: number) {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ACTIVE') return;

    const roundResultsManager = this.getRoundResultsManager();
    if (!roundResultsManager || !roundResultsManager.recordFinisher) return;

    const placement = roundResultsManager.recordFinisher(playerId);
    if (!placement) return;

    this.markRoundFinisher(playerId, placement);

    if (this.lightControlMode === 'auto' && placement === 1) {
      this.startAutoModeRoundFinishCountdown();
    }

    if (placement >= this.maxRoundFinishers || this.getContenderPlayerIds().length === 0) {
      this.completeRoundAfterFinish();
    }
  }

  startAutoModeRoundFinishCountdown() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ACTIVE') return;
    if (this.lightControlMode !== 'auto') return;

    const timerManagerSystem = this.getTimerManager();
    if (!timerManagerSystem || !timerManagerSystem.startRoundFinishCountdown) return;

    if (timerManagerSystem.isRoundFinishCountdownActive && timerManagerSystem.isRoundFinishCountdownActive()) {
      return;
    }

    timerManagerSystem.startRoundFinishCountdown(this.autoModeRoundFinishCountdownSeconds);
  }

  clearCenterCountdownDisplay() {
    const timerManagerSystem = this.getTimerManager();
    if (timerManagerSystem && timerManagerSystem.clearTimer) {
      timerManagerSystem.clearTimer();
    }
  }

  markRoundFinisher(playerId: number, placement: number) {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    const username = playerDetails && playerDetails.username ? playerDetails.username : `Player ${playerId}`;

    playerManager.tintPlayer(playerId, 'green');
    playerManager.setNameplate(playerId, this.getPlacementLabel(placement) + ' ' + username);

    if (placement === 1) {
      this.triggerWinnerParticleEffect(playerId);
      this.setWorldActivity('GAME_HIGH_SCORE');
    }
  }

  getPlacementLabel(placement: number): string {
    if (placement === 1) return '1st';
    if (placement === 2) return '2nd';
    if (placement === 3) return '3rd';
    return placement.toString() + 'th';
  }

  completeRoundAfterFinish() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ACTIVE') return;

    if (this.roundStartAnalyticsLogged && !this.roundCompletionAnalyticsLogged) {
      this.roundCompletionAnalyticsLogged = true;
      this.logCompletionAnalytics();
    }

    if (this.lightControlMode === 'user') {
      this.beginLeaderSelectionPhase();
      return;
    }

    this.beginAutoModeRoundTransition();
  }

  beginAutoModeRoundTransition() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ACTIVE') return;

    const roundResultsManager = this.getRoundResultsManager();

    this.clearCenterCountdownDisplay();
    this.currentState = 'ROUND_SELECTION';
    this.pendingLeaderId = 0;
    this.roundSelectionLeaderId = 0;

    this.stopRoundGameplaySystems();
    this.restoreBarrier();

    if (roundResultsManager && roundResultsManager.beginWinnerSummaryDisplay) {
      roundResultsManager.beginWinnerSummaryDisplay();
      return;
    }

    if (roundResultsManager && roundResultsManager.clearLeaderSelection) {
      roundResultsManager.clearLeaderSelection();
    }

    if (!this.hasEnoughPlayersToStart()) {
      this.resetToWaitingState();
      return;
    }

    if (this.successfulRoundStartCount >= this.maxSuccessfulRoundStartsBeforeClose) {
      this.closeExperience();
      return;
    }

    this.preparePlayersForNextRound();
    this.beginRoundCountdown();
  }

  beginLeaderSelectionPhase() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ACTIVE') return;

    if (this.lightControlMode !== 'user') {
      this.beginAutoModeRoundTransition();
      return;
    }

    const roundResultsManager = this.getRoundResultsManager();
    if (!roundResultsManager) return;

    this.clearCenterCountdownDisplay();
    this.currentState = 'ROUND_SELECTION';
    this.roundSelectionLeaderId = this.getCurrentLightControllerId();

    this.stopRoundGameplaySystems();
    this.restoreBarrier();
    this.teleportPlayersToRoundSelectionStage();

    const nextLeaderCandidates = roundResultsManager.buildNextLeaderCandidateIds
      ? roundResultsManager.buildNextLeaderCandidateIds(this.roundSelectionLeaderId)
      : [];

    if (roundResultsManager.beginLeaderSelection) {
      roundResultsManager.beginLeaderSelection(nextLeaderCandidates);
    }
  }

  stopRoundGameplaySystems() {
    if (!this.stoplightManager) {
      this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
    }
    if (this.stoplightManager && this.stoplightManager.stopStoplight) {
      this.stoplightManager.stopStoplight();
    }

    if (!this.movementDetector) {
      this.movementDetector = scriptManager.getSystem({ systemName: 'MovementDetector' });
    }
    if (this.movementDetector && this.movementDetector.stopMonitoring) {
      this.movementDetector.stopMonitoring();
    }

    if (!this.wallManager) {
      this.wallManager = scriptManager.getSystem({ systemName: 'WallManager' });
    }
    if (this.wallManager && this.wallManager.clearWalls) {
      this.wallManager.clearWalls();
    }
  }

  teleportPlayersToRoundSelectionStage() {
    const playerIds = this.getConnectedPlayerIds();
    const teleportPlayerIds: number[] = [];

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      if (this.isPlayerRoundFinisher(playerId)) continue;
      teleportPlayerIds.push(playerId);
    }

    if (teleportPlayerIds.length === 0) return;

    playerManager.teleportPlayers(teleportPlayerIds, {
      distributionType: 'area',
      positionX: this.roundSelectionTeleportX,
      positionY: this.roundSelectionTeleportY,
      width: this.roundSelectionTeleportWidth,
      height: this.roundSelectionTeleportHeight,
    });
  }

  advanceToNextRoundAfterLeaderSelection() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ROUND_SELECTION') return;

    const roundResultsManager = this.getRoundResultsManager();
    if (!roundResultsManager || !roundResultsManager.isLeaderSelectionComplete) return;
    if (!roundResultsManager.isLeaderSelectionComplete()) return;
    if (
      roundResultsManager.isLeaderSelectionReadyToAdvance &&
      !roundResultsManager.isLeaderSelectionReadyToAdvance()
    ) return;

    const nextLeaderId = this.resolveNextRoundLeaderId();

    if (roundResultsManager.clearLeaderSelection) {
      roundResultsManager.clearLeaderSelection();
    }

    if (!this.hasEnoughPlayersToStart()) {
      this.resetToWaitingState();
      return;
    }

    if (this.successfulRoundStartCount >= this.maxSuccessfulRoundStartsBeforeClose) {
      this.closeExperience();
      return;
    }

    this.pendingLeaderId = nextLeaderId;
    this.preparePlayersForNextRound();
    this.beginRoundCountdown();
  }

  advanceToNextRoundAfterAutoModeWinnerDisplay() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ROUND_SELECTION') return;

    const roundResultsManager = this.getRoundResultsManager();
    if (!roundResultsManager) {
      if (!this.hasEnoughPlayersToStart()) {
        this.resetToWaitingState();
        return;
      }

      if (this.successfulRoundStartCount >= this.maxSuccessfulRoundStartsBeforeClose) {
        this.closeExperience();
        return;
      }

      this.preparePlayersForNextRound();
      this.beginRoundCountdown();
      return;
    }

    if (roundResultsManager.isLeaderSelectionComplete && !roundResultsManager.isLeaderSelectionComplete()) return;
    if (
      roundResultsManager.isLeaderSelectionReadyToAdvance &&
      !roundResultsManager.isLeaderSelectionReadyToAdvance()
    ) return;

    if (roundResultsManager.clearLeaderSelection) {
      roundResultsManager.clearLeaderSelection();
    }

    if (!this.hasEnoughPlayersToStart()) {
      this.resetToWaitingState();
      return;
    }

    if (this.successfulRoundStartCount >= this.maxSuccessfulRoundStartsBeforeClose) {
      this.closeExperience();
      return;
    }

    this.preparePlayersForNextRound();
    this.beginRoundCountdown();
  }

  advanceAutoModeRoundAfterTimeout() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'ACTIVE') return;
    if (this.lightControlMode !== 'auto') return;

    const timerManagerSystem = this.getTimerManager();
    if (!timerManagerSystem) return;
    if (!timerManagerSystem.isRoundFinishCountdownActive) return;
    if (!timerManagerSystem.hasRoundFinishCountdownExpired) return;
    if (!timerManagerSystem.isRoundFinishCountdownActive()) return;
    if (!timerManagerSystem.hasRoundFinishCountdownExpired()) return;

    this.completeRoundAfterFinish();
  }

  resolveNextRoundLeaderId(): number {
    const roundResultsManager = this.getRoundResultsManager();
    if (!roundResultsManager) return 0;

    if (roundResultsManager.getSelectedLeaderId) {
      const selectedLeaderId = roundResultsManager.getSelectedLeaderId();
      if (this.isPlayerConnected(selectedLeaderId)) return selectedLeaderId;
    }

    if (roundResultsManager.buildNextLeaderCandidateIds) {
      const candidateIds = roundResultsManager.buildNextLeaderCandidateIds(this.roundSelectionLeaderId);
      if (candidateIds.length > 0) {
        return candidateIds[Math.floor(Math.random() * candidateIds.length)];
      }
    }

    const playerIds = this.getConnectedPlayerIds();
    if (playerIds.length === 0) return 0;

    return playerIds[Math.floor(Math.random() * playerIds.length)];
  }

  preparePlayersForNextRound() {
    if (!playerManager.isHost) return;
    const playerIds = this.getConnectedPlayerIds();
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      this.teleportToSafeZone(playerId, false, true);
      this.setInGameNameplate(playerId);
      playerManager.tintPlayer(playerId, null);
    }

    this.restoreBarrier();
    this.roundSelectionLeaderId = 0;
  }

  onStep() {
    if (!playerManager.isHost) return;

    if (this.pendingActiveRoundSetup) {
      this.finishPendingActiveRoundSetup();
    }

    if (this.currentState === 'ACTIVE') {
      this.checkForWinner();
      if (this.currentState !== 'ACTIVE') return;
      this.advanceAutoModeRoundAfterTimeout();
      return;
    }

    if (this.currentState === 'ROUND_SELECTION') {
      if (this.lightControlMode === 'user') {
        this.advanceToNextRoundAfterLeaderSelection();
        return;
      }

      this.advanceToNextRoundAfterAutoModeWinnerDisplay();
    }
  }

  onPhysicsStep() {
    if (!playerManager.isHost) return;
    if (this.currentState !== 'WAITING') return;

    this.ensureHostStartButton();
    this.updateHostStartButtonPosition();
  }

  clearRoundResultSprites() {
    if (!playerManager.isHost) return;
    if (spriteManager.getSprite('winnerAnnouncement')) {
      spriteManager.removeSprite('winnerAnnouncement');
    }

    if (spriteManager.getSprite('resetTimer')) {
      spriteManager.removeSprite('resetTimer');
    }

    const roundResultsManager = this.getRoundResultsManager();
    if (roundResultsManager && roundResultsManager.resetRoundResults) {
      roundResultsManager.resetRoundResults();
    }
  }

  resetToWaitingState() {
    if (!playerManager.isHost) return;
    this.currentState = 'WAITING';
    this.hasStartedGame = false;
    this.isGameClosing = false;
    this.pendingLeaderId = 0;
    this.roundSelectionLeaderId = 0;
    this.clearPendingActiveRoundSetup();

    this.clearNotEnoughPlayersTimer();
    this.clearRoundResultSprites();

    this.clearCenterCountdownDisplay();

    this.stopRoundGameplaySystems();

    const playerIds = this.getConnectedPlayerIds();
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      this.teleportToSafeZone(playerId, false, true);
      this.setInGameNameplate(playerId);
      playerManager.tintPlayer(playerId, null);
    }

    this.restoreBarrier();
    this.clearLobby();
    this.showLobby();
  }

  abortCurrentGame() {
    if (!playerManager.isHost) return;
    if (this.isGameClosing) return;

    this.resetToWaitingState();
  }

  closeExperience() {
    if (!playerManager.isHost) return;
    if (this.isGameClosing) return;

    this.isGameClosing = true;
    this.currentState = 'CLOSING';
    this.hasStartedGame = false;
    this.pendingLeaderId = 0;
    this.roundSelectionLeaderId = 0;
    this.clearPendingActiveRoundSetup();

    this.clearNotEnoughPlayersTimer();
    this.clearRoundResultSprites();
    this.clearLobby();

    this.clearCenterCountdownDisplay();

    this.stopRoundGameplaySystems();
    this.restoreBarrier();

    const playerIds = this.getConnectedPlayerIds();
    let hostPlayerId = this.hostId;
    if (!hostPlayerId || hostPlayerId === 0) {
      hostPlayerId = playerManager.getMyPlayerId();
      this.hostId = hostPlayerId;
    }

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      if (playerId === hostPlayerId) continue;
      playerManager.kickFromGame(playerId);
    }

    if (hostPlayerId) {
      for (let i = 0; i < playerIds.length; i++) {
        if (playerIds[i] !== hostPlayerId) continue;
        playerManager.kickFromGame(hostPlayerId);
        break;
      }
    }
  }

  onEvent_resetGame() {
    if (!playerManager.isHost) return;
    if (this.isGameClosing) return;

    this.resetToWaitingState();
  }

  getActivityPublicKey() {
    let publicKey = '';

    try {
      publicKey = stateManager.getVariable('publicKey');
    } catch (error) {}

    if (!publicKey) {
      try {
        publicKey = stateManager.getVariable('PublicKey');
      } catch (error) {}
    }

    if (!publicKey) {
      try {
        publicKey = stateManager.getVariable('interactivePublicKey');
      } catch (error) {}
    }

    return publicKey;
  }

  /*
   *  Sends a host-authoritative batch of public-key analytics. Analytics are
   *  skipped when this experience has no configured public key.
   */
  sendAnalytics(analytics: any[]) {
    try {
      if (!playerManager.isHost) return;
      if (!analytics || analytics.length === 0) return;

      const publicKey = this.getActivityPublicKey();
      if (!publicKey) return;

      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: publicKey,
        analytics: analytics,
      });
    } catch (error) {}
  }

  getPlayerProfileId(playerId: number): string {
    try {
      const playerDetails = playerManager.getPlayerDetails(playerId);
      if (!playerDetails || !playerDetails.profileId) return '';
      return playerDetails.profileId;
    } catch (error) {
      return '';
    }
  }

  /*
   *  Records a total and unique join when the main app joins a player to RLGL.
   */
  logJoinAnalytics(playerId: number) {
    if (!playerManager.isHost) return;

    const profileId = this.getPlayerProfileId(playerId);
    if (!profileId) return;

    this.sendAnalytics([
      { analyticName: 'Joins', profileId: profileId },
      { analyticName: 'UniqueJoins', profileId: profileId, uniqueKey: profileId },
    ]);
  }

  /*
   *  Records every player present when movement is enabled for a round.
   */
  logStartAnalytics() {
    if (!playerManager.isHost) return;

    const playerIds = this.getConnectedPlayerIds();
    const analytics = [] as any[];
    analytics.push({ analyticName: `GamesOf${playerIds.length}` });

    for (let i = 0; i < playerIds.length; i++) {
      const profileId = this.getPlayerProfileId(playerIds[i]);
      if (!profileId) continue;

      analytics.push({ analyticName: 'Starts', profileId: profileId });
      analytics.push({ analyticName: 'UniqueStarts', profileId: profileId, uniqueKey: profileId });
    }

    this.sendAnalytics(analytics);
  }

  /*
   *  Records every player still present when the active round ends.
   */
  logCompletionAnalytics() {
    if (!playerManager.isHost) return;

    const playerIds = this.getConnectedPlayerIds();
    const analytics = [] as any[];

    for (let i = 0; i < playerIds.length; i++) {
      const profileId = this.getPlayerProfileId(playerIds[i]);
      if (!profileId) continue;

      analytics.push({ analyticName: 'Completions', profileId: profileId });
      analytics.push({ analyticName: 'UniqueCompletions', profileId: profileId, uniqueKey: profileId });
    }

    this.sendAnalytics(analytics);
  }

  triggerWinnerParticleEffect(playerId: number) {
    try {
      if (!playerManager.isHost) return;
      const publicKey = this.getActivityPublicKey();
      if (!publicKey) return;

      let winnerEffectOptions: any;
      winnerEffectOptions = {
        interactivePublicKey: publicKey,
        particleName: 'trophy_float',
        duration: 15,
        playerId: playerId,
        followPlayerId: playerId,
      };
      integrationsManager.triggerParticleEffect(winnerEffectOptions);
    } catch (e) {}
  }

  setWorldActivity(type: string) {
    try {
      if (!playerManager.isHost) return;
      const publicKey = this.getActivityPublicKey();
      if (!publicKey) return;
      integrationsManager.setWorldActivity({
        type: type,
        interactivePublicKey: publicKey,
      });
    } catch (e) {}
  }
}
