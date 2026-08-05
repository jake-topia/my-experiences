"use strict";
class GameManagerLava extends SystemScript {
    // Topia runtime may treat systemName specially; declare explicitly (non-optional to satisfy base)
    systemName;
    // --- World / Lobby ---
    worldWidth;
    worldHeight;
    centerSpawnX;
    centerSpawnY;
    startZoneId;
    startSpriteUniqueId;
    // --- Player Tracking ---
    readyPlayerIdsList; // players who stood on start pad
    activePlayerIds; // snapshot at game start; used for scoring
    numberOfPlayersInGame;
    // --- Game State / Scoring ---
    currentGameState; // WAITING_FOR_PLAYERS | PRE_COUNTDOWN | COUNTDOWN | ACTIVE | GAME_OVER
    cyclesSurvived; // waves started (score uses waves completed)
    totalScore;
    // --- Timing Config (read by subsystems) ---
    countdownDuration;
    flashDurationPerWarning;
    numberOfFlashes;
    lavaActiveDurationPerWave;
    pauseBetweenWaves;
    lobbyIntroMessage;
    // --- Subsystems (attached in onInit) ---
    lavaMapManager;
    scoreManager;
    timerManager;
    countdownManager;
    highScoreManager;
    bonusZoneManager;
    collisionManager;
    particleManager;
    // Debug: did we finish attaching subsystems in onInit?
    didAttachSubsystems;
    // Queue player joins that arrive before subsystems are ready
    pendingPlayerJoins;
    // --- Phase System ---
    phaseEnabled; // master toggle
    currentPhaseId; // '' when not in a phase
    phaseEndWave; // wave index when current phase ends
    nextPhaseWave; // wave index when the next phase may start
    baseHue; // starting hue for visual drift
    currentHue; // current hue applied to visuals
    phaseDefs; // array of phase definitions (id, name, duration, colorShift, applyMethod)
    specialInterval;
    // --- Analytics ---
    analyticsPublicKey;
    lastGameInitiatorProfileId;
    // --- Leveling & Testing ---
    level;
    levelInterval; // waves per level
    nextLevelWave;
    levelBonusPoints;
    levelBonusPerLevel; // added: additional bonus grows each level
    // --- Centralized difficulty scaling ---
    speedMultiplierBase; // base speed multiplier applied to moving systems (<=1.0 means slower than base)
    speedMultiplierPerLevel; // added per level (level-1)
    speedMultiplierMin; // clamp low bound
    speedMultiplierMax; // clamp high bound
    warningSecondsBase; // base warning flash seconds at level 1
    warningSecondsPerLevel; // subtracted per level (level-1)
    warningSecondsMin; // clamp min seconds
    testingMode;
    testingSequence; // array of { kind: 'static'|'special', index?:number, methodName?:string }
    testingIndex;
    // --- Visual Overlay (stage tint substitute) ---
    overlayAssetId; // configurable asset id for full-screen panel
    overlaySpriteId;
    // --- Level-up UX ---
    levelPauseSeconds; // extra pause after level completion before next wave starts
    lastAnnouncedLevelCompleted; // tracks last completed level we've shown a banner for
    async onInit() {
        //if (!playerManager.isHost) return;
        console.log('[GM] INFO onInit:start');
        gameLoopManager.setGameLoopParameters({
            physicsTicksPerSecond: 10,
            throttledStepsPerSecond: 1,
        });
        //gameLoopManager.setSyncParameters({syncsPerSecond:10});
        this.lobbyIntroMessage =
            'Do not touch solid lava!\nGreen bonus zones give you points.\nLevel up every few waves to increase challenge.\n\nPress Start to begin.';
        this.didAttachSubsystems = false;
        this.pendingPlayerJoins = [];
        // Analytics setup
        this.analyticsPublicKey =
            stateManager.getVariable('PublicKey') || '';
        this.lastGameInitiatorProfileId = '';
        // Attach ParticleManager
        this.worldWidth = 1000;
        this.worldHeight = 1000;
        this.countdownDuration = 5;
        this.flashDurationPerWarning = 0.1;
        this.numberOfFlashes = 2;
        this.lavaActiveDurationPerWave = 3;
        this.pauseBetweenWaves = 0.1;
        this.startZoneId = 'lavaGameStartZone';
        this.centerSpawnX = this.worldWidth / 2;
        this.centerSpawnY = this.worldHeight / 2;
        this.startSpriteUniqueId = '';
        this.readyPlayerIdsList = [];
        this.activePlayerIds = [];
        this.numberOfPlayersInGame = 0;
        this.currentGameState = 'WAITING_FOR_PLAYERS';
        this.cyclesSurvived = 0;
        this.totalScore = 0;
        this.phaseEnabled = true;
        this.currentPhaseId = '';
        this.phaseEndWave = 0;
        this.specialInterval = 3; // special every 3 waves
        this.nextPhaseWave = this.specialInterval;
        this.baseHue = 20;
        this.currentHue = 0;
        // Overlay config (use a panel/rect asset id provided by the scene)
        this.overlayAssetId =
            (stateManager.getVariable &&
                stateManager.getVariable('OverlayAssetId')) ||
                'overlay_rect';
        this.overlaySpriteId = 'lava_overlay';
        // Leveling defaults (stub)
        this.level = 1;
        // Step 1: run levels every 3 waves (2 static, 1 moving)
        this.levelInterval = 3;
        this.nextLevelWave = this.levelInterval;
        this.levelBonusPoints = 300;
        this.levelBonusPerLevel = 100; // author-tuned
        // Difficulty scaling defaults (author-tunable)
        // Make early levels clearly slower/longer, then ramp up noticeably.
        this.speedMultiplierBase = 0.4; // 40% of base speed at level 1
        this.speedMultiplierPerLevel = 0.2; // +20% speed per level
        this.speedMultiplierMin = 0.3; // never below 30%
        this.speedMultiplierMax = 2.0; // cap at 200%
        this.warningSecondsBase = 4.0; // 4s warn at level 1
        this.warningSecondsPerLevel = 0.6; // -0.6s per level
        this.warningSecondsMin = 1.0; // clamp at 1s warn minimum
        // Step 1: add a short pause and banner between levels
        this.levelPauseSeconds = 1.2; // can be tuned; timers use seconds
        this.lastAnnouncedLevelCompleted = 0;
        // Testing mode defaults
        this.testingMode = !!(stateManager &&
            stateManager.getVariable &&
            stateManager.getVariable('TestingMode'));
        this.testingSequence = [];
        this.testingIndex = 0;
        scriptManager.attachSystem({ scriptId: 'TimerManager' });
        this.timerManager = scriptManager.getSystem({
            systemName: 'TimerManager',
        });
        scriptManager.attachSystem({ scriptId: 'LavaMapManager' });
        this.lavaMapManager = scriptManager.getSystem({
            systemName: 'LavaMapManager',
        });
        scriptManager.attachSystem({ scriptId: 'ScoreManager_Lava' });
        this.scoreManager = scriptManager.getSystem({
            systemName: 'ScoreManager_Lava',
        });
        scriptManager.attachSystem({ scriptId: 'CountdownManager_Lava' });
        this.countdownManager = scriptManager.getSystem({
            systemName: 'CountdownManager_Lava',
        });
        scriptManager.attachSystem({ scriptId: 'HighScoreManager_Lava' });
        this.highScoreManager = scriptManager.getSystem({
            systemName: 'HighScoreManager_Lava',
        });
        scriptManager.attachSystem({ scriptId: 'BonusZoneManager_Lava' });
        this.bonusZoneManager = scriptManager.getSystem({
            systemName: 'BonusZoneManager_Lava',
        });
        scriptManager.attachSystem({ scriptId: 'CollisionManager' });
        this.collisionManager = scriptManager.getSystem({
            systemName: 'CollisionManager',
        });
        scriptManager.attachSystem({ scriptId: 'ParticleManager' });
        this.particleManager = scriptManager.getSystem({
            systemName: 'ParticleManager',
        });
        // Sanity check
        if (!this.timerManager ||
            !this.lavaMapManager ||
            !this.scoreManager ||
            !this.countdownManager ||
            !this.highScoreManager ||
            !this.bonusZoneManager ||
            !this.collisionManager) {
            console.error('[GM] ERROR onInit: subsystem(s) missing');
            return;
        }
        // Phase definitions (id → method on LavaMapManager)
        this.phaseDefs = [
            {
                id: 'creepingLava',
                name: '🧱 CREEPING DOOM',
                colorShift: 15,
                duration: 1,
                applyMethod: 'spawnCreepingLava',
            } /*
            {
              id: 'rotatingSweep',
              name: '🗡️ CROSS SWEEP',
              colorShift: 20,
              duration: 1,
              applyMethod: 'spawnRotatingBar',
            },*/,
            {
                id: 'expandingWave',
                name: '💥 CORE RIPPLE',
                colorShift: 25,
                duration: 1,
                applyMethod: 'spawnExpandingRipple',
            },
            // new five:
            {
                id: 'clamp',
                name: '🛑 CLAMPING JAWS',
                colorShift: 18,
                duration: 1,
                applyMethod: 'spawnClampingJaws',
            },
            {
                id: 'corners',
                name: '📐 CORNER CREEP',
                colorShift: 22,
                duration: 1,
                applyMethod: 'spawnCornerCreep',
            },
            /*{
              id: 'lanes',
              name: '🏎️ LANE CHASE',
              colorShift: 16,
              duration: 1,
              applyMethod: 'spawnLaneChase',
            },
            {
              id: 'blink',
              name: '✨ BLINK GRID',
              colorShift: 28,
              duration: 1,
              applyMethod: 'spawnBlinkGrid',
            },*/
            {
                id: 'gates',
                name: '🚪 SLIDING GATES',
                colorShift: 12,
                duration: 1,
                applyMethod: 'spawnSlidingGates',
            },
            /*{
              id: 'slidingAlley',
              name: '🏃‍♀️ SLIDING ALLEY',
              colorShift: 15,
              duration: 1,
              applyMethod: 'spawnSlidingAlley',
            },*/
            {
                id: 'meteorRain',
                name: '☄️ METEOR RAIN',
                colorShift: 10,
                duration: 1,
                applyMethod: 'spawnMeteorRain',
            },
            {
                id: 'splitShift',
                name: '🔀 SPLIT SHIFT',
                colorShift: 20,
                duration: 1,
                applyMethod: 'spawnSplitShift',
            },
            {
                id: 'windowWalker',
                name: '🪟 WINDOW WALKER',
                colorShift: 25,
                duration: 1,
                applyMethod: 'spawnWindowWalker',
            },
            {
                id: 'crossPressure',
                name: '➕ CROSS PRESSURE',
                colorShift: 15,
                duration: 1,
                applyMethod: 'spawnCrossPressure',
            },
        ];
        console.log('[GM] INFO onInit: attach subsystems');
        // Replace center-collision start with a simple Start button
        if (this.particleManager &&
            typeof this.particleManager.displayParticles === 'function') {
            this.particleManager.displayParticles({ x: this.centerSpawnX, y: this.centerSpawnY }, 2, //
            5);
        }
        this.scoreManager.displayMessage(this.lobbyIntroMessage);
        this.scoreManager.showScoreSprite(false);
        this.highScoreManager.toggleHighScoreDisplay(true);
        this.drawOrUpdateStartButton();
        this.initPhaseSystem();
        // Prepare testing sequence if enabled
        if (this.testingMode) {
            try {
                this.buildTestingSequence();
                console.log('[GM] INFO testingMode enabled. Items=', (this.testingSequence && this.testingSequence.length) || 0);
            }
            catch (e) {
                console.log('[GM] WARN buildTestingSequence failed', e);
            }
        }
        this.didAttachSubsystems = true;
        // Analytics: host launch (once per host init)
        if (playerManager.isHost && this.analyticsPublicKey) {
            try {
                const hostPid = playerManager.getMyPlayerId();
                const hostProfile = playerManager.getPlayerDetails(hostPid)?.profileId;
                if (hostProfile) {
                    integrationsManager.putPublicKeyAnalytics({
                        interactivePublicKey: this.analyticsPublicKey,
                        analytics: [
                            {
                                analyticName: 'lavaHostLaunches',
                                profileId: hostProfile,
                                uniqueKey: hostProfile,
                            },
                        ],
                    });
                }
            }
            catch (e) {
                console.log('[GM] WARN analytics hostLaunch failed', e);
            }
        }
        // Process any queued joins
        const pending = this.pendingPlayerJoins &&
            (this.pendingPlayerJoins.toArray
                ? this.pendingPlayerJoins.toArray()
                : this.pendingPlayerJoins);
        if (pending?.length) {
            console.log('[GM] INFO processing queued joins count=', pending.length);
            // eslint-disable-next-line prefer-for-of
            for (let i = 0; i < pending.length; i++) {
                this.safeAddCollider(pending[i]);
            }
            this.pendingPlayerJoins = [];
        }
    }
    // --- Difficulty helpers (centralized) ---
    getCurrentLevel() {
        return typeof this.level === 'number' && this.level > 0 ? this.level : 1;
    }
    // Multiplier for speeds (bonus motion, moving lava). >1.0 is faster.
    getSpeedMultiplier() {
        const lvl = this.getCurrentLevel();
        let mul = (this.speedMultiplierBase || 1) +
            Math.max(0, lvl - 1) * (this.speedMultiplierPerLevel || 0);
        const lo = typeof this.speedMultiplierMin === 'number'
            ? this.speedMultiplierMin
            : 0.3;
        const hi = typeof this.speedMultiplierMax === 'number'
            ? this.speedMultiplierMax
            : 3.0;
        if (mul < lo)
            mul = lo;
        if (mul > hi)
            mul = hi;
        return mul;
    }
    // Timescale to apply to durations (inverse of speed). <1.0 is faster, >1.0 is slower.
    getTimeScale() {
        const speed = this.getSpeedMultiplier();
        if (!speed || speed <= 0)
            return 1.0;
        let scale = 1.0 / speed;
        // Keep within reasonable bounds
        if (scale < 0.33)
            scale = 0.33; // limit to 3x speed-up
        if (scale > 3.0)
            scale = 3.0; // limit to 3x slow-down
        return scale;
    }
    // Central warning duration that other systems can consume.
    getWarningSeconds() {
        const lvl = this.getCurrentLevel();
        const base = typeof this.warningSecondsBase === 'number'
            ? this.warningSecondsBase
            : 3.0;
        const step = typeof this.warningSecondsPerLevel === 'number'
            ? this.warningSecondsPerLevel
            : 0.25;
        const minS = typeof this.warningSecondsMin === 'number' ? this.warningSecondsMin : 1.5;
        let sec = base - Math.max(0, lvl - 1) * step;
        if (sec < minS)
            sec = minS;
        return sec;
    }
    /**
     * Draw or refresh the Start Game button in the lobby.
     */
    /*
     * Centers and draws the 'Start Game' button, visible only in the lobby.
     */
    /*
     * Centers and draws the 'Start Game' button, visible only in the lobby.
     */
    drawOrUpdateStartButton() {
        if (!playerManager.isHost)
            return;
        stageManager.setCurrentStage('logo');
        const id = 'lava_start_btn';
        const testId = 'lava_test_btn';
        // Always remove the button first to ensure a clean state on every call.
        if (spriteManager.getSprite(id)) {
            spriteManager.removeSprite(id);
        }
        if (spriteManager.getSprite(testId)) {
            spriteManager.removeSprite(testId);
        }
        // Only draw the button if we are in the lobby.
        if (this.currentGameState !== 'WAITING_FOR_PLAYERS') {
            return;
        }
        // --- Centering Logic ---
        // Decide whether to show the Testing toggle via a state variable (default: show)
        let showTestingBtn = false;
        try {
            const flag = stateManager &&
                stateManager.getVariable &&
                stateManager.getVariable('ShowTestingButton');
            if (flag === '0' || flag === false)
                showTestingBtn = false;
        }
        catch { }
        const buttonWidth = 170;
        const buttonHeight = 28; // Corresponds to fontSize
        const gap = 24; // pixels between buttons
        const y = this.centerSpawnY - buttonHeight / 2;
        if (showTestingBtn) {
            // Two buttons: Start and Testing toggle, side by side centered.
            const totalWidth = buttonWidth * 2 + gap;
            const leftX = this.centerSpawnX - totalWidth / 2;
            // Start button (left)
            spriteManager.addSprite('text', {
                uniqueId: id,
                text: 'Start Game',
                positionX: leftX,
                positionY: y,
                fontSize: 28,
                isInteractive: true,
            });
            // Testing toggle button (right)
            const label = this.testingMode ? 'Testing: ON' : 'Testing: OFF';
            spriteManager.addSprite('text', {
                uniqueId: testId,
                text: label,
                positionX: leftX + buttonWidth + gap,
                positionY: y,
                fontSize: 28,
                isInteractive: true,
            });
        }
        else {
            // Only draw a single centered Start button
            const centeredX = this.centerSpawnX - buttonWidth / 2;
            spriteManager.addSprite('text', {
                uniqueId: id,
                text: 'Start Game',
                positionX: centeredX,
                positionY: y,
                fontSize: 28,
                isInteractive: true,
            });
        }
    }
    removeStartButton() {
        if (!playerManager.isHost)
            return;
        stageManager.setCurrentStage('background');
        const id = 'lava_start_btn';
        const testId = 'lava_test_btn';
        if (spriteManager.getSprite(id))
            spriteManager.removeSprite(id);
        if (spriteManager.getSprite(testId))
            spriteManager.removeSprite(testId);
    }
    /**
     * Create the start-pad collider players must touch to mark "ready".
     * Stores the uniqueId we’ll use for collision checks.
     */
    setupStartZone() {
        if (!playerManager.isHost)
            return;
        const startSprite = spriteManager.addSprite('start_pad_asset', {
            uniqueId: this.startZoneId,
            positionX: this.centerSpawnX,
            positionY: this.centerSpawnY,
            checkCollisions: true,
            opacity: 1,
        });
        if (!startSprite) {
            console.error('[GM] ERROR setupStartZone: addSprite returned null');
            this.startSpriteUniqueId = '';
            return;
        }
        this.startSpriteUniqueId =
            startSprite.uniqueId !== undefined
                ? startSprite.uniqueId
                : this.startZoneId;
        console.log(`[GM] INFO setupStartZone: startSpriteId='${this.startSpriteUniqueId}'`);
    }
    /**
     * Lobby logic: updates readiness, displays lobby count, starts pre-countdown when all ready.
     */
    checkIfAllPlayersReady() {
        if (!playerManager.isHost)
            return;
        const currentPlayersInRoom = playerManager.getPlayerIds();
        const numCurrentPlayers = currentPlayersInRoom.length;
        if (numCurrentPlayers === 0) {
            this.readyPlayerIdsList = [];
            this.scoreManager.displayMessage(this.lobbyIntroMessage);
            return;
        }
        // Keep only ready players who are still present
        const readyArray = this.readyPlayerIdsList.toArray
            ? this.readyPlayerIdsList.toArray()
            : this.readyPlayerIdsList;
        const nextReadyList = [];
        // eslint-disable-next-line prefer-for-of
        for (let i = 0; i < readyArray.length; i++) {
            const pid = readyArray[i];
            if (currentPlayersInRoom.indexOf(pid) !== -1)
                nextReadyList.push(pid);
        }
        this.readyPlayerIdsList = nextReadyList;
        const numReadyPlayers = this.readyPlayerIdsList.length;
        this.scoreManager.displayMessage(`Glitch Lava\n${numReadyPlayers} / ${numCurrentPlayers} players ready.\nMove to center to start!`);
        // Start when everyone present is ready (cap 10)
        if (numReadyPlayers > 0 &&
            numReadyPlayers === numCurrentPlayers &&
            numReadyPlayers <= 10) {
            console.log('[GM] INFO lobby: all players ready → PRE_COUNTDOWN');
            this.currentGameState = 'PRE_COUNTDOWN';
            this.numberOfPlayersInGame = numCurrentPlayers;
            this.activePlayerIds = this.readyPlayerIdsList;
            if (this.startSpriteUniqueId) {
                try {
                    spriteManager.removeSprite(this.startSpriteUniqueId);
                }
                catch (e) {
                    console.log('[GM] WARN lobby: could not remove start sprite', e);
                }
                this.startSpriteUniqueId = '';
            }
            this.highScoreManager.toggleHighScoreDisplay(false);
            this.scoreManager.displayMessage('All Ready! Starting Game..');
            this.timerManager.setTimer('triggerCountdown', 2);
        }
    }
    /**
     * New player joins: attach collider + cosmetic; if in lobby, re-evaluate readiness.
     */
    onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        console.log(`[GM] INFO playerJoined: ${playerId}`);
        if (!this.didAttachSubsystems) {
            console.warn('[GM] WARN join before subsystems ready -> queue');
            this.pendingPlayerJoins.push(playerId);
        }
        else {
            this.safeAddCollider(playerId);
        }
        // Cosmetic only; failures are non-fatal
        try {
            playerManager.tintPlayer(playerId, 'orange');
            const details = playerManager.getPlayerDetails(playerId);
            playerManager.setNameplate(playerId, `🔥 ${details ? details.username : 'Player ' + playerId} 🔥`);
        }
        catch (e) {
            console.log('[GM] WARN playerJoined: styling failed', e);
        }
        if (this.currentGameState === 'WAITING_FOR_PLAYERS') {
            // Lobby: ensure Start button is visible
            if (this.particleManager &&
                typeof this.particleManager.displayParticles === 'function') {
                this.particleManager.displayParticles({ x: this.centerSpawnX, y: this.centerSpawnY }, 2, //
                5);
            }
            this.scoreManager.displayMessage(this.lobbyIntroMessage);
            this.drawOrUpdateStartButton();
            this.setWorldActivity('GAME_WAITING');
        }
        else if (this.currentGameState !== 'GAME_OVER') {
            console.log(`[GM] INFO playerJoined: spectating (state=${this.currentGameState})`);
        }
        // Analytics: player joins (count + unique)
        if (this.analyticsPublicKey) {
            try {
                const details = playerManager.getPlayerDetails(playerId);
                const profileId = details?.profileId;
                if (profileId) {
                    integrationsManager.putPublicKeyAnalytics({
                        interactivePublicKey: this.analyticsPublicKey,
                        analytics: [
                            {
                                analyticName: 'lavaPlayerJoins',
                                profileId: profileId,
                                uniqueKey: profileId,
                            },
                            {
                                analyticName: 'lavaNumPlayersOnJoin-' + playerManager.getPlayerIds().length,
                            },
                        ],
                    });
                }
            }
            catch (e) {
                console.log('[GM] WARN analytics playerJoin failed', e);
            }
        }
    }
    // Safe wrapper to add collider (avoids crashes)
    safeAddCollider(playerId) {
        if (!playerManager.isHost)
            return;
        if (!this.collisionManager) {
            console.error('[GM] ERROR safeAddCollider: collisionManager missing');
            return;
        }
        if (typeof this.collisionManager.addPlayer !== 'function') {
            console.error('[GM] ERROR safeAddCollider: addPlayer not a function; keys=', Object.keys(this.collisionManager).join(', '));
            return;
        }
        try {
            this.collisionManager.addPlayer(playerId);
            console.log('[GM] DEBUG safeAddCollider success pid=', playerId);
        }
        catch (e) {
            console.error('[GM] ERROR safeAddCollider failed pid=' + playerId, e);
        }
    }
    /**
     * Player leaves: remove from ready/active; if game empties during ACTIVE, end it.
     */
    /* eslint-disable-next-line sonarjs/cognitive-complexity */
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        console.log(`[GM] INFO playerLeft: ${playerId}`);
        //TODO: DELETE THE COLLISION BOX FOR THE PLAYER!
        spriteManager.removeSprite('collider_' + playerId);
        if (this.currentGameState === 'GAME_OVER') {
            return;
        }
        const readyArray = this.readyPlayerIdsList.toArray
            ? this.readyPlayerIdsList.toArray()
            : this.readyPlayerIdsList;
        const lenBefore = readyArray.length;
        const nextReadyList = [];
        // eslint-disable-next-line prefer-for-of
        for (let i = 0; i < readyArray.length; i++) {
            const rid = readyArray[i];
            if (rid !== playerId)
                nextReadyList.push(rid);
        }
        this.readyPlayerIdsList = nextReadyList;
        const wasReady = this.readyPlayerIdsList.length < lenBefore;
        const wasActivePlayer = (this.activePlayerIds.toArray
            ? this.activePlayerIds.toArray()
            : this.activePlayerIds).indexOf(playerId) !== -1;
        if (wasActivePlayer) {
            const arr = this.activePlayerIds.toArray
                ? this.activePlayerIds.toArray()
                : this.activePlayerIds;
            this.activePlayerIds = arr.filter(function (id) {
                return id !== playerId;
            });
        }
        if (this.currentGameState === 'WAITING_FOR_PLAYERS') {
            if (wasReady)
                this.checkIfAllPlayersReady();
            return;
        }
        if (this.currentGameState === 'ACTIVE' && wasActivePlayer) {
            if (this.activePlayerIds.length === 0) {
                console.log('[GM] INFO active: all players left → GAME_OVER');
                this.currentGameState = 'GAME_OVER';
                this.timerManager.clearTimer('endCurrentLavaWave');
                this.timerManager.clearTimer('initiateNextWaveCycle');
                if (this.lavaMapManager &&
                    typeof this.lavaMapManager.stopAllLavaActivity === 'function') {
                    this.lavaMapManager.stopAllLavaActivity();
                }
                this.bonusZoneManager.stopBonusZoneActivity();
                this.scoreManager.displayMessage('All players left. Game ended.');
                this.highScoreManager.toggleHighScoreDisplay(true);
                this.timerManager.setTimer('offerRestart', 5);
            }
            else {
                console.log(`[GM] INFO active: player ${playerId} left, remaining=${this.activePlayerIds.length}`);
            }
        }
    }
    /**
     * Central collision handler (host): lobby ready collisions and active hazards/bonuses.
     */
    /* eslint-disable-next-line sonarjs/cognitive-complexity */
    onSpriteCollisionStart({ sprite1, sprite2, }) {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState === 'GAME_OVER')
            return;
        const id1 = sprite1.uniqueId;
        const id2 = sprite2.uniqueId;
        // --- Lobby: standing on start zone marks player ready ---
        if (this.currentGameState === 'WAITING_FOR_PLAYERS') {
            let playerId = null;
            let hitStart = false;
            if (sprite1.playerId !== undefined && id2 === this.startSpriteUniqueId) {
                playerId = Number(sprite1.playerId);
                hitStart = true;
            }
            else if (sprite2.playerId !== undefined &&
                id1 === this.startSpriteUniqueId) {
                playerId = Number(sprite2.playerId);
                hitStart = true;
            }
            if (playerId !== null && hitStart) {
                const readyArr = this.readyPlayerIdsList;
                if (readyArr.toArray().indexOf(playerId) === -1) {
                    this.readyPlayerIdsList.push(playerId);
                    this.checkIfAllPlayersReady();
                }
            }
        }
        // --- Active: detect player vs. lava/bonus ---
        if (this.currentGameState === 'ACTIVE') {
            // Player colliders are named 'collider_<id>'
            const s1_isPlayer = id1.indexOf('collider_') !== -1;
            const s2_isPlayer = id2.indexOf('collider_') !== -1;
            if (!s1_isPlayer && !s2_isPlayer)
                return;
            const playerSprite = s1_isPlayer ? sprite1 : sprite2;
            const objectSprite = s1_isPlayer ? sprite2 : sprite1;
            const playerId = Number(String(playerSprite.uniqueId).split('_').pop());
            if (this.lavaMapManager.isLavaSprite(objectSprite.uniqueId)) {
                console.log(`[GM] INFO hit: player ${playerId} → lava`);
                eventManager.emit('playerHitLava', {
                    playerId: playerId,
                    lavaSpriteId: objectSprite.uniqueId,
                });
            }
            else if (this.bonusZoneManager.isBonusZoneSprite(objectSprite.uniqueId)) {
                console.log(`[GM] INFO hit: player ${playerId} → bonus`);
                eventManager.emit('playersAwardedBonus', {
                    playerId: playerId,
                    points: 10,
                });
            }
        }
    }
    /**
     * Reset to clean lobby.
     */
    resetGameToWaitingState() {
        if (!playerManager.isHost)
            return;
        console.log('[GM] INFO reset → WAITING_FOR_PLAYERS');
        this.currentGameState = 'WAITING_FOR_PLAYERS';
        this.readyPlayerIdsList = [];
        this.activePlayerIds = [];
        this.numberOfPlayersInGame = 0;
        this.cyclesSurvived = 0;
        this.totalScore = 0;
        // Phase System defaults
        this.phaseEnabled = true;
        this.currentPhaseId = '';
        this.phaseEndWave = 0;
        if (this.lavaMapManager &&
            typeof this.lavaMapManager.stopAllLavaActivity === 'function') {
            this.lavaMapManager.stopAllLavaActivity();
        }
        // fire a special exactly every 3 waves
        this.specialInterval = 3;
        this.nextPhaseWave = this.specialInterval; // first special at wave 3
        // Particle effect: full-screen smoke
        if (this.particleManager &&
            typeof this.particleManager.displayParticles === 'function') {
            this.particleManager.displayParticles({ x: this.centerSpawnX, y: this.centerSpawnY }, 2, //
            5);
        }
        this.scoreManager.displayMessage(this.lobbyIntroMessage);
        this.scoreManager.showScoreSprite(false);
        this.highScoreManager.toggleHighScoreDisplay(true);
        this.drawOrUpdateStartButton();
    }
    // -----------------------
    // Game flow (countdown → waves → game over)
    // -----------------------
    onEvent_triggerCountdownNow() {
        //if (!playerManager.isHost) return;
        if (this.currentGameState !== 'PRE_COUNTDOWN')
            return;
        console.log('[GM] INFO countdown: start');
        this.removeStartButton();
        this.currentGameState = 'COUNTDOWN';
        this.countdownManager.startCountdown(this.countdownDuration, 'startGameplayAfterCountdown');
    }
    onEvent_startGameplayAfterCountdown() {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState !== 'COUNTDOWN' &&
            this.currentGameState !== 'PRE_COUNTDOWN') {
            console.log(`[GM] WARN startGameplayAfterCountdown in state=${this.currentGameState}`);
        }
        console.log('[GM] INFO active: begin');
        this.currentGameState = 'ACTIVE';
        this.setWorldActivity('GAME_ON');
        this.cyclesSurvived = 0;
        this.totalScore = 0;
        // Reset level progression for a fresh run
        this.level = 1;
        this.nextLevelWave = this.levelInterval;
        this.lastAnnouncedLevelCompleted = 0;
        this.scoreManager.showScoreSprite(true);
        this.scoreManager.updateLiveScore(this.cyclesSurvived, this.numberOfPlayersInGame);
        this.startNextWave();
        // Bonus zone startup is managed by BonusZoneManager
    }
    /**
     * Handle Start button click from any client: transition to PRE_COUNTDOWN and schedule countdown.
     */
    onEvent_startGame(eventData) {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState !== 'WAITING_FOR_PLAYERS')
            return;
        console.log('[GM] INFO lobby: start button clicked → PRE_COUNTDOWN');
        this.currentGameState = 'PRE_COUNTDOWN';
        const ids = playerManager.getPlayerIds();
        this.numberOfPlayersInGame = ids.length;
        this.activePlayerIds = ids;
        this.highScoreManager.toggleHighScoreDisplay(false);
        this.removeStartButton();
        this.scoreManager.displayMessage('Starting Game..');
        this.timerManager.setTimer('triggerCountdown', 2);
        // Analytics: game start & player start (unique by profile)
        if (this.analyticsPublicKey) {
            try {
                const starterPid = eventData.fromPlayerId || eventData.playerId;
                const starterProfile = playerManager.getPlayerDetails(starterPid).profileId;
                if (starterProfile)
                    this.lastGameInitiatorProfileId = starterProfile;
                const analytics = [{ analyticName: 'lavaGameStarts' }];
                if (starterProfile) {
                    analytics.push({
                        analyticName: 'lavaPlayerStarts',
                        profileId: starterProfile,
                        uniqueKey: starterProfile,
                    });
                }
                analytics.push({
                    analyticName: 'lavaNumPlayersAtStart-' + ids.length,
                });
                integrationsManager.putPublicKeyAnalytics({
                    interactivePublicKey: this.analyticsPublicKey,
                    analytics,
                });
            }
            catch (e) {
                console.log('[GM] WARN analytics gameStart failed', e);
            }
        }
    }
    /**
     * Increments wave counter, updates score, resets/starts bonus, and asks LavaMapManager to prepare.
     */
    startNextWave() {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState !== 'ACTIVE')
            return;
        // Progress counters
        this.cyclesSurvived++;
        console.log('[GM] INFO wave: start #' + this.cyclesSurvived);
        // Leveling stub: every N waves, level up (bonus + message + hue bump)
        if (this.cyclesSurvived >= this.nextLevelWave) {
            this.level++;
            this.nextLevelWave += this.levelInterval;
            var lb = (this.levelBonusPoints || 0) +
                Math.max(0, this.level - 1) * (this.levelBonusPerLevel || 0);
            this.totalScore += lb;
            this.bumpHue(12); // small celebratory hue shift
            try {
                this.scoreManager.updateLiveScore(this.cyclesSurvived, this.numberOfPlayersInGame);
                this.scoreManager.displayMessage('LEVEL ' + this.level + ' \n+' + lb + ' bonus');
                // Quick overlay flash to punctuate the level-up
                this.setOverlayEnabled(true, { opacity: 0.18 });
                this.timerManager.setTimer('overlayFlashOff', 0.35);
            }
            catch (e) {
                console.log('[GM] WARN levelUp UI update failed', e);
            }
        }
        // Score adds completed cycles (previous waves finished)
        const completedCycles = this.cyclesSurvived > 0 ? this.cyclesSurvived - 1 : 0;
        this.totalScore += completedCycles;
        // UI
        this.scoreManager.updateLiveScore(this.cyclesSurvived, this.numberOfPlayersInGame);
        // Per-wave subtle visuals (hue drift, UI glow, etc.)
        this.applyPerWaveVisuals();
        // Phase lifecycle or testing pattern (testing overrides phases)
        let handledByPhase = false;
        if (this.testingMode) {
            try {
                handledByPhase = this.applyTestingPatternForCurrentIndex();
            }
            catch (e) {
                console.log('[GM] WARN testing pattern failed; fallback to normal', e);
                handledByPhase = false;
            }
        }
        else {
            handledByPhase = this.checkPhaseLifecycleAndApply();
        }
        if (!handledByPhase) {
            // Normal wave flow
            if (this.bonusZoneManager) {
                this.bonusZoneManager.resetAndStartNewZone();
            }
            if (this.lavaMapManager &&
                typeof this.lavaMapManager.prepareNextWave === 'function') {
                this.lavaMapManager.prepareNextWave();
            }
        }
        // Show the name of whatever pattern is active right now
        const lastName = this.lavaMapManager?.lastPatternName;
        if (lastName)
            this.scoreManager.displayMessage(lastName);
    }
    // Build a deterministic list: all static patterns in order, then specials in phaseDefs order
    buildTestingSequence() {
        this.testingSequence = [];
        try {
            var count = this.lavaMapManager &&
                typeof this.lavaMapManager.getPatternCount === 'function'
                ? this.lavaMapManager.getPatternCount()
                : 0;
            for (var i = 0; i < count; i++) {
                this.testingSequence.push({ kind: 'static', index: i });
            }
            if (this.phaseDefs && this.phaseDefs.length) {
                for (var j = 0; j < this.phaseDefs.length; j++) {
                    var ph = this.phaseDefs[j];
                    if (ph && ph.applyMethod) {
                        this.testingSequence.push({
                            kind: 'special',
                            methodName: ph.applyMethod,
                        });
                    }
                }
            }
            this.testingIndex = 0;
        }
        catch (e) {
            console.log('[GM] WARN buildTestingSequence error', e);
        }
    }
    // Apply one testing item for this wave; returns true if it handled spawning
    applyTestingPatternForCurrentIndex() {
        if (!playerManager.isHost)
            return false;
        if (!this.lavaMapManager)
            return false;
        var list = (this.testingSequence && this.testingSequence) || [];
        if (!list.length)
            return false;
        var idx = this.testingIndex % list.length;
        var item = list[idx];
        this.testingIndex = (this.testingIndex + 1) % list.length;
        // Keep bonus behavior consistent with normal waves
        if (this.bonusZoneManager &&
            typeof this.bonusZoneManager.resetAndStartNewZone === 'function') {
            this.bonusZoneManager.resetAndStartNewZone();
        }
        if (item && item.kind === 'static' && typeof item.index === 'number') {
            // Force a specific static pattern index
            if (typeof this.lavaMapManager.setNextPatternIndex === 'function') {
                this.lavaMapManager.setNextPatternIndex(item.index);
            }
            if (typeof this.lavaMapManager.prepareNextWave === 'function') {
                this.lavaMapManager.prepareNextWave();
                return true;
            }
            return false;
        }
        if (item &&
            item.kind === 'special' &&
            item.methodName &&
            typeof this.lavaMapManager[item.methodName] === 'function') {
            // Directly spawn the moving/special pattern for this wave
            try {
                this.lavaMapManager[item.methodName]();
                return true;
            }
            catch (e) {
                console.log('[GM] WARN apply special failed', e);
                return false;
            }
        }
        return false;
    }
    /**
     * Called when LavaMapManager signals the active, dangerous lava is live.
     * Starts the per-wave survival timer.
     */
    onEvent_lavaWaveActive() {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState !== 'ACTIVE')
            return;
        this.timerManager.setTimer('endCurrentLavaWave', this.lavaActiveDurationPerWave);
    }
    /**
     * Ends current wave: cleans lava, updates score UI, schedules next wave or starts immediately.
     */
    onEvent_endCurrentLavaWaveNow() {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState !== 'ACTIVE')
            return;
        if (this.lavaMapManager &&
            typeof this.lavaMapManager.cleanupCurrentWaveLava === 'function') {
            this.lavaMapManager.cleanupCurrentWaveLava();
        }
        this.scoreManager.updateLiveScore(this.cyclesSurvived, this.numberOfPlayersInGame);
        // Show the name of what just ran
        let pname = '';
        if (this.lavaMapManager &&
            typeof this.lavaMapManager.getLastPatternName === 'function') {
            pname = this.lavaMapManager.getLastPatternName();
        }
        if (pname && pname !== '') {
            this.scoreManager.displayMessage(pname);
        }
        // Level completion pause and banner (every levelInterval waves)
        if (this.levelInterval > 0) {
            var completedLevels = Math.floor(this.cyclesSurvived / this.levelInterval);
            if (completedLevels > this.lastAnnouncedLevelCompleted) {
                this.lastAnnouncedLevelCompleted = completedLevels;
                // Congratulatory message e.g., "Level 1 Completed. Entering Level 2."
                var nextLevel = completedLevels + 1;
                var congrats = 'Level ' +
                    completedLevels +
                    ' Completed. Entering Level ' +
                    nextLevel +
                    '.';
                try {
                    this.scoreManager.displayMessage(congrats);
                    // Soft visual emphasis
                    this.setOverlayEnabled(true, { opacity: 0.16 });
                    this.timerManager.setTimer('overlayFlashOff', Math.min(0.75, this.levelPauseSeconds));
                }
                catch (e) {
                    console.log('[GM] WARN levelComplete UI failed', e);
                }
                var baseDelay = this.pauseBetweenWaves > 0 ? this.pauseBetweenWaves : 0;
                var totalDelay = baseDelay + (this.levelPauseSeconds || 0);
                if (totalDelay > 0) {
                    this.timerManager.setTimer('initiateNextWaveCycle', totalDelay);
                }
                else {
                    this.startNextWave();
                }
                return; // avoid double scheduling
            }
        }
        // Normal pacing between waves
        if (this.pauseBetweenWaves > 0) {
            this.timerManager.setTimer('initiateNextWaveCycle', this.pauseBetweenWaves);
        }
        else {
            this.startNextWave();
        }
    }
    onEvent_initiateNextWaveCycleNow() {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState !== 'ACTIVE')
            return;
        this.startNextWave();
    }
    /**
     * Any player touching lava ends the run: finalize score, submit high score, show restart.
     */
    /* eslint-disable-next-line sonarjs/cognitive-complexity */
    onEvent_playerHitLava(eventData) {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState === 'GAME_OVER')
            return;
        if (this.currentGameState !== 'ACTIVE') {
            console.log(`[GM] WARN playerHitLava in state=${this.currentGameState}`);
            return;
        }
        console.log(`[GM] INFO gameOver: player ${eventData.playerId} hit lava`);
        // Particle effect: smoke at player position
        if (this.particleManager &&
            typeof this.particleManager.displayParticles === 'function') {
            // Try to get player position from playerManager
            let pos = { x: this.centerSpawnX, y: this.centerSpawnY };
            // Try to get player position from spriteManager
            const playerSprite = spriteManager.getSprite?.('player_' + eventData.playerId);
            if (playerSprite &&
                playerSprite.position &&
                typeof playerSprite.position.x === 'number' &&
                typeof playerSprite.position.y === 'number') {
                pos = { x: playerSprite.position.x, y: playerSprite.position.y };
            }
            // ParticleType 1 = blackSmoke_puff
            this.particleManager.displayParticles(pos, 1, 2, eventData.playerId);
        }
        this.currentGameState = 'GAME_OVER';
        this.timerManager.clearTimer('endCurrentLavaWave');
        this.timerManager.clearTimer('initiateNextWaveCycle');
        if (this.lavaMapManager &&
            typeof this.lavaMapManager.stopAllLavaActivity === 'function') {
            this.lavaMapManager.stopAllLavaActivity();
        }
        this.bonusZoneManager.stopBonusZoneActivity();
        const survivedCycles = this.cyclesSurvived > 0 ? this.cyclesSurvived - 1 : 0;
        this.scoreManager.updateLiveScore(this.cyclesSurvived, this.numberOfPlayersInGame);
        this.scoreManager.displayMessage(`🔥 GAME OVER! 🔥\nSurvived ${survivedCycles} waves.\nFinal Score: ${this.totalScore}`);
        this.scoreManager.showScoreSprite(false);
        const playersToSubmit = this.activePlayerIds;
        console.log('[GM] DEBUG: About to submit score. Player ID list type: ' +
            typeof this.activePlayerIds);
        console.log('[GM] DEBUG: Player IDs to submit: ' + JSON.stringify(playersToSubmit));
        console.log('[GM] DEBUG: Number of players found: ' + playersToSubmit.length);
        this.highScoreManager.submitScore(this.activePlayerIds, survivedCycles, this.totalScore);
        this.highScoreManager.toggleHighScoreDisplay(true);
        this.timerManager.setTimer('offerRestart', 4);
        // Analytics: game completion & player completions
        if (this.analyticsPublicKey) {
            try {
                const participants = this.activePlayerIds &&
                    (this.activePlayerIds.toArray
                        ? this.activePlayerIds.toArray()
                        : this.activePlayerIds);
                const analytics = [{ analyticName: 'lavaGameCompletions' }];
                if (participants?.length) {
                    // eslint-disable-next-line prefer-for-of
                    for (let i = 0; i < participants.length; i++) {
                        const pid = participants[i];
                        const prof = playerManager.getPlayerDetails(pid)?.profileId;
                        if (prof) {
                            analytics.push({
                                analyticName: 'lavaPlayerCompletions',
                                profileId: prof,
                                uniqueKey: prof,
                            });
                        }
                    }
                    analytics.push({
                        analyticName: 'lavaNumPlayersAtCompletion-' + participants.length,
                    });
                }
                if (this.lastGameInitiatorProfileId) {
                    analytics.push({
                        analyticName: 'lavaLastInitiator-' + this.lastGameInitiatorProfileId,
                    });
                }
                integrationsManager.putPublicKeyAnalytics({
                    interactivePublicKey: this.analyticsPublicKey,
                    analytics,
                });
            }
            catch (e) {
                console.log('[GM] WARN analytics gameCompletion failed', e);
            }
        }
    }
    /**
     * After game over or if lobby is idle, offer immediate reset to lobby state.
     */
    onEvent_offerRestartNow() {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState === 'GAME_OVER' ||
            this.currentGameState === 'WAITING_FOR_PLAYERS') {
            this.resetGameToWaitingState();
        }
    }
    /**
     * Bonus award hook (from BonusZoneManager): add points and refresh UI during ACTIVE.
     */
    onEvent_playersAwardedBonus(eventData) {
        if (!playerManager.isHost)
            return;
        if (this.currentGameState !== 'ACTIVE')
            return;
        const count = eventData.playerIds?.length ? eventData.playerIds.length : 1;
        this.totalScore += eventData.points * count;
        this.scoreManager.updateLiveScore(this.cyclesSurvived, this.numberOfPlayersInGame);
    }
    // -----------------------
    // Phase System (helpers)
    // -----------------------
    initPhaseSystem() {
        this.scheduleNextPhase();
        // FIX: Disabled call to prevent crash.
        // this.applyHueToWorld(this.currentHue);
    }
    scheduleNextPhase() {
        // next special exactly N waves from *now*
        this.nextPhaseWave = this.cyclesSurvived + this.specialInterval;
    }
    /**
     * Called at the start of each wave from startNextWave().
     * Returns true if a phase handled the lava pattern this wave (so caller should not prepare normal wave).
     */
    checkPhaseLifecycleAndApply() {
        if (!playerManager.isHost)
            return false;
        if (!this.phaseEnabled)
            return false;
        // If already in a phase, it lasts exactly 'duration' waves (usually 1)
        if (this.currentPhaseId !== '') {
            if (this.cyclesSurvived > this.phaseEndWave) {
                this.currentPhaseId = '';
                this.phaseEndWave = 0;
                return false;
            }
            return this.applyCurrentPhasePattern();
        }
        // Trigger a special every 3rd wave: 3, 6, 9, ..
        if (this.cyclesSurvived > 0 && this.cyclesSurvived % 3 === 0) {
            const phase = this.getRandomPhaseDef();
            if (!phase)
                return false;
            this.currentPhaseId = phase.id;
            this.phaseEndWave =
                this.cyclesSurvived + (phase.duration > 0 ? phase.duration - 1 : 0);
            this.scoreManager.displayMessage(phase.name);
            this.bumpHue(phase.colorShift);
            return this.applyCurrentPhasePattern();
        }
        return false;
    }
    /**
     * Apply current phase’s special lava pattern via LavaMapManager, if available.
     * Falls back to normal wave if method not found.
     */
    applyCurrentPhasePattern() {
        if (!playerManager.isHost)
            return false;
        if (!this.lavaMapManager)
            return false;
        const phase = this.getPhaseDefById(this.currentPhaseId);
        if (!phase)
            return false;
        const methodName = phase.applyMethod;
        if (methodName && typeof this.lavaMapManager[methodName] === 'function') {
            // Keep bonus behavior consistent with normal waves
            if (this.bonusZoneManager) {
                this.bonusZoneManager.resetAndStartNewZone();
            }
            // Drive the special lava for this wave
            this.lavaMapManager[methodName]();
            return true;
        }
        // Fallback: no special method, use normal selection
        if (this.bonusZoneManager) {
            this.bonusZoneManager.resetAndStartNewZone();
        }
        if (typeof this.lavaMapManager.prepareNextWave === 'function') {
            this.lavaMapManager.prepareNextWave();
            return true;
        }
        return false;
    }
    /**
     * Subtle visual drift per wave. Right now we only shift hue; you can add glow/intensity later.
     */
    applyPerWaveVisuals() {
        // Drift hue by ~3 deg per wave from base
        const drift = (this.cyclesSurvived * 3) % 360;
        this.currentHue = (this.baseHue + drift) % 360;
        // FIX: Disabled call to prevent crash.
        // this.applyHueToWorld(this.currentHue);
    }
    bumpHue(delta) {
        this.currentHue = (this.currentHue + (delta || 0)) % 360;
        // FIX: Disabled call to prevent crash.
        // this.applyHueToWorld(this.currentHue);
    }
    /**
     * Safely apply a hue/tint to the arena or lava groups if supported by your platform.
     * No-ops if tint APIs aren’t present (prevents errors).
     */
    applyHueToWorld(hueValue) {
        // No-op on this platform. Use setOverlayEnabled(...) helpers instead to simulate tint.
    }
    /**
     * Creates or updates a non-interactive, non-colliding full-stage overlay sprite.
     * Provide a prebuilt rectangular asset id via state variable 'OverlayAssetId' (e.g., a white/black panel),
     * then control its opacity here. Optional color fields are passed through if supported by the platform.
     */
    setOverlayEnabled(enabled, opts) {
        if (!playerManager.isHost)
            return;
        const id = this.overlaySpriteId;
        const asset = (opts && opts.assetId) || this.overlayAssetId || 'overlay_rect';
        const opacity = opts && typeof opts.opacity === 'number' ? opts.opacity : 0.12;
        // Note: color properties are not supported by SpriteOptions in this platform.
        if (enabled) {
            let spr = spriteManager.getSprite && spriteManager.getSprite(id);
            if (!spr) {
                try {
                    spriteManager.addSprite(asset, {
                        uniqueId: id,
                        positionX: 0,
                        positionY: 0,
                        width: this.worldWidth,
                        height: this.worldHeight,
                        isInteractive: false,
                        checkCollisions: false,
                        opacity: opacity,
                    });
                }
                catch (e) {
                    console.log('[GM] WARN setOverlayEnabled add failed', e);
                }
            }
            else {
                try {
                    spriteManager.updateSprite(id, { opacity: opacity });
                }
                catch (e) {
                    console.log('[GM] WARN setOverlayEnabled update failed', e);
                }
            }
        }
        else {
            try {
                if (spriteManager.getSprite && spriteManager.getSprite(id)) {
                    spriteManager.removeSprite(id);
                }
            }
            catch (e) {
                console.log('[GM] WARN setOverlayEnabled remove failed', e);
            }
        }
    }
    // Timer callback to end level-up overlay flash
    onEvent_overlayFlashOffNow() {
        if (!playerManager.isHost)
            return;
        this.setOverlayEnabled(false);
    }
    /**
     * Relay clicks on the Start button to the host via an event (runs on clients too).
     */
    onSpriteClicked({ sprite }) {
        if (!sprite)
            return;
        const id = '' + (sprite.uniqueId || '');
        if (id === 'lava_start_btn') {
            const pid = playerManager.getMyPlayerId();
            eventManager.emit('startGame', { fromPlayerId: pid, playerId: pid });
            return;
        }
        if (id === 'lava_test_btn') {
            const pid = playerManager.getMyPlayerId();
            eventManager.emit('toggleTestingMode', {
                fromPlayerId: pid,
                playerId: pid,
            });
            return;
        }
    }
    /**
     * Host-only handler to toggle testing mode in the lobby. It updates the state,
     * rebuilds the testing sequence when enabling, and redraws the buttons to refresh the label.
     */
    onEvent_toggleTestingMode(eventData) {
        if (!playerManager.isHost)
            return;
        // Only allow toggling while in the lobby
        if (this.currentGameState !== 'WAITING_FOR_PLAYERS')
            return;
        this.testingMode = !this.testingMode;
        try {
            if (this.testingMode) {
                this.buildTestingSequence();
            }
            // Also stash in a variable so it persists across hot reloads (best-effort)
            if (stateManager && stateManager.setVariable) {
                stateManager.setVariable('TestingMode', this.testingMode ? 1 : 0);
            }
        }
        catch (e) {
            console.log('[GM] WARN toggleTestingMode sequence build failed', e);
        }
        // Refresh the UI to update the button label
        this.drawOrUpdateStartButton();
        this.scoreManager.displayMessage('Glitch Lava\n' +
            (this.testingMode ? 'Testing Mode ENABLED' : 'Testing Mode DISABLED') +
            '\nPress Start to begin.');
    }
    getRandomPhaseDef() {
        if (!this.phaseDefs || this.phaseDefs.length === 0)
            return null;
        const idx = Math.floor(Math.random() * this.phaseDefs.length);
        return this.phaseDefs[idx];
    }
    getPhaseDefById(id) {
        if (!this.phaseDefs || this.phaseDefs.length === 0)
            return null;
        // FIX: Removed .toArray() call on a standard array.
        const list = this.phaseDefs;
        // eslint-disable-next-line prefer-for-of
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            if (p && p.id === id)
                return p;
        }
        return null;
    }
    setWorldActivity(type) {
        try {
            if (!playerManager.isHost)
                return;
            if (!this.analyticsPublicKey)
                return;
            integrationsManager.setWorldActivity({
                type: type,
                interactivePublicKey: this.analyticsPublicKey,
            });
        }
        catch (e) { }
    }
}
