"use strict";
class LavaMapManager extends SystemScript {
    // --- Pattern / State ---
    wavePatterns;
    currentWavePattern;
    _isCleaningUp;
    flashingSprites; // pre-lava warning visuals
    activeLavaSprites; // dangerous, collidable lava
    flashComplete;
    // --- World ---
    stageWidth;
    stageHeight;
    // --- External systems ---
    gameManager;
    timerManager;
    // --- Flashing config (mirrors GameManager) ---
    flashDurationPerWarning;
    numberOfFlashes;
    //Lava waves
    _ripple_s2;
    _ripple_s3;
    lastPatternName;
    patternBag; // array of indices into wavePatterns
    patternBagIndex;
    // --- Internal counters ---
    currentFlashCount;
    // --- Phase pending state (used instead of closure callbacks) ---
    pendingPhaseType; // '', 'creep', 'sweep', 'ripple1'|'ripple2'|'ripple3'
    pendingWaveKey; // wave index captured when scheduling
    constructor() {
        this.wavePatterns = [];
        this._isCleaningUp = false;
        this.currentWavePattern = null;
        this.flashingSprites = [];
        this.activeLavaSprites = [];
        this.currentFlashCount = 0;
        this.flashDurationPerWarning = 0.1;
        this.numberOfFlashes = 3;
        this.stageWidth = 1000;
        this.stageHeight = 1000;
        this.flashComplete = false;
        this.pendingPhaseType = '';
        this.pendingWaveKey = 0;
        this._ripple_s2 = 0;
        this._ripple_s3 = 0;
        this.patternBag = [];
        this.patternBagIndex = 0;
        this.lastPatternName = '';
    }
    onInit() {
        // Attach dependencies
        this.gameManager = scriptManager.getSystem({
            systemName: 'GameManager_Lava',
        });
        if (!this.gameManager) {
            console.log('[LavaMap] ERROR onInit: missing GameManager_Lava');
            return;
        }
        this.timerManager = scriptManager.getSystem({ systemName: 'TimerManager' });
        if (!this.timerManager) {
            console.log('[LavaMap] ERROR onInit: missing TimerManager');
            return;
        }
        // Mirror config
        this.flashDurationPerWarning = this.gameManager.flashDurationPerWarning;
        this.numberOfFlashes = this.gameManager.numberOfFlashes;
        this.defineWavePatterns();
    }
    defineWavePatterns() {
        this.wavePatterns = [];
        var asset = 'lava_tile_asset';
        // 🔳 Lava Box
        this.wavePatterns.push({
            name: '🔳 Lava Box',
            startingLevel: 1,
            endingLevel: 3,
            zones: [
                { id: 'sb1', x: 100, y: 100, width: 800, height: 100, assetKey: asset },
                { id: 'sb2', x: 100, y: 800, width: 800, height: 100, assetKey: asset },
                { id: 'sb3', x: 100, y: 200, width: 100, height: 600, assetKey: asset },
                { id: 'sb4', x: 800, y: 200, width: 100, height: 600, assetKey: asset },
            ],
        });
        // 🗼 Twin Pillars
        this.wavePatterns.push({
            name: '🗼 Twin Pillars',
            startingLevel: 1,
            endingLevel: 3,
            zones: [
                { id: 'dp1', x: 200, y: 0, width: 200, height: 1000, assetKey: asset },
                { id: 'zq1', x: 600, y: 0, width: 200, height: 1000, assetKey: asset },
            ],
        });
        // 🥪 Squeeze 1: Open Field
        this.wavePatterns.push({
            name: '🥪 Open Field',
            startingLevel: 1,
            endingLevel: 2,
            zones: [
                { id: 'sq1-1', x: 0, y: 0, width: 1000, height: 150, assetKey: asset },
                {
                    id: 'sq1-2',
                    x: 0,
                    y: 850,
                    width: 1000,
                    height: 150,
                    assetKey: asset,
                },
            ],
        });
        // 🥪 Squeeze 2: Walls In
        this.wavePatterns.push({
            name: '🥪 Walls In',
            startingLevel: 1,
            endingLevel: 2,
            zones: [
                { id: 'sq2-1', x: 0, y: 0, width: 1000, height: 150, assetKey: asset },
                {
                    id: 'sq2-2',
                    x: 0,
                    y: 850,
                    width: 1000,
                    height: 150,
                    assetKey: asset,
                },
                { id: 'sq2-3', x: 0, y: 150, width: 150, height: 700, assetKey: asset },
                {
                    id: 'sq2-4',
                    x: 850,
                    y: 150,
                    width: 150,
                    height: 700,
                    assetKey: asset,
                },
            ],
        });
        // 🥪 Squeeze 3: Racetrack
        this.wavePatterns.push({
            name: '🥪 Racetrack',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'sq3-1', x: 0, y: 0, width: 1000, height: 150, assetKey: asset },
                {
                    id: 'sq3-2',
                    x: 0,
                    y: 850,
                    width: 1000,
                    height: 150,
                    assetKey: asset,
                },
                { id: 'sq3-3', x: 0, y: 150, width: 150, height: 700, assetKey: asset },
                {
                    id: 'sq3-4',
                    x: 850,
                    y: 150,
                    width: 150,
                    height: 700,
                    assetKey: asset,
                },
                {
                    id: 'sq3-5',
                    x: 350,
                    y: 350,
                    width: 300,
                    height: 300,
                    assetKey: asset,
                },
            ],
        });
        // 🪨 Crusher 1: Pillars
        this.wavePatterns.push({
            name: '🪨 Pillars',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'cr1-1', x: 0, y: 0, width: 250, height: 1000, assetKey: asset },
                {
                    id: 'cr1-2',
                    x: 750,
                    y: 0,
                    width: 250,
                    height: 1000,
                    assetKey: asset,
                },
                {
                    id: 'cr1-3',
                    x: 450,
                    y: 0,
                    width: 100,
                    height: 1000,
                    assetKey: asset,
                },
            ],
        });
        // 🪨 Crusher 2: Beams
        this.wavePatterns.push({
            name: '🪨 Beams',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'cr2-1', x: 0, y: 0, width: 1000, height: 250, assetKey: asset },
                {
                    id: 'cr2-2',
                    x: 0,
                    y: 750,
                    width: 1000,
                    height: 250,
                    assetKey: asset,
                },
                {
                    id: 'cr2-3',
                    x: 0,
                    y: 450,
                    width: 1000,
                    height: 100,
                    assetKey: asset,
                },
            ],
        });
        // 🌀 Pinwheel 1: Eye of the Storm
        this.wavePatterns.push({
            name: '🌀 Eye of the Storm',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'pw1-1', x: 0, y: 0, width: 1000, height: 300, assetKey: asset },
                {
                    id: 'pw1-2',
                    x: 0,
                    y: 700,
                    width: 1000,
                    height: 300,
                    assetKey: asset,
                },
                { id: 'pw1-3', x: 0, y: 300, width: 300, height: 400, assetKey: asset },
                {
                    id: 'pw1-4',
                    x: 700,
                    y: 300,
                    width: 300,
                    height: 400,
                    assetKey: asset,
                },
            ],
        });
        // 🌀 Pinwheel 2: Corner Retreat
        this.wavePatterns.push({
            name: '🌀 Corner Retreat',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                {
                    id: 'pw2-1',
                    x: 400,
                    y: 0,
                    width: 200,
                    height: 1000,
                    assetKey: asset,
                },
                {
                    id: 'pw2-2',
                    x: 0,
                    y: 400,
                    width: 1000,
                    height: 200,
                    assetKey: asset,
                },
            ],
        });
        // ♟️ Checkers 1
        this.wavePatterns.push({
            name: '♟️ Checkers 1',
            startingLevel: 1,
            endingLevel: 2,
            zones: [
                { id: 'cb1-1', x: 0, y: 0, width: 500, height: 500, assetKey: asset },
                {
                    id: 'cb1-2',
                    x: 500,
                    y: 500,
                    width: 500,
                    height: 500,
                    assetKey: asset,
                },
            ],
        });
        // ♟️ Checkers 2 (Inverted)
        this.wavePatterns.push({
            name: '♟️ Checkers 2',
            startingLevel: 1,
            endingLevel: 2,
            zones: [
                { id: 'cb2-1', x: 500, y: 0, width: 500, height: 500, assetKey: asset },
                { id: 'cb2-2', x: 0, y: 500, width: 500, height: 500, assetKey: asset },
            ],
        });
        // 🐍 Maze 1: The Snake
        this.wavePatterns.push({
            name: '🐍 The Snake',
            startingLevel: 3,
            endingLevel: 5,
            zones: [
                { id: 'mz1-1', x: 200, y: 0, width: 800, height: 200, assetKey: asset },
                { id: 'mz1-2', x: 0, y: 400, width: 800, height: 200, assetKey: asset },
                {
                    id: 'mz1-3',
                    x: 200,
                    y: 800,
                    width: 800,
                    height: 200,
                    assetKey: asset,
                },
            ],
        });
        // 🍴 Maze 2: The Fork
        this.wavePatterns.push({
            name: '🍴 The Fork',
            startingLevel: 3,
            endingLevel: 5,
            zones: [
                { id: 'mz2-1', x: 0, y: 200, width: 200, height: 600, assetKey: asset },
                { id: 'mz2-2', x: 400, y: 0, width: 200, height: 400, assetKey: asset },
                {
                    id: 'mz2-3',
                    x: 400,
                    y: 600,
                    width: 200,
                    height: 400,
                    assetKey: asset,
                },
                {
                    id: 'mz2-4',
                    x: 800,
                    y: 200,
                    width: 200,
                    height: 600,
                    assetKey: asset,
                },
            ],
        });
        // 🌊 Sweep: North
        this.wavePatterns.push({
            name: '🌊 Sweep North',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'sw1', x: 0, y: 0, width: 1000, height: 400, assetKey: asset },
            ],
        });
        // 🌊 Sweep: South
        this.wavePatterns.push({
            name: '🌊 Sweep South',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'sw2', x: 0, y: 600, width: 1000, height: 400, assetKey: asset },
            ],
        });
        // 🌊 Sweep: West
        this.wavePatterns.push({
            name: '🌊 Sweep West',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'sw3', x: 0, y: 0, width: 400, height: 1000, assetKey: asset },
            ],
        });
        // 🌊 Sweep: East
        this.wavePatterns.push({
            name: '🌊 Sweep East',
            startingLevel: 2,
            endingLevel: 4,
            zones: [
                { id: 'sw4', x: 600, y: 0, width: 400, height: 1000, assetKey: asset },
            ],
        });
        // 🦈 Closing Jaws 1: Open Mouth
        this.wavePatterns.push({
            name: '🦈 Closing Jaws',
            startingLevel: 3,
            endingLevel: 5,
            zones: [
                { id: 'cj1-1', x: 0, y: 0, width: 400, height: 200, assetKey: asset },
                { id: 'cj1-2', x: 600, y: 0, width: 400, height: 200, assetKey: asset },
                { id: 'cj1-3', x: 0, y: 800, width: 400, height: 200, assetKey: asset },
                {
                    id: 'cj1-4',
                    x: 600,
                    y: 800,
                    width: 400,
                    height: 200,
                    assetKey: asset,
                },
            ],
        });
        // 🦈 Closing Jaws 2: The Bite
        this.wavePatterns.push({
            name: '🦈 The Bite',
            startingLevel: 3,
            endingLevel: 5,
            zones: [
                { id: 'cj2-1', x: 0, y: 0, width: 1000, height: 400, assetKey: asset },
                {
                    id: 'cj2-2',
                    x: 0,
                    y: 600,
                    width: 1000,
                    height: 400,
                    assetKey: asset,
                },
            ],
        });
        // 🦈 Closing Jaws 3: The Grind
        this.wavePatterns.push({
            name: '🦈 The Grind',
            startingLevel: 4,
            endingLevel: 6,
            zones: [
                { id: 'cj3-1', x: 0, y: 0, width: 1000, height: 400, assetKey: asset },
                {
                    id: 'cj3-2',
                    x: 0,
                    y: 600,
                    width: 1000,
                    height: 400,
                    assetKey: asset,
                },
                {
                    id: 'cj3-3',
                    x: 200,
                    y: 400,
                    width: 200,
                    height: 200,
                    assetKey: asset,
                },
                {
                    id: 'cj3-4',
                    x: 600,
                    y: 400,
                    width: 200,
                    height: 200,
                    assetKey: asset,
                },
            ],
        });
        // Ensure each pattern has defaults for starting/ending levels
        try {
            var arr = this.wavePatterns &&
                (this.wavePatterns.toArray ? this.wavePatterns.toArray() : this.wavePatterns);
            for (var i = 0; i < arr.length; i++) {
                var pat = arr[i];
                if (pat && typeof pat.startingLevel !== 'number')
                    pat.startingLevel = 1;
                if (pat && typeof pat.endingLevel !== 'number')
                    pat.endingLevel = 9999;
            }
        }
        catch (e) {
            console.log('[LavaMap] WARN normalize startingLevel failed', e);
        }
        this.currentWavePattern = this.selectRandomPattern();
    }
    selectRandomPattern() {
        var total = this.wavePatterns.toArray().length;
        if (total === 0)
            return null;
        if (!this.patternBag ||
            this.patternBag.toArray().length === 0 ||
            this.patternBagIndex >= this.patternBag.toArray().length) {
            this.buildPatternBag();
        }
        var idx = this.patternBag[this.patternBagIndex];
        this.patternBagIndex++;
        var pat = this.wavePatterns[idx];
        if (pat && pat.name)
            this.lastPatternName = pat.name;
        return pat;
    }
    // --- Testing helpers (safe, small surface) ---
    getPatternCount() {
        try {
            return this.wavePatterns && this.wavePatterns.toArray
                ? this.wavePatterns.toArray().length
                : this.wavePatterns.length || 0;
        }
        catch (e) {
            return 0;
        }
    }
    setNextPatternIndex(idx) {
        // Force the next static pattern by resetting the pattern bag to start with idx
        try {
            if (typeof idx !== 'number' || idx < 0)
                return;
            var total = this.wavePatterns && this.wavePatterns.toArray
                ? this.wavePatterns.toArray().length
                : this.wavePatterns.length || 0;
            if (idx >= total)
                return;
            this.patternBag = [idx];
            this.patternBagIndex = 0;
        }
        catch (e) {
            // no-op
        }
    }
    prepareNextWave() {
        this._isCleaningUp = false;
        this.cleanupCurrentWaveLava();
        this.currentWavePattern = this.selectRandomPattern();
        this.lastPatternName = this.currentWavePattern
            ? this.currentWavePattern.name
            : '';
        if (!this.currentWavePattern)
            return;
        // Spawn flashing warning sprites
        for (var i = 0; i < this.currentWavePattern.zones.length; i++) {
            var zone = this.currentWavePattern.zones[i];
            var flashSprite = spriteManager.addSprite(zone.assetKey, {
                uniqueId: 'flash_' + zone.id + '_' + this.gameManager.cyclesSurvived,
                positionX: zone.x,
                positionY: zone.y,
                collisionGroup: 'lava',
                width: zone.width,
                height: zone.height,
                opacity: 0.15,
            });
            if (flashSprite)
                this.flashingSprites.push(flashSprite);
        }
        this.currentFlashCount = 0;
        this.startFlashingSequence();
    }
    startFlashingSequence() {
        var self = this;
        // schedule the activation tick to fire when the flash ends
        // (3s = animation duration)
        if (self.timerManager) {
            self.timerManager.setTimer('lavaFlashTick', self.getWarningSeconds());
        }
        for (var i = 0; i < self.flashingSprites.toArray().length; i++) {
            var flashSprite = self.flashingSprites[i];
            if (flashSprite && flashSprite.uniqueId) {
                var animDur = Math.floor(((self.gameManager && typeof self.gameManager.getWarningSeconds === 'function')
                    ? self.gameManager.getWarningSeconds()
                    : 3.0) * 1000);
                timerManager.animate({
                    targets: [flashSprite],
                    keyframes: {
                        0: { opacity: 0.1 },
                        10: { opacity: 1 },
                        20: { opacity: 0.1 },
                        30: { opacity: 1 },
                        40: { opacity: 0.1 },
                        50: { opacity: 1 },
                        60: { opacity: 0.1 },
                        70: { opacity: 1 },
                        80: { opacity: 0.1 },
                        90: { opacity: 1 },
                        100: { opacity: 0.1 },
                    },
                    duration: animDur,
                    loop: false,
                    alternate: true,
                    playbackEase: 'linear',
                    onBegin: function () {
                        self.flashComplete = false;
                    },
                    // DO NOT call methods here; sandboxed callbacks can’t reference them safely.
                    onComplete: function () {
                        self.flashComplete = true;
                    },
                });
            }
        }
    }
    // Legacy flashing path (unused by phases but kept for compatibility)
    startFlashingSequence_OLD() {
        if (this.currentFlashCount >= this.numberOfFlashes * 2) {
            this.activateLavaAfterFlashing();
            return;
        }
        var isOn = this.currentFlashCount % 2 === 0;
        var alphaValue = isOn ? 0.4 : 0.05;
        for (var i = 0; i < this.flashingSprites.toArray().length; i++) {
            var s = this.flashingSprites[i];
            if (s && s.uniqueId) {
                spriteManager.updateSprite(s.uniqueId, { opacity: alphaValue });
            }
        }
        this.currentFlashCount++;
        this.timerManager.setTimer('lavaFlashTick', this.flashDurationPerWarning);
    }
    // Phase activation / scheduled work (no closures)
    onEvent_lavaFlashTickNow() {
        if (this.pendingPhaseType && this.pendingPhaseType !== '') {
            var wk = this.pendingWaveKey;
            var asset = 'lava_tile_asset';
            var W = this.stageWidth;
            var H = this.stageHeight;
            var dur = this.getActiveDurationMs();
            // --- Creeping Doom ---
            if (this.pendingPhaseType === 'creep') {
                spriteManager.removeSprite('warn_top_' + wk);
                spriteManager.removeSprite('warn_bottom_' + wk);
                spriteManager.removeSprite('warn_left_' + wk);
                spriteManager.removeSprite('warn_right_' + wk);
                var thickness = 140;
                var top = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_phase_top_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: W,
                    height: thickness,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var bottom = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_phase_bottom_' + wk,
                    positionX: 0,
                    positionY: H - thickness,
                    width: W,
                    height: thickness,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var left = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_phase_left_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: thickness,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var right = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_phase_right_' + wk,
                    positionX: W - thickness,
                    positionY: 0,
                    width: thickness,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (top)
                    this.activeLavaSprites.push(top);
                if (bottom)
                    this.activeLavaSprites.push(bottom);
                if (left)
                    this.activeLavaSprites.push(left);
                if (right)
                    this.activeLavaSprites.push(right);
                if (top)
                    timerManager.animate({
                        targets: [top],
                        keyframes: { 100: { positionY: '+=260' } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (bottom)
                    timerManager.animate({
                        targets: [bottom],
                        keyframes: { 100: { positionY: '-=260' } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (left)
                    timerManager.animate({
                        targets: [left],
                        keyframes: { 100: { positionX: '+=260' } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (right)
                    timerManager.animate({
                        targets: [right],
                        keyframes: { 100: { positionX: '-=260' } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            else if (this.pendingPhaseType === 'alley') {
                var wk = this.pendingWaveKey;
                var W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                // remove warns
                spriteManager.removeSprite('warn_alley_L_' + wk);
                spriteManager.removeSprite('warn_alley_R_' + wk);
                // two side walls with a corridor in the middle
                var minCorr = 180; // minimum corridor width (always survivable)
                var maxCorr = 360; // starts wider, then narrows
                var left = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_alley_L_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: (W - maxCorr) / 2,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var right = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_alley_R_' + wk,
                    positionX: W - (W - maxCorr) / 2,
                    positionY: 0,
                    width: (W - maxCorr) / 2,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (left)
                    this.activeLavaSprites.push(left);
                if (right)
                    this.activeLavaSprites.push(right);
                // animate corridor sliding L→R once while narrowing a bit
                var targetCorr = minCorr;
                var leftW0 = (W - maxCorr) / 2;
                var rightW0 = leftW0;
                var leftW1 = (W - targetCorr) * 0.15; // bias left small
                var rightW1 = W - targetCorr - leftW1;
                if (left)
                    timerManager.animate({
                        targets: [left],
                        keyframes: { 100: { width: leftW1 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                if (right)
                    timerManager.animate({
                        targets: [right],
                        keyframes: {
                            0: { positionX: W - rightW0 },
                            100: { positionX: W - rightW1, width: rightW1 },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            else if (this.pendingPhaseType === 'meteors') {
                var wk = this.pendingWaveKey;
                var W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                spriteManager.removeSprite('warn_meteors_' + wk);
                // spawn 6 small falling tiles staggered
                var n = 6, tile = 120, gap = W / (n + 1), i = 0;
                while (i < n) {
                    var sx = Math.floor((i + 1) * gap - tile / 2);
                    var sy = -tile - (i % 2) * 80; // slight stagger
                    var dx = sx + (i % 2 === 0 ? 160 : -140); // small diagonal drift
                    var lava = spriteManager.addSprite('lava_tile_asset', {
                        uniqueId: 'lava_meteor_' + wk + '_' + i,
                        positionX: sx,
                        positionY: sy,
                        width: tile,
                        height: tile,
                        collisionGroup: 'lava',
                        opacity: 1,
                        checkCollisions: true,
                    });
                    if (lava) {
                        this.activeLavaSprites.push(lava);
                        timerManager.animate({
                            targets: [lava],
                            keyframes: { 100: { positionX: dx, positionY: H } },
                            duration: dur,
                            loop: false,
                            alternate: false,
                            playbackEase: 'linear',
                        });
                    }
                    i++;
                }
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            else if (this.pendingPhaseType === 'splitshift') {
                var wk = this.pendingWaveKey;
                var W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                spriteManager.removeSprite('warn_split_' + wk);
                // two halves with a center gap that widens, entire band rises
                var bandH = 220, gap0 = 120, gap1 = 300;
                var cy0 = (H - bandH) / 2;
                var left = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_split_L_' + wk,
                    positionX: 0,
                    positionY: cy0,
                    width: (W - gap0) / 2,
                    height: bandH,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var right = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_split_R_' + wk,
                    positionX: (W + gap0) / 2,
                    positionY: cy0,
                    width: (W - gap0) / 2,
                    height: bandH,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (left)
                    this.activeLavaSprites.push(left);
                if (right)
                    this.activeLavaSprites.push(right);
                var cy1 = Math.max(0, cy0 - 140); // rises a bit
                if (left)
                    timerManager.animate({
                        targets: [left],
                        keyframes: { 100: { width: (W - gap1) / 2, positionY: cy1 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                if (right)
                    timerManager.animate({
                        targets: [right],
                        keyframes: {
                            0: { positionX: (W + gap0) / 2 },
                            100: {
                                positionX: (W + gap1) / 2,
                                width: (W - gap1) / 2,
                                positionY: cy1,
                            },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            else if (this.pendingPhaseType === 'windows') {
                var wk = this.pendingWaveKey;
                var W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                // Remove all four warnings (UL, UR, LL, LR)
                spriteManager.removeSprite('warn_win_UL_' + wk);
                spriteManager.removeSprite('warn_win_UR_' + wk);
                spriteManager.removeSprite('warn_win_LL_' + wk);
                spriteManager.removeSprite('warn_win_LR_' + wk);
                // four panels with two moving SAFE windows (implemented by moving the panel seams)
                var pad = 80, wnd = 180; // window size
                var UL = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_win_UL_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: W / 2 - wnd / 2,
                    height: H / 2 - wnd / 2,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var UR = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_win_UR_' + wk,
                    positionX: W / 2 + wnd / 2,
                    positionY: 0,
                    width: W / 2 - wnd / 2,
                    height: H / 2 - wnd / 2,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var LL = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_win_LL_' + wk,
                    positionX: 0,
                    positionY: H / 2 + wnd / 2,
                    width: W / 2 - wnd / 2,
                    height: H / 2 - wnd / 2,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var LR = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_win_LR_' + wk,
                    positionX: W / 2 + wnd / 2,
                    positionY: H / 2 + wnd / 2,
                    width: W / 2 - wnd / 2,
                    height: H / 2 - wnd / 2,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (UL)
                    this.activeLavaSprites.push(UL);
                if (UR)
                    this.activeLavaSprites.push(UR);
                if (LL)
                    this.activeLavaSprites.push(LL);
                if (LR)
                    this.activeLavaSprites.push(LR);
                // move the internal seams so the windows travel UL→LR
                var kx = W / 2 - wnd / 2, kx2 = pad;
                var ky = H / 2 - wnd / 2, ky2 = pad;
                if (UL)
                    timerManager.animate({
                        targets: [UL],
                        keyframes: { 100: { width: kx2, height: ky2 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (UR)
                    timerManager.animate({
                        targets: [UR],
                        keyframes: { 100: { positionX: W - kx2, width: kx2, height: ky2 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (LL)
                    timerManager.animate({
                        targets: [LL],
                        keyframes: { 100: { width: kx2, positionY: H - ky2, height: ky2 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (LR)
                    timerManager.animate({
                        targets: [LR],
                        keyframes: {
                            100: {
                                positionX: W - kx2,
                                positionY: H - ky2,
                                width: kx2,
                                height: ky2,
                            },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            else if (this.pendingPhaseType === 'crosspressure') {
                var wk = this.pendingWaveKey;
                var W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                spriteManager.removeSprite('warn_cross_H_' + wk);
                spriteManager.removeSprite('warn_cross_V_' + wk);
                var bar = 110;
                var Hbar = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_cross_H_' + wk,
                    positionX: 0,
                    positionY: (H - bar) / 2,
                    width: W,
                    height: bar,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var Vbar = spriteManager.addSprite('lava_tile_asset', {
                    uniqueId: 'lava_cross_V_' + wk,
                    positionX: (W - bar) / 2,
                    positionY: 0,
                    width: bar,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (Hbar)
                    this.activeLavaSprites.push(Hbar);
                if (Vbar)
                    this.activeLavaSprites.push(Vbar);
                // grow to ~60% then shrink back (ease)
                var maxBar = Math.floor(Math.min(W, H) * 0.6);
                var half = Math.floor(dur * 0.5);
                if (Hbar)
                    timerManager.animate({
                        targets: [Hbar],
                        keyframes: {
                            50: { height: maxBar, positionY: (H - maxBar) / 2 },
                            100: { height: bar, positionY: (H - bar) / 2 },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                if (Vbar)
                    timerManager.animate({
                        targets: [Vbar],
                        keyframes: {
                            50: { width: maxBar, positionX: (W - maxBar) / 2 },
                            100: { width: bar, positionX: (W - bar) / 2 },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            // --- Orthogonal Sweep (replacement for rotate) ---
            if (this.pendingPhaseType === 'sweep') {
                spriteManager.removeSprite('warn_sweep_h_' + wk);
                spriteManager.removeSprite('warn_sweep_v_' + wk);
                var hBar = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_sweep_h_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: W,
                    height: 120,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var vBar = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_sweep_v_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: 120,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (hBar)
                    this.activeLavaSprites.push(hBar);
                if (vBar)
                    this.activeLavaSprites.push(vBar);
                if (hBar)
                    timerManager.animate({
                        targets: [hBar],
                        keyframes: { 100: { positionY: H - 120 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (vBar)
                    timerManager.animate({
                        targets: [vBar],
                        keyframes: { 100: { positionX: W - 120 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            // --- Ripple stage 1 ---
            if (this.pendingPhaseType === 'ripple1') {
                var wk = this.pendingWaveKey;
                var asset = 'lava_tile_asset';
                var W = this.stageWidth;
                var H = this.stageHeight;
                // remove warn
                spriteManager.removeSprite('warn_ripple_' + wk);
                // Stage sizes
                var minSide = W < H ? W : H;
                var s1 = 140; // small, quick panic in center
                var s2 = Math.floor(minSide * 0.33); // medium
                var s3 = Math.floor(minSide * 0.6); // large: survivable edge ring remains
                // persist these numbers across stages by stashing on the instance
                this._ripple_s2 = s2;
                this._ripple_s3 = s3;
                // stage 1 square (active)
                var x1 = Math.floor((W - s1) / 2);
                var y1 = Math.floor((H - s1) / 2);
                var a1 = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_ripple_' + wk + '_1',
                    positionX: x1,
                    positionY: y1,
                    width: s1,
                    height: s1,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (a1)
                    this.activeLavaSprites.push(a1);
                // Start the wave timer now (so growth fits within one wave window)
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                // schedule stage 2 at ~1/3 of wave
                var t2 = this.getActiveDurationMs() / 3.0 / 1000.0;
                this.pendingPhaseType = 'ripple2';
                this.timerManager.setTimer('lavaFlashTick', t2);
                return;
            }
            // --- Ripple stage 2 ---
            if (this.pendingPhaseType === 'ripple2') {
                var wk = this.pendingWaveKey;
                var asset = 'lava_tile_asset';
                var W = this.stageWidth;
                var H = this.stageHeight;
                // replace stage 1 with medium
                var oldId_1 = 'lava_ripple_' + wk + '_1';
                spriteManager.removeSprite(oldId_1);
                // FIX: Also remove the stale reference from our tracking array
                this.activeLavaSprites = (this.activeLavaSprites && this.activeLavaSprites.toArray
                    ? this.activeLavaSprites.toArray()
                    : this.activeLavaSprites).filter(function (s) {
                    return s && s.uniqueId !== oldId_1;
                });
                var s2 = this._ripple_s2; // set in stage 1
                if (typeof s2 !== 'number' || s2 <= 0) {
                    s2 = Math.floor((W < H ? W : H) * 0.52);
                }
                var x2 = Math.floor((W - s2) / 2);
                var y2 = Math.floor((H - s2) / 2);
                var a2 = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_ripple_' + wk + '_2',
                    positionX: x2,
                    positionY: y2,
                    width: s2,
                    height: s2,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (a2)
                    this.activeLavaSprites.push(a2);
                // schedule stage 3 at ~1/3 of wave
                var t3 = this.getActiveDurationMs() / 3.0 / 1000.0;
                this.pendingPhaseType = 'ripple3';
                this.timerManager.setTimer('lavaFlashTick', t3);
                return;
            }
            // --- Ripple stage 3 (final, capped size) ---
            if (this.pendingPhaseType === 'ripple3') {
                var wk = this.pendingWaveKey;
                var asset = 'lava_tile_asset';
                var W = this.stageWidth;
                var H = this.stageHeight;
                // replace medium with large (but DO NOT fill the arena)
                var oldId_2 = 'lava_ripple_' + wk + '_2';
                spriteManager.removeSprite(oldId_2);
                // FIX: Also remove the stale reference from our tracking array
                this.activeLavaSprites = (this.activeLavaSprites && this.activeLavaSprites.toArray
                    ? this.activeLavaSprites.toArray()
                    : this.activeLavaSprites).filter(function (s) {
                    return s && s.uniqueId !== oldId_2;
                });
                var s3 = this._ripple_s3; // set in stage 1
                if (typeof s3 !== 'number' || s3 <= 0) {
                    s3 = Math.floor((W < H ? W : H) * 0.72);
                }
                var x3 = Math.floor((W - s3) / 2);
                var y3 = Math.floor((H - s3) / 2);
                var a3 = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_ripple_' + wk + '_3',
                    positionX: x3,
                    positionY: y3,
                    width: s3,
                    height: s3,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (a3)
                    this.activeLavaSprites.push(a3);
                // clear pending (no second emit here)
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                return;
            }
            // --- CLAMPING JAWS ---
            if (this.pendingPhaseType === 'clamp') {
                var wk = this.pendingWaveKey, asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                spriteManager.removeSprite('warn_clamp_t_' + wk);
                spriteManager.removeSprite('warn_clamp_b_' + wk);
                spriteManager.removeSprite('warn_clamp_l_' + wk);
                spriteManager.removeSprite('warn_clamp_r_' + wk);
                var t = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_clamp_t_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: W,
                    height: 120,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var b = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_clamp_b_' + wk,
                    positionX: 0,
                    positionY: H - 120,
                    width: W,
                    height: 120,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var l = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_clamp_l_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: 120,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var r = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_clamp_r_' + wk,
                    positionX: W - 120,
                    positionY: 0,
                    width: 120,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (t)
                    this.activeLavaSprites.push(t);
                if (b)
                    this.activeLavaSprites.push(b);
                if (l)
                    this.activeLavaSprites.push(l);
                if (r)
                    this.activeLavaSprites.push(r);
                if (t)
                    timerManager.animate({
                        targets: [t],
                        keyframes: { 100: { positionY: H / 2 - 160 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (b)
                    timerManager.animate({
                        targets: [b],
                        keyframes: { 100: { positionY: H / 2 + 40 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (l)
                    timerManager.animate({
                        targets: [l],
                        keyframes: { 100: { positionX: W / 2 - 160 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (r)
                    timerManager.animate({
                        targets: [r],
                        keyframes: { 100: { positionX: W / 2 + 40 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            // --- CORNER CREEP ---
            if (this.pendingPhaseType === 'corners') {
                var wk = this.pendingWaveKey, asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                spriteManager.removeSprite('warn_cc_tl_' + wk);
                spriteManager.removeSprite('warn_cc_br_' + wk);
                var s = 160;
                var tl = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_cc_tl_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: s,
                    height: s,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var br = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_cc_br_' + wk,
                    positionX: W - s,
                    positionY: H - s,
                    width: s,
                    height: s,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (tl)
                    this.activeLavaSprites.push(tl);
                if (br)
                    this.activeLavaSprites.push(br);
                // grow towards center to ~60% of short side
                var target = Math.floor((W < H ? W : H) * 0.6), cx = (W - target) / 2, cy = (H - target) / 2;
                if (tl)
                    timerManager.animate({
                        targets: [tl],
                        keyframes: {
                            100: {
                                positionX: cx,
                                positionY: cy,
                                width: target,
                                height: target,
                            },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                if (br)
                    timerManager.animate({
                        targets: [br],
                        keyframes: {
                            100: {
                                positionX: cx,
                                positionY: cy,
                                width: target,
                                height: target,
                            },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            // --- LANE CHASE ---
            if (this.pendingPhaseType === 'lanes') {
                var wk = this.pendingWaveKey, asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                spriteManager.removeSprite('warn_lc_1_' + wk);
                spriteManager.removeSprite('warn_lc_2_' + wk);
                spriteManager.removeSprite('warn_lc_3_' + wk);
                var h1 = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_lc_1_' + wk,
                    positionX: 0,
                    positionY: 0,
                    width: W,
                    height: 120,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var h2 = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_lc_2_' + wk,
                    positionX: 0,
                    positionY: 260,
                    width: W,
                    height: 120,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var h3 = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_lc_3_' + wk,
                    positionX: 0,
                    positionY: 520,
                    width: W,
                    height: 120,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (h1)
                    this.activeLavaSprites.push(h1);
                if (h2)
                    this.activeLavaSprites.push(h2);
                if (h3)
                    this.activeLavaSprites.push(h3);
                // all sweep down; stagger speeds slightly
                if (h1)
                    timerManager.animate({
                        targets: [h1],
                        keyframes: { 100: { positionY: H - 120 } },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (h2)
                    timerManager.animate({
                        targets: [h2],
                        keyframes: { 100: { positionY: H - 120 } },
                        duration: dur * 0.9,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                if (h3)
                    timerManager.animate({
                        targets: [h3],
                        keyframes: { 100: { positionY: H - 120 } },
                        duration: dur * 0.8,
                        loop: false,
                        alternate: false,
                        playbackEase: 'linear',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            // --- BLINK GRID (3x3) ---
            if (this.pendingPhaseType === 'blink1') {
                var wk = this.pendingWaveKey, asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                spriteManager.removeSprite('warn_bg_' + wk);
                // create 3x3 grid blocks (collidable) and blink them
                var cellW = Math.floor(W / 3), cellH = Math.floor(H / 3);
                var ids = [];
                for (var gy = 0; gy < 3; gy++) {
                    for (var gx = 0; gx < 3; gx++) {
                        var id = 'lava_bg_' + wk + '_' + gx + '_' + gy;
                        var sp = spriteManager.addSprite(asset, {
                            uniqueId: id,
                            positionX: gx * cellW,
                            positionY: gy * cellH,
                            width: cellW - 10,
                            height: cellH - 10,
                            collisionGroup: 'lava',
                            opacity: 0.6,
                            checkCollisions: true,
                        });
                        if (sp) {
                            this.activeLavaSprites.push(sp);
                            ids.push(id);
                        }
                    }
                }
                // Blink by opacity animation; keep collidable
                for (var k = 0; k < ids.length; k++) {
                    timerManager.animate({
                        targets: [{ uniqueId: ids[k] }],
                        keyframes: {
                            0: { opacity: 0.2 },
                            50: { opacity: 0.9 },
                            100: { opacity: 0.2 },
                        },
                        duration: Math.max(1000, dur / 3),
                        loop: true,
                        alternate: false,
                        playbackEase: 'inOut(2)',
                    });
                }
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
            // --- SLIDING GATES ---
            if (this.pendingPhaseType === 'gates') {
                var wk = this.pendingWaveKey, asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight, dur = this.getActiveDurationMs();
                // Remove both edge warnings
                spriteManager.removeSprite('warn_gate_L_' + wk);
                spriteManager.removeSprite('warn_gate_R_' + wk);
                var left = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_gate_l_' + wk,
                    positionX: -120,
                    positionY: 0,
                    width: 120,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                var right = spriteManager.addSprite(asset, {
                    uniqueId: 'lava_gate_r_' + wk,
                    positionX: W,
                    positionY: 0,
                    width: 120,
                    height: H,
                    collisionGroup: 'lava',
                    opacity: 1,
                    checkCollisions: true,
                });
                if (left)
                    this.activeLavaSprites.push(left);
                if (right)
                    this.activeLavaSprites.push(right);
                // slide in to ~1/3 from edges
                if (left)
                    timerManager.animate({
                        targets: [left],
                        keyframes: {
                            50: { positionX: W * 0.15 },
                            100: { positionX: -120 },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                if (right)
                    timerManager.animate({
                        targets: [right],
                        keyframes: {
                            50: { positionX: W * 0.85 - 120 },
                            100: { positionX: W },
                        },
                        duration: dur,
                        loop: false,
                        alternate: false,
                        playbackEase: 'inOut(3)',
                    });
                this.pendingPhaseType = '';
                this.pendingWaveKey = 0;
                eventManager.emit('lavaWaveActive', { waveNumber: wk });
                return;
            }
        }
        if (!this.pendingPhaseType || this.pendingPhaseType === '') {
            this.activateLavaAfterFlashing();
            return;
        }
    }
    getLastPatternName() {
        return (this.lastPatternName ||
            (this.currentWavePattern ? this.currentWavePattern.name : ''));
    }
    activateLavaAfterFlashing() {
        this.cleanupFlashingSprites();
        if (this.currentWavePattern && this.currentWavePattern.name) {
            this.lastPatternName = this.currentWavePattern.name;
        }
        if (!this.currentWavePattern || !this.gameManager)
            return;
        for (var i = 0; i < this.currentWavePattern.zones.length; i++) {
            var zone = this.currentWavePattern.zones[i];
            var lavaSprite = spriteManager.addSprite(zone.assetKey, {
                uniqueId: 'lava_' + zone.id + '_' + this.gameManager.cyclesSurvived,
                positionX: zone.x,
                positionY: zone.y,
                collisionGroup: 'lava',
                width: zone.width,
                height: zone.height,
                opacity: 1.0,
                checkCollisions: true,
            });
            if (lavaSprite)
                this.activeLavaSprites.push(lavaSprite);
        }
        eventManager.emit('lavaWaveActive', {
            waveNumber: this.gameManager.cyclesSurvived,
        });
    }
    cleanupCurrentWaveLava() {
        if (this.activeLavaSprites.toArray().length > 0) {
            var toRemove = this.activeLavaSprites.toArray();
            this.activeLavaSprites = [];
            for (var i = 0; i < toRemove.length; i++) {
                var s = toRemove[i];
                if (s && s.uniqueId) {
                    spriteManager.removeSprite(s.uniqueId);
                }
            }
        }
    }
    cleanupFlashingSprites() {
        if (this.flashingSprites.toArray().length > 0) {
            var toRemove = this.flashingSprites.toArray();
            this.flashingSprites = [];
            for (var i = 0; i < toRemove.length; i++) {
                var s = toRemove[i];
                if (s && s.uniqueId) {
                    spriteManager.removeSprite(s.uniqueId);
                }
            }
        }
    }
    stopAllLavaActivity() {
        if (this._isCleaningUp)
            return;
        this._isCleaningUp = true;
        if (this.timerManager) {
            this.timerManager.clearTimer('lavaFlashTick');
        }
        this.lastPatternName = '';
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.currentWavePattern = null;
    }
    isLavaSprite(id) {
        if (!id || id.indexOf('lava_') === -1)
            return false;
        if (typeof spriteManager !== 'undefined' &&
            spriteManager &&
            typeof spriteManager.getProperty === 'function') {
            var grp = spriteManager.getProperty(id, 'collisionGroup');
            if (grp && grp !== 'lava')
                return false; // ✅ only real lava
        }
        return true;
    }
    // Creeping Doom (warn then inward slide)
    spawnCreepingLava() {
        this.lastPatternName = '🧱 CREEPING DOOM';
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        var asset = 'lava_tile_asset';
        var W = this.stageWidth;
        var H = this.stageHeight;
        var thickness = 140;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        var idT = 'warn_top_' + wk;
        var idB = 'warn_bottom_' + wk;
        var idL = 'warn_left_' + wk;
        var idR = 'warn_right_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idT,
            positionX: 0,
            positionY: 0,
            width: W,
            height: thickness,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idB,
            positionX: 0,
            positionY: H - thickness,
            width: W,
            height: thickness,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idL,
            positionX: 0,
            positionY: 0,
            width: thickness,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idR,
            positionX: W - thickness,
            positionY: 0,
            width: thickness,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idT);
        this.animateWarnOpacity(idB);
        this.animateWarnOpacity(idL);
        this.animateWarnOpacity(idR);
        this.pendingPhaseType = 'creep';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // Orthogonal Sweep (replacement for rotate)
    spawnRotatingBar() {
        this.lastPatternName = '🗡️ CROSS SWEEP';
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        var asset = 'lava_tile_asset';
        var W = this.stageWidth;
        var H = this.stageHeight;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        var idH = 'warn_sweep_h_' + wk;
        var idV = 'warn_sweep_v_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idH,
            positionX: 0,
            positionY: 0,
            width: W,
            height: 120,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idV,
            positionX: 0,
            positionY: 0,
            width: 120,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idH);
        this.animateWarnOpacity(idV);
        this.pendingPhaseType = 'sweep';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // Expanding Ripple (3-stage growth)
    spawnExpandingRipple() {
        this.lastPatternName = '💥 CORE RIPPLE';
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        var asset = 'lava_tile_asset';
        var W = this.stageWidth;
        var H = this.stageHeight;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        var s = 100;
        var x = (W - s) / 2;
        var y = (H - s) / 2;
        var id = 'warn_ripple_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: id,
            positionX: x,
            positionY: y,
            width: s,
            height: s,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(id);
        this.pendingPhaseType = 'ripple1';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // 🛑 CLAMPING JAWS — top/bottom AND left/right clamp in together
    spawnClampingJaws() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '🛑 CLAMPING JAWS';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager ? this.gameManager.cyclesSurvived : 0;
        var idT = 'warn_clamp_t_' + wk;
        var idB = 'warn_clamp_b_' + wk;
        var idL = 'warn_clamp_l_' + wk;
        var idR = 'warn_clamp_r_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idT,
            positionX: 0,
            positionY: 0,
            width: W,
            height: 120,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idB,
            positionX: 0,
            positionY: H - 120,
            width: W,
            height: 120,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idL,
            positionX: 0,
            positionY: 0,
            width: 120,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idR,
            positionX: W - 120,
            positionY: 0,
            width: 120,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idT);
        this.animateWarnOpacity(idB);
        this.animateWarnOpacity(idL);
        this.animateWarnOpacity(idR);
        this.pendingPhaseType = 'clamp';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // 📐 CORNER CREEP — two opposite corners expand towards center
    spawnCornerCreep() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '📐 CORNER CREEP';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager ? this.gameManager.cyclesSurvived : 0;
        var idTL = 'warn_cc_tl_' + wk;
        var idBR = 'warn_cc_br_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idTL,
            positionX: 0,
            positionY: 0,
            width: 160,
            height: 160,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idBR,
            positionX: W - 160,
            positionY: H - 160,
            width: 160,
            height: 160,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idTL);
        this.animateWarnOpacity(idBR);
        this.pendingPhaseType = 'corners';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // 🏎️ LANE CHASE — three horizontal bands sweep down
    spawnLaneChase() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '🏎️ LANE CHASE';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager ? this.gameManager.cyclesSurvived : 0;
        var id1 = 'warn_lc_1_' + wk;
        var id2 = 'warn_lc_2_' + wk;
        var id3 = 'warn_lc_3_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: id1,
            positionX: 0,
            positionY: 0,
            width: W,
            height: 120,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: id2,
            positionX: 0,
            positionY: 260,
            width: W,
            height: 120,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: id3,
            positionX: 0,
            positionY: 520,
            width: W,
            height: 120,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(id1);
        this.animateWarnOpacity(id2);
        this.animateWarnOpacity(id3);
        this.pendingPhaseType = 'lanes';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // ✨ BLINK GRID — a 3x3 grid blinks (collidable) but never all at once
    spawnBlinkGrid() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '✨ BLINK GRID';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager ? this.gameManager.cyclesSurvived : 0;
        var id = 'warn_bg_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: id,
            positionX: (W - 160) / 2,
            positionY: (H - 160) / 2,
            width: 160,
            height: 160,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(id);
        this.pendingPhaseType = 'blink1';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // 🚪 SLIDING GATES — two vertical gates slide in, then out
    spawnSlidingGates() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '🚪 SLIDING GATES';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager ? this.gameManager.cyclesSurvived : 0;
        // Flash the first in-arena positions (edges) so players can anticipate
        var idL = 'warn_gate_L_' + wk;
        var idR = 'warn_gate_R_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idL,
            positionX: 0,
            positionY: 0,
            width: 120,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idR,
            positionX: W - 120,
            positionY: 0,
            width: 120,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idL);
        this.animateWarnOpacity(idR);
        this.pendingPhaseType = 'gates';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // 🏃‍♀️ Sliding Alley (moving corridor L⇄R)
    spawnSlidingAlley() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '🏃‍♀️ Sliding Alley';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        var idL = 'warn_alley_L_' + wk;
        var idR = 'warn_alley_R_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idL,
            positionX: 0,
            positionY: 0,
            width: 120,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idR,
            positionX: W - 120,
            positionY: 0,
            width: 120,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idL);
        this.animateWarnOpacity(idR);
        this.pendingPhaseType = 'alley';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // ☄️ Meteor Rain (small falling tiles with diagonal drift)
    spawnMeteorRain() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '☄️ Meteor Rain';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        var id = 'warn_meteors_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: id,
            positionX: 0,
            positionY: 0,
            width: W,
            height: 120,
            collisionGroup: 'lava',
            opacity: 0.25,
            checkCollisions: false,
        });
        this.animateWarnOpacity(id);
        this.pendingPhaseType = 'meteors';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // 🔀 Split Shift (band opens a center gap and rises)
    spawnSplitShift() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '🔀 Split Shift';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        var id = 'warn_split_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: id,
            positionX: 0,
            positionY: (H - 220) / 2,
            width: W,
            height: 220,
            collisionGroup: 'lava',
            opacity: 0.35,
            checkCollisions: false,
        });
        this.animateWarnOpacity(id);
        this.pendingPhaseType = 'splitshift';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // 🪟 Window Walker (two moving safe windows through corner panels)
    spawnWindowWalker() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '🪟 Window Walker';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        // Match warnings to the initial four panel sizes in activation
        var wnd = 180; // must match activation window size
        var wPanel = W / 2 - wnd / 2;
        var hPanel = H / 2 - wnd / 2;
        var idUL = 'warn_win_UL_' + wk;
        var idUR = 'warn_win_UR_' + wk;
        var idLL = 'warn_win_LL_' + wk;
        var idLR = 'warn_win_LR_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idUL,
            positionX: 0,
            positionY: 0,
            width: wPanel,
            height: hPanel,
            collisionGroup: 'lava',
            opacity: 0.25,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idUR,
            positionX: W / 2 + wnd / 2,
            positionY: 0,
            width: wPanel,
            height: hPanel,
            collisionGroup: 'lava',
            opacity: 0.25,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idLL,
            positionX: 0,
            positionY: H / 2 + wnd / 2,
            width: wPanel,
            height: hPanel,
            collisionGroup: 'lava',
            opacity: 0.25,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idLR,
            positionX: W / 2 + wnd / 2,
            positionY: H / 2 + wnd / 2,
            width: wPanel,
            height: hPanel,
            collisionGroup: 'lava',
            opacity: 0.25,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idUL);
        this.animateWarnOpacity(idUR);
        this.animateWarnOpacity(idLL);
        this.animateWarnOpacity(idLR);
        this.pendingPhaseType = 'windows';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    // ➕ Cross Pressure (plus sign grows, holds, then shrinks)
    spawnCrossPressure() {
        this.cleanupFlashingSprites();
        this.cleanupCurrentWaveLava();
        this.lastPatternName = '➕ Cross Pressure';
        var asset = 'lava_tile_asset', W = this.stageWidth, H = this.stageHeight;
        var wk = this.gameManager && typeof this.gameManager.cyclesSurvived === 'number'
            ? this.gameManager.cyclesSurvived
            : 0;
        var idH = 'warn_cross_H_' + wk;
        var idV = 'warn_cross_V_' + wk;
        spriteManager.addSprite(asset, {
            uniqueId: idH,
            positionX: 0,
            positionY: (H - 80) / 2,
            width: W,
            height: 80,
            collisionGroup: 'lava',
            opacity: 0.3,
            checkCollisions: false,
        });
        spriteManager.addSprite(asset, {
            uniqueId: idV,
            positionX: (W - 80) / 2,
            positionY: 0,
            width: 80,
            height: H,
            collisionGroup: 'lava',
            opacity: 0.3,
            checkCollisions: false,
        });
        this.animateWarnOpacity(idH);
        this.animateWarnOpacity(idV);
        this.pendingPhaseType = 'crosspressure';
        this.pendingWaveKey = wk;
        this.timerManager.setTimer('lavaFlashTick', this.getWarningSeconds());
    }
    getActiveDurationMs() {
        var durMs = 3000;
        if (this.gameManager &&
            typeof this.gameManager.lavaActiveDurationPerWave === 'number') {
            var base = this.gameManager.lavaActiveDurationPerWave * 1000;
            // Centralized time scaling from GameManager: shorter durations as level increases
            var scale = 1.0;
            try {
                if (typeof this.gameManager.getTimeScale === 'function') {
                    scale = this.gameManager.getTimeScale();
                }
            }
            catch (e) { }
            // For lava, keep a 50% floor like before to ensure readability
            if (scale < 0.5)
                scale = 0.5;
            durMs = Math.floor(base * scale);
        }
        return durMs;
    }
    buildPatternBag() {
        this.patternBag = [];
        // Step 2: filter by startingLevel <= current level
        var arr = this.wavePatterns &&
            (this.wavePatterns.toArray ? this.wavePatterns.toArray() : this.wavePatterns);
        var lvl = 1;
        try {
            if (this.gameManager && typeof this.gameManager.level === 'number')
                lvl = this.gameManager.level;
        }
        catch (e) { }
        for (var i = 0; i < arr.length; i++) {
            var p = arr[i];
            var s = typeof p.startingLevel === 'number' ? p.startingLevel : 1;
            var e = typeof p.endingLevel === 'number' ? p.endingLevel : 9999;
            if (s <= lvl && lvl <= e)
                this.patternBag.push(i);
        }
        // Safety fallback: if too few patterns remain at this level, use all patterns
        // This avoids repetition or dead-ends when authors retire many early patterns.
        var minCount = 3;
        if (this.patternBag.length < minCount) {
            this.patternBag = [];
            for (var k = 0; k < arr.length; k++)
                this.patternBag.push(k);
        }
        // Fisher–Yates shuffle
        for (var m = this.patternBag.length - 1; m > 0; m--) {
            var j = Math.floor(Math.random() * (m + 1));
            var tmp = this.patternBag[m];
            this.patternBag[m] = this.patternBag[j];
            this.patternBag[j] = tmp;
        }
        this.patternBagIndex = 0;
    }
    getWarningSeconds() {
        // Centralized warning length from GameManager
        try {
            if (this.gameManager && typeof this.gameManager.getWarningSeconds === 'function') {
                return this.gameManager.getWarningSeconds();
            }
        }
        catch (e) { }
        // Fallback: prior behavior
        var lvl = 1;
        try {
            if (this.gameManager && typeof this.gameManager.level === 'number')
                lvl = this.gameManager.level;
        }
        catch (e) { }
        var sec = 3.0 - (lvl - 1) * 0.25; // -250ms per level
        if (sec < 1.5)
            sec = 1.5; // clamp min
        return sec;
    }
    animateWarnOpacity(uniqueId) {
        // light blink so specials “feel” the same as base flashing
        var animDur = Math.floor(((this.gameManager && typeof this.gameManager.getWarningSeconds === 'function')
            ? this.gameManager.getWarningSeconds()
            : 3.0) * 1000);
        timerManager.animate({
            targets: [{ uniqueId: uniqueId }],
            keyframes: {
                0: { opacity: 0.15 },
                25: { opacity: 0.75 },
                50: { opacity: 0.15 },
                75: { opacity: 0.75 },
                100: { opacity: 0.15 },
            },
            duration: animDur,
            loop: false,
            alternate: false,
            playbackEase: 'linear',
        });
    }
}
