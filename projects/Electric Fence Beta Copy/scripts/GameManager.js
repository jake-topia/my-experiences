"use strict";
class GameManager extends SystemScript {
    // --- Properties ---
    worldWidth;
    worldHeight;
    safeZoneCenterX;
    safeZoneCenterY;
    safeZoneAreaWidth;
    safeZoneAreaHeight;
    currentLevelIndex;
    currentGameState; // 'STARTING', 'COUNTDOWN', 'ACTIVE', 'LEVEL_COMPLETE'
    gameStartTimeMs; // For calculating total level time
    currentElapsedTimeSec; // Stores the FINAL elapsed time for the level
    countdownSecondsDuration;
    pelletManager;
    wallManager;
    scoreManager;
    timerManager;
    countdownManager;
    highScoreManager;
    particleManager;
    collisionManager;
    utils;
    naughtyList;
    sprites;
    reset;
    playerJustTeleported;
    playersCurrentlyTeleporting; // Tracks who is teleporting
    /** Constructor: Initialize ALL properties here. */
    constructor() {
        console.log('GameManager Constructor: Initializing properties...');
        this.naughtyList = {};
        this.playerJustTeleported;
        this.worldWidth = 1000;
        this.worldHeight = 1000;
        this.currentGameState = 'STARTING';
        this.currentLevelIndex = -1;
        this.gameStartTimeMs = 0;
        this.currentElapsedTimeSec = 0;
        this.countdownSecondsDuration = 10;
        this.sprites = [];
        this.reset = 0;
        // Calculate safe zone
        this.safeZoneCenterX = 0;
        this.safeZoneCenterY = this.worldHeight * 0.9;
        this.safeZoneAreaWidth = this.worldWidth * 0.8;
        this.safeZoneAreaHeight = this.worldHeight * 0.1;
        console.log(`Safe Zone Info: Center X = ${this.safeZoneCenterX}, Center Y = ${this.safeZoneCenterY}, Width = ${this.safeZoneAreaWidth}, Height = ${this.safeZoneAreaHeight}`);
        this.playersCurrentlyTeleporting = {}; // Initialize as an empty object
        console.log(`GameManager Constructor: Properties Initialized.`);
    }
    /** onInit: Attach systems & Wait for TimerManager */
    onInit() {
        console.log('GameManager onInit: Attaching subsystems...');
        try {
            scriptManager.attachSystem({ scriptId: 'ScoreManager' });
            scriptManager.attachSystem({ scriptId: 'WallManager' });
            scriptManager.attachSystem({ scriptId: 'PelletManager' });
            scriptManager.attachSystem({ scriptId: 'CountdownManager' });
            scriptManager.attachSystem({ scriptId: 'HighScoreManager' });
            scriptManager.attachSystem({ scriptId: 'ParticleManager' });
            scriptManager.attachSystem({ scriptId: 'CollisionManager' });
            scriptManager.attachSystem({ scriptId: 'utils' });
            this.pelletManager = scriptManager.getSystem({
                systemName: 'PelletManager',
            });
            this.utils = scriptManager.getSystem({ systemName: 'utils' });
            this.wallManager = scriptManager.getSystem({
                systemName: 'WallManager',
            });
            this.scoreManager = scriptManager.getSystem({
                systemName: 'ScoreManager',
            });
            this.countdownManager = scriptManager.getSystem({
                systemName: 'CountdownManager',
            });
            this.highScoreManager = scriptManager.getSystem({
                systemName: 'HighScoreManager',
            });
            this.particleManager = scriptManager.getSystem({
                systemName: 'ParticleManager',
            });
            this.collisionManager = scriptManager.getSystem({
                systemName: 'CollisionManager',
            });
            console.log('GameManager onInit: Subsystems attached.');
            console.log('GameManager onInit: Waiting for timerManagerReady event...');
        }
        catch (error) {
            console.log('!!! GameManager ERROR during onInit:', error);
        }
        try {
            scriptManager.attachSystem({ scriptId: 'TimerManager' });
            this.timerManager = scriptManager.getSystem({
                systemName: 'TimerManager',
            });
            console.log('TimerManager attached successfully.');
        }
        catch (error) {
            console.log('!!! CRITICAL ERROR: Failed to attach TimerManager:', error);
        }
        try {
            stageManager.setCurrentStage('floor');
            console.log('Stage attached successfully.');
        }
        catch (error) {
            console.log('!!! CRITICAL ERROR: Failed to attach Stage:', error);
        }
    }
    /** Listener for TimerManager readiness signal */
    onEvent_timerManagerReady() {
        if (this.currentGameState !== 'STARTING') {
            console.log('GameManager: Received timerManagerReady event but game state is not STARTING. Ignoring.');
            return;
        }
        console.log('GameManager: Received timerManagerReady event. Starting game sequence...');
        this.selectDifficulty();
        //this.startNextLevel();
    }
    selectDifficulty() {
        console.log('Creating difficulty text options');
        this.sprites.push(this.utils.makeText({
            text: 'Easy\n\uD83D\uDC22',
            align: 'center',
            justify: 'start',
            onClick: () => {
                this.currentLevelIndex = -1;
                this.wallManager.startingLevel = 0;
                this.highScoreManager.toggleHighScoreDisplay(true);
                this.startNextLevel();
            },
        }));
        this.sprites.push(this.utils.makeText({
            text: 'Medium\n\uD83D\uDC07',
            align: 'center',
            justify: 'start',
            onClick: () => {
                this.currentLevelIndex = 4;
                this.wallManager.startingLevel = 5;
                this.highScoreManager.toggleHighScoreDisplay(true);
                this.startNextLevel();
            },
        }));
        this.sprites.push(this.utils.makeText({
            text: 'Hard\n\u26a1',
            align: 'center',
            justify: 'start',
            onClick: () => {
                this.currentLevelIndex = 9;
                this.wallManager.startingLevel = 10;
                this.highScoreManager.toggleHighScoreDisplay(true);
                this.startNextLevel();
            },
        }));
        this.sprites.push(this.utils.makeText({
            text: 'Extreme\n\u26a1\u26a1',
            align: 'center',
            justify: 'start',
            onClick: () => {
                this.currentLevelIndex = 14;
                this.wallManager.startingLevel = 15;
                this.highScoreManager.toggleHighScoreDisplay(true);
                this.startNextLevel();
            },
        }));
        this.sprites.push(this.utils.makeText({
            text: 'Impossible\n\u26a1\u26a1\u26a1',
            align: 'center',
            justify: 'start',
            onClick: () => {
                this.currentLevelIndex = 19;
                this.wallManager.startingLevel = 20;
                this.highScoreManager.toggleHighScoreDisplay(true);
                this.startNextLevel();
            },
        }));
        for (let i = 0; i < this.sprites.length; i++) {
            const spriteOptions = {
                positionX: 150 * i + 150,
                positionY: 160,
                fontColor: '#FFFFFF',
            };
            spriteManager.updateSprite(this.sprites[i].uniqueId, spriteOptions);
        }
    }
    // --- Game Loop & State Methods ---
    clearDifficultySprites() {
        this.sprites.toArray().forEach((sprite) => {
            if (!sprite)
                return;
            spriteManager.removeSprite(sprite.uniqueId);
        });
    }
    /** Prepares and starts the sequence for the next level */
    startNextLevel() {
        this.reset = 0;
        this.clearDifficultySprites();
        console.log('GameManager: Clearing previous timers...');
        try {
            //I have to put this here, because it is otherwise undefined - there must be a race condition in play
            this.timerManager = scriptManager.getSystem({
                systemName: 'TimerManager',
            });
            console.log(`-----------------TimerManager Status: ${this.timerManager}`);
            if (this.timerManager) {
                this.timerManager.clearTimer('countdown');
                this.timerManager.clearTimer('nextLevel');
                this.timerManager.clearTimer('startGameplay');
                this.timerManager.clearTimer('gameplayUpdate');
            }
            else {
                console.log('!!! GameManager WARNING: Could not get TimerManager to clear timers.');
            }
        }
        catch (e) {
            console.log('!!! GameManager: Error clearing timers via TimerManager', e);
        }
        if (this.wallManager.totalLevels - 1 + this.wallManager.startingLevel >
            this.currentLevelIndex) {
            this.currentLevelIndex++;
        }
        else {
            //this.currentLevelIndex = this.wallManager.startingLevel;
            this.currentGameState = 'STARTING';
            this.restartGame();
            return;
        }
        this.currentGameState = 'COUNTDOWN';
        console.log(`GameManager: Preparing Level ${this.currentLevelIndex + 1}. State: ${this.currentGameState}`);
        // --- Cleanup ---
        console.log('GameManager: Cleaning up previous level visuals...');
        this.pelletManager?.despawnPellet();
        this.wallManager?.clearLevel();
        this.wallManager?.loadLevel(99);
        // --- Teleport Player ---
        this.teleportAllPlayersToSafeZone();
        // --- Start Countdown Sequence ---
        const initialCountdownValue = this.countdownSecondsDuration;
        console.log(`GameManager: Starting ${initialCountdownValue} second countdown...`);
        this.scoreManager?.displayMessage(`Level ${this.currentLevelIndex + 1}\nGet Ready!`);
        this.scheduleNextCountdownTick(initialCountdownValue);
    }
    restartGame() {
        if (this.currentGameState !== 'STARTING') {
            console.log('GameManager: Received timerManagerReady event but game state is not STARTING. Ignoring.');
            return;
        }
        // --- Cleanup ---
        console.log('GameManager: Cleaning up previous level visuals...');
        //this.highScoreManager.toggleHighScoreDisplay(true);
        this.countdownManager?.displayMessage(''); // Clear GO message
        this.scoreManager?.displayMessage('Choose a Level');
        this.sprites = [];
        this.pelletManager?.despawnPellet();
        this.wallManager?.clearLevel();
        this.wallManager?.loadLevel(99);
        this.selectDifficulty();
    }
    /** Displays current value and schedules the NEXT countdown tick event via TimerManager */
    scheduleNextCountdownTick(valueToDisplay) {
        if (this.currentGameState !== 'COUNTDOWN')
            return;
        console.log(`GameManager COUNTDOWN: ${valueToDisplay}...`);
        //this.teleportAllPlayersToSafeZone();
        this.countdownManager?.displayMessage(`${valueToDisplay}...`);
        const nextValue = valueToDisplay - 1;
        try {
            if (this.timerManager) {
                // Pass payload object needed by TimerManager to extract value
                this.timerManager.setTimer('countdown', 1, {
                    countdownNextValue: nextValue,
                });
                // console.log(`GameManager: Scheduling 'handleCountdownTick' timer for value ${nextValue}`); // Optional simpler log
            }
            else {
                console.log('!!! GameManager ERROR: Could not get TimerManager to schedule countdown tick.');
            }
        }
        catch (e) {
            console.log('!!! GameManager ERROR setting countdown tick timer:', e);
        }
    }
    /** Listener for the event that drives the countdown (expects number payload) */
    onEvent_handleCountdownTick(payload) {
        // Expect number or null
        if (this.currentGameState !== 'COUNTDOWN')
            return;
        console.log('GameManager: Received handleCountdownTick event.');
        const currentValue = payload;
        console.log(`>>>   Received value: ${currentValue} (Type: ${typeof currentValue})`);
        // *** Check for valid number (catches null, undefined, AND NaN) ***
        if (typeof currentValue !== 'number' || currentValue !== currentValue) {
            console.log(`!!! GameManager WARNING: Invalid value (type ${typeof currentValue} or NaN) received in handleCountdownTick. Stopping countdown.`);
            return; // Exit if not a valid number
        }
        // --- Countdown Logic ---
        if (currentValue > 0) {
            // Schedule the next display/tick using the received number
            this.scheduleNextCountdownTick(currentValue);
        }
        else {
            // Countdown finished (currentValue is 0)
            console.log('GameManager COUNTDOWN: GO!');
            this.countdownManager?.displayMessage('GO!');
            try {
                this.timerManager?.setTimer('startGameplay', 1); // Set ~1s delay for GO!
                console.log('GameManager: Scheduled startGameplay timer.');
            }
            catch (e) {
                console.log('!!! GameManager ERROR setting startGameplay timer:', e);
                this.startGameplay(); // Fallback
            }
        }
    }
    /** Listener for the event to start gameplay after the GO! delay */
    onEvent_startGameplayNow() {
        if (this.currentGameState === 'COUNTDOWN') {
            console.log('GameManager: Received startGameplayNow event.');
            this.countdownManager?.displayMessage(''); // Clear GO message
            // Now start the actual gameplay state
            this.startGameplay();
        }
        else {
            console.log(`GameManager: Ignoring startGameplayNow event, state is ${this.currentGameState}.`);
        }
    }
    /** Sets up and starts the active playing state */
    startGameplay() {
        if (this.currentGameState === 'ACTIVE') {
            console.log('GameManager: startGameplay called but already in ACTIVE state. Ignoring.');
            return;
        }
        this.currentGameState = 'ACTIVE';
        console.log(`GameManager: Starting ACTIVE state for Level ${this.currentLevelIndex}`);
        // --- Load Map ---
        console.log(`GameManager: Requesting WallManager load level ${this.currentLevelIndex}`);
        try {
            this.wallManager?.clearLevel();
            this.wallManager?.loadLevel(this.currentLevelIndex);
        }
        catch (e) {
            console.log('!!! GameManager ERROR calling WallManager.loadLevel: ', e);
        }
        // *** Teleport all players just before starting gameplay ***
        this.teleportAllPlayersToSafeZone();
        // --- Start Gameplay Timer ---
        this.startGameplayTimer();
    }
    /** Stops active gameplay, records score, schedules next level */
    completeLevel(playerId) {
        if (this.currentGameState !== 'ACTIVE')
            return;
        this.currentGameState = 'LEVEL_COMPLETE';
        console.log(`GameManager: Level ${this.currentLevelIndex} complete! Player: ${playerId}`);
        this.stopGameplayTimer(); // Stop timer & calculate final time
        this.recordScore(playerId, this.currentElapsedTimeSec);
        const playerX = playerManager.getPlayerDetails(playerId).x;
        const playerY = playerManager.getPlayerDetails(playerId).y;
        this.particleManager?.displayParticles({ x: playerX, y: playerY }, 36, 10, playerId);
        this.pelletManager?.despawnPellet();
        console.log('GameManager: Scheduling timer for next level sequence.');
        try {
            if (this.timerManager) {
                this.timerManager.clearTimer('nextLevel'); // Clear first
                this.timerManager.setTimer('nextLevel', 10); // Set ~10s delay
                this.scoreManager.displayMessage('\uD83D\uDE4CCongratulations ' +
                    playerManager.getPlayerDetails(playerId).username +
                    '!\uD83D\uDE4C\nYou win with a final time of\n' +
                    this.currentElapsedTimeSec, this.worldWidth / 2 - 200);
            }
            else {
                console.log('!!! GameManager ERROR: Could not get TimerManager to schedule next level.');
            }
        }
        catch (e) {
            console.log('!!! GameManager ERROR scheduling triggerNextLevel timer:', e);
        }
    }
    /** Listener for the event that triggers the next level after a delay */
    onEvent_triggerNextLevel() {
        if (this.currentGameState === 'LEVEL_COMPLETE') {
            console.log('GameManager: Received triggerNextLevel event.');
            this.startNextLevel();
        }
        else {
            console.log(`GameManager: Ignoring triggerNextLevel event, state is ${this.currentGameState}.`);
        }
    }
    // --- Timer & Score Functions ---
    /** Starts the gameplay timer and the live update interval */
    startGameplayTimer() {
        this.highScoreManager.toggleHighScoreDisplay(false);
        console.log('GameManager: Starting gameplay timer.');
        this.gameStartTimeMs = Date.now();
        this.currentElapsedTimeSec = 0;
        this.updateScoreDisplay(0); // Show 0.00s
        // Start the live update interval
        try {
            this.timerManager?.setInterval('gameplayUpdate', 1);
            console.log('GameManager: Started gameplay update interval.');
        }
        catch (e) {
            console.log('!!! GameManager ERROR setting gameplay update interval:', e);
        }
    }
    /** Stops the gameplay timer interval and calculates final time */
    stopGameplayTimer() {
        this.highScoreManager.toggleHighScoreDisplay(true);
        // Stop the live update interval
        try {
            this.timerManager?.clearTimer('gameplayUpdate');
            console.log('GameManager: Cleared gameplay update interval.');
        }
        catch (e) {
            console.log('!!! GameManager ERROR clearing gameplay update interval:', e);
        }
        // Calculate final time
        let finalTime = 0;
        if (this.gameStartTimeMs > 0) {
            finalTime = (Date.now() - this.gameStartTimeMs) / 1000.0;
        }
        this.currentElapsedTimeSec = finalTime;
        console.log(`GameManager: Stopping timer. Final time: ${finalTime}s`);
        //this.updateScoreDisplay(finalTime); // Update display one last time
        this.gameStartTimeMs = 0;
    }
    /** Handles the event from TimerManager to update the live gameplay time display */
    onEvent_updateGameplayDisplay() {
        if (this.currentGameState !== 'ACTIVE' || this.gameStartTimeMs === 0)
            return;
        const elapsedSeconds = Math.round((Date.now() - this.gameStartTimeMs) / 1000.0);
        this.updateScoreDisplay(elapsedSeconds);
    }
    /** Calls ScoreManager to update the text sprite */
    updateScoreDisplay(timeInSeconds) {
        if (typeof timeInSeconds !== 'number' || !isFinite(timeInSeconds)) {
            timeInSeconds = 0;
        }
        this.scoreManager?.updateScoreDisplay(timeInSeconds);
    }
    /** Calls ScoreManager to record the final score */
    recordScore(playerId, score) {
        console.log(`GameManager: Telling ScoreManager to record score ${score} for Player ${playerId}`);
        this.scoreManager?.recordFinalScore(playerId, score);
        this.highScoreManager?.addScore(playerId, score, this.currentLevelIndex);
    }
    onEvent_playerHitWall(eventData) {
        const playerId = eventData?.playerId;
        if (playerId === undefined)
            return;
        this.naughtyList = {
            playerId: playerId,
            hitWall: true,
        };
        // *** Check if this player was the one JUST teleported ***
        if (this.playerJustTeleported === playerId) {
            console.log(`GameManager: Ignoring playerHitWall for Player ${playerId} (just teleported).`);
            return; // Ignore rapid hits from the same player
        }
        // Log, set the flag for *this* player, and teleport immediately
        console.log(`GameManager received event: playerHitWall for Player ${playerId}. Teleporting.`);
        this.playerJustTeleported = playerId;
        this.teleportPlayerToSafeZone(playerId);
        // Schedule a timer to reset the flag
        try {
            // Use a NEW timer type 'resetLastTeleported'
            this.timerManager?.setTimer('resetLastTeleported', 1, {
                playerId: playerId,
            }); // 1 step delay
            console.log(`GameManager: Scheduled resetLastTeleported timer for Player ${playerId}`);
        }
        catch (e) {
            console.log(`!!! GameManager ERROR scheduling resetLastTeleported timer for Player ${playerId}:`, e);
            // If timer fails, the player might get stuck unable to teleport again.
            // Maybe reset manually? this.playerJustTeleported = null; (risks bounce if error is intermittent)
        }
    }
    onEvent_resetLastTeleported(payload) {
        const resetPlayerId = payload?.playerId;
        if (resetPlayerId === undefined)
            return;
        // Only reset the flag if it still matches the player this timer was for
        // (Prevents a delayed timer resetting the flag for a different player)
        if (this.playerJustTeleported === resetPlayerId) {
            console.log(`GameManager: Resetting 'just teleported' flag for Player ${resetPlayerId}.`);
            this.playerJustTeleported = null;
        }
        else {
            // Optional log: Another player was teleported more recently
            console.log(`GameManager: Ignoring reset timer for Player ${resetPlayerId}, another player ${this.playerJustTeleported}) was teleported more recently.`);
        }
    }
    onEvent_playerGotPellet(eventData) {
        if (this.currentGameState !== 'ACTIVE')
            return;
        const playerId = eventData?.playerId;
        if (this.naughtyList[playerId] != undefined &&
            this.naughtyList[playerId].hitWall) {
            return;
        }
        if (playerId !== undefined) {
            this.completeLevel(playerId);
        }
    }
    async onPlayerJoined({ playerId }) {
        this.collisionManager.addPlayer(playerId);
        playerManager.tintPlayer(playerId, 'red');
        playerManager.setNameplate(playerId, '\u26a1 ' + playerManager.getPlayerDetails(playerId).username + ' \u26a1');
    }
    // --- Helper Functions ---
    teleportPlayerToSafeZone(playerId) {
        if (typeof playerManager === 'undefined' ||
            typeof playerManager.teleportPlayers !== 'function') {
            console.log('!!! GameManager ERROR: playerManager or playerManager.teleportPlayers not available!');
            return;
        }
        const playerCheck = playerManager.getPlayerIds();
        if (!playerCheck.includes(playerId))
            return;
        if (playerManager.getPlayerDetails(playerId).y > this.safeZoneCenterY) {
            return;
        }
        const teleportOptions = {
            distributionType: 'area',
            positionX: this.safeZoneCenterX,
            positionY: this.safeZoneCenterY,
            height: this.safeZoneAreaHeight,
            width: this.safeZoneAreaWidth,
        };
        console.log(`GameManager: Teleporting Player ${playerId} to safe zone...`);
        const playerX = playerManager.getPlayerDetails(playerId).x;
        const playerY = playerManager.getPlayerDetails(playerId).y;
        //Nixing the particle effects for the moment
        /*let particleType = mathRandomInt(
          1,
          this.particleManager.particleType.length,
        );
        particleType -= 1;
        this.particleManager.displayParticles(
          { x: playerX, y: playerY },
          30,
          1,
        );*/ /*
        this.particleManager.displayParticles(
          { x: playerX, y: playerY },
          particleType,
          1,
          playerId,
        );*/
        try {
            playerManager.teleportPlayers([playerId], teleportOptions);
        }
        catch (error) {
            console.log('!!! GameManager Teleport Error:', error);
        }
        this.naughtyList = {
            playerId: playerId,
            hitWall: false,
        };
    }
    onSpriteClicked(params) {
        if (params.sprite.uniqueId != 'scoreTextSprite')
            return;
        if (this.reset < 10) {
            this.reset++;
        }
        else {
            this.reset = 0;
            this.highScoreManager.populateTempHighScores();
        }
    }
    teleportAllPlayersToSafeZone() {
        console.log('GameManager: Attempting to teleport all players to safe zone...');
        // Check if playerManager and required functions exist
        if (typeof playerManager === 'undefined' ||
            typeof playerManager.getPlayerIds !== 'function' ||
            typeof playerManager.teleportPlayers !== 'function') {
            console.log('!!! GameManager ERROR: playerManager.getPlayerIds or playerManager.teleportPlayers not available!');
            return;
        }
        //I know there is a teleportplayers function, but I don't want to teleport a player if they are already in the safe zone
        const allPlayerIds = playerManager.getPlayerIds();
        for (let i = 0; i < allPlayerIds.length; i++) {
            this.teleportPlayerToSafeZone(allPlayerIds[i]);
        }
        /*
        try {
          const allPlayerIds = playerManager.getPlayerIds();
    
          if (
            allPlayerIds &&
            Array.isArray(allPlayerIds) &&
            allPlayerIds.length > 0
          ) {
            // Define teleport options (using area distribution as per your last code)
            const teleportOptions = {
              distributionType: 'area' as const, // Or 'radius' if preferred
              positionX: this.safeZoneCenterX,
              positionY: this.safeZoneCenterY,
              height: this.safeZoneAreaHeight,
              width: this.safeZoneAreaWidth,
            };
    
            console.log(
              `GameManager: Teleporting ${allPlayerIds.length} players to safe zone...`,
            );
            playerManager.teleportPlayers(allPlayerIds, teleportOptions);
          } else if (allPlayerIds && allPlayerIds.length === 0) {
            console.log('GameManager: No players found to teleport.');
          } else {
            console.log(
              '!!! GameManager WARNING: Failed to get a valid list of player IDs.',
            );
          }
        } catch (error) {
          console.log('!!! GameManager Teleport All Players Error:', error);
        }*/
    }
} // End class GameManager
