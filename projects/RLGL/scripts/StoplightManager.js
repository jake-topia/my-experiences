"use strict";
class StoplightManager extends SystemScript {
    stoplightSprite;
    controllerStatusSprite;
    activeLightTimer;
    inactivityTimer;
    lightToggleLockTimer;
    dangerZoneLockTimer;
    lightButtonVisualTimer;
    dangerButtonVisualTimer;
    dangerZoneTeleportTimer;
    dangerZoneResetTimer;
    dangerZoneAnimation;
    currentLight;
    lightTimer;
    isActive;
    redMinDuration;
    redMaxDuration;
    yellowLightDuration;
    greenMinDuration;
    greenMaxDuration;
    quickLightDuration;
    quickLightChance;
    lightControlMode;
    currentControllerId;
    localPlayerId;
    userModeInactivityDuration;
    lightToggleCooldownDuration;
    buttonPressedDuration;
    dangerZoneBaseOpacity;
    dangerZoneActiveOpacity;
    dangerZoneTriggerDelay;
    dangerZoneFlashDuration;
    dangerZoneFadeDuration;
    dangerZoneResetDurationSeconds;
    safeZoneY;
    worldWidth;
    light1X;
    light1Y;
    light2X;
    light2Y;
    isLightToggleLocked;
    isDangerZoneLocked;
    isDangerZoneAbilityAvailable;
    isLocalLightButtonLocked;
    isLocalDangerButtonLocked;
    lightButtonOffsetX;
    dangerButtonOffsetX;
    controlButtonsCenterX;
    controllerTeleportX;
    controllerTeleportY;
    controlButtonsOffsetY;
    controlLabelsOffsetY;
    controllerStatusX;
    controllerStatusY;
    stoplightDisplayX;
    stoplightDisplayY;
    leaderZoneId;
    leaderZoneX;
    leaderZoneY;
    leaderZoneWidth;
    leaderZoneHeight;
    leaderZoneOpacity;
    controllerTrapTopId;
    controllerTrapBottomId;
    controllerTrapLeftId;
    controllerTrapRightId;
    controllerTrapOffsetX;
    controllerTrapOffsetY;
    controllerTrapWidth;
    controllerTrapHeight;
    controllerTrapWallThickness;
    controllerTrapOpacity;
    dangerZoneLeftId;
    dangerZoneLeftY;
    dangerZoneRightId;
    dangerZoneRightY;
    lightButtonBorderSprite;
    lightButtonCenterSprite;
    lightButtonLabelSprite;
    dangerButtonBorderSprite;
    dangerButtonCenterSprite;
    dangerButtonLabelSprite;
    activeLightTimerToken;
    inactivityTimerToken;
    lightToggleLockTimerToken;
    dangerZoneLockTimerToken;
    lightButtonVisualTimerToken;
    dangerButtonVisualTimerToken;
    dangerZoneTeleportTimerToken;
    dangerZoneResetTimerToken;
    dangerZoneAnimationToken;
    userInactivityDeadlineMs;
    dangerZoneResetGreenTimeRemainingMs;
    lastDangerZoneGreenTimestampMs;
    areDangerZonesActive;
    constructor() {
        if (!playerManager.isHost)
            return;
        this.stoplightSprite = null;
        this.controllerStatusSprite = null;
        this.activeLightTimer = null;
        this.inactivityTimer = null;
        this.lightToggleLockTimer = null;
        this.dangerZoneLockTimer = null;
        this.lightButtonVisualTimer = null;
        this.dangerButtonVisualTimer = null;
        this.dangerZoneTeleportTimer = null;
        this.dangerZoneResetTimer = null;
        this.dangerZoneAnimation = null;
        this.currentLight = "RED";
        this.lightTimer = 0;
        this.isActive = false;
        this.redMinDuration = 2;
        this.redMaxDuration = 4;
        this.yellowLightDuration = 1.4;
        this.greenMinDuration = 1;
        this.greenMaxDuration = 4;
        this.quickLightDuration = 0.5;
        this.quickLightChance = 0.2;
        this.lightControlMode = "auto";
        this.currentControllerId = 0;
        this.localPlayerId = 0;
        this.userModeInactivityDuration = 12500; //12.5s
        this.lightToggleCooldownDuration = 750;
        this.buttonPressedDuration = 1000;
        this.dangerZoneBaseOpacity = 0.4;
        this.dangerZoneActiveOpacity = 1;
        this.dangerZoneTriggerDelay = 1300;
        this.dangerZoneFlashDuration = 500;
        this.dangerZoneFadeDuration = 1000;
        this.dangerZoneResetDurationSeconds = 25; // 25 seconmds of green light time
        this.safeZoneY = 1300;
        this.worldWidth = 1500;
        this.light1X = 900;
        this.light1Y = 900;
        this.light2X = 900;
        this.light2Y = 200;
        this.isLightToggleLocked = false;
        this.isDangerZoneLocked = false;
        this.isDangerZoneAbilityAvailable = true;
        this.isLocalLightButtonLocked = false;
        this.isLocalDangerButtonLocked = false;
        this.lightButtonOffsetX = 165;
        this.dangerButtonOffsetX = -185;
        this.controlButtonsCenterX = 750;
        this.controllerTeleportX = 750;
        this.controllerTeleportY = 80;
        this.controlButtonsOffsetY = 110;
        this.controlLabelsOffsetY = -30;
        this.controllerStatusX = 300;
        this.controllerStatusY = 160;
        this.stoplightDisplayX = 300;
        this.stoplightDisplayY = 100;
        this.leaderZoneId = "leaderZone";
        this.leaderZoneX = 500;
        this.leaderZoneY = 20;
        this.leaderZoneWidth = 500;
        this.leaderZoneHeight = 170;
        this.leaderZoneOpacity = 0.4;
        this.controllerTrapTopId = "controllerTrapTop";
        this.controllerTrapBottomId = "controllerTrapBottom";
        this.controllerTrapLeftId = "controllerTrapLeft";
        this.controllerTrapRightId = "controllerTrapRight";
        this.controllerTrapOffsetX = -30;
        this.controllerTrapOffsetY = -20;
        this.controllerTrapWidth = 50;
        this.controllerTrapHeight = 70;
        this.controllerTrapWallThickness = 10;
        this.controllerTrapOpacity = 0;
        this.dangerZoneLeftId = "dangerZoneLeft";
        this.dangerZoneLeftY = 350;
        this.dangerZoneRightId = "dangerZoneRight";
        this.dangerZoneRightY = 350;
        this.lightButtonBorderSprite = null;
        this.lightButtonCenterSprite = null;
        this.lightButtonLabelSprite = null;
        this.dangerButtonBorderSprite = null;
        this.dangerButtonCenterSprite = null;
        this.dangerButtonLabelSprite = null;
        this.activeLightTimerToken = 0;
        this.inactivityTimerToken = 0;
        this.lightToggleLockTimerToken = 0;
        this.dangerZoneLockTimerToken = 0;
        this.lightButtonVisualTimerToken = 0;
        this.dangerButtonVisualTimerToken = 0;
        this.dangerZoneTeleportTimerToken = 0;
        this.dangerZoneResetTimerToken = 0;
        this.dangerZoneAnimationToken = 0;
        this.userInactivityDeadlineMs = 0;
        this.dangerZoneResetGreenTimeRemainingMs = 0;
        this.lastDangerZoneGreenTimestampMs = 0;
        this.areDangerZonesActive = false;
    }
    onInit() {
        if (!playerManager.isHost)
            return;
        this.refreshLightControlModeFromConfig();
    }
    onHostStart() {
        this.localPlayerId = playerManager.getMyPlayerId();
        this.refreshLightControlModeFromConfig();
    }
    refreshLightControlModeFromConfig() {
        try {
            const configuredLightControlMode = stateManager.getVariable("lightControlMode");
            this.lightControlMode = configuredLightControlMode === "user" ? "user" : "auto";
        }
        catch (error) {
            this.lightControlMode = "auto";
        }
    }
    setControllerSyncVariable(controllerId) {
        if (!playerManager.isHost)
            return;
        stateManager.setVariable("controllerSyncVar", controllerId);
    }
    getControllerSyncVariable() {
        let syncedControllerValue;
        syncedControllerValue = stateManager.getVariable("controllerSyncVar");
        // console.log("ttypeof controllerSyncVar: ", typeof syncedControllerValue);
        return syncedControllerValue;
    }
    setCanUseAbilityVariable(canUseAbility) {
        if (!playerManager.isHost)
            return;
        try {
            stateManager.setVariable("canUseAbility", canUseAbility);
        }
        catch (error) { }
    }
    getCanUseAbilityVariable() {
        if (!playerManager.isHost)
            return;
        let canUseAbilityValue;
        canUseAbilityValue = stateManager.getVariable("canUseAbility");
        this.isDangerZoneAbilityAvailable = canUseAbilityValue;
        return canUseAbilityValue;
    }
    syncCanUseAbilityState() {
        if (!playerManager.isHost)
            return;
        this.setCanUseAbilityVariable(this.isDangerZoneAbilityAvailable);
    }
    startLightControl(lightControlMode = "auto", preferredControllerId = 0) {
        if (!playerManager.isHost)
            return;
        this.stopStoplight();
        this.lightControlMode = lightControlMode === "user" ? "user" : "auto";
        if (this.lightControlMode === "user") {
            this.startUserControlledLightControl(preferredControllerId);
            return;
        }
        this.startAutoLightControl();
    }
    startAutoLightControl() {
        this.clearUserModeTimers();
        this.currentControllerId = 0;
        this.isActive = true;
        this.currentLight = "RED";
        if (!playerManager.isHost)
            return;
        this.ensureStoplightDisplay();
        this.removeUserModeSharedSprites();
        this.setControllerSyncVariable(0);
        this.clearDangerZonePlayerList();
        this.lightTimer = this.getNextRedDuration();
        this.updateTrafficLightVisibility();
        this.updateStoplightDisplay();
        eventManager.emit("lightTurnedRed", {});
        this.scheduleCurrentLightTimer();
    }
    startUserControlledLightControl(preferredControllerId = 0) {
        if (!playerManager.isHost)
            return;
        this.clearUserModeTimers();
        this.currentLight = "RED";
        this.isActive = true;
        this.ensureLocalControllerUiSprites();
        this.ensureStoplightDisplay();
        this.ensureControllerStatusSprite();
        this.ensureDangerZoneSprites();
        this.clearDangerZonePlayerList();
        if (preferredControllerId && this.isConnectedPlayer(preferredControllerId)) {
            this.assignSpecificController(preferredControllerId);
        }
        else {
            this.assignInitialController();
        }
        this.updateTrafficLightVisibility();
        this.updateStoplightDisplay();
        eventManager.emit("lightTurnedRed", {});
        this.resetUserInactivityTimer();
    }
    ensureStoplightDisplay() {
        if (!playerManager.isHost)
            return;
        if (this.stoplightSprite) {
            spriteManager.updateSprite(this.stoplightSprite.uniqueId, {
                positionX: this.stoplightDisplayX,
                positionY: this.stoplightDisplayY,
                text: "",
                opacity: 0,
            });
            return;
        }
        this.stoplightSprite = spriteManager.addSprite("countdownText", {
            uniqueId: "stoplightDisplay",
            positionX: this.stoplightDisplayX,
            positionY: this.stoplightDisplayY,
            text: "",
            fontSize: 60,
            align: "center",
            opacity: 0,
        });
    }
    ensureControllerStatusSprite() {
        if (!playerManager.isHost)
            return;
        if (this.controllerStatusSprite) {
            spriteManager.updateSprite(this.controllerStatusSprite.uniqueId, {
                positionX: 0,
                positionY: this.controllerStatusY,
                strokeColor: "#000000",
                strokeThickness: 6,
            });
        }
        else {
            this.controllerStatusSprite = spriteManager.addSprite("countdownText", {
                uniqueId: "controllerStatus",
                positionX: 0,
                positionY: this.controllerStatusY,
                text: "",
                fontSize: 28,
                align: "center",
                strokeColor: "#000000",
                strokeThickness: 6,
            });
        }
    }
    ensureLeaderZoneSprite() {
        if (!playerManager.isHost)
            return;
        const leaderZoneSprite = spriteManager.getSprite(this.leaderZoneId);
        if (leaderZoneSprite) {
            spriteManager.updateSprite(this.leaderZoneId, {
                positionX: this.leaderZoneX,
                positionY: this.leaderZoneY,
                width: this.leaderZoneWidth,
                height: this.leaderZoneHeight,
                opacity: this.leaderZoneOpacity,
                checkCollisions: false,
            });
            return;
        }
        spriteManager.addSprite("leaderZone", {
            uniqueId: this.leaderZoneId,
            positionX: this.leaderZoneX,
            positionY: this.leaderZoneY,
            width: this.leaderZoneWidth,
            height: this.leaderZoneHeight,
            opacity: this.leaderZoneOpacity,
            checkCollisions: false,
        });
    }
    ensureControllerTrapWallSprite(spriteId, positionX, positionY, width, height) {
        if (!playerManager.isHost)
            return;
        const trapSprite = spriteManager.getSprite(spriteId);
        const trapSpriteOptions = {
            positionX: positionX,
            positionY: positionY,
            width: width,
            height: height,
            opacity: this.controllerTrapOpacity,
            checkCollisions: true,
            isImpassable: true,
            // isPlayerControlled: true,
        };
        if (trapSprite) {
            spriteManager.updateSprite(spriteId, trapSpriteOptions);
            return;
        }
        spriteManager.addSprite("baseRect", {
            uniqueId: spriteId,
            positionX: positionX,
            positionY: positionY,
            width: width,
            height: height,
            opacity: this.controllerTrapOpacity,
            checkCollisions: true,
            isImpassable: true,
            // isPlayerControlled: true,
        });
    }
    removeControllerTrapSprites() {
        if (!playerManager.isHost)
            return;
        const trapSpriteIds = [
            this.controllerTrapTopId,
            this.controllerTrapBottomId,
            this.controllerTrapLeftId,
            this.controllerTrapRightId,
        ];
        for (let i = 0; i < trapSpriteIds.length; i++) {
            if (spriteManager.getSprite(trapSpriteIds[i])) {
                spriteManager.removeSprite(trapSpriteIds[i]);
            }
        }
    }
    ensureControllerTrapSprites() {
        if (!playerManager.isHost)
            return;
        if (!this.currentControllerId) {
            this.removeControllerTrapSprites();
            return;
        }
        const trapX = this.controllerTeleportX + this.controllerTrapOffsetX;
        const trapY = this.controllerTeleportY + this.controllerTrapOffsetY;
        const trapWidth = this.controllerTrapWidth;
        const trapHeight = this.controllerTrapHeight;
        const wallThickness = this.controllerTrapWallThickness;
        this.ensureControllerTrapWallSprite(this.controllerTrapTopId, trapX, trapY, trapWidth, wallThickness);
        this.ensureControllerTrapWallSprite(this.controllerTrapBottomId, trapX, trapY + trapHeight - wallThickness, trapWidth, wallThickness);
        this.ensureControllerTrapWallSprite(this.controllerTrapLeftId, trapX, trapY, wallThickness, trapHeight);
        this.ensureControllerTrapWallSprite(this.controllerTrapRightId, trapX + trapWidth - wallThickness, trapY, wallThickness, trapHeight);
    }
    isDangerZoneSpriteId(spriteId) {
        return spriteId === this.dangerZoneLeftId || spriteId === this.dangerZoneRightId;
    }
    parsePlayerIdValue(rawPlayerId) {
        if (typeof rawPlayerId === "number") {
            if (!isNaN(rawPlayerId))
                return rawPlayerId;
            return 0;
        }
        if (typeof rawPlayerId === "string") {
            const parsedPlayerId = parseInt(rawPlayerId, 10);
            if (!isNaN(parsedPlayerId))
                return parsedPlayerId;
        }
        return 0;
    }
    getDangerZonePlayerMap() {
        let trackedPlayers;
        trackedPlayers = stateManager.getVariable("dangerZonePlayerMap");
        if (!trackedPlayers)
            return {};
        return trackedPlayers;
    }
    describeDangerZonePlayerMap() {
        const trackedPlayerMap = this.getDangerZonePlayerMap();
        const mapEntries = [];
        for (const playerKey in trackedPlayerMap) {
            mapEntries.push(playerKey + ":" + trackedPlayerMap[playerKey]);
        }
        return "{" + mapEntries.join(", ") + "}";
    }
    setDangerZonePlayerMap(playerMap) {
        if (!playerManager.isHost)
            return;
        stateManager.setVariable("dangerZonePlayerMap", playerMap);
    }
    clearDangerZonePlayerList() {
        this.setDangerZonePlayerMap({});
    }
    addDangerZonePlayer(playerId) {
        if (!playerManager.isHost)
            return;
        if (!playerId)
            return;
        const playerMap = this.getDangerZonePlayerMap();
        playerMap[playerId.toString()] = Math.max(1, (playerMap[playerId.toString()] ?? 0) + 1);
        this.setDangerZonePlayerMap(playerMap);
    }
    removeDangerZonePlayer(playerId) {
        if (!playerManager.isHost)
            return;
        if (!playerId)
            return;
        const playerMap = this.getDangerZonePlayerMap();
        playerMap[playerId.toString()] = Math.max(0, (playerMap[playerId.toString()] ?? 0) - 1);
        this.setDangerZonePlayerMap(playerMap);
    }
    getTrackedDangerZonePlayerIds() {
        const trackedPlayerIds = [];
        const trackedPlayerMap = this.getDangerZonePlayerMap();
        const currentPlayerIds = playerManager.getPlayerIds();
        for (let i = 0; i < currentPlayerIds.length; i++) {
            const playerId = currentPlayerIds[i];
            if ((trackedPlayerMap[playerId.toString()] ?? 0) <= 0)
                continue;
            trackedPlayerIds.push(playerId);
        }
        return trackedPlayerIds;
    }
    logDangerZonePlayerMap(context, playerId = 0, zoneId = "") {
        if (!playerManager.isHost)
            return;
        const trackedPlayerIds = this.getTrackedDangerZonePlayerIds();
        console.log("[RLGL][DangerZones] " +
            context +
            " playerId=" +
            playerId.toString() +
            " zoneId=" +
            zoneId +
            " map=" +
            this.describeDangerZonePlayerMap() +
            " trackedIds=" +
            trackedPlayerIds.join(",") +
            " currentLight=" +
            this.currentLight +
            " isActive=" +
            this.isActive.toString());
    }
    decodeDangerZoneCollision({ sprite1, sprite2, }) {
        let playerSprite = null;
        let zoneSprite = null;
        if (sprite1.isPlayerSprite && this.isDangerZoneSpriteId(sprite2.uniqueId)) {
            playerSprite = sprite1;
            zoneSprite = sprite2;
        }
        else if (sprite2.isPlayerSprite && this.isDangerZoneSpriteId(sprite1.uniqueId)) {
            playerSprite = sprite2;
            zoneSprite = sprite1;
        }
        else {
            return null;
        }
        const playerId = this.parsePlayerIdValue(playerSprite.uniqueId);
        if (!playerId)
            return null;
        return {
            playerId: playerId,
            zoneId: zoneSprite.uniqueId,
        };
    }
    ensureDangerZoneSprites() {
        if (!playerManager.isHost)
            return;
        const firstDangerZoneY = 300;
        const secondDangerZoneY = 700;
        const leftGetsFirstY = Math.random() < 0.5;
        this.dangerZoneLeftY = leftGetsFirstY ? firstDangerZoneY : secondDangerZoneY;
        this.dangerZoneRightY = leftGetsFirstY ? secondDangerZoneY : firstDangerZoneY;
        const leftDangerZoneSprite = spriteManager.getSprite(this.dangerZoneLeftId);
        if (leftDangerZoneSprite) {
            spriteManager.updateSprite(this.dangerZoneLeftId, {
                positionX: 0,
                positionY: this.dangerZoneLeftY,
                opacity: this.dangerZoneBaseOpacity,
                checkCollisions: true,
                isImpassable: false,
            });
        }
        else {
            spriteManager.addSprite("redZone", {
                uniqueId: this.dangerZoneLeftId,
                positionX: 0,
                positionY: this.dangerZoneLeftY,
                opacity: this.dangerZoneBaseOpacity,
                checkCollisions: true,
                isImpassable: false,
            });
        }
        const rightDangerZoneSprite = spriteManager.getSprite(this.dangerZoneRightId);
        if (rightDangerZoneSprite) {
            spriteManager.updateSprite(this.dangerZoneRightId, {
                positionX: 1000,
                positionY: this.dangerZoneRightY,
                opacity: this.dangerZoneBaseOpacity,
                checkCollisions: true,
                isImpassable: false,
            });
        }
        else {
            spriteManager.addSprite("redZone", {
                uniqueId: this.dangerZoneRightId,
                positionX: 1000,
                positionY: this.dangerZoneRightY,
                opacity: this.dangerZoneBaseOpacity,
                checkCollisions: true,
                isImpassable: false,
            });
        }
    }
    ensureLocalControllerUiSprites() {
        const lightButtonBorderX = 900;
        const lightButtonCenterX = 905;
        const dangerButtonBorderX = 600;
        const dangerButtonCenterX = 605;
        const lightButtonLabelX = 300;
        const dangerButtonLabelX = 0;
        const labelY = this.controlButtonsOffsetY + this.controlLabelsOffsetY;
        const labelContainerWidth = 1200;
        if (playerManager.isHost && !spriteManager.getSprite("controllerLightButtonBorder")) {
            this.lightButtonBorderSprite = spriteManager.addSprite("lightButtonBorder", {
                uniqueId: "controllerLightButtonBorder",
                positionX: lightButtonBorderX,
                positionY: this.controlButtonsOffsetY,
                opacity: 0,
                isInteractive: false,
            });
        }
        if (playerManager.isHost && !spriteManager.getSprite("controllerLightButtonCenter")) {
            this.lightButtonCenterSprite = spriteManager.addSprite("lightButtonCenter", {
                uniqueId: "controllerLightButtonCenter",
                positionX: lightButtonCenterX,
                positionY: this.controlButtonsOffsetY + 5,
                opacity: 0,
            });
        }
        if (playerManager.isHost && !spriteManager.getSprite("controllerLightButtonLabel")) {
            this.lightButtonLabelSprite = spriteManager.addSprite("countdownText", {
                uniqueId: "controllerLightButtonLabel",
                positionX: lightButtonLabelX,
                positionY: labelY,
                text: "Change Light \uD83D\uDCA1",
                fontSize: 26,
                align: "center",
                containerWidth: labelContainerWidth,
                strokeColor: "#000000",
                strokeThickness: 6,
                opacity: 1,
            });
        }
        if (playerManager.isHost && !spriteManager.getSprite("controllerDangerButtonBorder")) {
            this.dangerButtonBorderSprite = spriteManager.addSprite("lightButtonBorder", {
                uniqueId: "controllerDangerButtonBorder",
                positionX: dangerButtonBorderX,
                positionY: this.controlButtonsOffsetY,
                opacity: 0,
                isInteractive: false,
            });
        }
        if (playerManager.isHost && !spriteManager.getSprite("controllerDangerButtonCenter")) {
            this.dangerButtonCenterSprite = spriteManager.addSprite("lightButtonCenter", {
                uniqueId: "controllerDangerButtonCenter",
                positionX: dangerButtonCenterX,
                positionY: this.controlButtonsOffsetY + 5,
                opacity: 0,
            });
        }
        if (playerManager.isHost && !spriteManager.getSprite("controllerDangerButtonLabel")) {
            this.dangerButtonLabelSprite = spriteManager.addSprite("countdownText", {
                uniqueId: "controllerDangerButtonLabel",
                positionX: dangerButtonLabelX,
                positionY: labelY,
                text: "Activate \uD83D\uDFE5 Zones",
                fontSize: 26,
                align: "center",
                containerWidth: labelContainerWidth,
                strokeColor: "#000000",
                strokeThickness: 6,
                opacity: 0,
            });
        }
        this.lightButtonBorderSprite = spriteManager.getSprite("controllerLightButtonBorder");
        this.lightButtonCenterSprite = spriteManager.getSprite("controllerLightButtonCenter");
        this.lightButtonLabelSprite = spriteManager.getSprite("controllerLightButtonLabel");
        this.dangerButtonBorderSprite = spriteManager.getSprite("controllerDangerButtonBorder");
        this.dangerButtonCenterSprite = spriteManager.getSprite("controllerDangerButtonCenter");
        this.dangerButtonLabelSprite = spriteManager.getSprite("controllerDangerButtonLabel");
        if (playerManager.isHost) {
            this.ensureLeaderZoneSprite();
            this.ensureControllerTrapSprites();
            if (this.lightButtonBorderSprite) {
                spriteManager.updateSprite(this.lightButtonBorderSprite.uniqueId, {
                    positionX: lightButtonBorderX,
                    positionY: this.controlButtonsOffsetY,
                });
            }
            if (this.lightButtonCenterSprite) {
                spriteManager.updateSprite(this.lightButtonCenterSprite.uniqueId, {
                    positionX: lightButtonCenterX,
                    positionY: this.controlButtonsOffsetY + 5,
                });
            }
            if (this.lightButtonLabelSprite) {
                spriteManager.updateSprite(this.lightButtonLabelSprite.uniqueId, {
                    positionX: lightButtonLabelX,
                    positionY: labelY,
                    containerWidth: labelContainerWidth,
                });
            }
            if (this.dangerButtonBorderSprite) {
                spriteManager.updateSprite(this.dangerButtonBorderSprite.uniqueId, {
                    positionX: dangerButtonBorderX,
                    positionY: this.controlButtonsOffsetY,
                });
            }
            if (this.dangerButtonCenterSprite) {
                spriteManager.updateSprite(this.dangerButtonCenterSprite.uniqueId, {
                    positionX: dangerButtonCenterX,
                    positionY: this.controlButtonsOffsetY + 5,
                });
            }
            if (this.dangerButtonLabelSprite) {
                spriteManager.updateSprite(this.dangerButtonLabelSprite.uniqueId, {
                    positionX: dangerButtonLabelX,
                    positionY: labelY,
                    containerWidth: labelContainerWidth,
                });
            }
        }
    }
    updateTrafficLightVisibility() {
        if (!playerManager.isHost)
            return;
        this.hideAllTrafficLights();
        this.addActiveTrafficLightSprites();
    }
    getTrafficLightSpriteIds() {
        return [
            "trafficLight1Red",
            "trafficLight1Yellow",
            "trafficLight1Green",
            "trafficLight2Red",
            "trafficLight2Yellow",
            "trafficLight2Green",
            "trafficLight3Red",
            "trafficLight3Yellow",
            "trafficLight3Green",
            "trafficLight4Red",
            "trafficLight4Yellow",
            "trafficLight4Green",
        ];
    }
    getTrafficLightSpriteAssetId() {
        if (this.currentLight === "RED")
            return "trafficLightRed";
        if (this.currentLight === "YELLOW")
            return "trafficLightYellow";
        if (this.currentLight === "GREEN")
            return "trafficLightGreen";
        return "";
    }
    getTrafficLightUniqueIdSuffix() {
        if (this.currentLight === "RED")
            return "Red";
        if (this.currentLight === "YELLOW")
            return "Yellow";
        if (this.currentLight === "GREEN")
            return "Green";
        return "";
    }
    addTrafficLightSprite(spriteAssetId, uniqueId, positionX, positionY, scaleX = 1, scaleY = 1) {
        if (!playerManager.isHost)
            return;
        const existingSprite = spriteManager.getSprite(uniqueId);
        if (existingSprite) {
            spriteManager.removeSprite(existingSprite.uniqueId);
        }
        spriteManager.addSprite(spriteAssetId, {
            uniqueId: uniqueId,
            positionX: positionX,
            positionY: positionY,
            checkCollisions: false,
            opacity: 1,
            scaleX: scaleX,
            scaleY: scaleY,
        });
    }
    addActiveTrafficLightSprites() {
        if (!playerManager.isHost)
            return;
        const spriteAssetId = this.getTrafficLightSpriteAssetId();
        const uniqueIdSuffix = this.getTrafficLightUniqueIdSuffix();
        if (!spriteAssetId || !uniqueIdSuffix)
            return;
        const mirroredLightX = this.worldWidth - this.light1X;
        this.addTrafficLightSprite(spriteAssetId, "trafficLight1" + uniqueIdSuffix, this.light1X, this.light1Y);
        this.addTrafficLightSprite(spriteAssetId, "trafficLight2" + uniqueIdSuffix, this.light2X, this.light2Y);
        this.addTrafficLightSprite(spriteAssetId, "trafficLight3" + uniqueIdSuffix, mirroredLightX, this.light1Y, -1, 1);
        this.addTrafficLightSprite(spriteAssetId, "trafficLight4" + uniqueIdSuffix, mirroredLightX, this.light2Y, -1, 1);
    }
    hideAllTrafficLights() {
        if (!playerManager.isHost)
            return;
        const spriteIds = this.getTrafficLightSpriteIds();
        for (let i = 0; i < spriteIds.length; i++) {
            const lightSprite = spriteManager.getSprite(spriteIds[i]);
            if (lightSprite) {
                spriteManager.removeSprite(lightSprite.uniqueId);
            }
        }
    }
    updateStoplightDisplay() {
        if (!playerManager.isHost || !this.stoplightSprite)
            return;
        spriteManager.updateSprite(this.stoplightSprite.uniqueId, {
            text: "",
            opacity: 0,
        });
    }
    getRandomDuration(minDuration, maxDuration) {
        return minDuration + (maxDuration - minDuration) * Math.random();
    }
    getNextRedDuration() {
        if (Math.random() < this.quickLightChance)
            return this.quickLightDuration;
        return this.getRandomDuration(this.redMinDuration, this.redMaxDuration);
    }
    getNextGreenDuration() {
        if (Math.random() < this.quickLightChance)
            return this.quickLightDuration;
        return this.getRandomDuration(this.greenMinDuration, this.greenMaxDuration);
    }
    clearActiveLightTimer() {
        this.activeLightTimerToken += 1;
        this.activeLightTimer = null;
    }
    clearTimer(timerRefName) {
        if (timerRefName === "inactivityTimer") {
            this.userInactivityDeadlineMs = 0;
            this.inactivityTimer = null;
            return;
        }
        if (timerRefName === "lightToggleLockTimer") {
            this.lightToggleLockTimerToken += 1;
            this.lightToggleLockTimer = null;
            return;
        }
        if (timerRefName === "dangerZoneLockTimer") {
            this.dangerZoneLockTimerToken += 1;
            this.dangerZoneLockTimer = null;
            return;
        }
        if (timerRefName === "lightButtonVisualTimer") {
            this.lightButtonVisualTimerToken += 1;
            this.lightButtonVisualTimer = null;
            return;
        }
        if (timerRefName === "dangerButtonVisualTimer") {
            this.dangerButtonVisualTimerToken += 1;
            this.dangerButtonVisualTimer = null;
            return;
        }
        if (timerRefName === "dangerZoneTeleportTimer") {
            this.dangerZoneTeleportTimerToken += 1;
            this.dangerZoneTeleportTimer = null;
            return;
        }
        if (timerRefName === "dangerZoneResetTimer") {
            this.dangerZoneResetTimerToken += 1;
            this.dangerZoneResetTimer = null;
            this.dangerZoneResetGreenTimeRemainingMs = 0;
            this.lastDangerZoneGreenTimestampMs = 0;
            this.areDangerZonesActive = false;
            this.setDangerZoneOpacity(this.dangerZoneBaseOpacity);
            return;
        }
    }
    clearDangerZoneAnimation() {
        this.dangerZoneAnimationToken += 1;
        if (this.dangerZoneAnimation) {
            try {
                this.dangerZoneAnimation.destroy();
            }
            catch (error) { }
        }
        this.dangerZoneAnimation = null;
        this.setDangerZoneOpacity(this.dangerZoneBaseOpacity);
    }
    resetDangerZoneAbilityState() {
        this.isDangerZoneAbilityAvailable = true;
        this.dangerZoneResetGreenTimeRemainingMs = 0;
        this.lastDangerZoneGreenTimestampMs = 0;
        this.syncCanUseAbilityState();
    }
    startDangerZoneAbilityRefreshCooldown() {
        this.isDangerZoneAbilityAvailable = false;
        this.dangerZoneResetGreenTimeRemainingMs = this.dangerZoneResetDurationSeconds * 1000;
        this.lastDangerZoneGreenTimestampMs = 0;
        this.syncCanUseAbilityState();
    }
    updateDangerZoneAbilityRefreshCooldown() {
        if (!playerManager.isHost)
            return;
        if (!this.isActive)
            return;
        if (this.lightControlMode !== "user")
            return;
        if (this.isDangerZoneAbilityAvailable)
            return;
        if (this.currentLight !== "GREEN") {
            this.lastDangerZoneGreenTimestampMs = 0;
            return;
        }
        const now = Date.now();
        if (!this.lastDangerZoneGreenTimestampMs) {
            this.lastDangerZoneGreenTimestampMs = now;
            return;
        }
        this.dangerZoneResetGreenTimeRemainingMs -= now - this.lastDangerZoneGreenTimestampMs;
        this.lastDangerZoneGreenTimestampMs = now;
        if (this.dangerZoneResetGreenTimeRemainingMs > 0)
            return;
        this.resetDangerZoneAbilityState();
    }
    clearUserModeTimers() {
        this.clearActiveLightTimer();
        this.clearTimer("inactivityTimer");
        this.clearTimer("lightToggleLockTimer");
        this.clearTimer("dangerZoneLockTimer");
        this.clearTimer("lightButtonVisualTimer");
        this.clearTimer("dangerButtonVisualTimer");
        this.clearTimer("dangerZoneTeleportTimer");
        this.clearTimer("dangerZoneResetTimer");
        this.clearDangerZoneAnimation();
        this.resetDangerZoneAbilityState();
        this.isLightToggleLocked = false;
        this.isDangerZoneLocked = false;
        this.isLocalLightButtonLocked = false;
        this.isLocalDangerButtonLocked = false;
    }
    scheduleCurrentLightTimer() {
        this.clearActiveLightTimer();
        if (!playerManager.isHost)
            return;
        if (!this.isActive)
            return;
        if (this.lightControlMode !== "auto")
            return;
        const durationMs = Math.max(1, Math.round(this.lightTimer * 1000));
        const activeLightTimerToken = this.activeLightTimerToken;
        this.activeLightTimer = timerManager.createTimer({
            autoplay: true,
            duration: durationMs,
            loop: false,
            onComplete: () => {
                if (this.activeLightTimerToken !== activeLightTimerToken)
                    return;
                if (!playerManager.isHost)
                    return;
                if (!this.isActive)
                    return;
                this.activeLightTimer = null;
                this.switchLight();
            },
        });
    }
    switchLight() {
        if (!this.isActive)
            return;
        if (this.lightControlMode !== "auto")
            return;
        if (this.currentLight === "RED") {
            this.currentLight = "GREEN";
            this.lightTimer = this.getNextGreenDuration();
            eventManager.emit("lightTurnedGreen", {});
        }
        else if (this.currentLight === "GREEN") {
            this.currentLight = "YELLOW";
            this.lightTimer = this.yellowLightDuration;
            eventManager.emit("lightTurningRed", {});
        }
        else if (this.currentLight === "YELLOW") {
            this.currentLight = "RED";
            this.lightTimer = this.getNextRedDuration();
            eventManager.emit("lightTurnedRed", {});
        }
        this.updateTrafficLightVisibility();
        this.updateStoplightDisplay();
        if (playerManager.isHost) {
            this.scheduleCurrentLightTimer();
        }
    }
    isConnectedPlayer(playerId) {
        if (!playerId)
            return false;
        const playerIds = playerManager.getPlayerIds();
        for (let i = 0; i < playerIds.length; i++) {
            if (playerIds[i] === playerId)
                return true;
        }
        return false;
    }
    assignSpecificController(playerId) {
        if (!playerManager.isHost)
            return;
        if (!this.isConnectedPlayer(playerId)) {
            this.assignRandomController();
            return;
        }
        const previousControllerId = this.currentControllerId;
        this.currentControllerId = playerId;
        this.syncControllerAssignment(previousControllerId);
        this.teleportControllerToControlZone();
    }
    assignInitialController() {
        if (!playerManager.isHost)
            return;
        this.assignRandomController();
    }
    assignRandomController() {
        if (!playerManager.isHost)
            return;
        const previousControllerId = this.currentControllerId;
        const playerIds = playerManager.getPlayerIds();
        if (playerIds.length === 0) {
            this.currentControllerId = 0;
            this.syncControllerAssignment(previousControllerId);
            return;
        }
        const randomIndex = Math.floor(Math.random() * playerIds.length);
        this.currentControllerId = playerIds[randomIndex];
        this.syncControllerAssignment(previousControllerId);
        this.teleportControllerToControlZone();
    }
    syncControllerAssignment(previousControllerId = 0) {
        if (!playerManager.isHost)
            return;
        this.ensureControllerStatusSprite();
        this.setControllerSyncVariable(this.currentControllerId);
        this.syncCanUseAbilityState();
        this.syncControllerPlayerPresentation(previousControllerId);
        const controllerName = this.getPlayerName(this.currentControllerId);
        if (this.controllerStatusSprite) {
            spriteManager.updateSprite(this.controllerStatusSprite.uniqueId, {
                text: controllerName ? `Light Leader: ${controllerName}` : "Light Leader: None",
            });
        }
    }
    clearControllerAssignment() {
        if (!playerManager.isHost)
            return;
        const previousControllerId = this.currentControllerId;
        this.currentControllerId = 0;
        this.removeControllerTrapSprites();
        this.setControllerSyncVariable(0);
        this.syncCanUseAbilityState();
        this.syncControllerPlayerPresentation(previousControllerId);
        if (this.controllerStatusSprite) {
            spriteManager.updateSprite(this.controllerStatusSprite.uniqueId, {
                text: "Light Leader: None",
            });
        }
    }
    getPlayerName(playerId) {
        if (!playerId)
            return "";
        const playerDetails = playerManager.getPlayerDetails(playerId);
        if (!playerDetails || !playerDetails.username)
            return `Player ${playerId}`;
        return playerDetails.username;
    }
    setDefaultPlayerNameplate(playerId) {
        if (!playerManager.isHost)
            return;
        if (!playerId)
            return;
        const playerName = this.getPlayerName(playerId);
        playerManager.setNameplate(playerId, "\uD83D\uDEA6 " + playerName + " \uD83D\uDEA6");
    }
    setControllerLeaderPresentation(playerId) {
        if (!playerManager.isHost)
            return;
        if (!playerId)
            return;
        if (!this.isConnectedPlayer(playerId))
            return;
        const playerName = this.getPlayerName(playerId);
        playerManager.tintPlayer(playerId, "#e0f000");
        playerManager.setNameplate(playerId, "\uD83C\uDFAE " + playerName + " \uD83C\uDFAE");
    }
    clearControllerLeaderPresentation(playerId) {
        if (!playerManager.isHost)
            return;
        if (!playerId)
            return;
        if (!this.isConnectedPlayer(playerId))
            return;
        playerManager.tintPlayer(playerId, null);
        this.setDefaultPlayerNameplate(playerId);
    }
    syncControllerPlayerPresentation(previousControllerId = 0) {
        if (!playerManager.isHost)
            return;
        if (previousControllerId && previousControllerId !== this.currentControllerId) {
            this.clearControllerLeaderPresentation(previousControllerId);
        }
        if (this.currentControllerId) {
            this.setControllerLeaderPresentation(this.currentControllerId);
        }
    }
    teleportControllerToControlZone() {
        if (!playerManager.isHost)
            return;
        if (!this.currentControllerId)
            return;
        playerManager.teleportPlayers([this.currentControllerId], {
            distributionType: "area",
            positionX: this.controllerTeleportX,
            positionY: this.controllerTeleportY,
            width: 0,
            height: 0,
        });
        this.ensureControllerTrapSprites();
    }
    getSyncedControllerId() {
        return this.getControllerSyncVariable();
    }
    updateLocalControllerUi() {
        if (!this.lightButtonBorderSprite ||
            !this.lightButtonCenterSprite ||
            !this.lightButtonLabelSprite ||
            !this.dangerButtonBorderSprite ||
            !this.dangerButtonCenterSprite ||
            !this.dangerButtonLabelSprite) {
            return;
        }
        if (!playerManager.isHost)
            return;
        const syncedControllerExists = this.getSyncedControllerId() > 0;
        const isDangerZoneAbilityAvailable = this.getCanUseAbilityVariable();
        const shouldShowControls = (this.isActive || syncedControllerExists) && this.lightControlMode === "user";
        if (!shouldShowControls) {
            this.setLocalControllerUiVisibility(false);
            return;
        }
        spriteManager.updateSprite(this.lightButtonBorderSprite.uniqueId, {
            opacity: 1,
            isInteractive: !this.isLightToggleLocked,
        });
        spriteManager.updateSprite(this.lightButtonCenterSprite.uniqueId, {
            opacity: this.isLightToggleLocked ? 0 : 1,
        });
        spriteManager.updateSprite(this.lightButtonLabelSprite.uniqueId, {
            opacity: 1,
        });
        spriteManager.updateSprite(this.dangerButtonBorderSprite.uniqueId, {
            opacity: 1,
            isInteractive: !this.isDangerZoneLocked && isDangerZoneAbilityAvailable,
        });
        spriteManager.updateSprite(this.dangerButtonCenterSprite.uniqueId, {
            opacity: !this.isDangerZoneLocked && isDangerZoneAbilityAvailable ? 1 : 0,
        });
        spriteManager.updateSprite(this.dangerButtonLabelSprite.uniqueId, {
            opacity: 1,
        });
    }
    setLocalControllerUiVisibility(isVisible) {
        if (!playerManager.isHost)
            return;
        const opacity = isVisible ? 1 : 0;
        const canInteractWithLightButton = isVisible && !this.isLightToggleLocked;
        const canInteractWithDangerButton = isVisible && !this.isDangerZoneLocked && this.getCanUseAbilityVariable();
        if (this.lightButtonBorderSprite) {
            spriteManager.updateSprite(this.lightButtonBorderSprite.uniqueId, {
                opacity: opacity,
                isInteractive: canInteractWithLightButton,
            });
        }
        if (this.lightButtonCenterSprite) {
            spriteManager.updateSprite(this.lightButtonCenterSprite.uniqueId, {
                opacity: isVisible && !this.isLightToggleLocked ? 1 : 0,
            });
        }
        if (this.lightButtonLabelSprite) {
            spriteManager.updateSprite(this.lightButtonLabelSprite.uniqueId, {
                opacity: opacity,
            });
        }
        if (this.dangerButtonBorderSprite) {
            spriteManager.updateSprite(this.dangerButtonBorderSprite.uniqueId, {
                opacity: opacity,
                isInteractive: canInteractWithDangerButton,
            });
        }
        if (this.dangerButtonCenterSprite) {
            spriteManager.updateSprite(this.dangerButtonCenterSprite.uniqueId, {
                opacity: isVisible && !this.isDangerZoneLocked && this.getCanUseAbilityVariable() ? 1 : 0,
            });
        }
        if (this.dangerButtonLabelSprite) {
            spriteManager.updateSprite(this.dangerButtonLabelSprite.uniqueId, {
                opacity: opacity,
            });
        }
    }
    isUserModeRequestValid(fromPlayerId) {
        if (!playerManager.isHost)
            return false;
        if (!this.isActive)
            return false;
        if (this.lightControlMode !== "user")
            return false;
        if (!fromPlayerId || fromPlayerId !== this.currentControllerId)
            return false;
        return true;
    }
    lockLightToggle() {
        this.isLightToggleLocked = true;
        this.clearTimer("lightToggleLockTimer");
        const lightToggleLockTimerToken = this.lightToggleLockTimerToken;
        this.lightToggleLockTimer = timerManager.createTimer({
            autoplay: true,
            duration: this.lightToggleCooldownDuration,
            loop: false,
            onComplete: () => {
                if (this.lightToggleLockTimerToken !== lightToggleLockTimerToken)
                    return;
                this.lightToggleLockTimer = null;
                this.isLightToggleLocked = false;
            },
        });
    }
    lockDangerZoneActivation() {
        this.isDangerZoneLocked = true;
        this.clearTimer("dangerZoneLockTimer");
        const dangerZoneLockTimerToken = this.dangerZoneLockTimerToken;
        this.dangerZoneLockTimer = timerManager.createTimer({
            autoplay: true,
            duration: this.buttonPressedDuration,
            loop: false,
            onComplete: () => {
                if (this.dangerZoneLockTimerToken !== dangerZoneLockTimerToken)
                    return;
                this.dangerZoneLockTimer = null;
                this.isDangerZoneLocked = false;
            },
        });
    }
    resetUserInactivityTimer() {
        if (!playerManager.isHost || !this.isActive || this.lightControlMode !== "user") {
            this.userInactivityDeadlineMs = 0;
            this.inactivityTimer = null;
            return;
        }
        this.userInactivityDeadlineMs = Date.now() + this.userModeInactivityDuration;
    }
    setCurrentLight(nextLight) {
        this.currentLight = nextLight;
        this.updateTrafficLightVisibility();
        this.updateStoplightDisplay();
        if (nextLight === "GREEN") {
            eventManager.emit("lightTurnedGreen", {});
            return;
        }
        if (nextLight === "YELLOW") {
            eventManager.emit("lightTurningRed", {});
            return;
        }
        eventManager.emit("lightTurnedRed", {});
    }
    transitionYellowToRed() {
        this.clearActiveLightTimer();
        const activeLightTimerToken = this.activeLightTimerToken;
        this.activeLightTimer = timerManager.createTimer({
            autoplay: true,
            duration: this.yellowLightDuration * 1000,
            loop: false,
            onComplete: () => {
                if (this.activeLightTimerToken !== activeLightTimerToken)
                    return;
                this.activeLightTimer = null;
                if (!playerManager.isHost)
                    return;
                if (!this.isActive)
                    return;
                if (this.lightControlMode !== "user")
                    return;
                this.setCurrentLight("RED");
            },
        });
    }
    handleUserInactivityTimeout() {
        if (!playerManager.isHost)
            return;
        if (!this.isActive)
            return;
        if (this.lightControlMode !== "user")
            return;
        if (this.isLightToggleLocked) {
            this.resetUserInactivityTimer();
            return;
        }
        if (this.currentLight === "YELLOW") {
            this.resetUserInactivityTimer();
            return;
        }
        this.resetUserInactivityTimer();
        this.clearActiveLightTimer();
        this.lockLightToggle();
        if (this.currentLight === "RED") {
            this.setCurrentLight("GREEN");
            return;
        }
        this.setCurrentLight("YELLOW");
        this.transitionYellowToRed();
    }
    handleLightToggleRequest(fromPlayerId) {
        if (!this.isUserModeRequestValid(fromPlayerId))
            return;
        if (this.isLightToggleLocked)
            return;
        if (this.currentLight === "YELLOW")
            return;
        this.resetUserInactivityTimer();
        this.clearActiveLightTimer();
        this.lockLightToggle();
        if (this.currentLight === "RED") {
            this.setCurrentLight("GREEN");
            return;
        }
        this.setCurrentLight("YELLOW");
        this.transitionYellowToRed();
    }
    handleDangerZoneActivationRequest(fromPlayerId) {
        if (!this.isUserModeRequestValid(fromPlayerId))
            return;
        if (this.isDangerZoneLocked)
            return;
        if (!this.isDangerZoneAbilityAvailable)
            return;
        // if (this.currentLight !== "RED") return; This shouldnt matter!
        this.lockDangerZoneActivation();
        this.resetUserInactivityTimer();
        this.startDangerZoneAbilityRefreshCooldown();
        this.activateDangerZones();
    }
    activateDangerZones() {
        if (!playerManager.isHost)
            return;
        this.clearTimer("dangerZoneTeleportTimer");
        this.clearDangerZoneAnimation();
        this.setDangerZoneOpacity(this.dangerZoneBaseOpacity);
        if (!spriteManager.getSprite(this.dangerZoneLeftId))
            return;
        if (!spriteManager.getSprite(this.dangerZoneRightId))
            return;
        const dangerZoneTeleportTimerToken = this.dangerZoneTeleportTimerToken;
        this.dangerZoneTeleportTimer = timerManager.createTimer({
            autoplay: true,
            duration: this.dangerZoneTriggerDelay,
            loop: false,
            onComplete: () => {
                if (this.dangerZoneTeleportTimerToken !== dangerZoneTeleportTimerToken)
                    return;
                this.dangerZoneTeleportTimer = null;
                this.teleportTrackedDangerZonePlayers();
                this.animateDangerZones();
            },
        });
    }
    setDangerZoneOpacity(opacity) {
        if (!playerManager.isHost)
            return;
        if (spriteManager.getSprite(this.dangerZoneLeftId)) {
            spriteManager.updateSprite(this.dangerZoneLeftId, { opacity: opacity });
        }
        if (spriteManager.getSprite(this.dangerZoneRightId)) {
            spriteManager.updateSprite(this.dangerZoneRightId, { opacity: opacity });
        }
    }
    animateDangerZones() {
        if (!playerManager.isHost)
            return;
        if (!spriteManager.getSprite(this.dangerZoneLeftId))
            return;
        if (!spriteManager.getSprite(this.dangerZoneRightId))
            return;
        const totalDuration = this.dangerZoneFlashDuration + this.dangerZoneFadeDuration;
        const dangerZoneAnimationToken = this.dangerZoneAnimationToken;
        this.dangerZoneAnimation = timerManager.animate({
            targets: [spriteManager.getSprite(this.dangerZoneLeftId), spriteManager.getSprite(this.dangerZoneRightId)],
            keyframes: {
                0: { opacity: this.dangerZoneBaseOpacity.toString() },
                1: { opacity: this.dangerZoneActiveOpacity.toString() },
                33: { opacity: this.dangerZoneActiveOpacity.toString() },
                100: { opacity: this.dangerZoneBaseOpacity.toString() },
            },
            duration: totalDuration,
            loop: false,
            alternate: false,
            playbackEase: "Linear",
            onBegin: () => {
                if (this.dangerZoneAnimationToken !== dangerZoneAnimationToken)
                    return;
                this.setDangerZoneOpacity(this.dangerZoneBaseOpacity);
            },
            onComplete: () => {
                if (this.dangerZoneAnimationToken !== dangerZoneAnimationToken)
                    return;
                this.dangerZoneAnimation = null;
                this.setDangerZoneOpacity(this.dangerZoneBaseOpacity);
            },
        });
    }
    teleportTrackedDangerZonePlayers() {
        const trackedPlayerIds = this.getTrackedDangerZonePlayerIds();
        this.logDangerZonePlayerMap("teleport attempt");
        if (trackedPlayerIds.length === 0) {
            console.log("[RLGL][DangerZones] no tracked players to teleport");
        }
        for (let i = 0; i < trackedPlayerIds.length; i++) {
            const playerId = trackedPlayerIds[i];
            const playerDetails = playerManager.getPlayerDetails(playerId);
            if (!playerDetails)
                continue;
            console.log("[RLGL][DangerZones] teleporting tracked player", playerId);
            const playerX = playerDetails.x !== undefined ? playerDetails.x : this.worldWidth / 2;
            playerManager.teleportPlayers([playerId], {
                distributionType: "area",
                positionX: playerX,
                positionY: this.safeZoneY,
                width: 0,
                height: 0,
            });
            this.removeDangerZonePlayer(playerId);
        }
    }
    isPlayerController(playerId) {
        return this.getSyncedControllerId() === playerId;
    }
    onSpriteClicked({ sprite }) {
        if (!sprite)
            return;
        if (!this.isPlayerController(playerManager.getMyPlayerId()))
            return;
        if (sprite.uniqueId === "controllerLightButtonBorder") {
            console.log("about to emit light button event");
            eventManager.emit("handleButtonPress", { buttonName: "light" });
            return;
        }
        if (sprite.uniqueId === "controllerDangerButtonBorder") {
            eventManager.emit("handleButtonPress", { buttonName: "danger" });
        }
    }
    onEvent_handleButtonPress({ buttonName }) {
        if (!playerManager.isHost)
            return;
        console.log("handle button press: ", buttonName);
        if (buttonName === "light") {
            this.handleLightToggleRequest(this.currentControllerId);
            return;
        }
        if (buttonName === "danger") {
            this.handleDangerZoneActivationRequest(this.currentControllerId);
        }
    }
    onSpriteCollisionStart({ collisionX, collisionY, sprite1, sprite2, }) {
        if (!playerManager.isHost)
            return;
        if (this.lightControlMode !== "user")
            return;
        const decodedCollision = this.decodeDangerZoneCollision({ sprite1: sprite1, sprite2: sprite2 });
        if (!decodedCollision)
            return;
        this.addDangerZonePlayer(decodedCollision.playerId);
        this.logDangerZonePlayerMap("collision start", decodedCollision.playerId, decodedCollision.zoneId);
    }
    onSpriteCollisionStop({ collisionX, collisionY, sprite1, sprite2, }) {
        if (!playerManager.isHost)
            return;
        if (this.lightControlMode !== "user")
            return;
        const decodedCollision = this.decodeDangerZoneCollision({ sprite1: sprite1, sprite2: sprite2 });
        if (!decodedCollision)
            return;
        this.removeDangerZonePlayer(decodedCollision.playerId);
        this.logDangerZonePlayerMap("collision stop", decodedCollision.playerId, decodedCollision.zoneId);
    }
    onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        if (this.lightControlMode !== "user")
            return;
        if (!this.isActive)
            return;
        // if (this.currentControllerId) return;
        // this.currentControllerId = playerId;
        // this.syncControllerAssignment();
        // this.teleportControllerToControlZone();
    }
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        this.removeDangerZonePlayer(playerId);
        if (this.lightControlMode !== "user")
            return;
        if (!this.isActive)
            return;
        if (playerId !== this.currentControllerId)
            return;
        const remainingPlayerIds = playerManager.getPlayerIds();
        if (remainingPlayerIds.length <= 1) {
            this.clearControllerAssignment();
            return;
        }
        this.assignRandomController();
    }
    onPhysicsStep() {
        if (!playerManager.isHost)
            return;
        const syncedControllerExists = this.getSyncedControllerId() > 0;
        if (this.lightControlMode === "user" || syncedControllerExists) {
            if (syncedControllerExists) {
                this.isActive = true;
                this.lightControlMode = "user";
            }
            this.ensureLocalControllerUiSprites();
            this.updateLocalControllerUi();
        }
    }
    onStep() {
        if (!playerManager.isHost)
            return;
        if (!this.isActive)
            return;
        if (this.lightControlMode !== "user")
            return;
        this.updateDangerZoneAbilityRefreshCooldown();
        if (!this.userInactivityDeadlineMs)
            return;
        if (Date.now() < this.userInactivityDeadlineMs)
            return;
        this.handleUserInactivityTimeout();
    }
    isRedLightActive() {
        return this.isActive && this.currentLight === "RED";
    }
    removeLocalControllerUiSprites() {
        const localSpriteIds = [
            "controllerLightButtonBorder",
            "controllerLightButtonCenter",
            "controllerLightButtonLabel",
            "controllerDangerButtonBorder",
            "controllerDangerButtonCenter",
            "controllerDangerButtonLabel",
        ];
        if (playerManager.isHost) {
            for (let i = 0; i < localSpriteIds.length; i++) {
                if (spriteManager.getSprite(localSpriteIds[i])) {
                    spriteManager.removeSprite(localSpriteIds[i]);
                }
            }
        }
        this.lightButtonBorderSprite = null;
        this.lightButtonCenterSprite = null;
        this.lightButtonLabelSprite = null;
        this.dangerButtonBorderSprite = null;
        this.dangerButtonCenterSprite = null;
        this.dangerButtonLabelSprite = null;
    }
    removeUserModeSharedSprites() {
        if (!playerManager.isHost)
            return;
        const sharedSpriteIds = [
            "controllerStatus",
            "controllerSync",
            "dangerZoneLeft",
            "dangerZoneRight",
            "leaderZone",
            this.controllerTrapTopId,
            this.controllerTrapBottomId,
            this.controllerTrapLeftId,
            this.controllerTrapRightId,
        ];
        for (let i = 0; i < sharedSpriteIds.length; i++) {
            if (spriteManager.getSprite(sharedSpriteIds[i])) {
                spriteManager.removeSprite(sharedSpriteIds[i]);
            }
        }
        this.controllerStatusSprite = null;
        this.clearDangerZonePlayerList();
    }
    stopStoplight() {
        this.isActive = false;
        const previousControllerId = this.currentControllerId;
        this.currentControllerId = 0;
        this.clearUserModeTimers();
        this.removeLocalControllerUiSprites();
        if (playerManager.isHost) {
            this.clearControllerLeaderPresentation(previousControllerId);
            this.setControllerSyncVariable(0);
            if (this.stoplightSprite) {
                spriteManager.removeSprite(this.stoplightSprite.uniqueId);
                this.stoplightSprite = null;
            }
            this.removeUserModeSharedSprites();
        }
        this.hideAllTrafficLights();
        this.setDangerZoneOpacity(this.dangerZoneBaseOpacity);
    }
}
