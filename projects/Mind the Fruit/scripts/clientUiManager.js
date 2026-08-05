"use strict";
class clientUiManager extends SystemScript {
    outTextId;
    outTextVisible;
    myPlayerId;
    refreshRetryFrames;
    currentGamePhase;
    currentPlayerLifeMap;
    hasCurrentGamePhase;
    hasCurrentPlayerLifeMap;
    onInit() {
        this.outTextId = "localOutText";
        this.outTextVisible = false;
        this.myPlayerId = 0;
        this.refreshRetryFrames = 0;
        this.currentGamePhase = "";
        this.currentPlayerLifeMap = null;
        this.hasCurrentGamePhase = false;
        this.hasCurrentPlayerLifeMap = false;
        this.ensureOutTextSprite();
        this.applyOutTextState();
    }
    onPlayerStart() {
        this.myPlayerId = playerManager.getMyPlayerId();
        this.scheduleRefreshRetry();
        this.ensureOutTextSprite();
        this.applyOutTextState();
    }
    onSpectatorStart() {
        this.myPlayerId = playerManager.getMyPlayerId();
        this.scheduleRefreshRetry();
        this.ensureOutTextSprite();
        this.applyOutTextState();
    }
    onStep() {
        if (!spriteManager.getSprite(this.outTextId)) {
            this.ensureOutTextSprite();
            this.scheduleRefreshRetry();
        }
        if (this.refreshRetryFrames <= 0)
            return;
        this.refreshRetryFrames -= 1;
        this.applyOutTextState();
    }
    onVariableChanged_gamePhase({ newValue, }) {
        this.currentGamePhase = newValue;
        this.hasCurrentGamePhase = true;
        this.scheduleRefreshRetry();
        this.applyOutTextState();
    }
    onVariableChanged_playerLifeMap({ oldValue, newValue, }) {
        console.log("Player life map changed");
        console.log("player life map oldValue: ", oldValue);
        console.log("player life map newValue: ", newValue);
        this.currentPlayerLifeMap = newValue;
        this.hasCurrentPlayerLifeMap = true;
        this.scheduleRefreshRetry();
        this.applyOutTextState();
    }
    onVariableChanged_roundResolutionNonce() {
        this.scheduleRefreshRetry();
        this.applyOutTextState();
    }
    scheduleRefreshRetry() {
        this.refreshRetryFrames = 60;
    }
    ensureOutTextSprite() {
        if (!this.outTextId) {
            this.outTextId = "localOutText";
        }
        if (spriteManager.getSprite(this.outTextId))
            return;
        spriteManager.addSprite("basicText", {
            uniqueId: this.outTextId,
            positionX: 1128,
            positionY: 1130,
            containerWidth: 300,
            align: "center",
            text: "",
            fontSize: 34,
            fontWeight: "bold",
            fontColor: "#b21e35",
            topAdjust: 0,
            strokeThickness: 4,
            opacity: 0,
            isPlayerControlled: true,
        });
        this.outTextVisible = false;
    }
    applyOutTextState() {
        this.ensureOutTextSprite();
        if (!this.hasCurrentGamePhase || !this.hasCurrentPlayerLifeMap) {
            if (this.outTextVisible) {
                this.hideOutText();
            }
            return;
        }
        if (this.currentGamePhase === "WAITING") {
            if (this.outTextVisible) {
                this.hideOutText();
            }
            return;
        }
        const myPlayerId = this.getMyPlayerId();
        if (!myPlayerId) {
            if (this.outTextVisible) {
                this.hideOutText();
            }
            return;
        }
        if (!this.currentPlayerLifeMap) {
            if (this.outTextVisible) {
                this.hideOutText();
            }
            return;
        }
        const isOut = this.currentPlayerLifeMap[myPlayerId.toString()] === false;
        if (isOut) {
            if (!this.outTextVisible) {
                this.showOutText();
            }
            return;
        }
        if (this.outTextVisible) {
            this.hideOutText();
        }
    }
    getMyPlayerId() {
        if (!this.myPlayerId) {
            this.myPlayerId = playerManager.getMyPlayerId();
        }
        return this.myPlayerId;
    }
    showOutText() {
        this.ensureOutTextSprite();
        if (!spriteManager.getSprite(this.outTextId))
            return;
        let outTextOptions;
        outTextOptions = {
            text: "You're Out!",
            opacity: 1,
            strokeThickness: 4,
        };
        spriteManager.updateSprite(this.outTextId, outTextOptions);
        this.outTextVisible = true;
    }
    hideOutText() {
        this.ensureOutTextSprite();
        if (!spriteManager.getSprite(this.outTextId))
            return;
        spriteManager.updateSprite(this.outTextId, {
            text: "",
            opacity: 0,
            strokeThickness: 4,
        });
        this.outTextVisible = false;
    }
}
