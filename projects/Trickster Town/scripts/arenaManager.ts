class arenaManager extends SystemScript {
  gameWidth: number;
  gameHeight: number;
  centerX: number;
  centerY: number;
  seatRadius: number;
  seatLabelWidth: number;
  seatBoothSize: number;
  seatWallThickness: number;
  waitingAreaX: number;
  waitingAreaY: number;
  waitingAreaWidth: number;
  waitingAreaHeight: number;
  spectatorAreaX: number;
  spectatorAreaY: number;
  spectatorAreaWidth: number;
  spectatorAreaHeight: number;
  currentBlockerIds: string[];
  dayGreenOpacity: number;
  bgAnimationDurationMs: number;
  bgAnimation: any;
  bgAnimationToken: number;
  dayColor: string;
  nightColor: string;
  countdownTextColor: string;
  lastSyncedCountdownText: string;

  onInit() {
    if (!playerManager.isHost) return;

    this.gameWidth = 1500;
    this.gameHeight = 1500;
    this.centerX = 750;
    this.seatRadius = 510;
    this.seatLabelWidth = 240;
    this.seatBoothSize = 140;
    this.seatWallThickness = 18;
    // Keep a fixed 200px lane above the top booth without adding bottom dead space.
    this.centerY =
      200 +
      this.seatRadius +
      Math.floor(this.seatBoothSize / 2) +
      Math.floor(this.seatWallThickness / 2);
    this.waitingAreaX = 180;
    this.waitingAreaY = 1320;
    this.waitingAreaWidth = 1140;
    this.waitingAreaHeight = 100;
    this.spectatorAreaX = 40;
    this.spectatorAreaY = 40;
    this.spectatorAreaWidth = 140;
    this.spectatorAreaHeight = 140;
    this.currentBlockerIds = [];
    this.dayGreenOpacity = 1;
    this.bgAnimationDurationMs = 900;
    this.bgAnimation = null;
    this.bgAnimationToken = 0;
    this.dayColor = "#91bb56";
    this.nightColor = "#000000";
    this.countdownTextColor = "#fff7df";
    this.lastSyncedCountdownText = "";

    this.ensureBackgroundSprites();
    this.ensureSyncedCountdownSprite();
    this.setDayMode(true);
  }

  onHostStart() {
    if (!playerManager.isHost) return;
    this.ensureBackgroundSprites();
    this.ensureSyncedCountdownSprite();
  }

  ensureBackgroundSprites() {
    let blackOptions: any;
    blackOptions = {
      uniqueId: "bgBlack",
      positionX: 0,
      positionY: 0,
      width: this.gameWidth,
      height: this.gameHeight,
      fill: this.nightColor,
      opacity: 1,
      isStatic: true,
      checkCollisions: false,
      isImpassable: false,
      topAdjust: -500,
    };

    let greenOptions: any;
    greenOptions = {
      uniqueId: "bgDayGreen",
      positionX: 0,
      positionY: 0,
      width: this.gameWidth,
      height: this.gameHeight,
      fill: this.dayColor,
      opacity: this.dayGreenOpacity,
      isStatic: true,
      checkCollisions: false,
      isImpassable: false,
      topAdjust: -499,
    };

    if (!spriteManager.getSprite("bgBlack")) {
      spriteManager.addSprite("baseRect", blackOptions);
    } else {
      spriteManager.updateSprite("bgBlack", blackOptions);
    }

    if (!spriteManager.getSprite("bgDayGreen")) {
      spriteManager.addSprite("baseRect", greenOptions);
    } else {
      spriteManager.updateSprite("bgDayGreen", greenOptions);
    }
  }

  ensureSyncedCountdownSprite() {
    if (!playerManager.isHost) return;

    const countdownOptions: any = {
      uniqueId: "ui_countdown_synced",
      positionX: 500,
      positionY: 820,
      containerWidth: 500,
      align: "center",
      text: "",
      fontSize: 46,
      fontWeight: "bold",
      fontColor: this.countdownTextColor,
      opacity: 0,
      isInteractive: false,
      allowSpectatorInteraction: false,
      isPlayerControlled: false,
      topAdjust: 1000,
    };

    if (!spriteManager.getSprite("ui_countdown_synced")) {
      spriteManager.addSprite("baseText", countdownOptions);
      this.lastSyncedCountdownText = "";
      return;
    }

    spriteManager.updateSprite("ui_countdown_synced", {
      positionX: countdownOptions.positionX,
      positionY: countdownOptions.positionY,
      containerWidth: countdownOptions.containerWidth,
      align: countdownOptions.align,
      fontSize: countdownOptions.fontSize,
      fontWeight: countdownOptions.fontWeight,
      fontColor: countdownOptions.fontColor,
      isInteractive: false,
      opacity: this.lastSyncedCountdownText ? 1 : 0,
      text: this.lastSyncedCountdownText,
    });
  }

  setSyncedCountdownText(text: string) {
    if (!playerManager.isHost) return;

    const nextText = text || "";
    this.ensureSyncedCountdownSprite();

    if (this.lastSyncedCountdownText === nextText) return;

    this.lastSyncedCountdownText = nextText;
    spriteManager.updateSprite("ui_countdown_synced", {
      text: nextText,
      opacity: nextText ? 1 : 0,
    });
  }

  setDayMode(isDay: boolean) {
    if (!playerManager.isHost) return;

    const targetOpacity = isDay ? 1 : 0;
    const dayGreenSprite = spriteManager.getSprite("bgDayGreen");

    if (!dayGreenSprite) {
      this.ensureBackgroundSprites();
    }

    if (this.dayGreenOpacity === targetOpacity) {
      const refreshedSprite = spriteManager.getSprite("bgDayGreen");
      if (refreshedSprite && refreshedSprite.opacity === targetOpacity) {
        return;
      }
    }

    this.bgAnimationToken += 1;
    const animationToken = this.bgAnimationToken;
    const currentSprite = spriteManager.getSprite("bgDayGreen");
    const currentOpacity = currentSprite ? currentSprite.opacity : this.dayGreenOpacity;

    this.dayGreenOpacity = currentOpacity;

    if (this.bgAnimation && this.bgAnimation.destroy) {
      try {
        this.bgAnimation.destroy();
      } catch (e) {}
      this.bgAnimation = null;
    }

    if (!currentSprite) {
      spriteManager.updateSprite("bgDayGreen", {
        opacity: targetOpacity,
      });
      this.dayGreenOpacity = targetOpacity;
      return;
    }

    if (currentOpacity === targetOpacity) {
      return;
    }

    this.bgAnimation = timerManager.animate({
      targets: [currentSprite],
      keyframes: {
        0: { opacity: currentOpacity.toString() },
        100: { opacity: targetOpacity.toString() },
      },
      duration: this.bgAnimationDurationMs,
      loop: false,
      alternate: false,
      playbackEase: "Linear",
      onComplete: () => {
        if (this.bgAnimationToken !== animationToken) return;
        this.bgAnimation = null;
        this.dayGreenOpacity = targetOpacity;
        spriteManager.updateSprite("bgDayGreen", {
          opacity: targetOpacity,
        });
      },
    });
  }

  computeSeatMapForPlayerIds(playerIds: number[]) {
    let seatMap: any;
    seatMap = {};

    if (!playerIds || playerIds.length === 0) {
      return seatMap;
    }

    for (let i = 0; i < playerIds.length; i++) {
      const angleDeg = -90 + (360 / playerIds.length) * i;
      const angleRad = (angleDeg * Math.PI) / 180;
      const playerCenterX = Math.round(this.centerX + Math.cos(angleRad) * this.seatRadius);
      const playerCenterY = Math.round(this.centerY + Math.sin(angleRad) * this.seatRadius);
      const nameX = playerCenterX - Math.floor(this.seatLabelWidth / 2);
      const nameY = playerCenterY + Math.floor(this.seatBoothSize / 2) + 10;
      const voteY = nameY + 28;

      seatMap[playerIds[i].toString()] = {
        seatIndex: i,
        angle: angleDeg,
        playerX: playerCenterX,
        playerY: playerCenterY,
        nameX: nameX,
        nameY: nameY,
        voteX: nameX,
        voteY: voteY,
        labelWidth: this.seatLabelWidth,
        boothSize: this.seatBoothSize,
      };
    }

    return seatMap;
  }

  clearSeatBlockers() {
    if (!playerManager.isHost) return;

    for (let i = 0; i < this.currentBlockerIds.length; i++) {
      if (spriteManager.getSprite(this.currentBlockerIds[i])) {
        spriteManager.removeSprite(this.currentBlockerIds[i]);
      }
    }

    this.currentBlockerIds = [];
  }

  rebuildSeatBlockersFromSeatMap(seatMap: any) {
    if (!playerManager.isHost) return;

    this.clearSeatBlockers();

    if (!seatMap) return;

    const playerIds = Object.keys(seatMap);
    for (let i = 0; i < playerIds.length; i++) {
      this.addSeatBooth(playerIds[i], seatMap[playerIds[i]]);
    }
  }

  addSeatBooth(playerId: string, seatData: any) {
    if (!seatData) return;

    const boothSize = seatData.boothSize || this.seatBoothSize;
    const wallThickness = this.seatWallThickness;
    const halfSize = Math.floor(boothSize / 2);
    const centerX = seatData.playerX;
    const centerY = seatData.playerY;
    const topY = centerY - halfSize - Math.floor(wallThickness / 2);
    const bottomY = centerY + halfSize - Math.floor(wallThickness / 2);
    const leftX = centerX - halfSize - Math.floor(wallThickness / 2);
    const rightX = centerX + halfSize - Math.floor(wallThickness / 2);
    const topX = centerX - halfSize;
    const sideY = centerY - halfSize;
    const wallFill = "#1f2617";

    this.addBlockerSprite(
      "seatBlocker_" + playerId + "_top",
      topX,
      topY,
      boothSize,
      wallThickness,
      wallFill,
    );
    this.addBlockerSprite(
      "seatBlocker_" + playerId + "_bottom",
      topX,
      bottomY,
      boothSize,
      wallThickness,
      wallFill,
    );
    this.addBlockerSprite(
      "seatBlocker_" + playerId + "_left",
      leftX,
      sideY,
      wallThickness,
      boothSize,
      wallFill,
    );
    this.addBlockerSprite(
      "seatBlocker_" + playerId + "_right",
      rightX,
      sideY,
      wallThickness,
      boothSize,
      wallFill,
    );
  }

  addBlockerSprite(
    uniqueId: string,
    positionX: number,
    positionY: number,
    width: number,
    height: number,
    fill: string,
  ) {
    let blockerOptions: any;
    blockerOptions = {
      uniqueId: uniqueId,
      positionX: Math.round(positionX),
      positionY: Math.round(positionY),
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      fill: fill,
      opacity: 0,
      isStatic: true,
      checkCollisions: true,
      isImpassable: true,
      topAdjust: -100,
    };

    spriteManager.addSprite("baseRect", blockerOptions);
    this.currentBlockerIds.push(uniqueId);
  }

  teleportPlayersToSeats(seatMap: any) {
    if (!playerManager.isHost) return;
    if (!seatMap) return;

    const playerIds = Object.keys(seatMap);
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = parseInt(playerIds[i], 10);
      const seatData = seatMap[playerIds[i]];
      if (!seatData) continue;

      playerManager.teleportPlayers([playerId], {
        distributionType: "area",
        positionX: seatData.playerX - 2,
        positionY: seatData.playerY - 2,
        width: 4,
        height: 4,
      });
    }
  }

  teleportPlayersToWaitingArea(playerIds: number[]) {
    if (!playerIds || playerIds.length === 0) return;

    playerManager.teleportPlayers(playerIds, {
      distributionType: "area",
      positionX: this.waitingAreaX,
      positionY: this.waitingAreaY,
      width: this.waitingAreaWidth,
      height: this.waitingAreaHeight,
    });
  }

  teleportPlayersToSpectatorArea(playerIds: number[]) {
    if (!playerIds || playerIds.length === 0) return;

    playerManager.teleportPlayers(playerIds, {
      distributionType: "area",
      positionX: this.spectatorAreaX,
      positionY: this.spectatorAreaY,
      width: this.spectatorAreaWidth,
      height: this.spectatorAreaHeight,
    });
  }

  teleportPlayerToOrigin(playerId: number) {
    try {
      playerManager.teleportPlayers([playerId], {
        distributionType: "area",
        positionX: 0,
        positionY: 0,
        width: 1,
        height: 1,
      });
    } catch (e) {}
  }
}
