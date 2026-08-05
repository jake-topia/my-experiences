"use strict";
class tileManager extends SystemScript {
    main;
    hitboxManager;
    fauxSprite;
    tileFadeAnim;
    toFadeOutTracker;
    toFadeInTracker;
    tileToFade; // tileId
    timeFading;
    maxStanders;
    countdownTimeLeft;
    fadeOutList;
    fadeInList;
    TILE_SIZE;
    maxContenderCount;
    COUNTDOWN_TIME;
    onInit() {
        this.hitboxManager = scriptManager.getSystem({ systemName: "hitboxManager" });
        this.COUNTDOWN_TIME = 4;
        this.countdownTimeLeft = this.COUNTDOWN_TIME;
        this.maxStanders = 0;
        this.timeFading = 0;
        this.TILE_SIZE = 150;
        // as sprites:
        this.fadeOutList = [];
        this.fadeInList = [];
        this.tileToFade = "t60";
        this.fauxSprite = spriteManager.addSprite("tile", { checkCollisions: false, opacity: 0 });
        this.maxContenderCount = 2;
        // fadeout whatever tile is in the fadeout list
        // this.toFadeInTracker = timerManager.animate({
        //   targets: this.fadeInList,
        //   keyframes: {
        //     0: { opacity: "+=0" },
        //     1000: { opacity: "+=1" },
        //   },
        // duration: 1000,
        // loop: true,
        // alternate: false,
        // playbackEase: "Linear",
        // onUpdate: () => {
        //   if (!playerManager.isHost) return;
        //   if (stateManager.getVariable("gameStarted") === false) return;
        //     for (const tileId of this.fadeOutList) {
        //       const tileOpacity = spriteManager.getSprite(tileId).opacity;
        //       if (tileOpacity < 0 || tileOpacity > 1) {
        //         console.log("opacity out of bounds somehow");
        //         return;
        //       }
        //     }
        //   },
        //   onComplete: () => {
        //     if (!playerManager.isHost) return;
        // if (stateManager.getVariable("gameStarted") === false) return;
        //     for (const tileId of this.fadeOutList) {
        //       this.fadeInList.append(tileId);
        //     }
        //   },
        //   onBegin: () => {
        //     console.log("Begin tileFadeIn animation");
        //   },
        // });
        this.tileFadeAnim = timerManager.animate({
            targets: [this.fauxSprite],
            keyframes: {
                0: { topAdjust: "+=1" },
                100: { topAdjust: "+=-1" },
            },
            duration: 1000,
            loop: true,
            alternate: false,
            playbackEase: "Linear",
            onLoop: () => {
                if (stateManager.getVariable("enableCrowdControl") === "false")
                    return;
                if (!playerManager.isHost)
                    return;
                if (stateManager.getVariable("gameStarted") === false)
                    return;
                const contender = this.getMaxStanders(this.fadeOutList); // { tileId, maxStanders }
                if (!contender || !contender.tileId)
                    return;
                const contenderId = contender.tileId;
                const contenderCount = contender.maxStanders;
                const sameTile = contenderId === this.tileToFade;
                const increased = contenderCount > this.maxStanders;
                // New leader OR same leader but bigger crowd means accept and reset
                if (!sameTile || increased) {
                    this.tileToFade = contenderId;
                    this.maxStanders = contenderCount;
                    this.timeFading = 0;
                    this.countdownTimeLeft = this.COUNTDOWN_TIME;
                    return;
                }
                // Same tile and not increased = run countdown
                if (this.countdownTimeLeft > 0) {
                    if (contenderCount <= 1)
                        this.countdownTimeLeft = this.COUNTDOWN_TIME;
                    // console.log("COUNTDOWN: ", this.countdownTimeLeft);
                    this.countdownTimeLeft -= 1;
                }
                else {
                    if (this.tileToFade && contenderCount >= this.maxContenderCount) {
                        this.fadeOutList.push(this.tileToFade);
                        this.countdownTimeLeft = this.COUNTDOWN_TIME;
                        this.fadeOut();
                    }
                }
            },
            onBegin: () => {
                // console.log("Begin tileFade countdown timer animation");
            },
        });
    }
    async fadeOut() {
        if (stateManager.getVariable("winnerAnnounced") === true)
            return;
        // fadeout whatever tile is in the fadeout list
        timerManager.animate({
            targets: [spriteManager.getSprite(this.tileToFade)],
            keyframes: {
                0: { opacity: "+=0", strokeWeight: "+=0" },
                10: { strokeWeight: "+=0" },
                11: { strokeWeight: "30" },
                30: { strokeWeight: "30" },
                31: { strokeWeight: "0" },
                50: { strokeWeight: "0" },
                51: { strokeWeight: "30" },
                70: { strokeWeight: "30" },
                71: { strokeWeight: "0" },
                100: { opacity: "0" },
            },
            duration: 3000,
            loop: false,
            alternate: false,
            playbackEase: "Linear",
            onUpdate: () => {
                if (!playerManager.isHost)
                    return;
                if (stateManager.getVariable("gameStarted") === false)
                    return;
            },
            onComplete: () => {
                // console.log("FADEOUT COMPLETE!!!!!!");
                if (!playerManager.isHost)
                    return;
                if (stateManager.getVariable("gameStarted") === false)
                    return;
                // disallow walkable: this tile is faded now
                let fadedMap = stateManager.getVariable("tileFadedMap"); // tileId string to bool
                fadedMap[this.tileToFade] = true;
                stateManager.setVariable("tileFadedMap", fadedMap);
                this.fadeIn(this.tileToFade);
            },
            onBegin: () => {
                // console.log("Begin tileFadeOut animation");
            },
        });
    }
    async fadeIn(id) {
        if (stateManager.getVariable("winnerAnnounced") === true)
            return;
        let isFadedMapReset = false;
        // fadein tile passed in as a parameter
        timerManager.animate({
            targets: [spriteManager.getSprite(id)],
            keyframes: {
                0: { opacity: "+=0" }, // do nothing for 3 sec, then fade in for 3 sec
                50: { opacity: "+=0" },
                100: { opacity: "1" },
            },
            duration: 6000,
            loop: false,
            alternate: false,
            playbackEase: "Linear",
            onUpdate: () => {
                if (!playerManager.isHost)
                    return;
                if (stateManager.getVariable("gameStarted") === false)
                    return;
                if (!isFadedMapReset && spriteManager.getSprite(id).opacity > 0.01) { // if wait 3 seconds is over
                    // allow walkable again
                    let fadedMap = stateManager.getVariable("tileFadedMap"); // tileId string to bool
                    fadedMap[id] = false;
                    stateManager.setVariable("tileFadedMap", fadedMap);
                    isFadedMapReset = true;
                }
            },
            onComplete: () => {
                // console.log("FADEIN COMPLETE!!!!");
                if (!playerManager.isHost)
                    return;
                if (stateManager.getVariable("gameStarted") === false)
                    return;
                //ensure walkability and opacity
                let fadedMap = stateManager.getVariable("tileFadedMap"); // tileId string to bool
                fadedMap[id] = false;
                stateManager.setVariable("tileFadedMap", fadedMap);
                spriteManager.updateSprite(id, { opacity: 1 });
                // remove this tile's id from the fadeout list
                this.fadeOutList = this.fadeOutList.filter((item) => item !== id);
            },
            onBegin: () => {
                // console.log("Begin tileFadeIn animation");
                const hitboxes = stateManager.getVariable("playerHitboxesReverse");
                for (const hitbox of Object.keys(hitboxes)) {
                    const hitboxSprite = spriteManager.getSprite(hitbox);
                    const tileSprite = spriteManager.getSprite(id);
                    if (hitboxSprite.position.x < tileSprite.position.x + this.TILE_SIZE
                        && hitboxSprite.position.x > tileSprite.position.x
                        && hitboxSprite.position.y < tileSprite.position.y + this.TILE_SIZE
                        && hitboxSprite.position.y > tileSprite.position.y) {
                        this.hitboxManager.externalTeleportCall(hitboxes[hitbox]);
                    }
                }
            },
        });
    }
    isTile(tileId) {
        if (tileId.charCodeAt(0) !== 116 || tileId.length < 2 || tileId.length > 3) {
            return false;
        }
        return true;
    }
    // --- tileStanders helpers
    addTileStander(tileId) {
        const ts = stateManager.getVariable("tileStanders");
        ts[tileId] = Math.max(1, (ts[tileId] ?? 0) + 1);
        stateManager.setVariable("tileStanders", ts);
    }
    removeTileStander(tileId) {
        const ts = stateManager.getVariable("tileStanders");
        ts[tileId] = Math.max(0, (ts[tileId] ?? 0) - 1);
        stateManager.setVariable("tileStanders", ts);
    }
    getMaxStanders(exclude) {
        const ts = stateManager.getVariable("tileStanders");
        const excluded = exclude || [];
        const tileKeys = Object.keys(ts).filter((tileId) => {
            if (!this.isTile(tileId))
                return false;
            // keep it only if there is not a match in excluded
            return excluded.filter((ex) => ex === tileId).length === 0;
        });
        let max = 0;
        let maxIndex = null;
        for (const tileId of tileKeys) {
            if (ts[tileId] > max) {
                max = ts[tileId];
                maxIndex = tileId;
            }
        }
        return { tileId: maxIndex, maxStanders: max };
    }
    // ---
    onPlayerJoined({ playerId }) {
        this.calcMaxContenders();
    }
    calcMaxContenders() {
        const numPlayers = playerManager.getPlayerIds().length;
        this.maxContenderCount = Math.ceil(numPlayers / 2) + 1;
        // console.log("new maxcontcount: ", this.maxContenderCount);
    }
}
