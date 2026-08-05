"use strict";
const BALL_RESET_TIMER_ID = 'tpongBallReset';
class PongGameManager extends SystemScript {
    systemName;
    // --- Configuration Reference ---
    config; // PongConfigSystem
    // --- Game State ---
    currentState; // LOBBY | COUNTDOWN | ACTIVE | GAME_OVER
    // --- Player Management ---
    teamRed; // Player IDs on red team
    teamBlue; // Player IDs on blue team
    teamGreen; // Player IDs on green team
    teamYellow; // Player IDs on yellow team
    scoreRed; // DEPRECATED - replaced by lives
    scoreBlue; // DEPRECATED - replaced by lives
    scoreGreen; // DEPRECATED - replaced by lives
    scoreYellow; // DEPRECATED - replaced by lives
    activePlayers; // list of player IDs in current game
    playerColors; // team -> player tint color hex
    // --- Lives System (NEW) ---
    livesRed;
    livesBlue;
    livesGreen;
    livesYellow;
    // --- Round System (NEW) ---
    currentRound; // 1, 2, or 3
    nextRoundNumber; // Next round to start (for countdown display)
    roundWins; // playerId (red/blue/green/yellow) -> wins count
    tournamentInProgress;
    roundTransitionState; // '' | 'celebration' | 'countdown'
    roundTransitionEndTime; // timestamp when current transition ends
    roundCountdownDisplay; // last displayed countdown number
    originalPlayerCount; // Original game layout (2 or 4) - determines paddle/goal positions
    // --- Sudden Death System (NEW) ---
    suddenDeathActive; // true when in sudden death mode
    eliminatedTeams; // teams eliminated in sudden death
    activeSuddenDeathTeams; // teams still alive in sudden death
    // --- Player Leave Tracking ---
    leftTeams; // teams whose players left mid-tournament (persists across rounds)
    // --- Subsystems ---
    paddleManager; // PongPaddleManager
    ballManager; // PongBallManager
    uiManager; // PongUIManager
    analyticsManager; // PongAnalyticsManager
    // --- Countdown State (CTF pattern - no timers, use Date.now()) ---
    countdownEndTime; // timestamp when countdown ends
    lastCountdownDisplay; // last displayed countdown number
    // --- Game Over State ---
    winningTeam;
    gameOverTimeoutId;
    scoreTimeoutId;
    debugLogging;
    // --- Multi-ball Feature ---
    consecutiveHits; // Count hits without scoring
    // --- Camping Detection (Button Mode Only) ---
    campingTimers; // playerId -> timestamp when they entered play area
    onInit() {
        this.debugLogging = false;
        this.logDebug('[PongGM] Initializing game manager');
        this.systemName = 'PongGameManager';
        // Get configuration reference (should be attached by main.ts)
        this.config = scriptManager.getSystem({ systemName: 'PongConfigSystem' });
        if (!this.config) {
            console.error('[PongGM] ERROR: PongConfigSystem not found!');
            return;
        }
        // Initialize state
        this.currentState = 'LOBBY';
        this.teamRed = [];
        this.teamBlue = [];
        this.teamGreen = [];
        this.teamYellow = [];
        this.logDebug('[PongGM] DEBUG: Team lists initialized - Red:', typeof this.teamRed, 'isArray:', Array.isArray(this.teamRed));
        this.logDebug('[PongGM] DEBUG: Team lists initialized - Blue:', typeof this.teamBlue, 'isArray:', Array.isArray(this.teamBlue));
        this.scoreRed = 0;
        this.scoreBlue = 0;
        this.scoreGreen = 0;
        this.scoreYellow = 0;
        this.activePlayers = [];
        this.countdownEndTime = 0;
        this.lastCountdownDisplay = 0;
        this.winningTeam = '';
        this.scoreTimeoutId = null;
        this.consecutiveHits = 0; // Initialize multiball tracking
        this.campingTimers = {}; // Initialize camping detection
        // Initialize lives system (NEW)
        this.livesRed = 0;
        this.livesBlue = 0;
        this.livesGreen = 0;
        this.livesYellow = 0;
        // Initialize round system (NEW)
        this.currentRound = 1;
        this.nextRoundNumber = 1;
        this.roundWins = {};
        this.roundWins.red = 0;
        this.roundWins.blue = 0;
        this.roundWins.green = 0;
        this.roundWins.yellow = 0;
        this.tournamentInProgress = false;
        this.originalPlayerCount = 2; // Default to 2-player layout
        // Initialize sudden death system (NEW)
        this.suddenDeathActive = false;
        this.eliminatedTeams = [];
        this.activeSuddenDeathTeams = [];
        // Initialize player leave tracking
        this.leftTeams = [];
        // Initialize player colors (light tints for visibility)
        this.playerColors = {
            red: '#D9A19A',
            blue: '#A3C4D9',
            green: '#A8D9A1',
            yellow: '#F5D9A3',
        };
        // Get references to subsystems (should be attached by main.ts)
        this.paddleManager = scriptManager.getSystem({
            systemName: 'PongPaddleManager',
        });
        this.ballManager = scriptManager.getSystem({
            systemName: 'PongBallManager',
        });
        this.uiManager = scriptManager.getSystem({ systemName: 'PongUIManager' });
        this.analyticsManager = scriptManager.getSystem({
            systemName: 'PongAnalyticsManager',
        });
        if (!this.paddleManager) {
            console.error('[PongGM] ERROR: PongPaddleManager not found!');
        }
        if (!this.ballManager) {
            console.error('[PongGM] ERROR: PongBallManager not found!');
        }
        if (!this.uiManager) {
            console.error('[PongGM] ERROR: PongUIManager not found!');
        }
        if (!this.analyticsManager) {
            console.error('[PongGM] ERROR: PongAnalyticsManager not found!');
        }
        // Show lobby UI
        if (playerManager.isHost) {
            this.showLobby();
        }
    }
    logDebug(message, ...args) {
        if (!this.debugLogging)
            return;
        const mergedArgs = [message];
        if (args && args.length) {
            for (let i = 0; i < args.length; i++) {
                mergedArgs.push(args[i]);
            }
        }
        console.log.apply(console, mergedArgs);
    }
    clearScoreResetTimer() {
        if (!this.scoreTimeoutId)
            return;
        const timer = typeof timerManager !== 'undefined' && timerManager
            ? timerManager
            : null;
        try {
            if (timer && typeof timer.clearTimer === 'function') {
                timer.clearTimer(this.scoreTimeoutId);
            }
        }
        catch (err) {
            console.warn('[PongGM] Failed to clear timer "' + this.scoreTimeoutId + '"', err);
        }
        this.scoreTimeoutId = null;
    }
    /**
     * LOBBY: Show team selection and start button
     */
    showLobby() {
        console.log('[PongGM] Entering LOBBY state');
        this.currentState = 'LOBBY';
        const playerCount = this.getConnectedPlayerCount();
        // Clear any game over timeout (if still set)
        if (this.gameOverTimeoutId) {
            this.gameOverTimeoutId = null;
        }
        this.clearScoreResetTimer();
        if (this.paddleManager) {
            this.paddleManager.removeAllPaddles();
        }
        if (this.ballManager) {
            this.ballManager.removeBall();
        }
        if (this.uiManager) {
            this.uiManager.hideCountdown();
            this.uiManager.hideScoreboard();
            this.uiManager.hideGameOver();
        }
        // Reset game state
        this.teamRed = [];
        this.teamBlue = [];
        this.teamGreen = [];
        this.teamYellow = [];
        this.scoreRed = 0;
        this.scoreBlue = 0;
        this.scoreGreen = 0;
        this.scoreYellow = 0;
        this.livesRed = 0;
        this.livesBlue = 0;
        this.livesGreen = 0;
        this.livesYellow = 0;
        this.activePlayers = [];
        this.winningTeam = '';
        this.currentRound = 1; // Reset to round 1
        this.nextRoundNumber = 1;
        this.tournamentInProgress = false;
        this.roundWins.red = 0;
        this.roundWins.blue = 0;
        this.roundWins.green = 0;
        this.roundWins.yellow = 0;
        this.config.roundMode = 'button'; // Reset to button mode
        this.config.currentRound = 1;
        this.suddenDeathActive = false;
        this.eliminatedTeams = [];
        this.activeSuddenDeathTeams = [];
        this.leftTeams = []; // Reset left teams tracking for new game
        // Show lobby UI
        if (this.uiManager) {
            this.uiManager.showLobby(playerCount);
        }
        if (playerCount === 1) {
            this.setWorldActivity('GAME_WAITING');
        }
    }
    /**
     * Player joins a team (using CTF pattern with PseudoLists)
     */
    joinTeam(playerId, teamId) {
        if (!playerManager.isHost)
            return false;
        this.logDebug('[PongGM] joinTeam called - playerId:', playerId, 'teamId:', teamId);
        this.logDebug('[PongGM] DEBUG: Before join - teamRed type:', typeof this.teamRed, 'isArray:', Array.isArray(this.teamRed), 'length:', this.teamRed.length);
        // Validate team
        if (teamId !== 'red' &&
            teamId !== 'blue' &&
            teamId !== 'green' &&
            teamId !== 'yellow') {
            console.warn('[PongGM] Invalid team: ' + teamId);
            return false;
        }
        const playerCount = this.getConnectedPlayerCount();
        const availableTeams = this.config.getAvailableTeams(playerCount);
        let isValid = false;
        for (let i = 0; i < availableTeams.length; i++) {
            if (availableTeams[i] === teamId) {
                isValid = true;
                break;
            }
        }
        if (!isValid) {
            console.warn('[PongGM] Team not available: ' +
                teamId +
                ' for player count: ' +
                playerCount);
            return false;
        }
        // Check if already in that team
        const currentTeam = this.getPlayerTeam(playerId);
        if (currentTeam === teamId) {
            this.logDebug('[PongGM] Player ' + playerId + ' already in ' + teamId);
            return true;
        }
        // Remove from all teams first - directly manipulate properties, don't pass as parameters
        // Remove from red
        for (let i = 0; i < this.teamRed.length; i++) {
            if (this.teamRed[i] === playerId) {
                for (let j = i + 1; j < this.teamRed.length; j++) {
                    this.teamRed[j - 1] = this.teamRed[j];
                }
                this.teamRed.pop();
                break;
            }
        }
        // Remove from blue
        for (let i = 0; i < this.teamBlue.length; i++) {
            if (this.teamBlue[i] === playerId) {
                for (let j = i + 1; j < this.teamBlue.length; j++) {
                    this.teamBlue[j - 1] = this.teamBlue[j];
                }
                this.teamBlue.pop();
                break;
            }
        }
        // Remove from green
        for (let i = 0; i < this.teamGreen.length; i++) {
            if (this.teamGreen[i] === playerId) {
                for (let j = i + 1; j < this.teamGreen.length; j++) {
                    this.teamGreen[j - 1] = this.teamGreen[j];
                }
                this.teamGreen.pop();
                break;
            }
        }
        // Remove from yellow
        for (let i = 0; i < this.teamYellow.length; i++) {
            if (this.teamYellow[i] === playerId) {
                for (let j = i + 1; j < this.teamYellow.length; j++) {
                    this.teamYellow[j - 1] = this.teamYellow[j];
                }
                this.teamYellow.pop();
                break;
            }
        }
        // Check if team is full (1 player per team in 2-player mode)
        const maxPerTeam = playerCount === 2 ? 1 : 1; // Could be adjusted for 4-player
        // Add to target team - push directly to property to avoid proxy issues
        this.logDebug('[PongGM] DEBUG: About to push to team ' + teamId);
        if (teamId === 'red') {
            if (this.teamRed.length >= maxPerTeam) {
                console.warn('[PongGM] Team ' + teamId + ' is full');
                return false;
            }
            this.teamRed.push(playerId);
        }
        else if (teamId === 'blue') {
            if (this.teamBlue.length >= maxPerTeam) {
                console.warn('[PongGM] Team ' + teamId + ' is full');
                return false;
            }
            this.teamBlue.push(playerId);
        }
        else if (teamId === 'green') {
            if (this.teamGreen.length >= maxPerTeam) {
                console.warn('[PongGM] Team ' + teamId + ' is full');
                return false;
            }
            this.teamGreen.push(playerId);
        }
        else {
            if (this.teamYellow.length >= maxPerTeam) {
                console.warn('[PongGM] Team ' + teamId + ' is full');
                return false;
            }
            this.teamYellow.push(playerId);
        }
        this.logDebug('[PongGM] DEBUG: After push - lengths: R=' +
            this.teamRed.length +
            ' B=' +
            this.teamBlue.length +
            ' G=' +
            this.teamGreen.length +
            ' Y=' +
            this.teamYellow.length);
        console.log('[PongGM] Player ' + playerId + ' joined ' + teamId);
        // Analytics: Track player join
        if (this.analyticsManager) {
            this.analyticsManager.trackPlayerJoin(playerId);
        }
        // Apply team color tint and update nameplate
        const playerTint = this.playerColors[teamId] || '#CCCCCC';
        playerManager.tintPlayer(playerId, playerTint);
        // Update nameplate with team emoji and lives (if in active game)
        this.updatePlayerNameplate(playerId);
        // Update UI
        if (this.uiManager) {
            this.uiManager.updateTeamSelection(this);
        }
        return true;
    }
    /**
     * Get the team a player is on
     */
    getPlayerTeam(playerId) {
        for (let i = 0; i < this.teamRed.length; i++) {
            if (this.teamRed[i] === playerId)
                return 'red';
        }
        for (let i = 0; i < this.teamBlue.length; i++) {
            if (this.teamBlue[i] === playerId)
                return 'blue';
        }
        for (let i = 0; i < this.teamGreen.length; i++) {
            if (this.teamGreen[i] === playerId)
                return 'green';
        }
        for (let i = 0; i < this.teamYellow.length; i++) {
            if (this.teamYellow[i] === playerId)
                return 'yellow';
        }
        return null;
    }
    /**
     * Convert lives count to heart emojis
     * 5 lives = ❤️❤️❤️❤️❤️
     * 3 lives = ❤️❤️❤️
     * 0 lives = (empty)
     */
    getLivesAsHearts(teamId) {
        let lives = 0;
        if (teamId === 'red')
            lives = this.livesRed;
        else if (teamId === 'blue')
            lives = this.livesBlue;
        else if (teamId === 'green')
            lives = this.livesGreen;
        else if (teamId === 'yellow')
            lives = this.livesYellow;
        let hearts = '';
        for (let i = 0; i < lives; i++) {
            hearts += '❤️';
        }
        return hearts;
    }
    /**
     * Convert wins count to crown emojis
     * 1 win = 👑
     * 2 wins = 👑👑
     * etc.
     */
    getWinsAsCrowns(teamId) {
        const wins = this.roundWins[teamId] || 0;
        if (wins <= 0)
            return '';
        let crowns = '';
        for (let i = 0; i < wins && i < 3; i++) {
            // Max 3 crowns displayed
            crowns += '👑';
        }
        return crowns;
    }
    /**
     * Update nameplate for a player (includes crowns for wins, hearts for lives, camping tent)
     */
    updatePlayerNameplate(playerId) {
        const details = playerManager.getPlayerDetails(playerId);
        if (!details)
            return;
        const username = details.username || 'P' + playerId;
        const teamId = this.getPlayerTeam(playerId);
        if (!teamId)
            return;
        const hearts = this.getLivesAsHearts(teamId);
        const crowns = this.getWinsAsCrowns(teamId);
        const pidStr = String(playerId);
        // Check if camping timer is active (> 0, not just truthy)
        const isCamping = this.campingTimers[pidStr] > 0;
        // Format: [tent?] [crowns] [hearts] [username]
        let nameplate = '';
        if (isCamping)
            nameplate += '⛺ ';
        if (crowns)
            nameplate += crowns + ' ';
        if (hearts)
            nameplate += hearts + ' ';
        nameplate += username;
        playerManager.setNameplate(playerId, nameplate);
    }
    /**
     * Auto-assign players to teams based on player count
     * 2 players: Red vs Blue (top vs bottom)
     * 4 players: Red vs Blue vs Green vs Yellow (all four teams)
     */
    autoAssignTeams(playerCount) {
        if (!playerManager.isHost)
            return;
        // Clear all teams first
        this.teamRed = [];
        this.teamBlue = [];
        this.teamGreen = [];
        this.teamYellow = [];
        // Get all connected players
        const allPlayerIds = playerManager.getPlayerIds();
        if (playerCount === 2) {
            // 2-player: Red vs Blue
            this.joinTeam(allPlayerIds[0], 'red');
            this.joinTeam(allPlayerIds[1], 'blue');
        }
        else if (playerCount === 4) {
            // 4-player: All four teams
            this.joinTeam(allPlayerIds[0], 'red');
            this.joinTeam(allPlayerIds[1], 'blue');
            this.joinTeam(allPlayerIds[2], 'green');
            this.joinTeam(allPlayerIds[3], 'yellow');
        }
        console.log('[PongGM] Auto-assigned ' + playerCount + ' players to teams');
    }
    /**
     * Start the game (host only)
     * Auto-assigns players: 2 players = Red vs Blue, 4 players = all teams
     */
    startGame() {
        if (!playerManager.isHost)
            return;
        const playerCount = this.getConnectedPlayerCount();
        // Only allow 2 or 4 player games
        if (playerCount !== 2 && playerCount !== 4) {
            console.warn('[PongGM] Need exactly 2 or 4 players to start (currently have ' +
                playerCount +
                ')');
            // TODO: Show feedback to players
            return;
        }
        console.log('[PongGM] Starting game with ' + playerCount + ' players');
        // Auto-assign players to teams
        this.autoAssignTeams(playerCount);
        const teamCount = this.getAssignedTeamCount();
        console.log('[PongGM] Team counts - R:' +
            this.teamRed.length +
            ' B:' +
            this.teamBlue.length +
            ' G:' +
            this.teamGreen.length +
            ' Y:' +
            this.teamYellow.length);
        console.log('[PongGM] Assigned to ' + teamCount + ' teams');
        // Reset scores for new game (deprecated but kept for compatibility)
        this.scoreRed = 0;
        this.scoreBlue = 0;
        this.scoreGreen = 0;
        this.scoreYellow = 0;
        // Initialize tournament (NEW - Phase 5)
        this.currentRound = 1;
        this.tournamentInProgress = true;
        this.roundWins.red = 0;
        this.roundWins.blue = 0;
        this.roundWins.green = 0;
        this.roundWins.yellow = 0;
        console.log('[PongGM] Tournament started - Round 1 of 3');
        // Store original player count for layout (important for sudden death)
        // This determines paddle positions and goal zones for the entire tournament
        this.originalPlayerCount = teamCount;
        console.log('[PongGM] Original player count set to ' +
            teamCount +
            ' (determines layout)');
        // Set Round 1 mode: Avatar/Coordinate tracking (simpler for new players)
        this.config.roundMode = 'coordinate';
        this.config.currentRound = 1;
        // Initialize lives for new round (NEW)
        this.livesRed = this.config.startingLives;
        this.livesBlue = this.config.startingLives;
        this.livesGreen = this.config.startingLives;
        this.livesYellow = this.config.startingLives;
        this.consecutiveHits = 0; // Reset multiball counter
        // Analytics: Track game start and reset counters
        if (this.analyticsManager) {
            const hostPlayerId = playerManager.getMyPlayerId();
            this.analyticsManager.trackGameStart(hostPlayerId, playerCount);
            this.analyticsManager.resetGameCounters();
        }
        // Clear any game over state
        if (this.gameOverTimeoutId) {
            clearTimeout(this.gameOverTimeoutId);
            this.gameOverTimeoutId = null;
        }
        this.clearScoreResetTimer();
        // Clean up any existing game elements
        if (this.paddleManager) {
            this.paddleManager.removeAllPaddles();
        }
        if (this.ballManager) {
            this.ballManager.removeBall();
            // Set original player count for goal zone layout (important for sudden death)
            // This determines which edges are goal zones vs walls for the entire tournament
            this.ballManager.setPlayerCount(teamCount, true);
        }
        // Hide any existing UI elements
        if (this.uiManager) {
            this.uiManager.hideGameOver();
            this.uiManager.hideScoreboard();
            this.uiManager.hideCountdown();
            this.uiManager.hideLobby();
            this.uiManager.createPlayArea(); // Create the central play area sprite
            this.uiManager.createTeamLanes(teamCount); // Create team lane rectangles
        }
        // Snapshot active players from all teams
        this.activePlayers = [];
        for (let i = 0; i < this.teamRed.length; i++) {
            this.activePlayers.push(this.teamRed[i]);
        }
        for (let i = 0; i < this.teamBlue.length; i++) {
            this.activePlayers.push(this.teamBlue[i]);
        }
        for (let i = 0; i < this.teamGreen.length; i++) {
            this.activePlayers.push(this.teamGreen[i]);
        }
        for (let i = 0; i < this.teamYellow.length; i++) {
            this.activePlayers.push(this.teamYellow[i]);
        }
        // Start Round 1 instructions -> countdown
        this.startRound1Instructions();
    }
    /**
     * Show Round 1 instructions placard (NEW - matches Round 2/3 pattern)
     */
    startRound1Instructions() {
        if (!playerManager.isHost)
            return;
        console.log('[PongGM] Starting Round 1 instructions');
        // Set state to ROUND_TRANSITION to block new player joins during countdown
        this.currentState = 'ROUND_TRANSITION';
        // Show 5-second countdown with instructions
        const countdownSeconds = Math.floor(this.config.roundCountdownMs / 1000);
        this.roundCountdownDisplay = countdownSeconds;
        if (this.uiManager) {
            this.uiManager.showRoundCountdown(1, countdownSeconds);
        }
        // Set up countdown state
        this.roundTransitionState = 'countdown';
        this.roundTransitionEndTime = Date.now() + this.config.roundCountdownMs;
        this.nextRoundNumber = 1;
    }
    /**
     * Start 3-2-1-GO countdown (called after Round 1 instructions)
     */
    startGameCountdown() {
        console.log('[PongGM] Entering COUNTDOWN state');
        this.currentState = 'COUNTDOWN';
        const countdownSeconds = this.config.countdownDuration;
        this.countdownEndTime = Date.now() + countdownSeconds * 1000;
        this.lastCountdownDisplay = countdownSeconds;
        // Show initial countdown
        if (this.uiManager) {
            this.uiManager.showCountdown(countdownSeconds.toString());
        }
        else {
            console.error('[PongGM] ERROR: UI manager unavailable during countdown');
        }
    }
    /**
     * Update loop (called from onStep) - checks countdown state
     */
    update() {
        if (!playerManager.isHost)
            return;
        const now = Date.now();
        // Handle round transition states (celebration -> countdown -> start)
        if (this.roundTransitionState === 'celebration' &&
            now >= this.roundTransitionEndTime) {
            this.startRoundCountdown();
            return;
        }
        if (this.roundTransitionState === 'countdown') {
            if (now >= this.roundTransitionEndTime) {
                // Countdown complete - start round with proper setup
                this.roundTransitionState = '';
                if (this.uiManager) {
                    this.uiManager.hideRoundCountdown();
                }
                // For Round 1, start 3-2-1 countdown; for other rounds (including sudden death), start immediately
                if (this.nextRoundNumber === 1 && this.currentRound === 1) {
                    this.startGameCountdown();
                }
                else if (this.nextRoundNumber === 4 && this.suddenDeathActive) {
                    // Sudden death - skip 3-2-1 countdown, go straight to active gameplay
                    this.startGameCountdown(); // This will trigger the 3-2-1 countdown
                }
                else {
                    const nextRoundNum = this.nextRoundNumber || this.currentRound + 1;
                    this.startNextRound(nextRoundNum);
                }
                return;
            }
            // Update countdown display every second
            const remaining = Math.ceil((this.roundTransitionEndTime - now) / 1000);
            if (remaining !== this.roundCountdownDisplay && remaining > 0) {
                this.roundCountdownDisplay = remaining;
                if (this.uiManager) {
                    this.uiManager.updateRoundCountdownNumber(remaining);
                }
            }
        }
        // Handle countdown state
        if (this.currentState === 'COUNTDOWN' && now >= this.countdownEndTime) {
            this.beginActiveGame();
            return;
        }
        // Update countdown display
        if (this.currentState === 'COUNTDOWN') {
            const remaining = Math.ceil((this.countdownEndTime - now) / 1000);
            if (remaining !== this.lastCountdownDisplay && remaining > 0) {
                this.lastCountdownDisplay = remaining;
                if (this.uiManager) {
                    this.uiManager.showCountdown(remaining.toString());
                }
            }
            else if (remaining <= 0 && this.lastCountdownDisplay > 0) {
                this.lastCountdownDisplay = 0;
                if (this.uiManager) {
                    this.uiManager.showCountdown('GO!');
                }
                else {
                    console.error('[PongGM] ERROR: UI manager unavailable for GO! display');
                }
            }
        }
        // Check for camping violations during active gameplay
        if (this.currentState === 'ACTIVE') {
            this.checkCampingViolations();
        }
    }
    /**
     * Called every frame
     */
    onStep() {
        this.update();
    }
    /**
     * ACTIVE: Begin gameplay
     */
    beginActiveGame() {
        console.log('[PongGM] Entering ACTIVE state');
        console.log('[PongGM] ⚠️ DEBUG: roundMode at beginActiveGame =', this.config.roundMode);
        console.log('[PongGM] ⚠️ DEBUG: currentRound =', this.currentRound);
        console.log('[PongGM] ⚠️ DEBUG: originalPlayerCount =', this.originalPlayerCount);
        console.log('[PongGM] ⚠️ DEBUG: activePlayers.length =', this.activePlayers.length);
        this.currentState = 'ACTIVE';
        this.setWorldActivity('GAME_ON');
        // Hide countdown
        if (this.uiManager) {
            this.uiManager.hideCountdown();
        }
        // Initialize paddles and teleport players
        // IMPORTANT: Use originalPlayerCount for layout (paddle positions and goal zones)
        // This ensures correct positioning in sudden death when fewer players remain
        const layoutPlayerCount = this.originalPlayerCount;
        const activePlayerCount = this.activePlayers.length;
        if (this.ballManager) {
            // Update active count but originalPlayerCount was already set at game start
            const countForBall = activePlayerCount >= 2 ? activePlayerCount : 2;
            this.ballManager.setPlayerCount(countForBall);
        }
        // Note: In Body Paddle mode, player avatars don't collide with the ball by default
        // Only the paddle sprites (with checkCollisions: true) will collide with the ball
        if (this.paddleManager) {
            for (let i = 0; i < this.activePlayers.length; i++) {
                const playerId = this.activePlayers[i];
                const teamId = this.getPlayerTeam(playerId);
                if (teamId) {
                    // Use layoutPlayerCount (original) for paddle position, not activePlayerCount
                    this.paddleManager.createPaddle(playerId, teamId, layoutPlayerCount);
                    // Teleport player behind their paddle (using original layout)
                    const paddlePos = this.config.getPaddlePosition(teamId, layoutPlayerCount);
                    let playerX = paddlePos.x;
                    let playerY = paddlePos.y;
                    // Offset player position away from paddle based on orientation
                    if (paddlePos.orientation === 'horizontal') {
                        // Horizontal paddle: place player above/below
                        if (paddlePos.y < this.config.centerY) {
                            // Top paddle: player above it
                            playerY = paddlePos.y - 60;
                        }
                        else {
                            // Bottom paddle: player below it
                            playerY = paddlePos.y + 60;
                        }
                    }
                    else if (paddlePos.orientation === 'vertical') {
                        // Vertical paddle: place player left/right
                        if (paddlePos.x < this.config.centerX) {
                            // Left paddle: player to the left
                            playerX = paddlePos.x - 60;
                        }
                        else {
                            // Right paddle: player to the right
                            playerX = paddlePos.x + 60;
                        }
                    }
                    // Teleport player to position
                    playerManager.teleportPlayers([playerId], {
                        distributionType: 'area',
                        positionX: playerX,
                        positionY: playerY,
                        width: 1,
                        height: 1,
                    });
                }
            }
        }
        // Initialize ball
        if (this.ballManager) {
            this.ballManager.resetBall();
        }
        this.clearScoreResetTimer();
        // Check for players already in play area and start camping timers (Button mode only)
        if (this.config.roundMode === 'button') {
            this.initializeCampingDetection();
        }
        // Show lives UI and win count AFTER paddles are created (CRITICAL - paddles need to read roundMode first)
        if (this.uiManager) {
            this.uiManager.showLivesDisplay(this);
            this.uiManager.showWinCount(this); // Show win count for tournament tracking
        }
        // Flash control buttons at start of Round 2 (button mode) to draw attention
        if (this.currentRound === 2 && this.paddleManager) {
            this.paddleManager.flashControlButtons();
        }
        // Update all player nameplates to show lives
        for (let i = 0; i < this.activePlayers.length; i++) {
            this.updatePlayerNameplate(this.activePlayers[i]);
        }
    }
    /**
     * Initialize camping detection - check if any players are already in play area
     * Called when game transitions to ACTIVE state (Button mode only)
     */
    initializeCampingDetection() {
        if (!playerManager.isHost)
            return;
        const now = Date.now();
        const playAreaX = this.config.playAreaX;
        const playAreaY = this.config.playAreaY;
        const playAreaWidth = this.config.playAreaWidth;
        const playAreaHeight = this.config.playAreaHeight;
        const playAreaRight = playAreaX + playAreaWidth;
        const playAreaBottom = playAreaY + playAreaHeight;
        // Check each active player
        for (let i = 0; i < this.activePlayers.length; i++) {
            const pid = this.activePlayers[i];
            const details = playerManager.getPlayerDetails(pid);
            if (!details)
                continue;
            const playerX = details.x || 0;
            const playerY = details.y || 0;
            // Check if player is already inside play area
            const isInsidePlayArea = playerX >= playAreaX &&
                playerX <= playAreaRight &&
                playerY >= playAreaY &&
                playerY <= playAreaBottom;
            if (isInsidePlayArea) {
                const pidStr = String(pid);
                // Start camping timer
                this.campingTimers[pidStr] = now;
                // Update nameplate with tent emoji
                this.updatePlayerNameplate(pid);
                console.log('[PongGM] Player P' +
                    pid +
                    ' already in play area at game start (camping timer started)');
            }
        }
    }
    /**
     * Called when ball hits a paddle (not a wall or goal)
     */
    onPaddleHit() {
        if (!playerManager.isHost)
            return;
        if (this.currentState !== 'ACTIVE')
            return;
        this.consecutiveHits++;
        console.log('[PongGM] Paddle hit! Consecutive hits: ' + this.consecutiveHits);
        // Analytics: Track paddle hit
        if (this.analyticsManager) {
            this.analyticsManager.trackPaddleHit();
        }
        // Spawn additional ball at every multiple of threshold (4, 8, 12, etc.)
        if (this.consecutiveHits > 0 &&
            this.consecutiveHits % this.config.multiballHitThreshold === 0) {
            var ballNumber = Math.floor(this.consecutiveHits / this.config.multiballHitThreshold) +
                1;
            console.log('[PongGM] Multiball threshold reached! Spawning ball #' +
                ballNumber +
                ' at ' +
                this.consecutiveHits +
                ' hits');
            if (this.ballManager) {
                this.ballManager.spawnAdditionalBall();
            }
            // Analytics: Track multiball trigger
            if (this.analyticsManager) {
                this.analyticsManager.trackMultiballTrigger(ballNumber, this.getConnectedPlayerCount());
            }
        }
    }
    /**
     * Handle scoring - NEW LIVES SYSTEM
     * @param zoneTeam - The team whose zone the ball entered
     * @param lastTouchTeam - The team that last touched the ball (optional)
     *
     * Scoring logic (NEW):
     * - Universal across all modes: Ball enters YOUR zone = YOU lose a life
     * - Game ends when any player hits 0 lives
     * - Winner is player with MOST lives remaining
     */
    onScore(zoneTeam, lastTouchTeam) {
        if (!playerManager.isHost)
            return;
        // Ignore scoring if not in active game state
        if (this.currentState !== 'ACTIVE') {
            console.log('[PongGM] Ignoring score in state:', this.currentState);
            return;
        }
        // Reset consecutive hits counter when a goal is scored
        this.consecutiveHits = 0;
        // NEW: Ball enters YOUR zone = YOU lose a life (universal rule)
        console.log('[PongGM] Ball entered ' +
            zoneTeam +
            ' zone - ' +
            zoneTeam +
            ' loses a life!');
        // Stop ball immediately
        if (this.ballManager) {
            this.ballManager.stopBall();
        }
        // Decrement lives for the team whose zone was scored on
        if (zoneTeam === 'red')
            this.livesRed--;
        else if (zoneTeam === 'blue')
            this.livesBlue--;
        else if (zoneTeam === 'green')
            this.livesGreen--;
        else if (zoneTeam === 'yellow')
            this.livesYellow--;
        // Also update old score system for compatibility (deprecated)
        if (zoneTeam === 'red')
            this.scoreRed++;
        else if (zoneTeam === 'blue')
            this.scoreBlue++;
        else if (zoneTeam === 'green')
            this.scoreGreen++;
        else if (zoneTeam === 'yellow')
            this.scoreYellow++;
        // Update lives display
        if (this.uiManager) {
            this.uiManager.updateLivesDisplay(this);
            this.uiManager.showWinCount(this); // Keep win count updated
        }
        // Update nameplates to show new lives count
        for (let i = 0; i < this.activePlayers.length; i++) {
            this.updatePlayerNameplate(this.activePlayers[i]);
        }
        // Check for game over
        this.checkGameOver();
        console.log(`ON SCORE COMPLETED`);
    }
    /**
     * Check if game is over (NEW - lives system)
     * Game ends when any player hits 0 lives
     */
    checkGameOver() {
        if (!playerManager.isHost)
            return;
        if (this.currentState !== 'ACTIVE')
            return;
        // SUDDEN DEATH MODE: Handle progressive elimination
        if (this.suddenDeathActive) {
            console.log('[PongGM] checkGameOver - SUDDEN DEATH mode');
            // Log active teams (PseudoList-compatible)
            let activeTeamsList = '';
            for (let t = 0; t < this.activeSuddenDeathTeams.length; t++) {
                if (t > 0)
                    activeTeamsList += ', ';
                activeTeamsList += this.activeSuddenDeathTeams[t];
            }
            console.log('[PongGM] activeSuddenDeathTeams: [' + activeTeamsList + ']');
            console.log('[PongGM] Lives - Red:' +
                this.livesRed +
                ' Blue:' +
                this.livesBlue +
                ' Green:' +
                this.livesGreen +
                ' Yellow:' +
                this.livesYellow);
            // Check if any active sudden death player hit 0 lives
            const livesMap = {
                red: this.livesRed,
                blue: this.livesBlue,
                green: this.livesGreen,
                yellow: this.livesYellow,
            };
            // Find newly eliminated team (only one can be eliminated per goal in sudden death)
            let eliminatedTeam = null;
            for (let i = 0; i < this.activeSuddenDeathTeams.length; i++) {
                const team = this.activeSuddenDeathTeams[i];
                if (livesMap[team] <= 0) {
                    eliminatedTeam = team;
                    break;
                }
            }
            if (eliminatedTeam) {
                // Player eliminated!
                console.log('[PongGM] SUDDEN DEATH - ' + eliminatedTeam + ' ELIMINATED!');
                // Remove from active list (PseudoList-compatible - rebuild without eliminated team)
                const newActiveTeams = [];
                for (let j = 0; j < this.activeSuddenDeathTeams.length; j++) {
                    if (this.activeSuddenDeathTeams[j] !== eliminatedTeam) {
                        newActiveTeams.push(this.activeSuddenDeathTeams[j]);
                    }
                }
                this.activeSuddenDeathTeams = newActiveTeams;
                // Add to eliminated list (PseudoList-compatible)
                let alreadyEliminated = false;
                for (let k = 0; k < this.eliminatedTeams.length; k++) {
                    if (this.eliminatedTeams[k] === eliminatedTeam) {
                        alreadyEliminated = true;
                        break;
                    }
                }
                if (!alreadyEliminated) {
                    this.eliminatedTeams.push(eliminatedTeam);
                }
                // Convert their zone to wall AND notify ball manager
                this.convertGoalZoneToWall(eliminatedTeam);
                if (this.ballManager) {
                    this.ballManager.setTeamEliminated(eliminatedTeam);
                }
                // Remove paddle for eliminated player
                const elimPlayerId = this.getTeamPlayerId(eliminatedTeam);
                if (elimPlayerId && this.paddleManager) {
                    this.paddleManager.removePaddleForPlayer(elimPlayerId);
                }
                console.log('[PongGM] After elimination - activeSuddenDeathTeams.length = ' +
                    this.activeSuddenDeathTeams.length);
                // Check if only 1 player remains
                if (this.activeSuddenDeathTeams.length === 1) {
                    // SUDDEN DEATH WINNER!
                    const winnerTeam = this.activeSuddenDeathTeams[0];
                    console.log('[PongGM] SUDDEN DEATH WINNER: ' + winnerTeam);
                    // CRITICAL: Change state to prevent further game logic
                    this.currentState = 'GAME_OVER';
                    // Award tournament win
                    const currentWins = this.roundWins[winnerTeam] || 0;
                    this.roundWins[winnerTeam] = currentWins + 100; // Ensure they win tournament
                    // Deactivate sudden death
                    this.suddenDeathActive = false;
                    // Show winner celebration then end tournament
                    const winnerName = this.config.getPlayerNameForTeam(winnerTeam, this);
                    const winnerText = this.config.uiText.suddenDeathWinner.replace('{player}', winnerName);
                    if (this.uiManager) {
                        this.uiManager.showRoundCelebration(winnerText, 3); // 3 second celebration
                    }
                    // Trigger confetti for winner
                    const winnerPlayerId = this.getTeamPlayerId(winnerTeam);
                    if (winnerPlayerId) {
                        const details = playerManager.getPlayerDetails(winnerPlayerId);
                        if (details) {
                            const publicKey = stateManager.getVariable('PublicKey');
                            try {
                                integrationsManager.triggerParticleEffect({
                                    particleName: 'pastelConfetti_explosion',
                                    position: { x: details.x, y: details.y },
                                    duration: 3,
                                    followPlayerId: winnerPlayerId,
                                    interactivePublicKey: publicKey,
                                });
                            }
                            catch (e) {
                                console.warn('[PongGM] Failed to trigger sudden death winner particle', e);
                            }
                        }
                    }
                    // End tournament after celebration (3 seconds)
                    console.log('[PongGM] Creating sudden death end timer (3 seconds)');
                    timerManager.createTimer({
                        duration: 3000,
                        onComplete: () => {
                            console.log('[PongGM] Sudden death end timer fired');
                            if (playerManager.isHost) {
                                this.endTournament();
                            }
                        },
                    });
                    return;
                }
                else if (this.activeSuddenDeathTeams.length === 0) {
                    // Edge case: simultaneous elimination (tie)
                    console.log('[PongGM] SUDDEN DEATH TIE - All players eliminated simultaneously');
                    this.currentState = 'GAME_OVER';
                    this.suddenDeathActive = false;
                    this.endTournament();
                    return;
                }
                else {
                    // Continue sudden death with remaining players (2+ players left)
                    // Show elimination notification only when game continues (not when winner is determined)
                    const playerName = this.config.getPlayerNameForTeam(eliminatedTeam, this);
                    if (this.uiManager) {
                        this.uiManager.showSuddenDeathElimination(playerName);
                    }
                    // Create timer to hide elimination popup
                    const durationMs = this.config.eliminationPopupMs;
                    console.log('[PongGM] Creating elimination hide timer for ' + durationMs + 'ms');
                    timerManager.createTimer({
                        duration: durationMs,
                        onComplete: () => {
                            console.log('[PongGM] Elimination hide timer fired');
                            if (this.uiManager) {
                                this.uiManager.hideSuddenDeathElimination();
                            }
                        },
                    });
                    // Reset ball aimed at a random remaining player
                    const randomIdx = Math.floor(Math.random() * this.activeSuddenDeathTeams.length);
                    const targetTeam = this.activeSuddenDeathTeams[randomIdx];
                    console.log('[PongGM] SUDDEN DEATH continues with ' +
                        this.activeSuddenDeathTeams.length +
                        ' players');
                    this.resetBallAfterScore(targetTeam);
                    return;
                }
            }
            // No elimination yet means the scored team still has lives (shouldn't happen in 1-life sudden death)
            // This can happen if ball hits an already-eliminated zone (which should now bounce)
            // Just reset ball and continue
            const randomIdx = Math.floor(Math.random() * this.activeSuddenDeathTeams.length);
            const targetTeam = this.activeSuddenDeathTeams[randomIdx];
            console.log('[PongGM] SUDDEN DEATH - score detected but no elimination (possible wall bounce issue)');
            this.resetBallAfterScore(targetTeam);
            return;
        }
        // NORMAL MODE: Check if any active player hit 0 lives
        // Use originalPlayerCount to determine which teams were in the game originally
        // Only check teams that: (1) were original players AND (2) haven't left the game
        let hasLoser = false;
        const livesMap = {
            red: this.livesRed,
            blue: this.livesBlue,
            green: this.livesGreen,
            yellow: this.livesYellow,
        };
        // Helper to check if a team has left the game
        const hasTeamLeft = (teamId) => {
            for (let k = 0; k < this.leftTeams.length; k++) {
                if (this.leftTeams[k] === teamId)
                    return true;
            }
            return false;
        };
        // Check active players based on originalPlayerCount, excluding teams that left
        // A team is a "loser" only if they were in the original game, haven't left, and hit 0 lives
        if (this.originalPlayerCount >= 1 &&
            this.teamRed.length > 0 &&
            !hasTeamLeft('red') &&
            this.livesRed <= 0)
            hasLoser = true;
        if (this.originalPlayerCount >= 2 &&
            this.teamBlue.length > 0 &&
            !hasTeamLeft('blue') &&
            this.livesBlue <= 0)
            hasLoser = true;
        if (this.originalPlayerCount >= 3 &&
            this.teamGreen.length > 0 &&
            !hasTeamLeft('green') &&
            this.livesGreen <= 0)
            hasLoser = true;
        if (this.originalPlayerCount >= 4 &&
            this.teamYellow.length > 0 &&
            !hasTeamLeft('yellow') &&
            this.livesYellow <= 0)
            hasLoser = true;
        if (!hasLoser) {
            // Game continues - reset ball aimed at random active player
            const activeTeams = [];
            if (this.teamRed.length > 0 && this.livesRed > 0)
                activeTeams.push('red');
            if (this.teamBlue.length > 0 && this.livesBlue > 0)
                activeTeams.push('blue');
            if (this.teamGreen.length > 0 && this.livesGreen > 0)
                activeTeams.push('green');
            if (this.teamYellow.length > 0 && this.livesYellow > 0)
                activeTeams.push('yellow');
            if (activeTeams.length > 0) {
                const randomIdx = Math.floor(Math.random() * activeTeams.length);
                const targetTeam = activeTeams[randomIdx];
                this.resetBallAfterScore(targetTeam);
            }
            else {
                this.resetBallAfterScore('red'); // Fallback
            }
            return;
        }
        // Game over - find winner (most lives remaining)
        let maxLives = -1;
        let winningTeam = '';
        const activeTeams = [];
        if (this.teamRed.length > 0)
            activeTeams.push('red');
        if (this.teamBlue.length > 0)
            activeTeams.push('blue');
        if (this.teamGreen.length > 0)
            activeTeams.push('green');
        if (this.teamYellow.length > 0)
            activeTeams.push('yellow');
        for (let i = 0; i < activeTeams.length; i++) {
            const team = activeTeams[i];
            const lives = livesMap[team];
            if (lives > maxLives) {
                maxLives = lives;
                winningTeam = team;
            }
        }
        // Check for tie (multiple players with same max lives)
        const winners = [];
        for (let j = 0; j < activeTeams.length; j++) {
            const team = activeTeams[j];
            if (livesMap[team] === maxLives) {
                winners.push(team);
            }
        }
        // Tournament mode: end round and track winner (NEW - Phase 5)
        if (this.tournamentInProgress) {
            // 4-player special case: if 3 players have same lives, they all survived
            // Use originalPlayerCount, not current count (handles player leaving mid-game)
            const currentTeamCount = this.getAssignedTeamCount();
            if (this.originalPlayerCount === 4 &&
                currentTeamCount >= 3 &&
                winners.length === currentTeamCount - 1) {
                // Award wins to all 3 survivors (the one with 0 lives is the loser)
                console.log('[PongGM] Round ' +
                    this.currentRound +
                    ' - 3 survivors, 1 eliminated');
                // Find the loser (player with 0 lives)
                let loserTeam = '';
                for (let k = 0; k < activeTeams.length; k++) {
                    const team = activeTeams[k];
                    if (livesMap[team] <= 0) {
                        loserTeam = team;
                        break;
                    }
                }
                // Award wins to all survivors
                for (let m = 0; m < winners.length; m++) {
                    const survivorTeam = winners[m];
                    const currentWins = this.roundWins[survivorTeam] || 0;
                    this.roundWins[survivorTeam] = (currentWins + 1);
                }
                this.endRound('survivors:' + winners.join(',') + ':loser:' + loserTeam);
            }
            else if (winners.length > 1) {
                // True tie - award wins to all tied players
                console.log('[PongGM] Round ' +
                    this.currentRound +
                    ' ended in a tie - awarding wins to all tied players');
                for (let n = 0; n < winners.length; n++) {
                    const tiedTeam = winners[n];
                    const currentWins = this.roundWins[tiedTeam] || 0;
                    this.roundWins[tiedTeam] = currentWins + 1;
                }
                this.endRound('tie:' + winners.join(','));
            }
            else {
                console.log('[PongGM] Round ' + this.currentRound + ' won by ' + winningTeam);
                this.endRound(winningTeam);
            }
        }
        else {
            // Single game mode (fallback)
            if (winners.length > 1) {
                this.endGame('tie:' + winners.join(','));
            }
            else {
                this.endGame(winningTeam);
            }
        }
    }
    /**
     * Helper to reset ball after scoring
     */
    resetBallAfterScore(targetTeam) {
        this.clearScoreResetTimer();
        const timer = typeof timerManager !== 'undefined' && timerManager
            ? timerManager
            : null;
        const timerAvailable = timer && typeof timer.setTimer === 'function';
        if (timerAvailable) {
            try {
                timer.setTimer(BALL_RESET_TIMER_ID, 1, {
                    teamId: targetTeam,
                });
                this.scoreTimeoutId = BALL_RESET_TIMER_ID;
            }
            catch (err) {
                console.warn('[PongGM] Failed to schedule ball reset timer', err);
                this.scoreTimeoutId = null;
                if (this.ballManager) {
                    this.ballManager.resetBall(targetTeam);
                }
            }
        }
        else if (this.ballManager) {
            this.ballManager.resetBall(targetTeam);
        }
    }
    onEvent_tpongBallResetNow(payload) {
        if (!playerManager.isHost)
            return;
        if (this.scoreTimeoutId === BALL_RESET_TIMER_ID) {
            this.scoreTimeoutId = null;
        }
        if (this.currentState !== 'ACTIVE')
            return;
        const targetTeam = payload &&
            typeof payload === 'object' &&
            typeof payload.teamId === 'string'
            ? payload.teamId
            : undefined;
        if (this.ballManager) {
            this.ballManager.resetBall(targetTeam);
        }
    }
    /**
     * End current round and track winner (NEW - Phase 5 Tournament System)
     */
    endRound(winningTeam) {
        if (!playerManager.isHost)
            return;
        console.log('[PongGM] Round ' + this.currentRound + ' complete');
        // Change state to prevent camping/scoring during transition
        this.currentState = 'ROUND_TRANSITION';
        // Award round win (if not a tie or survivor format)
        // Survivor format: 'survivors:red,blue,green:loser:yellow' - wins already awarded
        if (winningTeam && winningTeam.indexOf('survivors:') !== 0) {
            const currentWins = this.roundWins[winningTeam] || 0;
            this.roundWins[winningTeam] = (currentWins + 1);
            console.log('[PongGM] ' +
                winningTeam +
                ' wins Round ' +
                this.currentRound +
                ' (total wins: ' +
                (currentWins + 1) +
                ')');
        }
        else if (winningTeam && winningTeam.indexOf('survivors:') === 0) {
            console.log('[PongGM] Round ' + this.currentRound + ' - survivor round complete');
        }
        // Analytics: Track round completion
        if (this.analyticsManager) {
            // For survivor format, report each survivor as a winner
            if (winningTeam && winningTeam.indexOf('survivors:') === 0) {
                const parts = winningTeam.split(':');
                const survivorTeams = parts[1].split(',');
                // Track each survivor as a winner
                for (let i = 0; i < survivorTeams.length; i++) {
                    this.analyticsManager.trackRoundCompletion(this.currentRound, survivorTeams[i], this.getAssignedTeamCount(), this);
                }
            }
            else {
                this.analyticsManager.trackRoundCompletion(this.currentRound, winningTeam, this.getAssignedTeamCount(), this);
            }
        }
        // Particle effect: Confetti for round winner(s)
        try {
            const publicKey = stateManager.getVariable('PublicKey');
            const teamsToParticle = [];
            if (winningTeam && winningTeam.indexOf('survivors:') === 0) {
                // Survivor format - particle effect for all survivors
                const parts = winningTeam.split(':');
                const survivorTeams = parts[1].split(',');
                for (let i = 0; i < survivorTeams.length; i++) {
                    teamsToParticle.push(survivorTeams[i]);
                }
            }
            else if (winningTeam && winningTeam.indexOf('tie:') === 0) {
                // Tie format - particle effect for all tied players
                const parts = winningTeam.split(':');
                const tiedTeams = parts[1].split(',');
                for (let i = 0; i < tiedTeams.length; i++) {
                    teamsToParticle.push(tiedTeams[i]);
                }
            }
            else if (winningTeam) {
                // Single winner
                teamsToParticle.push(winningTeam);
            }
            for (let j = 0; j < teamsToParticle.length; j++) {
                const winningPlayerId = this.getTeamPlayerId(teamsToParticle[j]);
                if (winningPlayerId) {
                    const details = playerManager.getPlayerDetails(winningPlayerId);
                    if (details) {
                        integrationsManager.triggerParticleEffect({
                            particleName: 'classicConfetti_explosion',
                            position: { x: details.x, y: details.y },
                            duration: 2.0,
                            followPlayerId: winningPlayerId,
                            interactivePublicKey: publicKey,
                        });
                    }
                }
            }
        }
        catch (e) {
            console.warn('[PongGM] Round winner particle effect error: ' + e);
        }
        // Clear game state
        if (this.ballManager) {
            this.ballManager.stopBall();
            this.ballManager.removeBall();
        }
        if (this.paddleManager) {
            this.paddleManager.removeAllPaddles();
        }
        // Hide lives and win count displays during transition
        if (this.uiManager) {
            this.uiManager.hideLivesDisplay();
            this.uiManager.hideWinCount();
        }
        // Check if tournament is complete (3 rounds played)
        if (this.currentRound >= 3) {
            console.log('[PongGM] Tournament complete - determining overall winner');
            this.endTournament();
            return;
        }
        // Start celebration -> countdown -> next round sequence
        const nextRound = this.currentRound + 1;
        console.log('[PongGM] Starting round transition to Round ' + nextRound);
        // Show 3-second celebration
        if (this.uiManager) {
            let roundWinnerText = '';
            if (winningTeam && winningTeam.indexOf('survivors:') === 0) {
                // Survivor format: 'survivors:red,blue,green:loser:yellow'
                const parts = winningTeam.split(':');
                const survivorTeams = parts[1].split(',');
                const loserTeam = parts[3];
                const loserName = this.config.getPlayerNameForTeam(loserTeam, this);
                const survivorNames = [];
                for (let i = 0; i < survivorTeams.length; i++) {
                    survivorNames.push(this.config.getPlayerNameForTeam(survivorTeams[i], this));
                }
                let survivorsText = '';
                if (survivorNames.length === 2) {
                    survivorsText = survivorNames[0] + ' & ' + survivorNames[1];
                }
                else if (survivorNames.length === 3) {
                    survivorsText =
                        survivorNames[0] +
                            ', ' +
                            survivorNames[1] +
                            ' & ' +
                            survivorNames[2];
                }
                else {
                    survivorsText = survivorNames.join(', ');
                }
                roundWinnerText =
                    this.config.uiText.roundLoser.replace('{player}', loserName) +
                        ' - ' +
                        this.config.uiText.roundSurvivors.replace('{players}', survivorsText);
            }
            else if (winningTeam && winningTeam.indexOf('tie:') === 0) {
                // Tie format: 'tie:red,blue'
                const parts = winningTeam.split(':');
                const tiedTeams = parts[1].split(',');
                const tiedNames = [];
                for (let i = 0; i < tiedTeams.length; i++) {
                    tiedNames.push(this.config.getPlayerNameForTeam(tiedTeams[i], this));
                }
                let tiedText = '';
                if (tiedNames.length === 2) {
                    tiedText = tiedNames[0] + ' & ' + tiedNames[1];
                }
                else if (tiedNames.length === 3) {
                    tiedText = tiedNames[0] + ', ' + tiedNames[1] + ' & ' + tiedNames[2];
                }
                else {
                    tiedText = tiedNames.join(', ');
                }
                roundWinnerText = tiedText + ' Tie!';
            }
            else if (winningTeam) {
                const playerName = this.config.getPlayerNameForTeam(winningTeam, this);
                roundWinnerText = this.config.uiText.roundWinner.replace('{player}', playerName);
            }
            else {
                roundWinnerText = this.config.uiText.roundTie;
            }
            this.uiManager.showRoundCelebration(roundWinnerText, this.currentRound);
        }
        // Set up celebration state (currentRound will be updated by startNextRound)
        this.roundTransitionState = 'celebration';
        this.roundTransitionEndTime = Date.now() + this.config.roundCelebrationMs;
        // Store next round number for the countdown display
        this.nextRoundNumber = nextRound;
    }
    /**
     * Start round countdown with instructions (NEW)
     */
    startRoundCountdown() {
        if (!playerManager.isHost)
            return;
        const roundToShow = this.nextRoundNumber || this.currentRound;
        console.log('[PongGM] Starting round countdown for Round ' + roundToShow);
        console.log('[PongGM] DEBUG: nextRoundNumber=' +
            this.nextRoundNumber +
            ', currentRound=' +
            this.currentRound);
        // Hide celebration
        if (this.uiManager) {
            this.uiManager.hideRoundCelebration();
        }
        // Show 5-second countdown with instructions
        const countdownSeconds = Math.floor(this.config.roundCountdownMs / 1000);
        this.roundCountdownDisplay = countdownSeconds;
        if (this.uiManager) {
            this.uiManager.showRoundCountdown(roundToShow, countdownSeconds);
        }
        // Set up countdown state
        this.roundTransitionState = 'countdown';
        this.roundTransitionEndTime = Date.now() + this.config.roundCountdownMs;
    }
    /**
     * Timer event: Start next round (NEW - Phase 5)
     */
    onEvent_tpongNextRound(payload) {
        if (!playerManager.isHost)
            return;
        const nextRound = payload && payload.nextRound ? payload.nextRound : this.currentRound + 1;
        this.startNextRound(nextRound);
    }
    /**
     * Start the next round in the tournament (NEW - Phase 5)
     */
    startNextRound(roundNumber) {
        if (!playerManager.isHost)
            return;
        console.log('[PongGM] ===== Starting Round ' + roundNumber + ' =====');
        // Reset lives FIRST before anything else (critical for round 2 & 3)
        this.livesRed = this.config.startingLives;
        this.livesBlue = this.config.startingLives;
        this.livesGreen = this.config.startingLives;
        this.livesYellow = this.config.startingLives;
        this.consecutiveHits = 0;
        console.log('[PongGM] ✓ Lives reset to ' +
            this.config.startingLives +
            ' for all teams');
        // Clear any eliminated teams from previous rounds (for ball manager)
        if (this.ballManager) {
            this.ballManager.clearEliminatedTeams();
        }
        // Re-apply eliminated status for teams whose players left (persists across rounds)
        if (this.leftTeams.length > 0) {
            console.log('[PongGM] Re-applying eliminated status for left teams: ' +
                this.leftTeams.length +
                ' team(s)');
            for (let i = 0; i < this.leftTeams.length; i++) {
                const leftTeam = this.leftTeams[i];
                console.log('[PongGM] Re-marking ' +
                    leftTeam +
                    ' as eliminated (player left earlier)');
                // Set lives to 0 for left team
                if (leftTeam === 'red')
                    this.livesRed = 0;
                else if (leftTeam === 'blue')
                    this.livesBlue = 0;
                else if (leftTeam === 'green')
                    this.livesGreen = 0;
                else if (leftTeam === 'yellow')
                    this.livesYellow = 0;
                // Re-mark as eliminated in ball manager so ball bounces off their zone
                if (this.ballManager) {
                    this.ballManager.setTeamEliminated(leftTeam);
                }
                // Re-convert their zone to wall (in case sprites were cleaned up)
                this.convertGoalZoneToWall(leftTeam);
            }
        }
        this.currentRound = roundNumber;
        this.config.currentRound = roundNumber;
        // Set round mode based on round number
        // Round 1: Avatar tracking (intuitive), Round 2: Buttons (classic), Round 3: Chaos
        if (roundNumber === 1) {
            this.config.roundMode = 'coordinate';
            console.log('[PongGM] Round 1: Avatar Tracking Mode');
        }
        else if (roundNumber === 2) {
            this.config.roundMode = 'button';
            console.log('[PongGM] Round 2: Button Control Mode');
        }
        else if (roundNumber === 3) {
            this.config.roundMode = 'bodypaddle';
            console.log('[PongGM] Round 3: Body Paddle Mode');
        }
        // Clean up any existing game elements
        if (this.paddleManager) {
            this.paddleManager.removeAllPaddles();
        }
        if (this.ballManager) {
            this.ballManager.removeBall();
        }
        // Start the 3-2-1 countdown for this round
        console.log('[PongGM] Starting 3-2-1 countdown for Round ' + roundNumber);
        this.startGameCountdown();
    }
    /**
     * End tournament and determine overall winner (NEW - Phase 5)
     */
    endTournament() {
        if (!playerManager.isHost)
            return;
        console.log('[PongGM] Tournament ended - calculating final results');
        this.tournamentInProgress = false;
        // Determine tournament winner (most round wins)
        const activeTeams = [];
        if (this.teamRed.length > 0)
            activeTeams.push('red');
        if (this.teamBlue.length > 0)
            activeTeams.push('blue');
        if (this.teamGreen.length > 0)
            activeTeams.push('green');
        if (this.teamYellow.length > 0)
            activeTeams.push('yellow');
        let maxWins = -1;
        let tournamentWinner = '';
        for (let i = 0; i < activeTeams.length; i++) {
            const team = activeTeams[i];
            const wins = this.roundWins[team] || 0;
            console.log('[PongGM] ' + team + ' total round wins: ' + wins);
            if (wins > maxWins) {
                maxWins = wins;
                tournamentWinner = team;
            }
        }
        // Check for tie (multiple teams with same max wins)
        const tournamentWinners = [];
        for (let j = 0; j < activeTeams.length; j++) {
            const team = activeTeams[j];
            if ((this.roundWins[team] || 0) === maxWins) {
                tournamentWinners.push(team);
            }
        }
        // TIE: Trigger SUDDEN DEATH mode
        if (tournamentWinners.length > 1) {
            console.log('[PongGM] Tournament TIE - Starting SUDDEN DEATH with: ' +
                tournamentWinners.join(', '));
            this.startSuddenDeath(tournamentWinners);
            return;
        }
        // Single winner - show celebration and end game
        const playerName = this.config.getPlayerNameForTeam(tournamentWinner, this);
        const celebrationText = this.config.uiText.tournamentWinner.replace('{player}', playerName);
        console.log('[PongGM] Tournament winner: ' + tournamentWinner);
        // Show celebration
        if (this.uiManager) {
            this.uiManager.showRoundCelebration(celebrationText, 3);
        }
        // Particle effect: Trophy confetti for tournament winner(s)
        try {
            const publicKey = stateManager.getVariable('PublicKey');
            for (let k = 0; k < tournamentWinners.length; k++) {
                const winnerId = this.getTeamPlayerId(tournamentWinners[k]);
                if (winnerId) {
                    const details = playerManager.getPlayerDetails(winnerId);
                    if (details) {
                        integrationsManager.triggerParticleEffect({
                            particleName: 'pastelConfetti_explosion',
                            position: { x: details.x, y: details.y },
                            duration: 3.0,
                            followPlayerId: winnerId,
                            interactivePublicKey: publicKey,
                        });
                    }
                }
            }
        }
        catch (e) {
            console.warn('[PongGM] Tournament winner particle effect error: ' + e);
        }
        // Analytics: Track tournament completion
        if (this.analyticsManager) {
            const finalWinner = tournamentWinners.length === 1
                ? tournamentWinner
                : 'tie:' + tournamentWinners.join(',');
            this.analyticsManager.trackTournamentCompletion(finalWinner, this.getAssignedTeamCount(), this);
        }
        // Schedule auto-close after 5 seconds (let celebration be visible)
        console.log('[PongGM] Tournament complete - host will leave game in 5 seconds');
        timerManager.createTimer({
            duration: 5000,
            onComplete: () => {
                console.log('[PongGM] Tournament end timer fired - host leaving game');
                if (playerManager.isHost) {
                    playerManager.leaveGame();
                }
            },
        });
    }
    /**
     * Start SUDDEN DEATH mode (triggered on tournament tie)
     */
    startSuddenDeath(tiedTeams) {
        if (!playerManager.isHost)
            return;
        console.log('[PongGM] ===== SUDDEN DEATH ACTIVATED =====');
        console.log('[PongGM] Tied teams: ' + tiedTeams.join(', '));
        // Analytics: Track sudden death occurrence
        if (this.analyticsManager) {
            this.analyticsManager.trackSuddenDeath(this.getConnectedPlayerCount());
        }
        // Activate sudden death mode
        this.suddenDeathActive = true;
        // Copy tied teams to active list (PseudoList-compatible)
        this.activeSuddenDeathTeams = [];
        for (let t = 0; t < tiedTeams.length; t++) {
            this.activeSuddenDeathTeams.push(tiedTeams[t]);
        }
        this.eliminatedTeams = [];
        this.currentState = 'ROUND_TRANSITION';
        // Clear eliminated teams in ball manager for fresh start
        if (this.ballManager) {
            this.ballManager.clearEliminatedTeams();
        }
        // Convert non-tied teams' zones to walls immediately (they're already eliminated)
        const allTeams = ['red', 'blue', 'green', 'yellow'];
        for (let i = 0; i < allTeams.length; i++) {
            const team = allTeams[i];
            let isActive = false;
            for (let j = 0; j < tiedTeams.length; j++) {
                if (tiedTeams[j] === team) {
                    isActive = true;
                    break;
                }
            }
            if (!isActive) {
                // Team didn't make sudden death - convert their zone to wall
                this.convertGoalZoneToWall(team);
                this.eliminatedTeams.push(team);
                // Notify ball manager that this team is eliminated (ball should bounce off their zone)
                if (this.ballManager) {
                    this.ballManager.setTeamEliminated(team);
                }
                // Remove paddle for non-participating player
                const playerId = this.getTeamPlayerId(team);
                if (playerId && this.paddleManager) {
                    this.paddleManager.removePaddleForPlayer(playerId);
                }
                // Remove from active players list (manual iteration for PseudoList)
                if (playerId) {
                    for (let m = 0; m < this.activePlayers.length; m++) {
                        if (this.activePlayers[m] === playerId) {
                            // Shift elements down
                            for (let n = m + 1; n < this.activePlayers.length; n++) {
                                this.activePlayers[n - 1] = this.activePlayers[n];
                            }
                            this.activePlayers.pop();
                            break;
                        }
                    }
                    // Teleport non-participant out of play area (to corner)
                    playerManager.teleportPlayers([playerId], {
                        distributionType: 'area',
                        positionX: 50,
                        positionY: 50,
                        width: 10,
                        height: 10,
                    });
                    console.log('[PongGM] Kicked non-tied player ' +
                        playerId +
                        ' from sudden death');
                }
            }
        }
        // Set all tied players to 1 life
        for (let k = 0; k < tiedTeams.length; k++) {
            const team = tiedTeams[k];
            if (team === 'red')
                this.livesRed = 1;
            else if (team === 'blue')
                this.livesBlue = 1;
            else if (team === 'green')
                this.livesGreen = 1;
            else if (team === 'yellow')
                this.livesYellow = 1;
        }
        // Set mode to chaos (bodypaddle)
        this.config.roundMode = 'bodypaddle';
        this.currentRound = 4; // Sudden death is "Round 4"
        // Show SUDDEN DEATH countdown directly (skip separate announcement)
        const countdownSeconds = Math.floor(this.config.roundCountdownMs / 1000);
        this.roundCountdownDisplay = countdownSeconds;
        if (this.uiManager) {
            this.uiManager.showRoundCountdown(4, countdownSeconds); // 4 = sudden death
        }
        // Go directly to countdown state (not celebration)
        this.roundTransitionState = 'countdown';
        this.roundTransitionEndTime = Date.now() + this.config.roundCountdownMs;
        this.nextRoundNumber = 4; // For countdown display
    }
    /**
     * Convert a goal zone to a wall (for eliminated players in sudden death or when player leaves)
     */
    convertGoalZoneToWall(teamId) {
        if (!playerManager.isHost)
            return;
        console.log('[PongGM] Converting ' + teamId + ' zone to wall');
        // Remove the goal zone sprite (if it exists) - legacy ID
        const goalZoneId = 'pong_goal_' + teamId;
        try {
            spriteManager.removeSprite(goalZoneId);
        }
        catch (e) {
            // Sprite might not exist
        }
        // Also remove the lane sprite (created by UI manager)
        const laneId = 'pong_lane_' + teamId;
        try {
            if (spriteManager.getSprite(laneId)) {
                spriteManager.removeSprite(laneId);
            }
        }
        catch (e) {
            // Sprite might not exist
        }
        // Calculate zone position based on team and lane dimensions
        const laneWidth = this.config.laneWidth;
        const worldWidth = this.config.worldWidth;
        const worldHeight = this.config.worldHeight;
        const playAreaHeight = this.config.playAreaHeight;
        let x = 0;
        let y = 0;
        let width = 0;
        let height = 0;
        if (teamId === 'red') {
            // Top zone
            x = 0;
            y = 0;
            width = worldWidth;
            height = laneWidth;
        }
        else if (teamId === 'blue') {
            // Bottom zone
            x = 0;
            y = worldHeight - laneWidth;
            width = worldWidth;
            height = laneWidth;
        }
        else if (teamId === 'green') {
            // Left zone (excluding corners)
            x = 0;
            y = laneWidth;
            width = laneWidth;
            height = playAreaHeight;
        }
        else if (teamId === 'yellow') {
            // Right zone (excluding corners)
            x = worldWidth - laneWidth;
            y = laneWidth;
            width = laneWidth;
            height = playAreaHeight;
        }
        // Create wall sprite (gray rectangle with collision)
        const wallId = 'pong_wall_suddendeath_' + teamId;
        spriteManager.addSprite('rect', {
            uniqueId: wallId,
            positionX: x,
            positionY: y,
            width: width,
            height: height,
            fill: '#444444', // Dark gray for eliminated zones
            opacity: 0.8,
            collisionGroup: 'wall', // Ball bounces off this
            checkCollisions: true,
        });
        console.log('[PongGM] Wall created for ' +
            teamId +
            ' zone at (' +
            x +
            ', ' +
            y +
            ') size ' +
            width +
            'x' +
            height);
        // Mark team as eliminated in ball manager so ball bounces off instead of scoring
        if (this.ballManager) {
            this.ballManager.setTeamEliminated(teamId);
        }
    }
    /**
     * GAME_OVER: Show winner and return to lobby
     */
    endGame(winningTeamId) {
        console.log('[PongGM] Entering GAME_OVER state - winner: ' + winningTeamId);
        this.currentState = 'GAME_OVER';
        this.winningTeam = winningTeamId;
        // Clear any pending score timeout
        this.clearScoreResetTimer();
        // Stop and remove ball immediately to prevent phantom scoring
        if (this.ballManager) {
            this.ballManager.stopBall();
            this.ballManager.removeBall();
        }
        // Remove paddles
        if (this.paddleManager) {
            this.paddleManager.removeAllPaddles();
        }
        // Show game over screen
        if (this.uiManager) {
            let winnerName = '';
            // Check if it's a tie (format: "tie:red,blue,green")
            if (winningTeamId.indexOf('tie:') === 0) {
                const tiedTeams = winningTeamId.substring(4).split(',');
                const teamNames = [];
                for (let i = 0; i < tiedTeams.length; i++) {
                    teamNames.push(this.config.getTeamName(tiedTeams[i]));
                }
                // Join with " & " for nice display: "Red & Blue Tie!" or "Red, Blue & Green Tie!"
                if (teamNames.length === 2) {
                    winnerName = teamNames[0] + ' & ' + teamNames[1] + ' Tie!';
                }
                else {
                    // For 3+ players: "Red, Blue & Green Tie!"
                    const lastTeam = teamNames[teamNames.length - 1];
                    const otherTeams = teamNames
                        .slice(0, teamNames.length - 1)
                        .join(', ');
                    winnerName = otherTeams + ' & ' + lastTeam + ' Tie!';
                }
            }
            else {
                winnerName = this.config.getTeamName(winningTeamId);
            }
            this.uiManager.showGameOver(winnerName, this);
        }
        // No auto-return to lobby - players click "Play Again" when ready
    }
    /**
     * Get count of connected players
     */
    getConnectedPlayerCount() {
        const allPlayerIds = playerManager.getPlayerIds();
        return allPlayerIds.length;
    }
    /**
     * Get count of teams with assigned players (Glitch Lava pattern)
     */
    getAssignedTeamCount() {
        let count = 0;
        if (this.teamRed.length > 0)
            count++;
        if (this.teamBlue.length > 0)
            count++;
        if (this.teamGreen.length > 0)
            count++;
        if (this.teamYellow.length > 0)
            count++;
        return count;
    }
    /**
     * Get player ID from team (helper for particle effects and analytics)
     */
    getTeamPlayerId(teamId) {
        if (teamId === 'red' && this.teamRed.length > 0)
            return this.teamRed[0];
        if (teamId === 'blue' && this.teamBlue.length > 0)
            return this.teamBlue[0];
        if (teamId === 'green' && this.teamGreen.length > 0)
            return this.teamGreen[0];
        if (teamId === 'yellow' && this.teamYellow.length > 0)
            return this.teamYellow[0];
        return null;
    }
    /**
     * Clear all game sprites (workaround for platform bug)
     */
    clearAllSprites() {
        console.log('[PongGM] Clearing all sprites');
        // Clear timeouts
        if (this.gameOverTimeoutId) {
            this.gameOverTimeoutId = null;
        }
        this.clearScoreResetTimer();
        // Remove all paddles
        if (this.paddleManager) {
            this.paddleManager.removeAllPaddles();
        }
        // Remove ball
        if (this.ballManager) {
            this.ballManager.removeBall();
        }
        // Remove UI sprites
        if (this.uiManager) {
            this.uiManager.hideCountdown();
            this.uiManager.hideScoreboard();
            this.uiManager.hideGameOver();
            this.uiManager.clearAllUISprites();
        }
        console.log('[PongGM] All sprites cleared');
    }
    /**
     * Handle player joining
     */
    onPlayerJoined(o) {
        if (!playerManager.isHost)
            return;
        const playerId = o.playerId;
        console.log('[PongGM] Player joined: ' + playerId);
        // Block joins during active game - player becomes spectator
        if (this.currentState === 'ACTIVE' ||
            this.currentState === 'COUNTDOWN' ||
            this.currentState === 'ROUND_TRANSITION' ||
            this.currentState === 'GAME_OVER') {
            console.log('[PongGM] Game in progress - player ' + playerId + ' will spectate');
            // Teleport to corner as spectator
            playerManager.teleportPlayers([playerId], {
                distributionType: 'area',
                positionX: 50,
                positionY: 50,
                width: 10,
                height: 10,
            });
            // Set spectator nameplate
            const details = playerManager.getPlayerDetails(playerId);
            const username = details && details.username ? details.username : 'P' + playerId;
            playerManager.setNameplate(playerId, '👁️ ' + username + ' (Spectating)');
            return;
        }
        // Block rejoins during sudden death - player can watch but not participate
        if (this.suddenDeathActive) {
            console.log('[PongGM] Sudden death active - player ' +
                playerId +
                ' blocked from joining');
            // Teleport to corner as spectator
            playerManager.teleportPlayers([playerId], {
                distributionType: 'area',
                positionX: 50,
                positionY: 50,
                width: 10,
                height: 10,
            });
            const details = playerManager.getPlayerDetails(playerId);
            const username = details && details.username ? details.username : 'P' + playerId;
            playerManager.setNameplate(playerId, '👁️ ' + username + ' (Spectating)');
            return;
        }
        // Auto-assign to smallest team in LOBBY state
        if (this.currentState === 'LOBBY') {
            const playerCount = this.getConnectedPlayerCount();
            const availableTeams = this.config.getAvailableTeams(playerCount);
            // Find team with minimum count from available teams - check directly, no local references
            let minCount = Infinity;
            let targetTeam = availableTeams[0];
            for (let i = 0; i < availableTeams.length; i++) {
                const teamId = availableTeams[i];
                let count = 0;
                if (teamId === 'red') {
                    count = this.teamRed.length;
                }
                else if (teamId === 'blue') {
                    count = this.teamBlue.length;
                }
                else if (teamId === 'green') {
                    count = this.teamGreen.length;
                }
                else {
                    count = this.teamYellow.length;
                }
                if (count < minCount) {
                    minCount = count;
                    targetTeam = teamId;
                }
            }
            this.joinTeam(playerId, targetTeam);
            console.log('[PongGM] Auto-assigned player ' + playerId + ' to ' + targetTeam);
        }
        // Update UI player count
        if (this.uiManager) {
            this.uiManager.updateTeamSelection(this);
        }
    }
    /**
     * Handle player leaving
     */
    onPlayerLeft(o) {
        if (!playerManager.isHost)
            return;
        const playerId = o.playerId;
        console.log('[PongGM] Player left: ' + playerId);
        // Check if the leaving player is the host
        const hostPlayerId = playerManager.getMyPlayerId();
        if (playerId === hostPlayerId) {
            console.log('[PongGM] Host is leaving - clearing all sprites');
            this.clearAllSprites();
            return;
        }
        // Get the player's team BEFORE removing from lists
        const leavingTeam = this.getPlayerTeam(playerId);
        // Remove from all team lists (helper from joinTeam)
        const removeFromList = (list, pid) => {
            for (let i = 0; i < list.length; i++) {
                if (list[i] === pid) {
                    for (let j = i + 1; j < list.length; j++) {
                        list[j - 1] = list[j];
                    }
                    list.pop();
                    return;
                }
            }
        };
        removeFromList(this.teamRed, playerId);
        removeFromList(this.teamBlue, playerId);
        removeFromList(this.teamGreen, playerId);
        removeFromList(this.teamYellow, playerId);
        // If in active game and player was participating, handle gracefully
        if (this.currentState === 'ACTIVE' ||
            this.currentState === 'COUNTDOWN' ||
            this.currentState === 'ROUND_TRANSITION') {
            let wasActive = false;
            for (let i = 0; i < this.activePlayers.length; i++) {
                if (this.activePlayers[i] === playerId) {
                    wasActive = true;
                    break;
                }
            }
            if (wasActive && leavingTeam) {
                console.log('[PongGM] Active player left from team ' +
                    leavingTeam +
                    ' - continuing game');
                // Track this team as having left (persists across rounds)
                let alreadyLeft = false;
                for (let k = 0; k < this.leftTeams.length; k++) {
                    if (this.leftTeams[k] === leavingTeam) {
                        alreadyLeft = true;
                        break;
                    }
                }
                if (!alreadyLeft) {
                    this.leftTeams.push(leavingTeam);
                    console.log('[PongGM] Added ' +
                        leavingTeam +
                        ' to leftTeams (will persist across rounds)');
                }
                // Remove from active players list
                for (let i = 0; i < this.activePlayers.length; i++) {
                    if (this.activePlayers[i] === playerId) {
                        for (let j = i + 1; j < this.activePlayers.length; j++) {
                            this.activePlayers[j - 1] = this.activePlayers[j];
                        }
                        this.activePlayers.pop();
                        break;
                    }
                }
                // Remove their paddle
                if (this.paddleManager) {
                    this.paddleManager.removePaddleForPlayer(playerId);
                }
                // Convert their zone to a wall (ball bounces off)
                this.convertGoalZoneToWall(leavingTeam);
                // Mark team as eliminated in ball manager
                if (this.ballManager) {
                    this.ballManager.setTeamEliminated(leavingTeam);
                }
                // Set their lives to 0
                if (leavingTeam === 'red')
                    this.livesRed = 0;
                else if (leavingTeam === 'blue')
                    this.livesBlue = 0;
                else if (leavingTeam === 'green')
                    this.livesGreen = 0;
                else if (leavingTeam === 'yellow')
                    this.livesYellow = 0;
                // Update lives display
                if (this.uiManager) {
                    this.uiManager.updateLivesDisplay(this);
                }
                // If in sudden death, update activeSuddenDeathTeams
                if (this.suddenDeathActive) {
                    const newActiveTeams = [];
                    for (let j = 0; j < this.activeSuddenDeathTeams.length; j++) {
                        if (this.activeSuddenDeathTeams[j] !== leavingTeam) {
                            newActiveTeams.push(this.activeSuddenDeathTeams[j]);
                        }
                    }
                    this.activeSuddenDeathTeams = newActiveTeams;
                    // Check if only one player left in sudden death
                    if (this.activeSuddenDeathTeams.length === 1) {
                        const winnerTeam = this.activeSuddenDeathTeams[0];
                        console.log('[PongGM] Player left - Sudden death winner by default: ' +
                            winnerTeam);
                        this.currentState = 'GAME_OVER';
                        this.suddenDeathActive = false;
                        const currentWins = this.roundWins[winnerTeam] || 0;
                        this.roundWins[winnerTeam] = currentWins + 100;
                        const winnerName = this.config.getPlayerNameForTeam(winnerTeam, this);
                        const winnerText = this.config.uiText.suddenDeathWinner.replace('{player}', winnerName);
                        if (this.uiManager) {
                            this.uiManager.showRoundCelebration(winnerText, 3);
                        }
                        timerManager.createTimer({
                            duration: 3000,
                            onComplete: () => {
                                if (playerManager.isHost) {
                                    this.endTournament();
                                }
                            },
                        });
                        return;
                    }
                }
                // Count remaining active teams
                let remainingTeams = 0;
                if (this.teamRed.length > 0)
                    remainingTeams++;
                if (this.teamBlue.length > 0)
                    remainingTeams++;
                if (this.teamGreen.length > 0)
                    remainingTeams++;
                if (this.teamYellow.length > 0)
                    remainingTeams++;
                // If only 1 team left, they win
                if (remainingTeams <= 1) {
                    console.log('[PongGM] Only one team left - ending game');
                    let winnerTeam = '';
                    if (this.teamRed.length > 0)
                        winnerTeam = 'red';
                    else if (this.teamBlue.length > 0)
                        winnerTeam = 'blue';
                    else if (this.teamGreen.length > 0)
                        winnerTeam = 'green';
                    else if (this.teamYellow.length > 0)
                        winnerTeam = 'yellow';
                    if (winnerTeam) {
                        // Award tournament wins and end
                        this.currentState = 'GAME_OVER';
                        const currentWins = this.roundWins[winnerTeam] || 0;
                        this.roundWins[winnerTeam] = currentWins + 100;
                        if (this.ballManager) {
                            this.ballManager.stopBall();
                        }
                        const winnerName = this.config.getPlayerNameForTeam(winnerTeam, this);
                        const celebrationText = this.config.uiText.tournamentWinner.replace('{player}', winnerName);
                        if (this.uiManager) {
                            this.uiManager.showRoundCelebration(celebrationText, 3);
                        }
                        timerManager.createTimer({
                            duration: 5000,
                            onComplete: () => {
                                if (playerManager.isHost) {
                                    this.endTournament();
                                }
                            },
                        });
                    }
                    else {
                        // No players left - return to lobby
                        this.showLobby();
                    }
                    return;
                }
                // Game continues with remaining players
                console.log('[PongGM] Game continues with ' + remainingTeams + ' teams');
                return;
            }
        }
        // Update UI if in lobby
        if (this.currentState === 'LOBBY' && this.uiManager) {
            this.uiManager.updateTeamSelection(this);
        }
    }
    /**
     * EVENT HANDLER: Player requests to join a team
     * DISABLED: Players are now auto-assigned based on player count
     */
    /*
    onEvent_pong_playerJoinTeam(eventData: { playerId: number; teamId: string }) {
      if (!playerManager.isHost) return;
  
      const playerId = eventData.playerId;
      const teamId = eventData.teamId;
  
      this.joinTeam(playerId, teamId);
    }
    */
    /**
     * EVENT HANDLER: Player requests to start the game
     */
    onEvent_pong_startGame(eventData) {
        if (!playerManager.isHost)
            return;
        // Only host can start
        if (eventData.playerId === playerManager.getMyPlayerId()) {
            this.startGame();
        }
    }
    /**
     * EVENT HANDLER: Debug - force sudden death scenario
     * Sets up round 3 with 3 players having 1 win each and all players at 1 life
     */
    onEvent_pong_debugSuddenDeath(eventData) {
        if (!playerManager.isHost)
            return;
        // Only host can trigger debug
        if (eventData.playerId !== playerManager.getMyPlayerId())
            return;
        console.log('[PongGM] DEBUG: Forcing sudden death scenario');
        const playerCount = this.getConnectedPlayerCount();
        if (playerCount !== 4) {
            console.error('[PongGM] DEBUG: Need exactly 4 players, have ' + playerCount);
            return;
        }
        // Auto-assign players to teams (same as normal start)
        this.autoAssignTeams(playerCount);
        const teamCount = this.getAssignedTeamCount();
        console.log('[PongGM] DEBUG: Assigned to ' + teamCount + ' teams');
        // Reset scores
        this.scoreRed = 0;
        this.scoreBlue = 0;
        this.scoreGreen = 0;
        this.scoreYellow = 0;
        // Initialize tournament at round 3
        this.currentRound = 3;
        this.config.currentRound = 3;
        this.tournamentInProgress = true;
        // IMPORTANT: Set original player count for proper layout in sudden death
        this.originalPlayerCount = teamCount;
        // Set state to ROUND_TRANSITION to block new joins during countdown
        this.currentState = 'ROUND_TRANSITION';
        // Set round wins: 3 players with 1 win each (forces sudden death after round 3)
        // red=1, blue=1, green=1, yellow=0
        this.roundWins.red = 1;
        this.roundWins.blue = 1;
        this.roundWins.green = 1;
        this.roundWins.yellow = 0;
        console.log('[PongGM] DEBUG: Round wins set - red:1, blue:1, green:1, yellow:0');
        // Set Round 3 mode: Body paddle (Chaos)
        this.config.roundMode = 'bodypaddle';
        // Initialize lives to 1 (one hit elimination)
        this.livesRed = 1;
        this.livesBlue = 1;
        this.livesGreen = 1;
        this.livesYellow = 1;
        this.consecutiveHits = 0;
        // Analytics: Track game start
        if (this.analyticsManager) {
            const hostPlayerId = playerManager.getMyPlayerId();
            this.analyticsManager.trackGameStart(hostPlayerId, playerCount);
        }
        // Clear any game over state
        if (this.gameOverTimeoutId) {
            clearTimeout(this.gameOverTimeoutId);
            this.gameOverTimeoutId = null;
        }
        this.clearScoreResetTimer();
        // Clean up any existing game elements
        if (this.paddleManager) {
            this.paddleManager.removeAllPaddles();
        }
        if (this.ballManager) {
            this.ballManager.removeBall();
            // Set original player count for goal zone layout (important for sudden death)
            this.ballManager.setPlayerCount(teamCount, true);
        }
        // Hide any existing UI elements and set up game board
        if (this.uiManager) {
            this.uiManager.hideGameOver();
            this.uiManager.hideScoreboard();
            this.uiManager.hideCountdown();
            this.uiManager.hideLobby();
            this.uiManager.createPlayArea();
            this.uiManager.createTeamLanes(teamCount);
        }
        // Snapshot active players from all teams
        this.activePlayers = [];
        let teamIndex = 0;
        while (teamIndex < this.teamRed.length) {
            this.activePlayers.push(this.teamRed[teamIndex]);
            teamIndex++;
        }
        teamIndex = 0;
        while (teamIndex < this.teamBlue.length) {
            this.activePlayers.push(this.teamBlue[teamIndex]);
            teamIndex++;
        }
        teamIndex = 0;
        while (teamIndex < this.teamGreen.length) {
            this.activePlayers.push(this.teamGreen[teamIndex]);
            teamIndex++;
        }
        teamIndex = 0;
        while (teamIndex < this.teamYellow.length) {
            this.activePlayers.push(this.teamYellow[teamIndex]);
            teamIndex++;
        }
        // Show 5-second countdown with instructions for Round 3
        const countdownSeconds = Math.floor(this.config.roundCountdownMs / 1000);
        this.roundCountdownDisplay = countdownSeconds;
        if (this.uiManager) {
            this.uiManager.showRoundCountdown(3, countdownSeconds);
        }
        // Set up countdown state
        this.roundTransitionState = 'countdown';
        this.roundTransitionEndTime = Date.now() + this.config.roundCountdownMs;
        this.nextRoundNumber = 3;
        console.log('[PongGM] DEBUG: Sudden death scenario initialized');
        console.log('[PongGM] DEBUG: Round=3, Lives=1 each, Wins: red=1, blue=1, green=1, yellow=0');
        console.log('[PongGM] DEBUG: After round 3 ends, red/blue/green will have 2 wins each → triggers sudden death!');
    }
    /**
     * Collision handler: Play area collision for camping detection (Button mode only)
     */
    onSpriteCollisionStart({ sprite1, sprite2, }) {
        // Only track camping in button mode (Round 1)
        if (this.config.roundMode !== 'button')
            return;
        if (!playerManager.isHost)
            return;
        if (this.currentState !== 'ACTIVE')
            return;
        const s1 = sprite1;
        const s2 = sprite2;
        if (!s1 || !s2)
            return;
        if (s1.playerId == undefined && s2.playerId == undefined) {
            return;
        }
        // Check for play area camping (pattern from CTF)
        const playerSprite = s1.playerId != undefined ? s1 : s2.playerId != undefined ? s2 : null;
        let zoneSprite = null;
        if (s1.collisionGroup === 'playarea') {
            zoneSprite = s1;
        }
        else if (s2.collisionGroup === 'playarea') {
            zoneSprite = s2;
        }
        if (playerSprite && zoneSprite) {
            const pid = playerSprite.playerId;
            if (pid) {
                const pidStr = String(pid);
                const now = Date.now();
                // Start camping timer
                if (!this.campingTimers[pidStr]) {
                    this.campingTimers[pidStr] = now;
                    // Update nameplate with tent emoji
                    this.updatePlayerNameplate(pid);
                    console.log('[PongGM] Player P' +
                        pid +
                        ' entered play area (camping timer started)');
                }
            }
        }
    }
    /**
     * Collision handler: Play area collision end for camping detection (Button mode only)
     */
    onSpriteCollisionEnd({ sprite1, sprite2, }) {
        // Only track camping in button mode (Round 1)
        if (this.config.roundMode !== 'button')
            return;
        if (!playerManager.isHost)
            return;
        const s1 = sprite1;
        const s2 = sprite2;
        if (!s1 || !s2)
            return;
        // Check for play area camping end (pattern from CTF)
        const playerSprite = s1.playerId != undefined ? s1 : s2.playerId != undefined ? s2 : null;
        let zoneSprite = null;
        if (s1.collisionGroup === 'playarea') {
            zoneSprite = s1;
        }
        else if (s2.collisionGroup === 'playarea') {
            zoneSprite = s2;
        }
        if (playerSprite && zoneSprite) {
            const pid = playerSprite.playerId;
            if (pid) {
                const pidStr = String(pid);
                // Clear camping timer (check if key exists, not just if truthy)
                if (this.campingTimers[pidStr] !== undefined) {
                    this.campingTimers[pidStr] = 0;
                    // Update nameplate (remove tent emoji)
                    this.updatePlayerNameplate(pid);
                    console.log('[PongGM] Player P' +
                        pid +
                        ' left play area (camping timer cleared)');
                }
            }
        }
    }
    /**
     * Check camping timers and teleport players who overstay
     * Only enabled in Round 1 (button mode)
     */
    checkCampingViolations() {
        if (!playerManager.isHost)
            return;
        if (this.currentState !== 'ACTIVE')
            return;
        if (this.config.roundMode !== 'button')
            return; // Only enforce camping in button mode (Round 1)
        const now = Date.now();
        const allPids = playerManager.getPlayerIds();
        for (let i = 0; i < allPids.length; i++) {
            const pid = allPids[i];
            const pidStr = String(pid);
            if (this.campingTimers[pidStr] && this.campingTimers[pidStr] > 0) {
                const campingDuration = now - this.campingTimers[pidStr];
                if (campingDuration >= this.config.campingTimeoutMs) {
                    // Teleport player back to their control lane
                    const teamId = this.getPlayerTeam(pid);
                    if (teamId) {
                        const paddleInfo = this.config.getPaddlePosition(teamId, this.activePlayers.length);
                        // Calculate teleport position at CENTER of team's control lane
                        let teleportX, teleportY;
                        if (paddleInfo.orientation === 'horizontal') {
                            // Top or bottom team - teleport to center of their horizontal lane
                            const isTop = paddleInfo.y < this.config.centerY;
                            teleportX = this.config.centerX; // Horizontal center
                            teleportY = isTop
                                ? this.config.laneWidth / 2
                                : this.config.worldHeight - this.config.laneWidth / 2;
                        }
                        else {
                            // Left or right team - teleport to center of their vertical lane
                            const isLeft = paddleInfo.x < this.config.centerX;
                            teleportX = isLeft
                                ? this.config.laneWidth / 2
                                : this.config.worldWidth - this.config.laneWidth / 2;
                            teleportY = this.config.centerY; // Vertical center
                        }
                        playerManager.teleportPlayers([pid], {
                            distributionType: 'area',
                            positionX: teleportX,
                            positionY: teleportY,
                            width: 40,
                            height: 40,
                        });
                        // Update nameplate (remove tent emoji)
                        this.updatePlayerNameplate(pid);
                        console.log('[PongGM] Teleported P' +
                            pid +
                            ' (team ' +
                            teamId +
                            ') back to control lane');
                        // Reset camping timer
                        this.campingTimers[pidStr] = 0;
                    }
                }
            }
        }
    }
    setWorldActivity(type) {
        try {
            if (!playerManager.isHost)
                return;
            const publicKey = stateManager.getVariable('PublicKey');
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
