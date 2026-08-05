class gameManager extends SystemScript {
  arenaManager: PseudoAny;
  tileManager: PseudoAny;
  minimumPlayersToStart: number;
  winnerAnnouncementDurationMs: number;
  outTintColor: string;
  winnerTintColor: string;
  waitingAreaX: number;
  waitingAreaY: number;
  waitingAreaWidth: number;
  waitingAreaHeight: number;
  outAreaX: number;
  outAreaY: number;
  outAreaWidth: number;
  outAreaHeight: number;
  hostId: number;
  notEnoughPlayersUntilMs: number;
  lastCenterCountdownText: string;
  lastWinnerCountdownText: string;
  roundStartingPlayerIds: number[];
  shouldReplayRound: boolean;
  rewindItemName: string;
  rewindRewardChance: number;
  minimumRewardRoundsSurvived: number;
  rewindCatalogItemId: string;
  playerRoundsSurvivedMap: Record<string, any>;
  playerFinalEliminationOrderMap: Record<string, any>;
  eliminationOrderCounter: number;
  pendingRewindRespawnPlayerIds: number[];
  pendingRewindUsePlayerMap: Record<string, any>;

  onInit() {
    if (!playerManager.isHost) return;

    this.arenaManager = scriptManager.getSystem({ systemName: "arenaManager" });
    this.tileManager = scriptManager.getSystem({ systemName: "tileManager" });
    this.minimumPlayersToStart = 2;
    this.winnerAnnouncementDurationMs = 10000;
    this.outTintColor = "#d94747ff";
    this.winnerTintColor = "#58c96bff";
    this.waitingAreaX = 300;
    this.waitingAreaY = 1310;
    this.waitingAreaWidth = 600;
    this.waitingAreaHeight = 120;
    this.outAreaX = 1138;
    this.outAreaY = 1130;
    this.outAreaWidth = 280;
    this.outAreaHeight = 280;
    this.hostId = playerManager.getMyPlayerId();
    this.notEnoughPlayersUntilMs = 0;
    this.lastCenterCountdownText = "";
    this.lastWinnerCountdownText = "";
    this.roundStartingPlayerIds = [];
    this.shouldReplayRound = false;
    this.rewindItemName = "Rewind";
    this.rewindRewardChance = 0.2;
    this.minimumRewardRoundsSurvived = 5;
    this.rewindCatalogItemId = "";
    this.playerRoundsSurvivedMap = {};
    this.playerFinalEliminationOrderMap = {};
    this.eliminationOrderCounter = 0;
    this.pendingRewindRespawnPlayerIds = [];
    this.pendingRewindUsePlayerMap = {};

    this.resetVariablesForWaiting();
    this.refreshConnectedPlayerNameplates();
    this.refreshLobby();
  }

  onHostStart() {
    if (!playerManager.isHost) return;
    this.hostId = playerManager.getMyPlayerId();
    this.refreshLobby();
  }

  onPlayerJoined({ playerId }) {
    if (!playerManager.isHost) return;

    this.setPlayerNameplate(playerId);
    this.playerRoundsSurvivedMap[playerId.toString()] = 0;
    delete this.playerFinalEliminationOrderMap[playerId.toString()];
    delete this.pendingRewindUsePlayerMap[playerId.toString()];

    const phase = stateManager.getVariable("gamePhase");
    if (phase === "WAITING") {
      this.refreshLobby();
      return;
    }

    const playerLifeMap = stateManager.getVariable("playerLifeMap");
    const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
    const playerRewindUsedMap = stateManager.getVariable("playerRewindUsedMap");
    playerLifeMap[playerId.toString()] = false;
    playerRewindUsedMap[playerId.toString()] = false;
    delete currentTileMap[playerId.toString()];
    stateManager.setVariable("playerLifeMap", playerLifeMap);
    console.log(stateManager.getVariable("playerLifeMap"));
    stateManager.setVariable("playerRewindUsedMap", playerRewindUsedMap);
    stateManager.setVariable("playerCurrentTileMap", currentTileMap);
    this.teleportPlayersToOutArea([playerId]);
    this.refreshPlayerTints();
    this.refreshPlayerList();
  }

  onPlayerLeft({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;

    const playerLifeMap = stateManager.getVariable("playerLifeMap");
    const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
    const playerRewindUsedMap = stateManager.getVariable("playerRewindUsedMap");

    delete playerLifeMap[playerId.toString()];
    delete currentTileMap[playerId.toString()];
    delete playerRewindUsedMap[playerId.toString()];
    delete this.playerRoundsSurvivedMap[playerId.toString()];
    delete this.playerFinalEliminationOrderMap[playerId.toString()];
    delete this.pendingRewindUsePlayerMap[playerId.toString()];
    this.removePendingRewindRespawnPlayerId(playerId);

    stateManager.setVariable("playerLifeMap", playerLifeMap);
    console.log(stateManager.getVariable("playerLifeMap"));
    stateManager.setVariable("playerRewindUsedMap", playerRewindUsedMap);
    stateManager.setVariable("playerCurrentTileMap", currentTileMap);

    const phase = stateManager.getVariable("gamePhase");
    if (phase === "WAITING") {
      this.refreshLobby();
      return;
    }

    this.handleAliveCountChanges();
    this.refreshPlayerList();
  }

  onSpriteClicked(params: { sprite: PseudoSprite }) {
    if (!playerManager.isHost) return;
    if (!params || !params.sprite) return;
    if (
      params.sprite.uniqueId !== "startButtonText" &&
      params.sprite.uniqueId !== "hostStartButton"
    ) return;
    if (stateManager.getVariable("gamePhase") !== "WAITING") return;

    this.tryStartGame();
  }

  onPhysicsStep() {
    if (!playerManager.isHost) return;

    const phase = stateManager.getVariable("gamePhase");
    if (phase === "WAITING") {
      this.ensureWaitingStartButtons();
      this.maybeRestoreStartButtons();
      return;
    }

    const phaseEndsAtMs = stateManager.getVariable("phaseEndsAtMs");
    if (!phaseEndsAtMs || phaseEndsAtMs <= 0) return;

    const now = this.getNowMs();
    const remainingMs = phaseEndsAtMs - now;

    this.updateCountdownText(phase, remainingMs);

    if (remainingMs > 0) return;

    if (phase === "MEMORIZE") {
      this.beginMovePhase();
      return;
    }

    if (phase === "MOVE") {
      this.resolveRound();
      return;
    }

    if (phase === "RESOLVE") {
      this.finishResolvePhase();
      return;
    }

    if (phase === "WINNER") {
      this.resetToWaitingState();
    }
  }

  onEvent_reset() {
    if (!playerManager.isHost) return;
    this.resetToWaitingState();
  }

  onEvent_playerRequestsRewindUse({
    fromPlayerId,
  }: {
    fromPlayerId: number;
  }) {
    if (!playerManager.isHost) return;
    this.handlePlayerRewindUseRequest(fromPlayerId);
  }

  onEvent_playerRequestsRewindInventoryChange({
    action,
    fromPlayerId,
  }: {
    action: string;
    fromPlayerId: number;
  }) {
    if (!playerManager.isHost) return;
    this.handlePlayerRewindInventoryChangeRequest(action, fromPlayerId);
  }

  tryStartGame() {
    if (!playerManager.isHost) return;

    const connectedPlayerIds = playerManager.getPlayerIds();
    if (connectedPlayerIds.length < this.minimumPlayersToStart) {
      this.showNotEnoughPlayersFeedback();
      return;
    }

    const playerLifeMap: Record<string, any> = {};
    const playerRewindUsedMap: Record<string, any> = {};
    this.playerRoundsSurvivedMap = {};
    this.playerFinalEliminationOrderMap = {};
    this.eliminationOrderCounter = 0;
    this.pendingRewindRespawnPlayerIds = [];
    this.pendingRewindUsePlayerMap = {};
    for (let i = 0; i < connectedPlayerIds.length; i++) {
      playerLifeMap[connectedPlayerIds[i].toString()] = true;
      playerRewindUsedMap[connectedPlayerIds[i].toString()] = false;
      this.playerRoundsSurvivedMap[connectedPlayerIds[i].toString()] = 0;
    }

    stateManager.setVariable("playerLifeMap", playerLifeMap);
    console.log(stateManager.getVariable("playerLifeMap"));
    stateManager.setVariable("playerRewindUsedMap", playerRewindUsedMap);
    stateManager.setVariable("playerCurrentTileMap", {});
    stateManager.setVariable("roundNumber", 0);
    stateManager.setVariable("winnerPlayerId", 0);
    stateManager.setVariable("winnerAnnounced", false);
    stateManager.setVariable("gameStarted", true);

    this.lastCenterCountdownText = "";
    this.lastWinnerCountdownText = "";
    this.notEnoughPlayersUntilMs = 0;
    this.roundStartingPlayerIds = [];
    this.shouldReplayRound = false;
    this.refreshPlayerTints();
    this.setWorldActivity("GAME_ON");

    this.arenaManager.showArenaBarriers();
    this.arenaManager.showOutZone();
    this.beginNextRound();
  }

  beginNextRound() {
    if (!playerManager.isHost) return;

    const alivePlayerIds = this.getAlivePlayerIds();
    if (alivePlayerIds.length <= 1) {
      if (alivePlayerIds.length === 1) {
        this.declareWinner(alivePlayerIds[0]);
      } else {
        this.resetToWaitingState();
      }
      return;
    }

    const nextRoundNumber = stateManager.getVariable("roundNumber") + 1;
    const memorizeDurationMs = this.getMemorizeDurationMs(nextRoundNumber);
    this.roundStartingPlayerIds = alivePlayerIds.slice();
    this.shouldReplayRound = false;

    stateManager.setVariable("roundNumber", nextRoundNumber);
    stateManager.setVariable("gamePhase", "MEMORIZE");
    stateManager.setVariable("phaseEndsAtMs", this.getNowMs() + memorizeDurationMs);

    this.tileManager.prepareRound(nextRoundNumber);
    this.tileManager.showAllFruitLabels();

    this.lastCenterCountdownText = "";
    this.lastWinnerCountdownText = "";

    this.arenaManager.hideWinner();
    this.arenaManager.showOutZone();
    this.arenaManager.showMemorizeRound(nextRoundNumber);
    if (nextRoundNumber === 1 || this.pendingRewindRespawnPlayerIds.length > 0) {
      this.teleportPlayersToRoundStartSpots(alivePlayerIds);
    }
    this.pendingRewindRespawnPlayerIds = [];
    this.tileManager.refreshPlayerCurrentTileMap(alivePlayerIds);
    this.refreshPlayerList();
    this.updateCountdownText("MEMORIZE", memorizeDurationMs);
  }

  beginMovePhase() {
    if (!playerManager.isHost) return;

    const moveDurationMs = 6000;
    stateManager.setVariable("gamePhase", "MOVE");
    stateManager.setVariable("phaseEndsAtMs", this.getNowMs() + moveDurationMs);

    this.tileManager.hideAllFruitLabels();
    this.tileManager.refreshPlayerCurrentTileMap(this.getAlivePlayerIds());

    this.lastCenterCountdownText = "";
    this.arenaManager.showSafeFruit(stateManager.getVariable("safeFruitName"));
    this.updateCountdownText("MOVE", moveDurationMs);
  }

  resolveRound() {
    if (!playerManager.isHost) return;

    const alivePlayerIds = this.getAlivePlayerIds();
    const roundNumber = stateManager.getVariable("roundNumber");
    const playerLifeMap = stateManager.getVariable("playerLifeMap");
    const playerCurrentTileMap = stateManager.getVariable("playerCurrentTileMap");
    const eliminatedPlayerIds: number[] = [];
    const survivingPlayerIds: number[] = [];

    this.tileManager.refreshPlayerCurrentTileMap(alivePlayerIds);

    for (let i = 0; i < alivePlayerIds.length; i++) {
      const playerId = alivePlayerIds[i];
      const isSafe = this.tileManager.isPlayerOnSafeTile(playerId);

      if (isSafe) {
        survivingPlayerIds.push(playerId);
      } else {
        playerLifeMap[playerId.toString()] = false;
        delete playerCurrentTileMap[playerId.toString()];
        eliminatedPlayerIds.push(playerId);
      }
    }

    for (let i = 0; i < survivingPlayerIds.length; i++) {
      this.playerRoundsSurvivedMap[survivingPlayerIds[i].toString()] = roundNumber;
    }
    for (let i = 0; i < eliminatedPlayerIds.length; i++) {
      this.eliminationOrderCounter += 1;
      this.playerFinalEliminationOrderMap[eliminatedPlayerIds[i].toString()] =
        this.eliminationOrderCounter;
    }

    stateManager.setVariable("playerLifeMap", playerLifeMap);
    console.log(stateManager.getVariable("playerLifeMap"));
    stateManager.setVariable("playerCurrentTileMap", playerCurrentTileMap);
    stateManager.setVariable(
      "roundResolutionNonce",
      stateManager.getVariable("roundResolutionNonce") + 1,
    );

    if (eliminatedPlayerIds.length > 0) {
      this.teleportPlayersToOutArea(eliminatedPlayerIds);
    }

    this.tileManager.showSafeResults();

    if (survivingPlayerIds.length === 1) {
      this.shouldReplayRound = false;
      stateManager.setVariable("winnerPlayerId", survivingPlayerIds[0]);
      stateManager.setVariable("winnerAnnounced", true);
      stateManager.setVariable("gameStarted", false);
    } else if (survivingPlayerIds.length === 0) {
      this.shouldReplayRound = true;
      stateManager.setVariable("winnerPlayerId", 0);
      stateManager.setVariable("winnerAnnounced", false);
    } else {
      this.shouldReplayRound = false;
      stateManager.setVariable("winnerPlayerId", 0);
      stateManager.setVariable("winnerAnnounced", false);
    }

    this.refreshPlayerTints(stateManager.getVariable("winnerPlayerId"));

    const resolveDurationMs = survivingPlayerIds.length === 1 ? 15000 : 5000;
    stateManager.setVariable("gamePhase", "RESOLVE");
    stateManager.setVariable("phaseEndsAtMs", this.getNowMs() + resolveDurationMs);

    this.lastCenterCountdownText = "";
    this.arenaManager.showResolve(stateManager.getVariable("safeFruitName"));
    this.refreshPlayerList();
    this.updateCountdownText("RESOLVE", resolveDurationMs);
  }

  finishResolvePhase() {
    if (!playerManager.isHost) return;

    if (this.shouldReplayRound) {
      this.replayCurrentRound();
      return;
    }

    const alivePlayerIds = this.getAlivePlayerIds();
    if (alivePlayerIds.length === 1) {
      this.declareWinner(alivePlayerIds[0]);
      return;
    }

    if (alivePlayerIds.length === 0) {
      this.resetToWaitingState();
      return;
    }

    this.beginNextRound();
  }

  declareWinner(playerId: number) {
    if (!playerManager.isHost) return;

    const playerDetails = playerManager.getPlayerDetails(playerId);
    const winnerName =
      playerDetails && playerDetails.username
        ? playerDetails.username
        : "Player " + playerId.toString();

    stateManager.setVariable("winnerAnnounced", true);
    stateManager.setVariable("winnerPlayerId", playerId);
    stateManager.setVariable("gameStarted", false);
    stateManager.setVariable("gamePhase", "WINNER");
    stateManager.setVariable(
      "phaseEndsAtMs",
      this.getNowMs() + this.winnerAnnouncementDurationMs,
    );

    this.lastCenterCountdownText = "";
    this.lastWinnerCountdownText = "";

    this.tileManager.hideAllTiles();
    this.arenaManager.showWinner(winnerName);
    this.arenaManager.setWinnerRewardAnnouncements([]);
    this.triggerWinnerParticleEffect(playerId);
    this.refreshPlayerList();
    this.awardRewindItemsToTopSurvivors(playerId);
  }

  resetToWaitingState() {
    if (!playerManager.isHost) return;

    this.roundStartingPlayerIds = [];
    this.shouldReplayRound = false;
    this.playerRoundsSurvivedMap = {};
    this.playerFinalEliminationOrderMap = {};
    this.eliminationOrderCounter = 0;
    this.pendingRewindRespawnPlayerIds = [];
    this.pendingRewindUsePlayerMap = {};
    this.resetVariablesForWaiting();
    this.tileManager.clearAll();
    this.refreshPlayerTints();
    this.setAllConnectedPlayersWaiting();
    this.arenaManager.hideArenaBarriers();
    this.arenaManager.hideWinner();
    this.arenaManager.hideOutZone();
    this.refreshLobby();
  }

  resetVariablesForWaiting() {
    stateManager.setVariable("gamePhase", "WAITING");
    stateManager.setVariable("phaseEndsAtMs", 0);
    stateManager.setVariable("roundNumber", 0);
    stateManager.setVariable("playerLifeMap", {});
    console.log(stateManager.getVariable("playerLifeMap"));
    stateManager.setVariable("playerCurrentTileMap", {});
    stateManager.setVariable("tileFruitMap", {});
    stateManager.setVariable("safeTileMap", {});
    stateManager.setVariable("safeFruitName", "");
    stateManager.setVariable("roundFruitOptionsMap", {});
    stateManager.setVariable("roundResolutionNonce", 0);
    stateManager.setVariable("winnerPlayerId", 0);
    stateManager.setVariable("winnerAnnounced", false);
    stateManager.setVariable("gameStarted", false);
    stateManager.setVariable("playerRewindUsedMap", {});
    this.notEnoughPlayersUntilMs = 0;
  }

  refreshLobby() {
    if (!playerManager.isHost) return;

    this.arenaManager.showLobby(this.getHostName());
    this.refreshPlayerList();
    this.ensureWaitingStartButtons();
    const connectedPlayerIds = playerManager.getPlayerIds();
    if (
      connectedPlayerIds.length > 0 &&
      connectedPlayerIds.length < this.minimumPlayersToStart
    ) {
      this.setWorldActivity("GAME_WAITING");
    }
  }

  setAllConnectedPlayersWaiting() {
    const connectedPlayerIds = playerManager.getPlayerIds();
    this.refreshConnectedPlayerNameplates();
    this.teleportPlayersToWaitingArea(connectedPlayerIds);
  }

  refreshConnectedPlayerNameplates() {
    const connectedPlayerIds = playerManager.getPlayerIds();
    for (let i = 0; i < connectedPlayerIds.length; i++) {
      this.setPlayerNameplate(connectedPlayerIds[i]);
    }
  }

  setPlayerNameplate(playerId: number) {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    const username =
      playerDetails && playerDetails.username
        ? playerDetails.username
        : "Player " + playerId.toString();

    playerManager.setNameplate(playerId, "\uD83C\uDF53 " + username + " \uD83C\uDF4C");
  }

  refreshPlayerTints(winnerPlayerId?: number) {
    const playerLifeMap = stateManager.getVariable("playerLifeMap");
    const connectedPlayerIds = playerManager.getPlayerIds();

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      const playerId = connectedPlayerIds[i];
      let tintColor: string | null = null;

      if (playerLifeMap[playerId.toString()] === false) {
        tintColor = this.outTintColor;
      }

      if (winnerPlayerId && playerId === winnerPlayerId) {
        tintColor = this.winnerTintColor;
      }

      playerManager.tintPlayer(playerId, tintColor);
    }
  }

  teleportPlayersToWaitingArea(playerIds: number[]) {
    if (playerIds.length === 0) return;

    playerManager.teleportPlayers(playerIds, {
      distributionType: "area",
      positionX: this.waitingAreaX,
      positionY: this.waitingAreaY,
      width: this.waitingAreaWidth,
      height: this.waitingAreaHeight,
    });
  }

  getRoundStartSpawnPoints(): { positionX: number; positionY: number }[] {
    const centerDisplayRect = spriteManager.getSprite("centerDisplayRect");
    let centerX = 566;
    let centerY = 750;

    if (centerDisplayRect) {
      centerX = centerDisplayRect.position.x +
        Math.floor(centerDisplayRect.width / 2);
      centerY = centerDisplayRect.position.y +
        Math.floor(centerDisplayRect.height / 2);
    }

    const upperLeftOffsets = [
      { offsetX: -359, offsetY: -115 },
      { offsetX: -345, offsetY: -373 },
      { offsetX: -230, offsetY: -505 },
    ];
    const topCenterOffset = { offsetX: 0, offsetY: -536 };
    const topHalfOffsets: { offsetX: number; offsetY: number }[] = [];

    for (let i = 0; i < upperLeftOffsets.length; i++) {
      topHalfOffsets.push(upperLeftOffsets[i]);
    }
    topHalfOffsets.push(topCenterOffset);
    for (let i = upperLeftOffsets.length - 1; i >= 0; i--) {
      topHalfOffsets.push({
        offsetX: -upperLeftOffsets[i].offsetX,
        offsetY: upperLeftOffsets[i].offsetY,
      });
    }

    const spawnPoints: { positionX: number; positionY: number }[] = [];
    for (let i = 0; i < topHalfOffsets.length; i++) {
      spawnPoints.push({
        positionX: centerX + topHalfOffsets[i].offsetX,
        positionY: centerY + topHalfOffsets[i].offsetY,
      });
    }
    for (let i = topHalfOffsets.length - 1; i >= 0; i--) {
      spawnPoints.push({
        positionX: centerX + topHalfOffsets[i].offsetX,
        positionY: centerY - topHalfOffsets[i].offsetY,
      });
    }

    return spawnPoints;
  }

  teleportPlayersToRoundStartSpots(playerIds: number[]) {
    if (playerIds.length === 0) return;

    const spawnPoints = this.getRoundStartSpawnPoints();
    for (let i = 0; i < playerIds.length; i++) {
      const spawnPoint = spawnPoints[i % spawnPoints.length];
      playerManager.teleportPlayers([playerIds[i]], {
        distributionType: "area",
        positionX: spawnPoint.positionX,
        positionY: spawnPoint.positionY,
        width: 1,
        height: 1,
      });
    }
  }

  getOutAreaBounds(): {
    positionX: number;
    positionY: number;
    width: number;
    height: number;
  } {
    const outZoneRect = spriteManager.getSprite("outZoneRect");
    if (outZoneRect) {
      return {
        positionX: outZoneRect.position.x + 10,
        positionY: outZoneRect.position.y + 10,
        width: Math.max(20, outZoneRect.width - 20),
        height: Math.max(20, outZoneRect.height - 20),
      };
    }

    return {
      positionX: this.outAreaX,
      positionY: this.outAreaY,
      width: this.outAreaWidth,
      height: this.outAreaHeight,
    };
  }

  teleportPlayersToOutArea(playerIds: number[]) {
    if (playerIds.length === 0) return;

    const outAreaBounds = this.getOutAreaBounds();
    playerManager.teleportPlayers(playerIds, {
      distributionType: "area",
      positionX: outAreaBounds.positionX,
      positionY: outAreaBounds.positionY,
      width: outAreaBounds.width,
      height: outAreaBounds.height,
    });
  }

  getAlivePlayerIds(): number[] {
    const playerLifeMap = stateManager.getVariable("playerLifeMap");
    const connectedPlayerIds = playerManager.getPlayerIds();
    const alivePlayerIds: number[] = [];

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      const playerId = connectedPlayerIds[i];
      if (playerLifeMap[playerId.toString()] === true) {
        alivePlayerIds.push(playerId);
      }
    }

    return alivePlayerIds;
  }

  handleAliveCountChanges() {
    const phase = stateManager.getVariable("gamePhase");
    if (phase === "WAITING") return;
    if (phase === "RESOLVE" && !this.shouldReplayRound) return;

    if (this.shouldReplayRound) {
      const replayPlayerIds = this.getReplayPlayerIds();
      if (replayPlayerIds.length === 1) {
        this.shouldReplayRound = false;
        this.declareWinner(replayPlayerIds[0]);
        return;
      }

      if (replayPlayerIds.length === 0) {
        this.resetToWaitingState();
      }
      return;
    }

    const alivePlayerIds = this.getAlivePlayerIds();
    if (alivePlayerIds.length === 1) {
      this.declareWinner(alivePlayerIds[0]);
      return;
    }

    if (alivePlayerIds.length === 0) {
      this.resetToWaitingState();
    }
  }

  getMemorizeDurationMs(roundNumber: number): number {
    if (roundNumber <= 7) return 8000;

    const reducedDuration = 8000 - (roundNumber - 7) * 500;
    return Math.max(3000, reducedDuration);
  }

  updateCountdownText(phase: string, remainingMs: number) {
    const countdownText = this.formatCountdownText(remainingMs);

    if (phase === "WINNER") {
      return;
    }

    let centerText = "Time Left: " + countdownText;
    if (phase === "RESOLVE") {
      centerText = "Next Round Starts: " + countdownText;
    }

    if (centerText === this.lastCenterCountdownText) return;
    this.lastCenterCountdownText = centerText;
    this.arenaManager.setCenterFooterText(centerText, "#F01135");
  }

  formatCountdownText(remainingMs: number): string {
    const safeRemainingMs = Math.max(0, remainingMs);
    const roundedSeconds = Math.ceil(safeRemainingMs / 1000);
    return roundedSeconds.toString();
  }

  getNowMs(): number {
    return new Date().getTime();
  }

  getHostName(): string {
    if (!this.hostId) {
      this.hostId = playerManager.getMyPlayerId();
    }

    const hostDetails = playerManager.getPlayerDetails(this.hostId);
    if (hostDetails && hostDetails.username) {
      return hostDetails.username;
    }

    return "the host";
  }

  getPlayerName(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (playerDetails && playerDetails.username) {
      return playerDetails.username;
    }

    return "Player " + playerId.toString();
  }

  getStartButtonText(): string {
    return "Click here to start!";
  }

  getHostStartButtonPosition(): { positionX: number; positionY: number } | null {
    if (!this.hostId) return null;

    const hostDetails = playerManager.getPlayerDetails(this.hostId);
    if (!hostDetails) return null;

    return {
      positionX: hostDetails.x + 45,
      positionY: hostDetails.y + 15,
    };
  }

  ensureWaitingStartButtons() {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "WAITING") return;

    const buttonText = this.notEnoughPlayersUntilMs > this.getNowMs()
      ? "Not enough players"
      : this.getStartButtonText();
    const buttonColor = this.notEnoughPlayersUntilMs > this.getNowMs()
      ? "#555555"
      : "#F01135";

    this.arenaManager.setCenterStartButtonText(buttonText, buttonColor);

    const hostButtonPosition = this.getHostStartButtonPosition();
    if (!hostButtonPosition) return;

    this.arenaManager.updateHostStartButton(
      hostButtonPosition.positionX,
      hostButtonPosition.positionY,
      buttonText,
      buttonColor,
    );
  }

  showNotEnoughPlayersFeedback() {
    this.notEnoughPlayersUntilMs = this.getNowMs() + 1500;
    this.ensureWaitingStartButtons();
  }

  maybeRestoreStartButtons() {
    if (!this.notEnoughPlayersUntilMs) return;
    if (this.getNowMs() < this.notEnoughPlayersUntilMs) return;

    this.notEnoughPlayersUntilMs = 0;
    this.ensureWaitingStartButtons();
  }

  replayCurrentRound() {
    if (!playerManager.isHost) return;

    const replayPlayerIds = this.getReplayPlayerIds();
    this.shouldReplayRound = false;
    this.pendingRewindRespawnPlayerIds = [];

    if (replayPlayerIds.length === 0) {
      this.resetToWaitingState();
      return;
    }

    if (replayPlayerIds.length === 1) {
      this.declareWinner(replayPlayerIds[0]);
      return;
    }

    const roundNumber = stateManager.getVariable("roundNumber");
    const memorizeDurationMs = this.getMemorizeDurationMs(roundNumber);
    const connectedPlayerIds = playerManager.getPlayerIds();
    const playerLifeMap = stateManager.getVariable("playerLifeMap");

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      const playerId = connectedPlayerIds[i];
      playerLifeMap[playerId.toString()] =
        replayPlayerIds.indexOf(playerId) !== -1;
    }

    stateManager.setVariable("playerLifeMap", playerLifeMap);
    console.log(stateManager.getVariable("playerLifeMap"));
    stateManager.setVariable("playerCurrentTileMap", {});
    stateManager.setVariable("winnerPlayerId", 0);
    stateManager.setVariable("winnerAnnounced", false);
    stateManager.setVariable("gameStarted", true);
    stateManager.setVariable("gamePhase", "MEMORIZE");
    stateManager.setVariable(
      "phaseEndsAtMs",
      this.getNowMs() + memorizeDurationMs,
    );

    this.lastCenterCountdownText = "";
    this.lastWinnerCountdownText = "";
    this.refreshPlayerTints();

    this.teleportPlayersToWaitingArea(replayPlayerIds);
    this.tileManager.prepareReplayRound(roundNumber);
    this.tileManager.showAllFruitLabels();
    this.tileManager.refreshPlayerCurrentTileMap(replayPlayerIds);

    this.arenaManager.hideWinner();
    this.arenaManager.showOutZone();
    this.arenaManager.showMemorizeRound(roundNumber);
    this.refreshPlayerList();
    this.updateCountdownText("MEMORIZE", memorizeDurationMs);
  }

  refreshPlayerList() {
    if (!playerManager.isHost) return;

    this.arenaManager.refreshPlayerList(stateManager.getVariable("gamePhase"));
  }

  getReplayPlayerIds(): number[] {
    const connectedPlayerIds = playerManager.getPlayerIds();
    const replayPlayerIds: number[] = [];

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      const playerId = connectedPlayerIds[i];
      if (this.roundStartingPlayerIds.indexOf(playerId) !== -1) {
        replayPlayerIds.push(playerId);
      }
    }

    return replayPlayerIds;
  }

  async handlePlayerRewindUseRequest(playerId: number) {
    if (!playerId) return;
    if (this.pendingRewindUsePlayerMap[playerId.toString()] === true) return;
    if (!this.canPlayerUseRewindRightNow(playerId)) return;

    this.pendingRewindUsePlayerMap[playerId.toString()] = true;
    this.extendResolvePhaseForPendingRewind();

    try {
      const didConsumeItem = await this.removeOneRewindItemFromPlayer(playerId);
      if (!didConsumeItem) return;

      const playerLifeMap = stateManager.getVariable("playerLifeMap");
      const playerCurrentTileMap = stateManager.getVariable("playerCurrentTileMap");
      const playerRewindUsedMap = stateManager.getVariable("playerRewindUsedMap");

      playerLifeMap[playerId.toString()] = true;
      playerRewindUsedMap[playerId.toString()] = true;
      delete playerCurrentTileMap[playerId.toString()];
      delete this.playerFinalEliminationOrderMap[playerId.toString()];

      stateManager.setVariable("playerLifeMap", playerLifeMap);
      console.log(stateManager.getVariable("playerLifeMap"));
      stateManager.setVariable("playerRewindUsedMap", playerRewindUsedMap);
      stateManager.setVariable("playerCurrentTileMap", playerCurrentTileMap);
      stateManager.setVariable("winnerPlayerId", 0);
      stateManager.setVariable("winnerAnnounced", false);
      stateManager.setVariable("gameStarted", true);

      if (this.pendingRewindRespawnPlayerIds.indexOf(playerId) === -1) {
        this.pendingRewindRespawnPlayerIds.push(playerId);
      }

      this.teleportPlayersToWaitingArea([playerId]);
      this.refreshPlayerTints();
      this.refreshPlayerList();
      this.lastCenterCountdownText = "";
      this.updateCountdownText(
        "RESOLVE",
        stateManager.getVariable("phaseEndsAtMs") - this.getNowMs(),
      );
    } catch (e) {
      console.log("Unable to use Rewind", { playerId, e });
    } finally {
      delete this.pendingRewindUsePlayerMap[playerId.toString()];
    }
  }

  handlePlayerRewindInventoryChangeRequest(action: string, playerId: number) {
    this.handlePlayerRewindInventoryChangeRequestAsync(action, playerId);
  }

  async handlePlayerRewindInventoryChangeRequestAsync(
    action: string,
    playerId: number,
  ) {
    if (!playerId) return;

    try {
      if (action === "remove") {
        await this.removeOneRewindItemFromPlayer(playerId);
        return;
      }

      await this.grantRewindItemToPlayer(playerId, 1);
    } catch (e) {
      console.log("Unable to change Rewind inventory", {
        action,
        playerId,
        e,
      });
    }
  }

  canPlayerUseRewindRightNow(playerId: number): boolean {
    if (stateManager.getVariable("gamePhase") !== "RESOLVE") return false;
    if (this.shouldReplayRound) return false;

    const playerLifeMap = stateManager.getVariable("playerLifeMap");
    if (playerLifeMap[playerId.toString()] !== false) return false;

    const playerRewindUsedMap = stateManager.getVariable("playerRewindUsedMap");
    if (playerRewindUsedMap[playerId.toString()] === true) return false;

    const alivePlayerIds = this.getAlivePlayerIds();
    if (alivePlayerIds.length !== 1) return false;

    return true;
  }

  extendResolvePhaseForPendingRewind() {
    const phaseEndsAtMs = stateManager.getVariable("phaseEndsAtMs");
    const extendedEndsAtMs = Math.max(phaseEndsAtMs, this.getNowMs() + 3000);
    stateManager.setVariable("phaseEndsAtMs", extendedEndsAtMs);
  }

  async awardRewindItemsToTopSurvivors(winnerPlayerId: number) {
    const rewardedAnnouncementLines: string[] = [];

    try {
      const rewardCandidateIds = this.getTopSurvivorRewardPlayerIds(winnerPlayerId);

      for (let i = 0; i < rewardCandidateIds.length; i++) {
        const playerId = rewardCandidateIds[i];
        if (
          this.getPlayerRoundsSurvived(playerId) <
            this.minimumRewardRoundsSurvived
        ) {
          continue;
        }
        if (Math.random() >= this.rewindRewardChance) continue;

        const didGrantItem = await this.grantRewindItemToPlayer(playerId, 1);
        if (!didGrantItem) continue;

        rewardedAnnouncementLines.push(
          this.getPlayerName(playerId) + " earned a \u23EA item!",
        );
      }
    } catch (e) {
      console.log("Unable to award Rewind items", { winnerPlayerId, e });
    }

    this.arenaManager.setWinnerRewardAnnouncements(rewardedAnnouncementLines);
  }

  getTopSurvivorRewardPlayerIds(winnerPlayerId: number): number[] {
    const connectedPlayerIds = playerManager.getPlayerIds();
    const orderedOtherPlayerIds: number[] = [];

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      const playerId = connectedPlayerIds[i];
      if (playerId === winnerPlayerId) continue;
      orderedOtherPlayerIds.push(playerId);
    }

    orderedOtherPlayerIds.sort((playerIdA, playerIdB) => {
      const survivedRoundsDifference = this.getPlayerRoundsSurvived(playerIdB) -
        this.getPlayerRoundsSurvived(playerIdA);
      if (survivedRoundsDifference !== 0) {
        return survivedRoundsDifference;
      }

      const eliminationOrderDifference =
        this.getPlayerEliminationOrder(playerIdB) -
        this.getPlayerEliminationOrder(playerIdA);
      if (eliminationOrderDifference !== 0) {
        return eliminationOrderDifference;
      }

      return playerIdA - playerIdB;
    });

    const rewardPlayerIds: number[] = [winnerPlayerId];
    for (let i = 0; i < orderedOtherPlayerIds.length && rewardPlayerIds.length < 3; i++) {
      rewardPlayerIds.push(orderedOtherPlayerIds[i]);
    }

    return rewardPlayerIds;
  }

  getPlayerRoundsSurvived(playerId: number): number {
    const survivedRounds = this.playerRoundsSurvivedMap[playerId.toString()];
    if (typeof survivedRounds === "number") {
      return survivedRounds;
    }

    return 0;
  }

  getPlayerEliminationOrder(playerId: number): number {
    const eliminationOrder = this.playerFinalEliminationOrderMap[playerId.toString()];
    if (typeof eliminationOrder === "number") {
      return eliminationOrder;
    }

    return 0;
  }

  removePendingRewindRespawnPlayerId(playerId: number) {
    for (let i = this.pendingRewindRespawnPlayerIds.length - 1; i >= 0; i--) {
      if (this.pendingRewindRespawnPlayerIds[i] === playerId) {
        this.pendingRewindRespawnPlayerIds.splice(i, 1);
      }
    }
  }

  getInteractivePublicKey(): string {
    return stateManager.getVariable("publicKey");
  }

  getInventoryIntegrations(): any {
    return integrationsManager;
  }

  async getRewindCatalogItemId(): Promise<string> {
    if (this.rewindCatalogItemId) return this.rewindCatalogItemId;

    const publicKey = this.getInteractivePublicKey();
    if (!publicKey) return "";

    const inventoryIntegrations = this.getInventoryIntegrations();
    if (!inventoryIntegrations.getPublicKeyInventoryItems) return "";

    const publicKeyItems = await inventoryIntegrations.getPublicKeyInventoryItems({
      interactivePublicKey: publicKey,
    });

    for (let i = 0; i < publicKeyItems.length; i++) {
      if (publicKeyItems[i].name === this.rewindItemName) {
        this.rewindCatalogItemId = publicKeyItems[i].id;
        return this.rewindCatalogItemId;
      }
    }

    return "";
  }

  getPlayerProfileId(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (playerDetails && playerDetails.profileId) {
      return playerDetails.profileId;
    }

    return "";
  }

  async getOwnedRewindItemForPlayer(playerId: number): Promise<any> {
    try {
      const publicKey = this.getInteractivePublicKey();
      if (!publicKey) return null;

      const profileId = this.getPlayerProfileId(playerId);
      if (!profileId) return null;

      const rewindItemId = await this.getRewindCatalogItemId();
      if (!rewindItemId) return null;

      const ownedItems = await this.getInventoryIntegrations().getUserInventoryItems({
        interactivePublicKey: publicKey,
        profileId: profileId,
      });

      for (let i = 0; i < ownedItems.length; i++) {
        if (ownedItems[i].itemId === rewindItemId) {
          return ownedItems[i];
        }
      }
    } catch (e) {
      console.log("Unable to fetch Rewind item ownership", { playerId, e });
    }

    return null;
  }

  async grantRewindItemToPlayer(playerId: number, quantity: number): Promise<boolean> {
    try {
      const publicKey = this.getInteractivePublicKey();
      if (!publicKey) return false;

      const profileId = this.getPlayerProfileId(playerId);
      if (!profileId) return false;

      await this.getInventoryIntegrations().grantUserInventoryItem({
        interactivePublicKey: publicKey,
        item: this.rewindItemName,
        quantity: quantity,
        playerId: playerId,
        profileId: profileId,
      });

      return true;
    } catch (e) {
      console.log("Unable to grant Rewind item", { playerId, quantity, e });
    }

    return false;
  }

  async removeOneRewindItemFromPlayer(playerId: number): Promise<boolean> {
    try {
      const publicKey = this.getInteractivePublicKey();
      if (!publicKey) return false;

      const profileId = this.getPlayerProfileId(playerId);
      if (!profileId) return false;

      const ownedItem = await this.getOwnedRewindItemForPlayer(playerId);
      if (!ownedItem || ownedItem.quantity <= 0) {
        console.log("No Rewind item available to remove", { playerId, profileId });
        return false;
      }

      await this.getInventoryIntegrations().updateUserInventoryItemQuantity({
        interactivePublicKey: publicKey,
        itemId: ownedItem.itemId,
        userItemId: ownedItem.id,
        quantity: -1,
        playerId: playerId,
        profileId: profileId,
      });

      return true;
    } catch (e) {
      console.log("Unable to remove Rewind item", { playerId, e });
    }

    return false;
  }

  getActivityPublicKey(): string {
    return stateManager.getVariable("publicKey");
  }

  triggerWinnerParticleEffect(playerId: number) {
    try {
      if (!playerManager.isHost) return;
      const publicKey = this.getActivityPublicKey();
      if (!publicKey) return;

      let winnerEffectOptions: any;
      winnerEffectOptions = {
        interactivePublicKey: publicKey,
        particleName: "trophy_float",
        duration: 8,
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
