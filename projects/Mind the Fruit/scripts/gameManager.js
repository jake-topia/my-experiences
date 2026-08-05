"use strict";
class gameManager extends SystemScript {
    arenaManager;
    tileManager;
    minimumPlayersToStart;
    outTintColor;
    winnerTintColor;
    waitingAreaX;
    waitingAreaY;
    waitingAreaWidth;
    waitingAreaHeight;
    firstRoundStartAreaX;
    firstRoundStartAreaY;
    firstRoundStartAreaWidth;
    firstRoundStartAreaHeight;
    outAreaX;
    outAreaY;
    outAreaWidth;
    outAreaHeight;
    hostId;
    notEnoughPlayersUntilMs;
    lastCenterCountdownText;
    lastWinnerCountdownText;
    roundStartingPlayerIds;
    shouldReplayRound;
    onInit() {
        if (!playerManager.isHost)
            return;
        this.arenaManager = scriptManager.getSystem({ systemName: "arenaManager" });
        this.tileManager = scriptManager.getSystem({ systemName: "tileManager" });
        this.minimumPlayersToStart = 2;
        this.outTintColor = "#d94747ff";
        this.winnerTintColor = "#58c96bff";
        this.waitingAreaX = 300;
        this.waitingAreaY = 1310;
        this.waitingAreaWidth = 600;
        this.waitingAreaHeight = 120;
        this.firstRoundStartAreaX = 281;
        this.firstRoundStartAreaY = 222;
        this.firstRoundStartAreaWidth = 150;
        this.firstRoundStartAreaHeight = 150;
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
        this.resetVariablesForWaiting();
        this.refreshConnectedPlayerNameplates();
        this.refreshLobby();
    }
    onHostStart() {
        if (!playerManager.isHost)
            return;
        this.hostId = playerManager.getMyPlayerId();
        this.refreshLobby();
    }
    onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        this.setPlayerNameplate(playerId);
        const phase = stateManager.getVariable("gamePhase");
        if (phase === "WAITING") {
            this.refreshLobby();
            return;
        }
        const playerLifeMap = stateManager.getVariable("playerLifeMap");
        const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
        playerLifeMap[playerId.toString()] = false;
        delete currentTileMap[playerId.toString()];
        stateManager.setVariable("playerLifeMap", playerLifeMap);
        console.log(stateManager.getVariable("playerLifeMap"));
        stateManager.setVariable("playerCurrentTileMap", currentTileMap);
        this.teleportPlayersToOutArea([playerId]);
        this.refreshPlayerTints();
        this.refreshPlayerList();
    }
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        const playerLifeMap = stateManager.getVariable("playerLifeMap");
        const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
        delete playerLifeMap[playerId.toString()];
        delete currentTileMap[playerId.toString()];
        stateManager.setVariable("playerLifeMap", playerLifeMap);
        console.log(stateManager.getVariable("playerLifeMap"));
        stateManager.setVariable("playerCurrentTileMap", currentTileMap);
        const phase = stateManager.getVariable("gamePhase");
        if (phase === "WAITING") {
            this.refreshLobby();
            return;
        }
        this.handleAliveCountChanges();
        this.refreshPlayerList();
    }
    onSpriteClicked(params) {
        if (!playerManager.isHost)
            return;
        if (!params || !params.sprite)
            return;
        if (params.sprite.uniqueId !== "startButtonText" &&
            params.sprite.uniqueId !== "hostStartButton")
            return;
        if (stateManager.getVariable("gamePhase") !== "WAITING")
            return;
        this.tryStartGame();
    }
    onPhysicsStep() {
        if (!playerManager.isHost)
            return;
        const phase = stateManager.getVariable("gamePhase");
        if (phase === "WAITING") {
            this.ensureWaitingStartButtons();
            this.maybeRestoreStartButtons();
            return;
        }
        const phaseEndsAtMs = stateManager.getVariable("phaseEndsAtMs");
        if (!phaseEndsAtMs || phaseEndsAtMs <= 0)
            return;
        const now = this.getNowMs();
        const remainingMs = phaseEndsAtMs - now;
        this.updateCountdownText(phase, remainingMs);
        if (remainingMs > 0)
            return;
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
        if (!playerManager.isHost)
            return;
        this.resetToWaitingState();
    }
    tryStartGame() {
        if (!playerManager.isHost)
            return;
        const connectedPlayerIds = playerManager.getPlayerIds();
        if (connectedPlayerIds.length < this.minimumPlayersToStart) {
            this.showNotEnoughPlayersFeedback();
            return;
        }
        const playerLifeMap = {};
        for (let i = 0; i < connectedPlayerIds.length; i++) {
            playerLifeMap[connectedPlayerIds[i].toString()] = true;
        }
        stateManager.setVariable("playerLifeMap", playerLifeMap);
        console.log(stateManager.getVariable("playerLifeMap"));
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
        this.arenaManager.showOutZone();
        this.beginNextRound();
    }
    beginNextRound() {
        if (!playerManager.isHost)
            return;
        const alivePlayerIds = this.getAlivePlayerIds();
        if (alivePlayerIds.length <= 1) {
            if (alivePlayerIds.length === 1) {
                this.declareWinner(alivePlayerIds[0]);
            }
            else {
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
        if (nextRoundNumber === 1) {
            this.teleportPlayersToFirstRoundStartArea(alivePlayerIds);
        }
        this.tileManager.refreshPlayerCurrentTileMap(alivePlayerIds);
        this.refreshPlayerList();
        this.updateCountdownText("MEMORIZE", memorizeDurationMs);
    }
    beginMovePhase() {
        if (!playerManager.isHost)
            return;
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
        if (!playerManager.isHost)
            return;
        const alivePlayerIds = this.getAlivePlayerIds();
        const playerLifeMap = stateManager.getVariable("playerLifeMap");
        const playerCurrentTileMap = stateManager.getVariable("playerCurrentTileMap");
        const eliminatedPlayerIds = [];
        const survivingPlayerIds = [];
        this.tileManager.refreshPlayerCurrentTileMap(alivePlayerIds);
        for (let i = 0; i < alivePlayerIds.length; i++) {
            const playerId = alivePlayerIds[i];
            const isSafe = this.tileManager.isPlayerOnSafeTile(playerId);
            if (isSafe) {
                survivingPlayerIds.push(playerId);
            }
            else {
                playerLifeMap[playerId.toString()] = false;
                delete playerCurrentTileMap[playerId.toString()];
                eliminatedPlayerIds.push(playerId);
            }
        }
        stateManager.setVariable("playerLifeMap", playerLifeMap);
        console.log(stateManager.getVariable("playerLifeMap"));
        stateManager.setVariable("playerCurrentTileMap", playerCurrentTileMap);
        stateManager.setVariable("roundResolutionNonce", stateManager.getVariable("roundResolutionNonce") + 1);
        if (eliminatedPlayerIds.length > 0) {
            this.teleportPlayersToOutArea(eliminatedPlayerIds);
        }
        this.tileManager.showSafeResults();
        if (survivingPlayerIds.length === 1) {
            this.shouldReplayRound = false;
            stateManager.setVariable("winnerPlayerId", survivingPlayerIds[0]);
            stateManager.setVariable("winnerAnnounced", true);
            stateManager.setVariable("gameStarted", false);
        }
        else if (survivingPlayerIds.length === 0) {
            this.shouldReplayRound = true;
            stateManager.setVariable("winnerPlayerId", 0);
            stateManager.setVariable("winnerAnnounced", false);
        }
        else {
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
        if (!playerManager.isHost)
            return;
        if (this.shouldReplayRound) {
            this.replayCurrentRound();
            return;
        }
        const alivePlayerIds = this.getAlivePlayerIds();
        if (alivePlayerIds.length === 1) {
            this.resetToWaitingState();
            return;
        }
        if (alivePlayerIds.length === 0) {
            this.resetToWaitingState();
            return;
        }
        this.beginNextRound();
    }
    declareWinner(playerId) {
        if (!playerManager.isHost)
            return;
        const playerDetails = playerManager.getPlayerDetails(playerId);
        const winnerName = playerDetails && playerDetails.username
            ? playerDetails.username
            : "Player " + playerId.toString();
        stateManager.setVariable("winnerAnnounced", true);
        stateManager.setVariable("winnerPlayerId", playerId);
        stateManager.setVariable("gameStarted", false);
        stateManager.setVariable("gamePhase", "WINNER");
        stateManager.setVariable("phaseEndsAtMs", this.getNowMs() + 5000);
        this.lastCenterCountdownText = "";
        this.lastWinnerCountdownText = "";
        this.tileManager.hideAllTiles();
        this.arenaManager.hideCenterPanel();
        this.arenaManager.hideOutZone();
        this.arenaManager.showWinner(winnerName);
        this.refreshPlayerList();
        this.updateCountdownText("WINNER", 5000);
    }
    resetToWaitingState() {
        if (!playerManager.isHost)
            return;
        this.roundStartingPlayerIds = [];
        this.shouldReplayRound = false;
        this.resetVariablesForWaiting();
        this.tileManager.clearAll();
        this.refreshPlayerTints();
        this.setAllConnectedPlayersWaiting();
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
        this.notEnoughPlayersUntilMs = 0;
    }
    refreshLobby() {
        if (!playerManager.isHost)
            return;
        this.arenaManager.showLobby(this.getHostName());
        this.refreshPlayerList();
        this.ensureWaitingStartButtons();
        const connectedPlayerIds = playerManager.getPlayerIds();
        if (connectedPlayerIds.length > 0 &&
            connectedPlayerIds.length < this.minimumPlayersToStart) {
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
    setPlayerNameplate(playerId) {
        const playerDetails = playerManager.getPlayerDetails(playerId);
        const username = playerDetails && playerDetails.username
            ? playerDetails.username
            : "Player " + playerId.toString();
        playerManager.setNameplate(playerId, "\uD83C\uDF53 " + username + " \uD83C\uDF4C");
    }
    refreshPlayerTints(winnerPlayerId) {
        const playerLifeMap = stateManager.getVariable("playerLifeMap");
        const connectedPlayerIds = playerManager.getPlayerIds();
        for (let i = 0; i < connectedPlayerIds.length; i++) {
            const playerId = connectedPlayerIds[i];
            let tintColor = null;
            if (playerLifeMap[playerId.toString()] === false) {
                tintColor = this.outTintColor;
            }
            if (winnerPlayerId && playerId === winnerPlayerId) {
                tintColor = this.winnerTintColor;
            }
            playerManager.tintPlayer(playerId, tintColor);
        }
    }
    teleportPlayersToWaitingArea(playerIds) {
        if (playerIds.length === 0)
            return;
        playerManager.teleportPlayers(playerIds, {
            distributionType: "area",
            positionX: this.waitingAreaX,
            positionY: this.waitingAreaY,
            width: this.waitingAreaWidth,
            height: this.waitingAreaHeight,
        });
    }
    teleportPlayersToFirstRoundStartArea(playerIds) {
        if (playerIds.length === 0)
            return;
        playerManager.teleportPlayers(playerIds, {
            distributionType: "area",
            positionX: this.firstRoundStartAreaX,
            positionY: this.firstRoundStartAreaY,
            width: this.firstRoundStartAreaWidth,
            height: this.firstRoundStartAreaHeight,
        });
    }
    teleportPlayersToOutArea(playerIds) {
        if (playerIds.length === 0)
            return;
        playerManager.teleportPlayers(playerIds, {
            distributionType: "area",
            positionX: this.outAreaX,
            positionY: this.outAreaY,
            width: this.outAreaWidth,
            height: this.outAreaHeight,
        });
    }
    getAlivePlayerIds() {
        const playerLifeMap = stateManager.getVariable("playerLifeMap");
        const connectedPlayerIds = playerManager.getPlayerIds();
        const alivePlayerIds = [];
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
        if (phase === "WAITING")
            return;
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
    getMemorizeDurationMs(roundNumber) {
        if (roundNumber <= 7)
            return 8000;
        const reducedDuration = 8000 - (roundNumber - 7) * 500;
        return Math.max(3000, reducedDuration);
    }
    updateCountdownText(phase, remainingMs) {
        const countdownText = this.formatCountdownText(remainingMs);
        if (phase === "WINNER") {
            const winnerText = "New game in " + countdownText;
            if (winnerText === this.lastWinnerCountdownText)
                return;
            this.lastWinnerCountdownText = winnerText;
            this.arenaManager.setWinnerCountdown(winnerText);
            return;
        }
        let centerText = "Time Left: " + countdownText;
        if (phase === "RESOLVE") {
            centerText = "Next Round Starts: " + countdownText;
        }
        if (centerText === this.lastCenterCountdownText)
            return;
        this.lastCenterCountdownText = centerText;
        this.arenaManager.setCenterFooterText(centerText, "#F01135");
    }
    formatCountdownText(remainingMs) {
        const safeRemainingMs = Math.max(0, remainingMs);
        const roundedSeconds = Math.ceil(safeRemainingMs / 1000);
        return roundedSeconds.toString();
    }
    getNowMs() {
        return new Date().getTime();
    }
    getHostName() {
        if (!this.hostId) {
            this.hostId = playerManager.getMyPlayerId();
        }
        const hostDetails = playerManager.getPlayerDetails(this.hostId);
        if (hostDetails && hostDetails.username) {
            return hostDetails.username;
        }
        return "the host";
    }
    getPlayerName(playerId) {
        const playerDetails = playerManager.getPlayerDetails(playerId);
        if (playerDetails && playerDetails.username) {
            return playerDetails.username;
        }
        return "Player " + playerId.toString();
    }
    getStartButtonText() {
        return "Click here to start!";
    }
    getHostStartButtonPosition() {
        if (!this.hostId)
            return null;
        const hostDetails = playerManager.getPlayerDetails(this.hostId);
        if (!hostDetails)
            return null;
        return {
            positionX: hostDetails.x + 45,
            positionY: hostDetails.y + 15,
        };
    }
    ensureWaitingStartButtons() {
        if (!playerManager.isHost)
            return;
        if (stateManager.getVariable("gamePhase") !== "WAITING")
            return;
        const buttonText = this.notEnoughPlayersUntilMs > this.getNowMs()
            ? "Not enough players"
            : this.getStartButtonText();
        const buttonColor = this.notEnoughPlayersUntilMs > this.getNowMs()
            ? "#555555"
            : "#F01135";
        this.arenaManager.setCenterStartButtonText(buttonText, buttonColor);
        const hostButtonPosition = this.getHostStartButtonPosition();
        if (!hostButtonPosition)
            return;
        this.arenaManager.updateHostStartButton(hostButtonPosition.positionX, hostButtonPosition.positionY, buttonText, buttonColor);
    }
    showNotEnoughPlayersFeedback() {
        this.notEnoughPlayersUntilMs = this.getNowMs() + 1500;
        this.ensureWaitingStartButtons();
    }
    maybeRestoreStartButtons() {
        if (!this.notEnoughPlayersUntilMs)
            return;
        if (this.getNowMs() < this.notEnoughPlayersUntilMs)
            return;
        this.notEnoughPlayersUntilMs = 0;
        this.ensureWaitingStartButtons();
    }
    replayCurrentRound() {
        if (!playerManager.isHost)
            return;
        const replayPlayerIds = this.getReplayPlayerIds();
        this.shouldReplayRound = false;
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
        stateManager.setVariable("phaseEndsAtMs", this.getNowMs() + memorizeDurationMs);
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
        if (!playerManager.isHost)
            return;
        this.arenaManager.refreshPlayerList(stateManager.getVariable("gamePhase"));
    }
    getReplayPlayerIds() {
        const connectedPlayerIds = playerManager.getPlayerIds();
        const replayPlayerIds = [];
        for (let i = 0; i < connectedPlayerIds.length; i++) {
            const playerId = connectedPlayerIds[i];
            if (this.roundStartingPlayerIds.indexOf(playerId) !== -1) {
                replayPlayerIds.push(playerId);
            }
        }
        return replayPlayerIds;
    }
    getActivityPublicKey() {
        let publicKey = "";
        try {
            publicKey = stateManager.getVariable("PublicKey");
        }
        catch (e) { }
        if (!publicKey) {
            try {
                publicKey = stateManager.getVariable("publicKey");
            }
            catch (e) { }
        }
        if (!publicKey) {
            try {
                publicKey = stateManager.getVariable("interactivePublicKey");
            }
            catch (e) { }
        }
        return publicKey;
    }
    setWorldActivity(type) {
        try {
            if (!playerManager.isHost)
                return;
            const publicKey = this.getActivityPublicKey();
            if (!publicKey)
                return;
            integrationsManager.setWorldActivity({
                type: type,
                interactivePublicKey: publicKey,
            });
        }
        catch (e) { }
    }
}
