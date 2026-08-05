"use strict";
class BonusZoneManager_Lava extends SystemScript {
    // --- External systems ---
    gameManager;
    lavaMapManager;
    scoreManager;
    timerManager;
    countdownManager;
    highScoreManager;
    // --- Zone state ---
    zoneSprite;
    zoneAssetKey;
    currentZoneId;
    // --- Patterns / motion ---
    movementPatterns; // pseudo list style container (kept dynamic for platform leniency)
    currentPattern;
    direction; // simple {dx, dy} vector (randomized per spawn)
    pulseState;
    movementTiming;
    timingTracker;
    animation;
    // --- Timers ---
    pointInterval;
    moveInterval;
    /**
     * Attach system references and build movement patterns.
     */
    onInit() {
        console.log('[Bonus] INFO onInit:attach systems');
        // One-time primitive / collection setup (class has no constructor by design to avoid super())
        if (!this.zoneAssetKey) {
            this.zoneSprite = null;
            this.zoneAssetKey = 'bonus';
            this.currentZoneId = '';
            this.movementPatterns = [];
            this.currentPattern = null;
            this.direction = {};
            this.pulseState = 'growing';
            this.movementTiming = 20;
            this.timingTracker = 0;
            this.pointInterval = 1.0;
            this.moveInterval = 0.05;
        }
        this.timerManager = scriptManager.getSystem({ systemName: 'TimerManager' });
        this.lavaMapManager = scriptManager.getSystem({
            systemName: 'LavaMapManager',
        });
        this.scoreManager = scriptManager.getSystem({
            systemName: 'ScoreManager_Lava',
        });
        this.countdownManager = scriptManager.getSystem({
            systemName: 'CountdownManager_Lava',
        });
        this.highScoreManager = scriptManager.getSystem({
            systemName: 'HighScoreManager_Lava',
        });
        this.gameManager = scriptManager.getSystem({
            systemName: 'GameManager_Lava',
        });
        if (!this.timerManager ||
            !this.lavaMapManager ||
            !this.scoreManager ||
            !this.countdownManager ||
            !this.highScoreManager) {
            console.error('[Bonus] ERROR onInit: missing one or more subsystems');
            return;
        }
        this.direction = { dx: 1, dy: 1 };
        this.defineMovementPatterns();
    }
    /**
     * Pattern catalog for the zone's motion / shape. Tunable per title.
     */
    defineMovementPatterns() {
        this.movementPatterns.push({
            name: 'The Sweeper',
            initialX: 0,
            initialY: 0,
            initialSize: 350,
            speed: 30,
            keyframes: {
                0: {
                    positionY: '+=0',
                    positionX: '+=0',
                    opacity: 0.1,
                    width: 350,
                    height: 350,
                },
                100: {
                    positionY: '+=650',
                    positionX: '+=250',
                    opacity: 1,
                    width: 500,
                    height: 100,
                },
            },
            duration: 5000,
            loop: true,
            alternate: true,
            playbackEase: 'inOut(3)',
        });
        this.movementPatterns.push({
            name: 'The Bouncer',
            initialX: 800,
            initialY: 0,
            initialSize: 200,
            speed: 50,
            keyframes: {
                0: { positionY: '+=0', opacity: 0.1 },
                50: { positionY: '+=800', opacity: 1 },
            },
            duration: 3000,
            loop: true,
            alternate: true,
            playbackEase: 'inOut(3)',
        });
        this.movementPatterns.push({
            name: 'The Pulsar',
            initialX: 0,
            initialY: 825,
            initialSize: 175,
            speed: 90,
            keyframes: {
                0: { positionY: '-=0', opacity: 0.1 },
                35: { positionY: '-=825', opacity: 1 },
            },
            duration: 3000,
            loop: true,
            alternate: true,
            playbackEase: 'inOut(3)',
        });
        this.movementPatterns.push({
            name: 'The Jumper',
            initialX: 0,
            initialY: 0,
            initialSize: 120,
            speed: 20,
            keyframes: {
                0: { positionX: '+=0', opacity: 0.1 },
                50: { positionX: '+=880', opacity: 1 },
            },
            duration: 3000,
            loop: true,
            alternate: true,
            playbackEase: 'inOut(3)',
        });
    }
    /**
     * Randomly pick one of the patterns (returns null if none defined).
     */
    selectRandomPattern() {
        if (!playerManager.isHost)
            return;
        if (this.movementPatterns.length === 0)
            return null;
        const idx = Math.floor(Math.random() * this.movementPatterns.length);
        return this.movementPatterns[idx];
    }
    /**
     * Spawn the zone for the current wave and kick off animation + periodic scoring.
     */
    startBonusZoneActivity() {
        if (!playerManager.isHost)
            return;
        console.log('[Bonus] INFO start');
        // Safety net: clear any lingering collision state from prior pattern before selecting a new one.
        this.currentPattern = this.selectRandomPattern();
        if (!this.currentPattern) {
            console.log('[Bonus] WARN start: no pattern available');
            return;
        }
        console.log('[Bonus] INFO pattern=' + this.currentPattern.name);
        this.currentZoneId = 'bonus_zone_' + this.gameManager.cyclesSurvived;
        // New random direction per zone instance (not currently used by keyframe path)
        this.direction = { dx: Math.random() * 2 - 1, dy: Math.random() * 2 - 1 };
        // Random start position reserved; pattern currently uses initialX/Y instead
        var posX = Math.random() * (this.gameManager.worldWidth - 200) + 100;
        var posY = Math.random() * (this.gameManager.worldHeight - 200) + 100;
        this.zoneSprite = spriteManager.addSprite(this.zoneAssetKey, {
            uniqueId: this.currentZoneId,
            positionX: this.currentPattern.initialX,
            positionY: this.currentPattern.initialY,
            collisionGroup: 'lava',
            width: this.currentPattern.initialSize,
            height: this.currentPattern.initialSize,
            checkCollisions: true,
            opacity: 0.3,
        });
        // Centralized time scaling: later levels move faster (shorter duration)
        const duration = this.currentPattern.duration;
        let scale = (this.gameManager && typeof this.gameManager.getTimeScale === 'function')
            ? this.gameManager.getTimeScale()
            : 1.0;
        // For bonus zone, allow it to go a bit faster than lava (down to 0.4x)
        if (scale < 0.4)
            scale = 0.4;
        const adjustedDuration = Math.floor(duration * scale);
        this.timerManager.setTimer('awardBonusPoints', this.pointInterval);
        this.moveBonusZoneNowWithDuration(adjustedDuration);
    }
    /**
     * Remove the zone and clear timers. Safe to call repeatedly.
     */
    stopBonusZoneActivity() {
        if (!playerManager.isHost)
            return;
        console.log('[Bonus] INFO stop');
        if (this.currentZoneId != '') {
            spriteManager.removeSprite(this.currentZoneId);
        }
        this.currentZoneId = '';
        this.timerManager.clearTimer('awardBonusPoints');
        // Clear tracked players (treat as all collision stops)
    }
    /**
     * Start GSAP-like keyframe animation on the existing zone sprite.
     */
    moveBonusZoneNow() {
        if (!playerManager.isHost)
            return;
        this.animation = timerManager.animate({
            targets: [this.zoneSprite],
            keyframes: this.currentPattern.keyframes,
            duration: this.currentPattern.duration,
            loop: this.currentPattern.loop,
            alternate: this.currentPattern.alternate,
            playbackEase: this.currentPattern.playbackEase,
            onBegin: () => {
                console.log('[Bonus] INFO anim: begin ' + this.currentPattern.name);
            },
            onLoop: () => { },
        });
    }
    moveBonusZoneNowWithDuration(customDuration) {
        if (!playerManager.isHost)
            return;
        this.animation = timerManager.animate({
            targets: [this.zoneSprite],
            keyframes: this.currentPattern.keyframes,
            duration: customDuration,
            loop: this.currentPattern.loop,
            alternate: this.currentPattern.alternate,
            playbackEase: this.currentPattern.playbackEase,
            onBegin: () => {
                console.log('[Bonus] INFO anim: begin ' + this.currentPattern.name + ' (' + customDuration + 'ms)');
            },
            onLoop: () => { },
        });
    }
    /**
     * Hard reset between waves: despawn then respawn with a fresh pattern.
     */
    resetAndStartNewZone() {
        if (!playerManager.isHost)
            return;
        console.log('[Bonus] INFO reset→start');
        this.stopBonusZoneActivity();
        this.startBonusZoneActivity();
    }
    /**
     * Optional per-physics tick cadence. Currently only keeps a simple counter.
     */
    onPhysicsStep(deltaTime) {
        if (!playerManager.isHost)
            return;
        if (this.gameManager.currentGameState !== 'ACTIVE' ||
            this.currentZoneId == '')
            return;
        this.timingTracker++;
        if (this.timingTracker >= this.movementTiming) {
            // Future: trigger additional moves/adjustments.
            this.timingTracker = 0;
        }
    }
    /**
     * Quick check by naming convention.
     */
    isBonusZoneSprite(spriteId) {
        if (!playerManager.isHost)
            return;
        if (this.currentZoneId == '')
            return false;
        return spriteId.indexOf('bonus') != -1;
    }
}
