"use strict";
class arenaManager extends SystemScript {
    worldWidth;
    worldHeight;
    playAreaWidth;
    arenaStartX;
    arenaTop;
    arenaSize;
    sidebarX;
    sidebarWidth;
    sidebarPadding;
    panelSize;
    panelX;
    panelY;
    outZoneX;
    outZoneY;
    outZoneWidth;
    outZoneHeight;
    playerListPanelX;
    playerListPanelY;
    playerListPanelWidth;
    playerListPanelHeight;
    playerListTitleY;
    playerListEntryIds;
    lobbyTitleX;
    lobbyTextWidth;
    centerFooterY;
    centerFruitBaseSpriteSize;
    centerFruitSpriteScale;
    centerFruitSpriteName;
    centerFruitSpriteId;
    fruitSpriteAvailability;
    roundTextColor;
    panelTextColor;
    onInit() {
        if (!playerManager.isHost)
            return;
        this.worldWidth = 1500;
        this.worldHeight = 1500;
        this.playAreaWidth = 1296;
        this.arenaStartX = 76;
        this.arenaSize = 980;
        const arenaLeftGap = this.arenaStartX;
        this.arenaTop = this.worldHeight - this.arenaSize - arenaLeftGap;
        this.sidebarWidth = 300;
        this.sidebarPadding = 20;
        const arenaRightEdge = this.arenaStartX + this.arenaSize;
        const rightColumnSpace = this.worldWidth - arenaRightEdge;
        this.sidebarX = arenaRightEdge +
            Math.floor((rightColumnSpace - this.sidebarWidth) / 2);
        this.panelSize = 340;
        const centerCutoutOffset = 2 * (160 + 4);
        const centerCutoutSize = 2 * 160 + 4;
        this.panelX = this.arenaStartX + centerCutoutOffset +
            Math.floor((centerCutoutSize - this.panelSize) / 2);
        this.panelY = this.arenaTop + centerCutoutOffset +
            Math.floor((centerCutoutSize - this.panelSize) / 2);
        this.playerListPanelX = this.sidebarX;
        this.playerListPanelY = 90;
        this.playerListPanelWidth = this.sidebarWidth;
        this.playerListPanelHeight = 940;
        this.outZoneX = this.sidebarX;
        this.outZoneY = this.playerListPanelY + this.playerListPanelHeight +
            this.playerListPanelY;
        this.outZoneWidth = this.sidebarWidth;
        this.outZoneHeight = this.sidebarWidth;
        this.playerListTitleY = this.playerListPanelY + 25;
        this.playerListEntryIds = [];
        this.lobbyTextWidth = this.panelSize - 24;
        this.lobbyTitleX = this.panelX +
            Math.floor((this.panelSize - this.lobbyTextWidth) / 2);
        this.centerFooterY = this.getRoundTimerY();
        // Keep this in sync with the fruit image source size so centering stays deterministic.
        this.centerFruitBaseSpriteSize = 160;
        this.centerFruitSpriteScale = 1.1;
        this.centerFruitSpriteName = "";
        this.centerFruitSpriteId = "";
        this.fruitSpriteAvailability = {};
        this.roundTextColor = "#45b111";
        this.panelTextColor = "#F01135";
        this.ensureStaticSprites();
        this.rebuildBarrierSprites();
        this.hideWinner();
        this.hideOutZone();
        this.hideCenterPanel();
    }
    ensureStaticSprites() {
        if (!spriteManager.getSprite("arenaBackground")) {
            spriteManager.addSprite("background", {
                uniqueId: "arenaBackground",
                positionX: 0,
                positionY: 0,
            });
        }
        if (!spriteManager.getSprite("arenaFrameTop")) {
            spriteManager.addSprite("frameTop", {
                uniqueId: "arenaFrameTop",
                positionX: -149,
                positionY: -90,
            });
        }
        if (!spriteManager.getSprite("arenaFrameBottom")) {
            spriteManager.addSprite("frameBottom", {
                uniqueId: "arenaFrameBottom",
                positionX: -149,
                positionY: 580,
            });
        }
        if (!spriteManager.getSprite("centerDisplayRect")) {
            spriteManager.addSprite("displayRect", {
                uniqueId: "centerDisplayRect",
                positionX: this.panelX,
                positionY: this.panelY,
                width: this.panelSize,
                height: this.panelSize,
                bottomAdjust: "NONE",
                opacity: 0,
            });
        }
        spriteManager.updateSprite("centerDisplayRect", {
            positionX: this.panelX,
            positionY: this.panelY,
            width: this.panelSize,
            height: this.panelSize,
            bottomAdjust: "NONE",
            opacity: 0,
        });
        if (!spriteManager.getSprite("playerListPanel")) {
            spriteManager.addSprite("displayRect", {
                uniqueId: "playerListPanel",
                positionX: this.playerListPanelX,
                positionY: this.playerListPanelY,
                width: this.playerListPanelWidth,
                height: this.playerListPanelHeight,
                fill: "#173247",
                opacity: 0,
            });
        }
        spriteManager.updateSprite("playerListPanel", {
            positionX: this.playerListPanelX,
            positionY: this.playerListPanelY,
            width: this.playerListPanelWidth,
            height: this.playerListPanelHeight,
            fill: "#173247",
            opacity: 0,
        });
        this.ensureTextSprite("playerListTitleText", this.sidebarX + this.sidebarPadding, this.playerListTitleY, this.sidebarWidth - this.sidebarPadding * 2, 30, "bold", "center");
        let playerListTitleHiddenOptions;
        playerListTitleHiddenOptions = {
            text: "",
            opacity: 0,
            fontColor: "#ffffff",
            strokeThickness: 3,
        };
        spriteManager.updateSprite("playerListTitleText", playerListTitleHiddenOptions);
        this.ensureTextSprite("centerTitleText", this.panelX, this.panelY + 75, this.panelSize, 58, "bold", "center");
        this.ensureTextSprite("centerSubtitleText", this.panelX, this.panelY + 165, this.panelSize, 34, "normal", "center");
        this.ensureTextSprite("centerFooterText", this.panelX, this.panelY + 235, this.panelSize, 54, "bold", "center");
        if (!spriteManager.getSprite("startButtonText")) {
            spriteManager.addSprite("basicText", {
                uniqueId: "startButtonText",
                positionX: this.lobbyTitleX,
                positionY: this.getLobbyButtonY(),
                containerWidth: this.lobbyTextWidth,
                align: "center",
                text: "",
                fontSize: 24,
                fontWeight: "bold",
                fontColor: "#F01135",
                strokeThickness: 0,
                strokeColor: "#000000",
                isInteractive: true,
                isPlayerControlled: true,
                opacity: 0,
            });
        }
        if (!spriteManager.getSprite("hostStartButton")) {
            spriteManager.addSprite("basicText", {
                uniqueId: "hostStartButton",
                positionX: 0,
                positionY: 0,
                containerWidth: 320,
                align: "center",
                text: "",
                fontSize: 30,
                fontWeight: "bold",
                fontColor: "#F01135",
                isInteractive: true,
                isPlayerControlled: true,
                opacity: 0,
            });
        }
        if (!spriteManager.getSprite("winnerText")) {
            spriteManager.addSprite("basicText", {
                uniqueId: "winnerText",
                positionX: 0,
                positionY: 575,
                containerWidth: this.playAreaWidth,
                align: "center",
                text: "",
                fontSize: 58,
                fontWeight: "bold",
                opacity: 0,
            });
        }
        spriteManager.updateSprite("winnerText", {
            positionX: this.arenaStartX,
            containerWidth: this.arenaSize,
        });
        if (!spriteManager.getSprite("winnerCountdownText")) {
            spriteManager.addSprite("basicText", {
                uniqueId: "winnerCountdownText",
                positionX: 0,
                positionY: 655,
                containerWidth: this.playAreaWidth,
                align: "center",
                text: "",
                fontSize: 50,
                fontWeight: "bold",
                opacity: 0,
            });
        }
        spriteManager.updateSprite("winnerCountdownText", {
            positionX: this.arenaStartX,
            containerWidth: this.arenaSize,
        });
        if (!spriteManager.getSprite("outZoneRect")) {
            spriteManager.addSprite("displayRect", {
                uniqueId: "outZoneRect",
                positionX: this.outZoneX,
                positionY: this.outZoneY,
                width: this.outZoneWidth,
                height: this.outZoneHeight,
                fill: "#f2b7b7",
                opacity: 0,
            });
        }
        spriteManager.updateSprite("outZoneRect", {
            positionX: this.outZoneX,
            positionY: this.outZoneY,
            width: this.outZoneWidth,
            height: this.outZoneHeight,
            fill: "#f2b7b7",
            opacity: 0,
        });
    }
    ensureTextSprite(uniqueId, positionX, positionY, containerWidth, fontSize, fontWeight, align) {
        if (spriteManager.getSprite(uniqueId))
            return;
        spriteManager.addSprite("basicText", {
            uniqueId: uniqueId,
            positionX: positionX,
            positionY: positionY,
            containerWidth: containerWidth,
            align: align,
            text: "",
            fontSize: fontSize,
            fontWeight: fontWeight,
            opacity: 0,
        });
    }
    showLobby(hostName) {
        if (!playerManager.isHost)
            return;
        this.showCenterPanel();
        this.showPlayerListArea();
        this.showOutZone();
        this.syncTopArenaBarrier("WAITING", 0);
        this.hideWinner();
        this.hideCenterFruitSprite();
        this.centerFooterY = this.getRoundTimerY();
        this.setRoundLayoutToLobby();
        spriteManager.updateSprite("centerTitleText", {
            text: "Mind\nthe\nFruit",
            positionX: this.lobbyTitleX,
            positionY: this.getLobbyTitleY(),
            containerWidth: this.lobbyTextWidth,
            fontSize: 58,
            fontWeight: "bold",
            fontColor: "#1e1e1e",
            strokeThickness: 1.5,
            strokeColor: "#000000",
            opacity: 1,
        });
        spriteManager.updateSprite("centerSubtitleText", {
            text: "Waiting for " + hostName + " to start.",
            positionX: this.lobbyTitleX,
            positionY: this.getLobbySubtitleY(),
            containerWidth: this.lobbyTextWidth,
            fontSize: 22,
            fontWeight: "normal",
            fontColor: "#1e1e1e",
            strokeThickness: 1.5,
            strokeColor: "#000000",
            opacity: 1,
        });
        spriteManager.updateSprite("centerFooterText", {
            text: "",
            strokeThickness: 3.5,
            strokeColor: "#000000",
            opacity: 0,
        });
        this.setCenterStartButtonText("Click here to start!", "#F01135");
    }
    showMemorizeRound(roundNumber) {
        if (!playerManager.isHost)
            return;
        this.showCenterPanel();
        this.showPlayerListArea();
        this.showOutZone();
        this.syncTopArenaBarrier("MEMORIZE", roundNumber);
        this.setRoundLayoutDefault();
        this.hideCenterFruitSprite();
        this.centerFooterY = this.getRoundTimerY();
        this.setCenterRoundText(roundNumber);
        this.setCenterPhasePromptText("Memorize the Fruits!");
        this.setCenterFooterText("", this.panelTextColor);
        this.hideStartButton();
    }
    showSafeFruit(fruitName) {
        if (!playerManager.isHost)
            return;
        const roundNumber = stateManager.getVariable("roundNumber");
        this.showCenterPanel();
        this.showPlayerListArea();
        this.showOutZone();
        this.syncTopArenaBarrier("MOVE", roundNumber);
        this.setRoundLayoutDefault();
        this.centerFooterY = this.getRoundTimerY();
        this.setCenterRoundText(roundNumber);
        this.setCenterPhasePromptText("Stand on this fruit!");
        if (!this.showCenterFruitSprite(fruitName)) {
            this.hideCenterFruitSprite();
        }
        this.setCenterFooterText("", this.panelTextColor);
        this.hideStartButton();
    }
    showResolve(fruitName) {
        if (!playerManager.isHost)
            return;
        const roundNumber = stateManager.getVariable("roundNumber");
        this.showCenterPanel();
        this.showPlayerListArea();
        this.showOutZone();
        this.syncTopArenaBarrier("RESOLVE", roundNumber);
        this.setRoundLayoutDefault();
        this.centerFooterY = this.getRoundTimerY();
        this.setCenterRoundText(roundNumber);
        this.setCenterPhasePromptText("Complete!");
        if (!this.showCenterFruitSprite(fruitName)) {
            this.hideCenterFruitSprite();
        }
        this.setCenterFooterText("", this.panelTextColor);
        this.hideStartButton();
    }
    setCenterFooterText(text, color) {
        if (!playerManager.isHost)
            return;
        const contentWidth = this.getCenterContentWidth();
        spriteManager.updateSprite("centerFooterText", {
            positionX: this.panelX + this.getCenterContentPadding(),
            positionY: this.centerFooterY,
            containerWidth: contentWidth,
            text: text,
            align: "center",
            fontSize: this.getFittedFontSize(text, contentWidth, 30, 22),
            fontWeight: "bold",
            fontColor: color,
            strokeThickness: 3.5,
            strokeColor: "#000000",
            opacity: text ? 1 : 0,
        });
    }
    showCenterPanel() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("centerDisplayRect", {
            positionX: this.panelX,
            positionY: this.panelY,
            width: this.panelSize,
            height: this.panelSize,
            bottomAdjust: "NONE",
            opacity: 1,
        });
    }
    hideCenterPanel() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("centerDisplayRect", { opacity: 0 });
        spriteManager.updateSprite("centerTitleText", {
            text: "",
            strokeThickness: 3.5,
            strokeColor: "#000000",
            opacity: 0,
        });
        spriteManager.updateSprite("centerSubtitleText", {
            text: "",
            strokeThickness: 3.5,
            strokeColor: "#000000",
            opacity: 0,
        });
        spriteManager.updateSprite("centerFooterText", {
            text: "",
            strokeThickness: 3.5,
            strokeColor: "#000000",
            opacity: 0,
        });
        this.hideCenterFruitSprite();
        this.hideStartButton();
    }
    hideStartButton() {
        if (!playerManager.isHost)
            return;
        const startButtonSprite = spriteManager.getSprite("startButtonText");
        if (!startButtonSprite)
            return;
        if (!startButtonSprite.text &&
            startButtonSprite.opacity === 0 &&
            !startButtonSprite.isInteractive) {
            this.hideHostStartButton();
            return;
        }
        spriteManager.updateSprite("startButtonText", {
            text: "",
            strokeThickness: 0,
            strokeColor: "#000000",
            opacity: 0,
            isInteractive: false,
        });
        this.hideHostStartButton();
    }
    setCenterStartButtonText(text, color) {
        if (!playerManager.isHost)
            return;
        const startButtonSprite = spriteManager.getSprite("startButtonText");
        if (!startButtonSprite)
            return;
        const desiredOpacity = text ? 1 : 0;
        if (startButtonSprite.text === text &&
            startButtonSprite.position.x === this.lobbyTitleX &&
            startButtonSprite.position.y === this.getLobbyButtonY() &&
            startButtonSprite.containerWidth === this.lobbyTextWidth &&
            startButtonSprite.opacity === desiredOpacity &&
            startButtonSprite.fontColor === color &&
            !!startButtonSprite.isInteractive) {
            return;
        }
        spriteManager.updateSprite("startButtonText", {
            text: text,
            positionX: this.lobbyTitleX,
            positionY: this.getLobbyButtonY(),
            containerWidth: this.lobbyTextWidth,
            fontSize: 24,
            opacity: text ? 1 : 0,
            isInteractive: true,
            fontColor: color,
            strokeThickness: 1.5,
            strokeColor: "#000000",
        });
    }
    updateHostStartButton(positionX, positionY, text, color) {
        if (!playerManager.isHost)
            return;
        const hostStartButtonSprite = spriteManager.getSprite("hostStartButton");
        if (!hostStartButtonSprite)
            return;
        const desiredOpacity = text ? 1 : 0;
        if (hostStartButtonSprite.position.x === positionX &&
            hostStartButtonSprite.position.y === positionY &&
            hostStartButtonSprite.text === text &&
            hostStartButtonSprite.opacity === desiredOpacity &&
            hostStartButtonSprite.fontColor === color &&
            !!hostStartButtonSprite.isInteractive) {
            return;
        }
        spriteManager.updateSprite("hostStartButton", {
            positionX: positionX,
            positionY: positionY,
            text: text,
            opacity: text ? 1 : 0,
            isInteractive: true,
            fontColor: color,
        });
    }
    hideHostStartButton() {
        if (!playerManager.isHost)
            return;
        const hostStartButtonSprite = spriteManager.getSprite("hostStartButton");
        if (!hostStartButtonSprite)
            return;
        if (!hostStartButtonSprite.text &&
            hostStartButtonSprite.opacity === 0 &&
            !hostStartButtonSprite.isInteractive) {
            return;
        }
        spriteManager.updateSprite("hostStartButton", {
            text: "",
            opacity: 0,
            isInteractive: false,
        });
    }
    setRoundLayoutToLobby() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("centerTitleText", {
            positionX: this.lobbyTitleX,
            containerWidth: this.lobbyTextWidth,
        });
        spriteManager.updateSprite("centerSubtitleText", {
            positionX: this.lobbyTitleX,
            containerWidth: this.lobbyTextWidth,
        });
    }
    setRoundLayoutDefault() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("centerTitleText", {
            positionX: this.panelX + this.getCenterContentPadding(),
            containerWidth: this.getCenterContentWidth(),
        });
        spriteManager.updateSprite("centerSubtitleText", {
            positionX: this.panelX + this.getCenterContentPadding(),
            containerWidth: this.getCenterContentWidth(),
        });
        spriteManager.updateSprite("centerFooterText", {
            positionX: this.panelX + this.getCenterContentPadding(),
            containerWidth: this.getCenterContentWidth(),
        });
    }
    setCenterRoundText(roundNumber) {
        if (!playerManager.isHost)
            return;
        const roundText = "Round " + roundNumber.toString();
        const contentWidth = this.getCenterContentWidth();
        spriteManager.updateSprite("centerTitleText", {
            text: roundText,
            positionX: this.panelX + this.getCenterContentPadding(),
            positionY: this.getRoundTextY(),
            containerWidth: contentWidth,
            fontSize: this.getFittedFontSize(roundText, contentWidth, 24, 18),
            fontWeight: "bold",
            fontColor: this.roundTextColor,
            align: "center",
            strokeThickness: 3.5,
            strokeColor: "#000000",
            opacity: 1,
        });
    }
    setCenterPhasePromptText(text) {
        if (!playerManager.isHost)
            return;
        const displayText = this.getCenterPhasePromptDisplayText(text);
        const contentWidth = this.getCenterContentWidth();
        spriteManager.updateSprite("centerSubtitleText", {
            text: displayText,
            positionX: this.panelX + this.getCenterContentPadding(),
            positionY: this.getPhasePromptY(),
            containerWidth: contentWidth,
            fontSize: this.getFittedFontSize(displayText, contentWidth, 34, 18),
            fontWeight: "bold",
            fontColor: this.panelTextColor,
            align: "center",
            strokeThickness: 3.5,
            strokeColor: "#000000",
            opacity: displayText ? 1 : 0,
        });
    }
    getCenterPhasePromptDisplayText(text) {
        if (text === "Memorize the Fruits!") {
            return "Memorize the\nFruits!";
        }
        if (text === "Stand on this fruit!") {
            return "Stand on this\nfruit!";
        }
        return text;
    }
    showCenterFruitSprite(fruitName) {
        if (!playerManager.isHost)
            return false;
        if (!fruitName)
            return false;
        const desiredSpriteId = this.getCenterFruitSpriteId(fruitName);
        const centerFruitSprite = spriteManager.getSprite(desiredSpriteId);
        if (centerFruitSprite &&
            this.centerFruitSpriteId === desiredSpriteId) {
            this.positionCenterFruitSprite(desiredSpriteId, 1);
            return true;
        }
        this.removeCenterFruitSprite();
        if (this.fruitSpriteAvailability[fruitName] === false) {
            return false;
        }
        if (centerFruitSprite) {
            this.centerFruitSpriteName = fruitName;
            this.centerFruitSpriteId = desiredSpriteId;
            this.positionCenterFruitSprite(desiredSpriteId, 1);
            return true;
        }
        let fruitSpriteId;
        fruitSpriteId = fruitName;
        try {
            spriteManager.addSprite(fruitSpriteId, {
                uniqueId: desiredSpriteId,
                positionX: this.getCenterFruitSpriteX(),
                positionY: this.getCenterFruitSpriteY(),
                scaleX: this.centerFruitSpriteScale,
                scaleY: this.centerFruitSpriteScale,
                displayLayer: "TOP",
                topAdjust: this.getCenterFruitSpriteTopAdjust(),
                bottomAdjust: "NONE",
                opacity: 1,
                applyPhysics: false,
                checkCollisions: false,
            });
            this.centerFruitSpriteName = fruitName;
            this.centerFruitSpriteId = desiredSpriteId;
            this.fruitSpriteAvailability[fruitName] = true;
            return true;
        }
        catch (error) {
            this.centerFruitSpriteName = "";
            this.centerFruitSpriteId = "";
            this.fruitSpriteAvailability[fruitName] = false;
            return false;
        }
    }
    hideCenterFruitSprite() {
        if (!playerManager.isHost)
            return;
        const centerFruitSpriteId = this.getVisibleCenterFruitSpriteId();
        if (!centerFruitSpriteId)
            return;
        if (!spriteManager.getSprite(centerFruitSpriteId))
            return;
        spriteManager.updateSprite(centerFruitSpriteId, {
            opacity: 0,
        });
    }
    removeCenterFruitSprite() {
        if (!playerManager.isHost)
            return;
        const centerFruitSpriteId = this.getVisibleCenterFruitSpriteId();
        if (centerFruitSpriteId && spriteManager.getSprite(centerFruitSpriteId)) {
            spriteManager.removeSprite(centerFruitSpriteId);
        }
        if (centerFruitSpriteId !== "centerFruitSprite" &&
            spriteManager.getSprite("centerFruitSprite")) {
            spriteManager.removeSprite("centerFruitSprite");
        }
        this.centerFruitSpriteName = "";
        this.centerFruitSpriteId = "";
    }
    getCenterFruitSpriteX() {
        return this.panelX +
            Math.floor((this.panelSize - this.getCenterFruitRenderedSize()) / 2);
    }
    getCenterFruitSpriteY() {
        return this.getCenterFruitVisualCenterY() -
            Math.floor(this.getCenterFruitRenderedSize() / 2);
    }
    getCenterFruitVisualCenterY() {
        return this.panelY + 166;
    }
    positionCenterFruitSprite(spriteId, opacity) {
        const centerFruitSprite = spriteManager.getSprite(spriteId);
        if (!centerFruitSprite)
            return;
        const desiredPositionX = this.getCenterFruitSpriteX();
        const desiredPositionY = this.getCenterFruitSpriteY();
        spriteManager.updateSprite(spriteId, {
            positionX: desiredPositionX,
            positionY: desiredPositionY,
            scaleX: this.centerFruitSpriteScale,
            scaleY: this.centerFruitSpriteScale,
            displayLayer: "TOP",
            topAdjust: this.getCenterFruitSpriteTopAdjust(),
            bottomAdjust: "NONE",
            opacity: opacity,
        });
    }
    getCenterFruitRenderedSize() {
        return Math.floor(this.centerFruitBaseSpriteSize * this.centerFruitSpriteScale);
    }
    getCenterFruitSpriteTopAdjust() {
        return 90;
    }
    getCenterFruitSpriteId(fruitName) {
        // Reusing one synced uniqueId across different fruit assets can leave clients on a stale sprite.
        return "centerFruitSprite_" + fruitName;
    }
    getVisibleCenterFruitSpriteId() {
        if (this.centerFruitSpriteId)
            return this.centerFruitSpriteId;
        if (spriteManager.getSprite("centerFruitSprite"))
            return "centerFruitSprite";
        return "";
    }
    rebuildBarrierSprites() {
        if (!playerManager.isHost)
            return;
        const barrierIds = this.getBarrierSpriteIds();
        for (let i = 0; i < barrierIds.length; i++) {
            if (spriteManager.getSprite(barrierIds[i])) {
                spriteManager.removeSprite(barrierIds[i]);
            }
        }
        const barrierDefinitions = this.getBarrierDefinitions();
        for (let i = 0; i < barrierDefinitions.length; i++) {
            this.addBarrierSprite(barrierDefinitions[i]);
        }
    }
    addBarrierSprite(barrier) {
        if (spriteManager.getSprite(barrier.uniqueId))
            return;
        spriteManager.addSprite("baseRect", {
            uniqueId: barrier.uniqueId,
            positionX: barrier.positionX,
            positionY: barrier.positionY,
            width: barrier.width,
            height: barrier.height,
            fill: "#000000",
            opacity: 0.35,
            displayLayer: "TOP",
            topAdjust: 60,
            checkCollisions: true,
            isImpassable: true,
        });
    }
    syncTopArenaBarrier(phase, roundNumber) {
        if (!playerManager.isHost)
            return;
        const shouldRemoveTopBarrier = roundNumber === 1 &&
            (phase === "MEMORIZE" || phase === "MOVE");
        if (shouldRemoveTopBarrier) {
            if (spriteManager.getSprite("arenaTopBarrier")) {
                spriteManager.removeSprite("arenaTopBarrier");
            }
            return;
        }
        if (spriteManager.getSprite("arenaTopBarrier"))
            return;
        const barrierDefinitions = this.getBarrierDefinitions();
        for (let i = 0; i < barrierDefinitions.length; i++) {
            if (barrierDefinitions[i].uniqueId === "arenaTopBarrier") {
                this.addBarrierSprite(barrierDefinitions[i]);
                return;
            }
        }
    }
    getBarrierSpriteIds() {
        return [
            "arenaCenterBarrier",
            "arenaTopBarrier",
            "arenaBottomBarrier",
            "arenaLeftBarrier",
            "arenaRightBarrier",
            "playerListBarrier",
        ];
    }
    getBarrierDefinitions() {
        const barrierDefinitions = [];
        const arenaLeft = this.arenaStartX;
        const arenaTop = this.arenaTop;
        const arenaRight = arenaLeft + this.arenaSize;
        const arenaBottom = arenaTop + this.arenaSize;
        const arenaWallThickness = 16;
        const arenaWallInset = 8;
        const arenaWallExpansion = 50;
        const arenaWallLeft = arenaLeft - arenaWallInset - arenaWallExpansion;
        const arenaWallTop = arenaTop - arenaWallInset - arenaWallExpansion;
        const arenaWallSpan = this.arenaSize + arenaWallThickness +
            arenaWallExpansion * 2;
        const centerBarrierInset = 20;
        const leaderboardBarrierInset = 6;
        barrierDefinitions.push({
            uniqueId: "arenaCenterBarrier",
            positionX: this.panelX + centerBarrierInset,
            positionY: this.panelY + centerBarrierInset,
            width: this.panelSize - centerBarrierInset * 2,
            height: this.panelSize - centerBarrierInset * 2,
        });
        barrierDefinitions.push({
            uniqueId: "arenaTopBarrier",
            positionX: arenaWallLeft,
            positionY: arenaWallTop,
            width: arenaWallSpan,
            height: arenaWallThickness,
        });
        barrierDefinitions.push({
            uniqueId: "arenaBottomBarrier",
            positionX: arenaWallLeft,
            positionY: arenaWallTop + arenaWallSpan - arenaWallThickness,
            width: arenaWallSpan,
            height: arenaWallThickness,
        });
        barrierDefinitions.push({
            uniqueId: "arenaLeftBarrier",
            positionX: arenaWallLeft,
            positionY: arenaWallTop,
            width: arenaWallThickness,
            height: arenaWallSpan,
        });
        barrierDefinitions.push({
            uniqueId: "arenaRightBarrier",
            positionX: arenaWallLeft + arenaWallSpan - arenaWallThickness,
            positionY: arenaWallTop,
            width: arenaWallThickness,
            height: arenaWallSpan,
        });
        barrierDefinitions.push({
            uniqueId: "playerListBarrier",
            positionX: this.playerListPanelX + leaderboardBarrierInset,
            positionY: this.playerListPanelY + leaderboardBarrierInset,
            width: this.playerListPanelWidth - leaderboardBarrierInset * 2,
            height: this.playerListPanelHeight - leaderboardBarrierInset * 2,
        });
        return barrierDefinitions;
    }
    showWinner(playerName) {
        if (!playerManager.isHost)
            return;
        this.showPlayerListArea();
        this.showOutZone();
        this.syncTopArenaBarrier("WINNER", stateManager.getVariable("roundNumber"));
        this.hideCenterFruitSprite();
        spriteManager.updateSprite("winnerText", {
            text: playerName + " wins!",
            opacity: 1,
            fontColor: "#1e1e1e",
        });
        spriteManager.updateSprite("winnerCountdownText", {
            text: "",
            opacity: 1,
            fontColor: "#1e1e1e",
        });
    }
    setWinnerCountdown(text) {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("winnerCountdownText", {
            text: text,
            opacity: text ? 1 : 0,
        });
    }
    hideWinner() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("winnerText", { text: "", opacity: 0 });
        spriteManager.updateSprite("winnerCountdownText", { text: "", opacity: 0 });
    }
    showOutZone() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("outZoneRect", {
            positionX: this.outZoneX,
            positionY: this.outZoneY,
            width: this.outZoneWidth,
            height: this.outZoneHeight,
            opacity: 0.9,
        });
    }
    hideOutZone() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("outZoneRect", { opacity: 0 });
    }
    showPlayerListArea() {
        if (!playerManager.isHost)
            return;
        spriteManager.updateSprite("playerListPanel", {
            positionX: this.playerListPanelX,
            positionY: this.playerListPanelY,
            width: this.playerListPanelWidth,
            height: this.playerListPanelHeight,
            opacity: 0.92,
        });
        let playerListTitleOptions;
        playerListTitleOptions = {
            positionX: this.sidebarX + this.sidebarPadding,
            positionY: this.playerListTitleY,
            containerWidth: this.sidebarWidth - this.sidebarPadding * 2,
            text: "Players",
            align: "center",
            fontSize: 30,
            fontWeight: "bold",
            fontColor: "#ffffff",
            opacity: 1,
            strokeThickness: 3,
        };
        spriteManager.updateSprite("playerListTitleText", playerListTitleOptions);
    }
    refreshPlayerList(phase) {
        if (!playerManager.isHost)
            return;
        this.showPlayerListArea();
        const playerLifeMap = stateManager.getVariable("playerLifeMap");
        const connectedPlayerIds = playerManager.getPlayerIds();
        const orderedPlayerIds = [];
        const outPlayerIds = [];
        const isWaitingPhase = phase === "WAITING";
        for (let i = 0; i < connectedPlayerIds.length; i++) {
            const playerId = connectedPlayerIds[i];
            if (isWaitingPhase || playerLifeMap[playerId.toString()] !== false) {
                orderedPlayerIds.push(playerId);
                continue;
            }
            outPlayerIds.push(playerId);
        }
        for (let i = 0; i < outPlayerIds.length; i++) {
            orderedPlayerIds.push(outPlayerIds[i]);
        }
        const entryCount = orderedPlayerIds.length;
        const contentTop = this.playerListPanelY + 95;
        const contentHeight = this.playerListPanelHeight - 125;
        const entryTextWidth = this.sidebarWidth - this.sidebarPadding * 2 - 12;
        const entrySpacing = entryCount > 0
            ? Math.max(24, Math.min(42, Math.floor(contentHeight / entryCount)))
            : 0;
        const startY = contentTop;
        for (let i = 0; i < entryCount; i++) {
            const playerId = orderedPlayerIds[i];
            const isOut = !isWaitingPhase && playerLifeMap[playerId.toString()] === false;
            const entryId = this.ensurePlayerListEntrySprite(i);
            const playerName = this.getPlayerName(playerId);
            const truncatedPlayerName = this.truncateTextToFit(playerName, entryTextWidth, 27);
            let playerListEntryOptions;
            playerListEntryOptions = {
                positionX: this.sidebarX + this.sidebarPadding,
                positionY: startY + i * entrySpacing,
                containerWidth: this.sidebarWidth - this.sidebarPadding * 2,
                text: truncatedPlayerName,
                align: "left",
                fontSize: 27,
                fontWeight: "bold",
                fontColor: isOut ? "#b21e35" : "#ffffff",
                opacity: 1,
                strokeThickness: 3,
            };
            spriteManager.updateSprite(entryId, playerListEntryOptions);
        }
        for (let i = entryCount; i < this.playerListEntryIds.length; i++) {
            spriteManager.updateSprite(this.playerListEntryIds[i], {
                text: "",
                opacity: 0,
            });
        }
    }
    ensurePlayerListEntrySprite(index) {
        const entryId = "playerListEntryText_" + index.toString();
        if (!spriteManager.getSprite(entryId)) {
            let playerListEntryAddOptions;
            playerListEntryAddOptions = {
                uniqueId: entryId,
                positionX: this.sidebarX + this.sidebarPadding,
                positionY: this.playerListPanelY,
                containerWidth: this.sidebarWidth - this.sidebarPadding * 2,
                align: "left",
                text: "",
                fontSize: 27,
                fontWeight: "bold",
                fontColor: "#ffffff",
                opacity: 0,
                strokeThickness: 3,
            };
            spriteManager.addSprite("basicText", playerListEntryAddOptions);
        }
        if (index < this.playerListEntryIds.length) {
            this.playerListEntryIds[index] = entryId;
        }
        else {
            this.playerListEntryIds.push(entryId);
        }
        return entryId;
    }
    getCenterContentPadding() {
        return 16;
    }
    getCenterContentWidth() {
        return this.panelSize - this.getCenterContentPadding() * 2;
    }
    getRoundTextY() {
        return this.panelY + 12;
    }
    getPhasePromptY() {
        return this.panelY + 42;
    }
    getRoundTimerY() {
        return this.panelY + 262;
    }
    getLobbyTitleY() {
        return this.panelY + 8;
    }
    getLobbySubtitleY() {
        return this.panelY + 214;
    }
    getLobbyButtonY() {
        return this.panelY + 261;
    }
    getFittedFontSize(text, maxWidth, preferredFontSize, minimumFontSize) {
        if (!text)
            return preferredFontSize;
        let fontSize = preferredFontSize;
        while (fontSize > minimumFontSize &&
            this.getTextBlockWidth(text, fontSize) > maxWidth) {
            fontSize -= 1;
        }
        return fontSize;
    }
    getTextBlockWidth(text, fontSize) {
        if (!text)
            return 0;
        const lines = text.split("\n");
        let widestLine = 0;
        for (let i = 0; i < lines.length; i++) {
            widestLine = Math.max(widestLine, this.estimateTextWidth(lines[i], fontSize));
        }
        return widestLine;
    }
    getPlayerName(playerId) {
        const playerDetails = playerManager.getPlayerDetails(playerId);
        if (playerDetails && playerDetails.username) {
            return playerDetails.username;
        }
        return "Player " + playerId.toString();
    }
    estimateTextWidth(text, fontSize) {
        if (!text)
            return 0;
        let emojiCount = 0;
        let regularCharCount = 0;
        for (let i = 0; i < text.length; i++) {
            const code = text.charCodeAt(i);
            if (code >= 0xd800 && code <= 0xdbff) {
                emojiCount += 1;
                i += 1;
            }
            else if (code >= 0x2600 && code <= 0x27bf) {
                emojiCount += 1;
            }
            else {
                regularCharCount += 1;
            }
        }
        const charWidth = Math.max(8, fontSize * 0.6);
        const emojiWidth = charWidth * 2.6;
        const baseWidth = regularCharCount * charWidth + emojiCount * emojiWidth;
        return baseWidth * 1.12;
    }
    truncateTextToFit(text, maxWidth, fontSize) {
        if (!text)
            return "";
        if (this.estimateTextWidth(text, fontSize) <= maxWidth) {
            return text;
        }
        const ellipsis = "...";
        const ellipsisWidth = this.estimateTextWidth(ellipsis, fontSize);
        if (ellipsisWidth >= maxWidth) {
            return ellipsis;
        }
        let truncatedText = text;
        while (truncatedText.length > 0) {
            truncatedText = this.removeLastDisplayChar(truncatedText);
            if (!truncatedText)
                break;
            if (this.estimateTextWidth(truncatedText + ellipsis, fontSize) <= maxWidth) {
                return truncatedText + ellipsis;
            }
        }
        return ellipsis;
    }
    removeLastDisplayChar(text) {
        if (!text)
            return "";
        const lastIndex = text.length - 1;
        if (lastIndex <= 0)
            return "";
        const lastCode = text.charCodeAt(lastIndex);
        if (lastCode >= 0xdc00 && lastCode <= 0xdfff) {
            const previousIndex = lastIndex - 1;
            if (previousIndex >= 0) {
                const previousCode = text.charCodeAt(previousIndex);
                if (previousCode >= 0xd800 && previousCode <= 0xdbff) {
                    return text.slice(0, previousIndex);
                }
            }
        }
        return text.slice(0, lastIndex);
    }
    toDisplayFruitName(fruitName) {
        if (!fruitName)
            return "";
        return fruitName.charAt(0).toUpperCase() + fruitName.slice(1);
    }
}
