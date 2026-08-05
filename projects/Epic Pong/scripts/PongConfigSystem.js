"use strict";
class PongConfigSystem extends SystemScript {
    systemName;
    // --- World / Stage ---
    worldWidth;
    worldHeight;
    centerX;
    centerY;
    // --- Player Limits ---
    minPlayers;
    maxPlayers;
    // --- Team Configuration (from CTF) ---
    teamColors; // { red, blue, green, yellow }
    teamNames; // { red, blue, green, yellow }
    // --- Game States ---
    // LOBBY: waiting for players to join and select teams
    // COUNTDOWN: pre-game countdown (3-2-1-GO)
    // ACTIVE: game in progress
    // GAME_OVER: round complete, showing winner
    // --- Timing Configuration ---
    countdownDuration; // seconds for pre-game countdown
    winningScore; // DEPRECATED - replaced by lives system
    gameOverDisplayDuration; // seconds to show game over screen
    // --- Lives System (NEW) ---
    startingLives; // lives each player starts with
    // --- Round System (NEW) ---
    currentRound; // 1, 2, or 3
    roundMode; // 'button' | 'coordinate' | 'bodypaddle'
    roundDelayMs; // delay between rounds (milliseconds)
    roundCelebrationMs; // celebration time for round winner (milliseconds)
    roundCountdownMs; // countdown with instructions (milliseconds)
    tournamentCelebrationMs; // celebration time after tournament (milliseconds)
    eliminationPopupMs; // how long to show elimination popup in sudden death
    // --- Paddle Configuration ---
    paddleWidth;
    paddleHeight;
    paddleSpeed; // pixels per frame
    paddleOffset; // distance from edge of play area
    // --- Ball Configuration ---
    ballSize;
    ballSpeedInitial;
    ballSpeedIncrement; // speed increase per paddle hit
    ballSpeedMax;
    multiballHitThreshold; // consecutive hits to spawn second ball
    // --- Control Configuration ---
    buttonWidth;
    buttonHeight;
    buttonGap; // spacing between buttons
    // --- Goal/Wall Thickness ---
    goalThickness;
    wallThickness;
    // --- Play Area Layout (New) ---
    laneWidth; // Width of control lane around play area
    playAreaX; // X position of central play area
    playAreaY; // Y position of central play area
    playAreaWidth; // Width of central play area
    playAreaHeight; // Height of central play area
    // --- Camping Detection (Button Mode Only) ---
    campingTimeoutMs; // Time before teleporting player out of play area (milliseconds)
    // --- Body Paddle Mode (DEPRECATED - now part of round system) ---
    bodyPaddleMode; // DEPRECATED - use roundMode instead
    bodyPaddleOffsetX; // Horizontal offset for paddle from player center
    bodyPaddleOffsetY; // Vertical offset for paddle from player center
    // --- UI Text Strings (for easy copy editing) ---
    uiText; // All on-screen text messages
    onInit() {
        console.log('[PongConfig] Initializing configuration system');
        this.systemName = 'PongConfigSystem';
        // Stage dimensions
        this.worldWidth = 1000;
        this.worldHeight = 1000;
        this.centerX = this.worldWidth / 2;
        this.centerY = this.worldHeight / 2;
        // Player limits
        this.minPlayers = 2;
        this.maxPlayers = 4;
        // Team configuration (from CTF)
        this.teamColors = {
            red: 0xff0000,
            blue: 0x0000ff,
            green: 0x00ff00,
            yellow: 0xffff00,
        };
        this.teamNames = {
            red: 'Red Player',
            blue: 'Blue Player',
            green: 'Green Player',
            yellow: 'Yellow Player',
        };
        // Timing
        this.countdownDuration = 3;
        this.winningScore = 5; // DEPRECATED - kept for compatibility
        this.gameOverDisplayDuration = 5;
        // Lives system (NEW)
        this.startingLives = 3;
        // Round system (NEW)
        this.currentRound = 1; // Start at round 1
        this.roundMode = 'button'; // Default to button control
        this.roundDelayMs = 3000; // 3 seconds celebration + 5 seconds countdown = 8 seconds total
        this.roundCelebrationMs = 3000; // 3 seconds for round winner celebration
        this.roundCountdownMs = 5000; // 5 seconds countdown with instructions
        this.tournamentCelebrationMs = 5000; // 5 seconds for tournament winner
        this.eliminationPopupMs = 2000; // 2 seconds for elimination popup in sudden death
        // Paddle configuration
        this.paddleWidth = 20;
        this.paddleHeight = 100;
        this.paddleSpeed = 8;
        this.paddleOffset = 200; // Distance from edge - paddles stay INSIDE play area (play area starts at 150)
        // Ball configuration
        this.ballSize = 30;
        this.ballSpeedInitial = 5;
        this.ballSpeedIncrement = 0.5;
        this.ballSpeedMax = 15;
        // Multi-ball feature
        this.multiballHitThreshold = 4; // Consecutive hits needed to spawn additional ball (spawns at every multiple)
        // UI button configuration
        this.buttonWidth = 120;
        this.buttonHeight = 50;
        this.buttonGap = 24;
        // Goal and wall thickness
        this.goalThickness = 10;
        this.wallThickness = 10;
        // Play area layout - central game board with surrounding control lanes
        this.laneWidth = 150; // Width of control lane where players stay
        this.playAreaX = this.laneWidth;
        this.playAreaY = this.laneWidth;
        this.playAreaWidth = this.worldWidth - this.laneWidth * 2; // 700px wide
        this.playAreaHeight = this.worldHeight - this.laneWidth * 2; // 700px tall
        // Camping detection (Button Mode only - if player stays on play surface too long)
        this.campingTimeoutMs = 3000; // 3 seconds (same as CTF-Optimized)
        // Body Paddle mode (paddle follows player)
        this.bodyPaddleMode = false; // Default: off
        this.bodyPaddleOffsetX = 0; // Centered on player by default
        this.bodyPaddleOffsetY = 0; // Centered on player by default
        // UI Text - all on-screen messages for easy copy editing
        this.uiText = {
            // Round celebrations
            roundComplete: 'Round {round} Complete!',
            roundWinner: '{player} wins!',
            roundTie: "It's a Tie!",
            roundLoser: '{player} eliminated!',
            roundSurvivors: '{players} survive!',
            // Sudden Death
            suddenDeathTitle: 'SUDDEN DEATH!',
            suddenDeathRules: 'One Life. Last Player Standing Wins!',
            suddenDeathEliminated: '{player} Eliminated!',
            suddenDeathWinner: '{player} Wins Sudden Death!',
            // Tournament results
            tournamentWinner: '{player} Wins the Tournament!',
            tournamentTie: '{players} End the Game in a Tie!',
            // Round countdown
            roundTitle: 'Round {round} - {mode}',
            roundModes: {
                button: 'Button Control',
                coordinate: 'Avatar Control',
                bodypaddle: 'Chaos Mode',
            },
            roundInstructions: {
                button: 'Tap ◄ ► buttons to move your paddle!',
                coordinate: 'Move your character to control your paddle',
                bodypaddle: 'Your character carries the paddle!',
            },
            startingIn: 'Starting in...',
            // Display labels
            livesLabel: 'Lives',
            winsLabel: 'Wins',
            // Game over
            playerWins: '{player} is the Champion!',
            gameTie: 'Tie Game!',
            playAgain: 'Touch to play again',
        };
    }
    /**
     * Get team color by team ID
     */
    getTeamColor(teamId) {
        return this.teamColors[teamId] || 0xffffff;
    }
    /**
     * Get player name by team ID
     */
    getTeamName(teamId) {
        if (teamId === 'red')
            return this.teamNames.red;
        if (teamId === 'blue')
            return this.teamNames.blue;
        if (teamId === 'green')
            return this.teamNames.green;
        if (teamId === 'yellow')
            return this.teamNames.yellow;
        return 'Unknown Player';
    }
    /**
     * Get actual player name for a team (uses first player's username)
     */
    getPlayerNameForTeam(teamId, gameManager) {
        if (!gameManager)
            return this.getTeamName(teamId);
        // Get first player from team
        let playerId = null;
        if (teamId === 'red' && gameManager.teamRed.length > 0) {
            playerId = gameManager.teamRed[0];
        }
        else if (teamId === 'blue' && gameManager.teamBlue.length > 0) {
            playerId = gameManager.teamBlue[0];
        }
        else if (teamId === 'green' && gameManager.teamGreen.length > 0) {
            playerId = gameManager.teamGreen[0];
        }
        else if (teamId === 'yellow' && gameManager.teamYellow.length > 0) {
            playerId = gameManager.teamYellow[0];
        }
        if (!playerId)
            return this.getTeamName(teamId);
        const details = playerManager.getPlayerDetails(playerId);
        return details && details.username
            ? details.username
            : this.getTeamName(teamId);
    }
    /**
     * Get team emoji by team ID
     */
    getTeamEmoji(teamId) {
        const emojis = {
            red: '🔴',
            blue: '🔵',
            green: '🟢',
            yellow: '🟡',
        };
        return emojis[teamId] || '⚪';
    }
    /**
     * Get available teams based on player count
     * 2 players: red, blue
     * 3 players: red, blue, green
     * 4 players: red, blue, green, yellow
     */
    getAvailableTeams(playerCount) {
        const teams = ['red', 'blue'];
        if (playerCount >= 3)
            teams.push('green');
        if (playerCount >= 4)
            teams.push('yellow');
        return teams;
    }
    /**
     * Calculate paddle positions based on layout
     */
    getPaddlePosition(teamId, playerCount) {
        // Returns { x, y, orientation: 'horizontal' | 'vertical' }
        if (playerCount === 2) {
            // Top/Bottom layout
            if (teamId === 'red') {
                return {
                    x: this.centerX,
                    y: this.paddleOffset,
                    orientation: 'horizontal',
                };
            }
            else if (teamId === 'blue') {
                return {
                    x: this.centerX,
                    y: this.worldHeight - this.paddleOffset,
                    orientation: 'horizontal',
                };
            }
        }
        else if (playerCount === 4) {
            // Four-sided layout
            if (teamId === 'red') {
                return {
                    x: this.centerX,
                    y: this.paddleOffset,
                    orientation: 'horizontal',
                };
            }
            else if (teamId === 'blue') {
                return {
                    x: this.centerX,
                    y: this.worldHeight - this.paddleOffset,
                    orientation: 'horizontal',
                };
            }
            else if (teamId === 'green') {
                return {
                    x: this.paddleOffset,
                    y: this.centerY,
                    orientation: 'vertical',
                };
            }
            else if (teamId === 'yellow') {
                return {
                    x: this.worldWidth - this.paddleOffset,
                    y: this.centerY,
                    orientation: 'vertical',
                };
            }
        }
        else if (playerCount === 3) {
            // Three-sided layout (experimental)
            // Red: top (horizontal)
            // Blue: bottom-left (diagonal)
            // Green: bottom-right (diagonal)
            if (teamId === 'red') {
                return {
                    x: this.centerX,
                    y: this.paddleOffset,
                    orientation: 'horizontal',
                };
            }
            else if (teamId === 'blue') {
                return {
                    x: this.worldWidth * 0.25,
                    y: this.worldHeight - this.paddleOffset,
                    orientation: 'diagonal-left',
                };
            }
            else if (teamId === 'green') {
                return {
                    x: this.worldWidth * 0.75,
                    y: this.worldHeight - this.paddleOffset,
                    orientation: 'diagonal-right',
                };
            }
        }
        return { x: this.centerX, y: this.centerY, orientation: 'horizontal' };
    }
    /**
     * Get goal area boundaries for scoring
     */
    getGoalArea(teamId, playerCount) {
        // Returns { x, y, width, height } - area where ball scores against this team
        if (playerCount === 2) {
            if (teamId === 'red') {
                // Top goal
                return {
                    x: 0,
                    y: 0,
                    width: this.worldWidth,
                    height: this.goalThickness,
                };
            }
            else if (teamId === 'blue') {
                // Bottom goal
                return {
                    x: 0,
                    y: this.worldHeight - this.goalThickness,
                    width: this.worldWidth,
                    height: this.goalThickness,
                };
            }
        }
        else if (playerCount === 4) {
            if (teamId === 'red') {
                // Top goal
                return {
                    x: 0,
                    y: 0,
                    width: this.worldWidth,
                    height: this.goalThickness,
                };
            }
            else if (teamId === 'blue') {
                // Bottom goal
                return {
                    x: 0,
                    y: this.worldHeight - this.goalThickness,
                    width: this.worldWidth,
                    height: this.goalThickness,
                };
            }
            else if (teamId === 'green') {
                // Left goal
                return {
                    x: 0,
                    y: 0,
                    width: this.goalThickness,
                    height: this.worldHeight,
                };
            }
            else if (teamId === 'yellow') {
                // Right goal
                return {
                    x: this.worldWidth - this.goalThickness,
                    y: 0,
                    width: this.goalThickness,
                    height: this.worldHeight,
                };
            }
        }
        else if (playerCount === 3) {
            // Three-sided layout goals (triangular arrangement)
            if (teamId === 'red') {
                // Top goal
                return {
                    x: 0,
                    y: 0,
                    width: this.worldWidth,
                    height: this.goalThickness,
                };
            }
            else if (teamId === 'blue') {
                // Bottom-left goal
                return {
                    x: 0,
                    y: this.worldHeight - this.goalThickness,
                    width: this.worldWidth / 2,
                    height: this.goalThickness,
                };
            }
            else if (teamId === 'green') {
                // Bottom-right goal
                return {
                    x: this.worldWidth / 2,
                    y: this.worldHeight - this.goalThickness,
                    width: this.worldWidth / 2,
                    height: this.goalThickness,
                };
            }
        }
        return { x: 0, y: 0, width: 0, height: 0 };
    }
}
