class arenaManager extends SystemScript {
  worldWidth: number;
  worldHeight: number;
  playAreaWidth: number;
  arenaStartX: number;
  arenaTop: number;
  arenaWidth: number;
  arenaHeight: number;
  tileSize: number;
  tileGap: number;
  arenaRows: number;
  arenaCols: number;
  centerCutoutRows: number;
  centerCutoutCols: number;
  centerCutoutStartRow: number;
  centerCutoutStartCol: number;
  sidebarX: number;
  sidebarWidth: number;
  sidebarPadding: number;
  panelSize: number;
  panelX: number;
  panelY: number;
  outZoneX: number;
  outZoneY: number;
  outZoneWidth: number;
  outZoneHeight: number;
  outZoneSpriteScale: number;
  playerListPanelX: number;
  playerListPanelY: number;
  playerListPanelWidth: number;
  playerListPanelHeight: number;
  playerListTitleY: number;
  playerListEntryIds: string[];
  lobbyTitleX: number;
  lobbyTextWidth: number;
  centerFooterY: number;
  centerFruitBaseSpriteSize: number;
  centerFruitSpriteScale: number;
  centerFruitSpriteName: string;
  centerFruitSpriteId: string;
  fruitSpriteAvailability: Record<string, any>;
  roundTextColor: string;
  panelTextColor: string;
  panelTextStrokeColor: string;

  onInit() {
    if (!playerManager.isHost) return;

    this.worldWidth = 1500;
    this.worldHeight = 1500;
    this.playAreaWidth = 1296;
    this.arenaStartX = 76;
    this.tileSize = 160;
    // Tile art now meets edge-to-edge; all board-dependent geometry must use
    // the same zero-gap span as tileManager.
    this.tileGap = 0;
    this.arenaRows = 8;
    this.arenaCols = 6;
    this.centerCutoutRows = 2;
    this.centerCutoutCols = 2;
    this.centerCutoutStartRow = Math.floor(
      (this.arenaRows - this.centerCutoutRows) / 2,
    );
    this.centerCutoutStartCol = Math.floor(
      (this.arenaCols - this.centerCutoutCols) / 2,
    );
    this.arenaWidth = this.getArenaSpan(this.arenaCols);
    this.arenaHeight = this.getArenaSpan(this.arenaRows);
    this.arenaTop = Math.floor((this.worldHeight - this.arenaHeight) / 2);
    this.sidebarWidth = 300;
    this.sidebarPadding = 20;
    const arenaRightEdge = this.arenaStartX + this.arenaWidth;
    const rightColumnSpace = this.worldWidth - arenaRightEdge;
    this.sidebarX = arenaRightEdge +
      Math.floor((rightColumnSpace - this.sidebarWidth) / 2);
    this.panelSize = 340;
    const centerCutoutOffsetX = this.centerCutoutStartCol *
      (this.tileSize + this.tileGap);
    const centerCutoutOffsetY = this.centerCutoutStartRow *
      (this.tileSize + this.tileGap);
    const centerCutoutWidth = this.getArenaSpan(this.centerCutoutCols);
    const centerCutoutHeight = this.getArenaSpan(this.centerCutoutRows);
    this.panelX = this.arenaStartX + centerCutoutOffsetX +
      Math.floor((centerCutoutWidth - this.panelSize) / 2);
    this.panelY = this.arenaTop + centerCutoutOffsetY +
      Math.floor((centerCutoutHeight - this.panelSize) / 2);
    this.playerListPanelX = this.sidebarX;
    this.playerListPanelY = 90;
    this.playerListPanelWidth = this.sidebarWidth;
    this.playerListPanelHeight = 940;
    this.outZoneX = this.sidebarX;
    this.outZoneY = this.playerListPanelY + this.playerListPanelHeight +
      this.playerListPanelY;
    this.outZoneWidth = this.sidebarWidth;
    this.outZoneHeight = this.sidebarWidth;
    this.outZoneSpriteScale = 1.5;
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
    this.panelTextStrokeColor = "#7a1023";

    this.ensureStaticSprites();
    this.rebuildRectAreaBarriers();
    this.hideArenaBarriers();
    this.hideWinner();
    this.hideOutZone();
    this.hideCenterPanel();
  }

  ensureStaticSprites() {
    this.removeArenaDecorationSprite("arenaBackground");
    this.removeArenaDecorationSprite("arenaFrameTop");
    this.removeArenaDecorationSprite("arenaFrameBottom");

    if (!spriteManager.getSprite("centerDisplayRect")) {
      spriteManager.addSprite("displayRect", {
        uniqueId: "centerDisplayRect",
        positionX: this.panelX,
        positionY: this.panelY,
        width: this.panelSize,
        height: this.panelSize,
        fill: this.panelTextStrokeColor,
        bottomAdjust: "BRING_TO_FRONT",
        opacity: 0,
      });
    }

    spriteManager.updateSprite("centerDisplayRect", {
      positionX: this.panelX,
      positionY: this.panelY,
      width: this.panelSize,
      height: this.panelSize,
      fill: this.panelTextStrokeColor,
      bottomAdjust: "BRING_TO_FRONT",
      opacity: 0,
    });

    if (!spriteManager.getSprite("playerListPanel")) {
      spriteManager.addSprite("napkin", {
        uniqueId: "playerListPanel",
        positionX: this.playerListPanelX,
        positionY: this.playerListPanelY,
        opacity: 0,
      });
    }

    spriteManager.updateSprite("playerListPanel", {
      positionX: this.playerListPanelX,
      positionY: this.playerListPanelY,
      opacity: 0,
    });

    this.ensureTextSprite(
      "playerListTitleText",
      this.sidebarX + this.sidebarPadding,
      this.playerListTitleY,
      this.sidebarWidth - this.sidebarPadding * 2,
      30,
      "bold",
      "center",
    );
    let playerListTitleHiddenOptions: any;
    playerListTitleHiddenOptions = {
      text: "",
      opacity: 0,
      fontWeight: "bold",
      fontColor: "#F01135",
      strokeThickness: 4,
      strokeColor: "#000000",
      fontStrokeColor: "#000000",
    };
    spriteManager.updateSprite(
      "playerListTitleText",
      playerListTitleHiddenOptions,
    );

    this.ensureTextSprite(
      "centerTitleText",
      this.panelX,
      this.panelY + 75,
      this.panelSize,
      58,
      "bold",
      "center",
    );
    this.ensureTextSprite(
      "centerSubtitleText",
      this.panelX,
      this.panelY + 165,
      this.panelSize,
      34,
      "normal",
      "center",
    );
    this.ensureTextSprite(
      "centerFooterText",
      this.panelX,
      this.panelY + 235,
      this.panelSize,
      54,
      "bold",
      "center",
    );

    if (!spriteManager.getSprite("startButtonText")) {
      let startButtonAddOptions: any;
      startButtonAddOptions = {
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
      };
      spriteManager.addSprite("basicText", startButtonAddOptions);
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
      containerWidth: this.arenaWidth,
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
      containerWidth: this.arenaWidth,
    });

    if (!spriteManager.getSprite("outZoneRect")) {
      spriteManager.addSprite("basket", {
        uniqueId: "outZoneRect",
        positionX: this.getOutZoneSpriteX(),
        positionY: this.getOutZoneSpriteY(),
        scaleX: this.outZoneSpriteScale,
        scaleY: this.outZoneSpriteScale,
        opacity: 0,
      });
    }

    spriteManager.updateSprite("outZoneRect", {
      positionX: this.getOutZoneSpriteX(),
      positionY: this.getOutZoneSpriteY(),
      scaleX: this.outZoneSpriteScale,
      scaleY: this.outZoneSpriteScale,
      opacity: 0,
    });

    this.ensureTextSprite(
      "outZoneTitleText",
      this.outZoneX,
      this.getOutZoneTitleY(),
      this.outZoneWidth,
      28,
      "bold",
      "center",
    );
    let outZoneTitleHiddenOptions: any;
    outZoneTitleHiddenOptions = {
      positionX: this.outZoneX,
      positionY: this.getOutZoneTitleY(),
      containerWidth: this.outZoneWidth,
      text: "",
      fontColor: "#ffffff",
      strokeThickness: 3,
      strokeColor: "#000000",
      opacity: 0,
    };
    spriteManager.updateSprite("outZoneTitleText", outZoneTitleHiddenOptions);
  }

  removeArenaDecorationSprite(uniqueId: string) {
    if (!spriteManager.getSprite(uniqueId)) return;
    spriteManager.removeSprite(uniqueId);
  }

  ensureTextSprite(
    uniqueId: string,
    positionX: number,
    positionY: number,
    containerWidth: number,
    fontSize: number,
    fontWeight: string,
    align: string,
  ) {
    if (spriteManager.getSprite(uniqueId)) return;

    spriteManager.addSprite("basicText", {
      uniqueId: uniqueId,
      positionX: positionX,
      positionY: positionY,
      containerWidth: containerWidth,
      align: align,
      text: "",
      fontSize: fontSize,
      fontWeight: fontWeight,
    });
  }

  showLobby(hostName: string) {
    if (!playerManager.isHost) return;

    this.showCenterPanel();
    this.showPlayerListArea();
    this.showOutZone();
    this.hideArenaBarriers();
    this.hideWinner();
    this.hideCenterFruitSprite();
    this.centerFooterY = this.getRoundTimerY();

    this.setRoundLayoutToLobby();

    let centerTitleOptions: any;
    centerTitleOptions = {
      text: "Mind\nthe\nFruit",
      positionX: this.lobbyTitleX,
      positionY: this.getLobbyTitleY(),
      containerWidth: this.lobbyTextWidth,
      fontSize: 58,
      fontWeight: "bold",
      fontColor: "#1e1e1e",
      strokeThickness: 1.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerTitleText", centerTitleOptions);

    let centerSubtitleOptions: any;
    centerSubtitleOptions = {
      text: "Waiting for " + hostName + " to start.",
      positionX: this.lobbyTitleX,
      positionY: this.getLobbySubtitleY(),
      containerWidth: this.lobbyTextWidth,
      fontSize: 22,
      fontWeight: "normal",
      fontColor: "#1e1e1e",
      strokeThickness: 1.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerSubtitleText", centerSubtitleOptions);

    let centerFooterHiddenOptions: any;
    centerFooterHiddenOptions = {
      text: "",
      strokeThickness: 3.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerFooterText", centerFooterHiddenOptions);
    this.setCenterStartButtonText("Click here to start!", "#F01135");
  }

  showMemorizeRound(roundNumber: number) {
    if (!playerManager.isHost) return;

    this.showCenterPanel();
    this.showPlayerListArea();
    this.showOutZone();
    this.setRoundLayoutDefault();
    this.hideCenterFruitSprite();
    this.centerFooterY = this.getRoundTimerY();

    this.setCenterRoundText(roundNumber);
    this.setCenterPhasePromptText("Memorize the Fruits!");
    this.setCenterFooterText("", this.panelTextColor);
    this.hideStartButton();
  }

  showSafeFruit(fruitName: string) {
    if (!playerManager.isHost) return;

    const roundNumber = stateManager.getVariable("roundNumber");
    this.showCenterPanel();
    this.showPlayerListArea();
    this.showOutZone();
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

  showResolve(fruitName: string) {
    if (!playerManager.isHost) return;

    const roundNumber = stateManager.getVariable("roundNumber");
    this.showCenterPanel();
    this.showPlayerListArea();
    this.showOutZone();
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

  setCenterFooterText(text: string, color: string) {
    if (!playerManager.isHost) return;

    const contentWidth = this.getCenterContentWidth();
    let centerFooterOptions: any;
    centerFooterOptions = {
      positionX: this.panelX + this.getCenterContentPadding(),
      positionY: this.centerFooterY,
      containerWidth: contentWidth,
      text: text,
      align: "center",
      fontSize: this.getFittedFontSize(text, contentWidth, 30, 22),
      fontWeight: "bold",
      fontColor: color,
      strokeThickness: 3.5,
      strokeColor: this.getCenterPanelStrokeColor(color),
      fontStrokeColor: this.getCenterPanelStrokeColor(color),
    };
    spriteManager.updateSprite("centerFooterText", centerFooterOptions);
  }

  showCenterPanel() {
    if (!playerManager.isHost) return;

    spriteManager.updateSprite("centerDisplayRect", {
      positionX: this.panelX,
      positionY: this.panelY,
      width: this.panelSize,
      height: this.panelSize,
      fill: this.panelTextStrokeColor,
      bottomAdjust: "BRING_TO_FRONT",
      opacity: 1,
    });
  }

  hideCenterPanel() {
    if (!playerManager.isHost) return;

    spriteManager.updateSprite("centerDisplayRect", { opacity: 0 });

    let centerTitleHiddenOptions: any;
    centerTitleHiddenOptions = {
      text: "",
      strokeThickness: 3.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerTitleText", centerTitleHiddenOptions);

    let centerSubtitleHiddenOptions: any;
    centerSubtitleHiddenOptions = {
      text: "",
      strokeThickness: 3.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerSubtitleText", centerSubtitleHiddenOptions);

    let centerFooterHiddenOptions: any;
    centerFooterHiddenOptions = {
      text: "",
      strokeThickness: 3.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerFooterText", centerFooterHiddenOptions);

    this.hideCenterFruitSprite();
    this.hideStartButton();
  }

  hideStartButton() {
    if (!playerManager.isHost) return;
    const startButtonSprite = spriteManager.getSprite("startButtonText");
    if (!startButtonSprite) return;
    if (
      !startButtonSprite.text &&
      startButtonSprite.opacity === 0 &&
      !startButtonSprite.isInteractive
    ) {
      this.hideHostStartButton();
      return;
    }

    let startButtonHiddenOptions: any;
    startButtonHiddenOptions = {
      text: "",
      strokeThickness: 0,
      strokeColor: "#000000",
      opacity: 0,
      isInteractive: false,
    };
    spriteManager.updateSprite("startButtonText", startButtonHiddenOptions);
    this.hideHostStartButton();
  }

  setCenterStartButtonText(text: string, color: string) {
    if (!playerManager.isHost) return;
    const startButtonSprite = spriteManager.getSprite("startButtonText");
    if (!startButtonSprite) return;

    const desiredOpacity = text ? 1 : 0;
    if (
      startButtonSprite.text === text &&
      startButtonSprite.position.x === this.lobbyTitleX &&
      startButtonSprite.position.y === this.getLobbyButtonY() &&
      startButtonSprite.containerWidth === this.lobbyTextWidth &&
      startButtonSprite.opacity === desiredOpacity &&
      startButtonSprite.fontColor === color &&
      !!startButtonSprite.isInteractive
    ) {
      return;
    }

    let startButtonOptions: any;
    startButtonOptions = {
      text: text,
      positionX: this.lobbyTitleX,
      positionY: this.getLobbyButtonY(),
      containerWidth: this.lobbyTextWidth,
      fontSize: 24,
      opacity: text ? 1 : 0,
      isInteractive: true,
      fontColor: color,
      strokeThickness: 1.5,
      strokeColor: this.getCenterPanelStrokeColor(color),
      fontStrokeColor: this.getCenterPanelStrokeColor(color),
    };
    spriteManager.updateSprite("startButtonText", startButtonOptions);
  }

  updateHostStartButton(
    positionX: number,
    positionY: number,
    text: string,
    color: string,
  ) {
    if (!playerManager.isHost) return;
    const hostStartButtonSprite = spriteManager.getSprite("hostStartButton");
    if (!hostStartButtonSprite) return;

    const desiredOpacity = text ? 1 : 0;
    if (
      hostStartButtonSprite.position.x === positionX &&
      hostStartButtonSprite.position.y === positionY &&
      hostStartButtonSprite.text === text &&
      hostStartButtonSprite.opacity === desiredOpacity &&
      hostStartButtonSprite.fontColor === color &&
      !!hostStartButtonSprite.isInteractive
    ) {
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
    if (!playerManager.isHost) return;
    const hostStartButtonSprite = spriteManager.getSprite("hostStartButton");
    if (!hostStartButtonSprite) return;
    if (
      !hostStartButtonSprite.text &&
      hostStartButtonSprite.opacity === 0 &&
      !hostStartButtonSprite.isInteractive
    ) {
      return;
    }

    spriteManager.updateSprite("hostStartButton", {
      text: "",
      opacity: 0,
      isInteractive: false,
    });
  }

  setRoundLayoutToLobby() {
    if (!playerManager.isHost) return;

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
    if (!playerManager.isHost) return;

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

  setCenterRoundText(roundNumber: number) {
    if (!playerManager.isHost) return;

    const roundText = "Round " + roundNumber.toString();
    const contentWidth = this.getCenterContentWidth();
    let centerRoundOptions: any;
    centerRoundOptions = {
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
    };
    spriteManager.updateSprite("centerTitleText", centerRoundOptions);
  }

  setCenterPhasePromptText(text: string) {
    if (!playerManager.isHost) return;

    const displayText = this.getCenterPhasePromptDisplayText(text);
    const contentWidth = this.getCenterContentWidth();
    let centerSubtitleOptions: any;
    centerSubtitleOptions = {
      text: displayText,
      positionX: this.panelX + this.getCenterContentPadding(),
      positionY: this.getPhasePromptY(),
      containerWidth: contentWidth,
      fontSize: this.getFittedFontSize(displayText, contentWidth, 34, 18),
      fontWeight: "bold",
      fontColor: this.panelTextColor,
      align: "center",
      displayLayer: "TOP",
      topAdjust: 100,
      strokeThickness: 3.5,
      strokeColor: this.panelTextStrokeColor,
      fontStrokeColor: this.panelTextStrokeColor,
    };
    spriteManager.updateSprite("centerSubtitleText", centerSubtitleOptions);
  }

  getCenterPhasePromptDisplayText(text: string): string {
    if (text === "Memorize the Fruits!") {
      return "Memorize the\nFruits!";
    }

    if (text === "Stand on this fruit!") {
      return "Stand on this\nfruit!";
    }

    return text;
  }

  showCenterFruitSprite(fruitName: string): boolean {
    if (!playerManager.isHost) return false;
    if (!fruitName) return false;

    const desiredSpriteId = this.getCenterFruitSpriteId(fruitName);
    const centerFruitSprite = spriteManager.getSprite(desiredSpriteId);
    if (
      centerFruitSprite &&
      this.centerFruitSpriteId === desiredSpriteId
    ) {
      this.positionCenterFruitSprite(desiredSpriteId);
      return true;
    }

    this.removeCenterFruitSprite();

    if (this.fruitSpriteAvailability[fruitName] === false) {
      return false;
    }

    if (centerFruitSprite && spriteManager.getSprite(desiredSpriteId)) {
      spriteManager.removeSprite(desiredSpriteId);
    }

    let fruitSpriteId: any;
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
        applyPhysics: false,
      });
      this.centerFruitSpriteName = fruitName;
      this.centerFruitSpriteId = desiredSpriteId;
      this.fruitSpriteAvailability[fruitName] = true;
      return true;
    } catch (error) {
      this.centerFruitSpriteName = "";
      this.centerFruitSpriteId = "";
      this.fruitSpriteAvailability[fruitName] = false;
      return false;
    }
  }

  hideCenterFruitSprite() {
    this.removeCenterFruitSprite();
  }

  removeCenterFruitSprite() {
    if (!playerManager.isHost) return;

    const centerFruitSpriteId = this.getVisibleCenterFruitSpriteId();
    if (centerFruitSpriteId && spriteManager.getSprite(centerFruitSpriteId)) {
      spriteManager.removeSprite(centerFruitSpriteId);
    }

    if (
      centerFruitSpriteId !== "centerFruitSprite" &&
      spriteManager.getSprite("centerFruitSprite")
    ) {
      spriteManager.removeSprite("centerFruitSprite");
    }

    this.centerFruitSpriteName = "";
    this.centerFruitSpriteId = "";
  }

  getCenterFruitSpriteX(): number {
    return this.panelX +
      Math.floor((this.panelSize - this.getCenterFruitRenderedSize()) / 2);
  }

  getCenterFruitSpriteY(): number {
    return this.getCenterFruitVisualCenterY() -
      Math.floor(this.getCenterFruitRenderedSize() / 2);
  }

  getCenterFruitVisualCenterY(): number {
    return this.panelY + 166;
  }

  positionCenterFruitSprite(spriteId: string) {
    const centerFruitSprite = spriteManager.getSprite(spriteId);
    if (!centerFruitSprite) return;

    const desiredPositionX = this.getCenterFruitSpriteX();
    const desiredPositionY = this.getCenterFruitSpriteY();

    spriteManager.updateSprite(spriteId, {
      positionX: desiredPositionX,
      positionY: desiredPositionY,
      scaleX: this.centerFruitSpriteScale,
      scaleY: this.centerFruitSpriteScale,
      displayLayer: "TOP",
      topAdjust: this.getCenterFruitSpriteTopAdjust(),
    });
  }

  getCenterFruitRenderedSize(): number {
    return Math.floor(
      this.centerFruitBaseSpriteSize * this.centerFruitSpriteScale,
    );
  }

  getCenterFruitSpriteTopAdjust(): number {
    return 0;
  }

  getCenterFruitSpriteId(fruitName: string): string {
    // Reusing one synced uniqueId across different fruit assets can leave clients on a stale sprite.
    return "centerFruitSprite_" + fruitName;
  }

  getVisibleCenterFruitSpriteId(): string {
    if (this.centerFruitSpriteId) return this.centerFruitSpriteId;
    if (spriteManager.getSprite("centerFruitSprite")) return "centerFruitSprite";
    return "";
  }

  rebuildRectAreaBarriers() {
    if (!playerManager.isHost) return;

    this.removeBarrierSprites(this.getRectAreaBarrierSpriteIds());

    const barrierDefinitions = this.getRectAreaBarrierDefinitions();
    for (let i = 0; i < barrierDefinitions.length; i++) {
      this.addBarrierSprite(barrierDefinitions[i]);
    }
  }

  showArenaBarriers() {
    if (!playerManager.isHost) return;

    const barrierDefinitions = this.getArenaBarrierDefinitions();
    for (let i = 0; i < barrierDefinitions.length; i++) {
      this.addBarrierSprite(barrierDefinitions[i]);
    }
  }

  hideArenaBarriers() {
    if (!playerManager.isHost) return;
    this.removeBarrierSprites(this.getArenaBarrierSpriteIds());
  }

  removeBarrierSprites(barrierIds: string[]) {
    for (let i = 0; i < barrierIds.length; i++) {
      if (spriteManager.getSprite(barrierIds[i])) {
        spriteManager.removeSprite(barrierIds[i]);
      }
    }
  }

  addBarrierSprite(barrier: Record<string, any>) {
    if (spriteManager.getSprite(barrier.uniqueId)) return;

    spriteManager.addSprite("baseRect", {
      uniqueId: barrier.uniqueId,
      positionX: barrier.positionX,
      positionY: barrier.positionY,
      width: barrier.width,
      height: barrier.height,
      fill: "#000000",
      opacity: 0,
      displayLayer: "TOP",
      topAdjust: 60,
      checkCollisions: true,
      isImpassable: true,
    });
  }

  getArenaBarrierSpriteIds(): string[] {
    return [
      "arenaTopBarrier",
      "arenaBottomBarrier",
      "arenaLeftBarrier",
      "arenaRightBarrier",
    ];
  }

  getRectAreaBarrierSpriteIds(): string[] {
    return [
      "arenaCenterBarrier",
      "playerListBarrier",
    ];
  }

  getArenaBarrierDefinitions(): any[] {
    const barrierDefinitions: any[] = [];
    const arenaLeft = this.arenaStartX;
    const arenaTop = this.arenaTop;
    const arenaWallThickness = 16;
    const arenaWallInset = 8;
    const arenaWallExpansion = 50;
    const arenaWallLeft = arenaLeft - arenaWallInset - arenaWallExpansion;
    const arenaWallTop = arenaTop - arenaWallInset - arenaWallExpansion;
    const arenaWallWidth = this.arenaWidth + arenaWallThickness +
      arenaWallExpansion * 2;
    const arenaWallHeight = this.arenaHeight + arenaWallThickness +
      arenaWallExpansion * 2;
    barrierDefinitions.push({
      uniqueId: "arenaTopBarrier",
      positionX: arenaWallLeft,
      positionY: arenaWallTop,
      width: arenaWallWidth,
      height: arenaWallThickness,
    });
    barrierDefinitions.push({
      uniqueId: "arenaBottomBarrier",
      positionX: arenaWallLeft,
      positionY: arenaWallTop + arenaWallHeight - arenaWallThickness,
      width: arenaWallWidth,
      height: arenaWallThickness,
    });
    barrierDefinitions.push({
      uniqueId: "arenaLeftBarrier",
      positionX: arenaWallLeft,
      positionY: arenaWallTop,
      width: arenaWallThickness,
      height: arenaWallHeight,
    });
    barrierDefinitions.push({
      uniqueId: "arenaRightBarrier",
      positionX: arenaWallLeft + arenaWallWidth - arenaWallThickness,
      positionY: arenaWallTop,
      width: arenaWallThickness,
      height: arenaWallHeight,
    });

    return barrierDefinitions;
  }

  getRectAreaBarrierDefinitions(): any[] {
    const barrierDefinitions: any[] = [];
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
      uniqueId: "playerListBarrier",
      positionX: this.playerListPanelX + leaderboardBarrierInset,
      positionY: this.playerListPanelY + leaderboardBarrierInset,
      width: this.playerListPanelWidth - leaderboardBarrierInset * 2,
      height: this.playerListPanelHeight - leaderboardBarrierInset * 2,
    });

    return barrierDefinitions;
  }

  showWinner(playerName: string) {
    if (!playerManager.isHost) return;

    const contentWidth = this.getCenterContentWidth();
    const contentX = this.panelX + this.getCenterContentPadding();
    const winnerName = this.truncateTextToFit(playerName, contentWidth, 46);

    this.showCenterPanel();
    this.showPlayerListArea();
    this.showOutZone();
    this.hideCenterFruitSprite();
    this.hideStartButton();
    this.setRoundLayoutDefault();

    spriteManager.updateSprite("winnerText", {
      text: "",
      opacity: 0,
    });
    spriteManager.updateSprite("winnerCountdownText", {
      text: "",
      opacity: 0,
    });

    let winnerNameOptions: any;
    winnerNameOptions = {
      text: winnerName,
      positionX: contentX,
      positionY: this.panelY + 86,
      containerWidth: contentWidth,
      fontSize: this.getFittedFontSize(winnerName, contentWidth, 46, 24),
      fontWeight: "bold",
      fontColor: "#ffffff",
      align: "center",
      strokeThickness: 3.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerTitleText", winnerNameOptions);

    let winnerSubtitleOptions: any;
    winnerSubtitleOptions = {
      text: "wins!",
      positionX: contentX,
      positionY: this.panelY + 188,
      containerWidth: contentWidth,
      fontSize: 46,
      fontWeight: "bold",
      fontColor: "#ffffff",
      align: "center",
      strokeThickness: 3.5,
      strokeColor: "#000000",
    };
    spriteManager.updateSprite("centerSubtitleText", winnerSubtitleOptions);

    spriteManager.updateSprite("centerFooterText", {
      text: "",
    });
  }

  setWinnerCountdown(text: string) {
    if (!playerManager.isHost) return;

    spriteManager.updateSprite("winnerCountdownText", {
      text: text,
      opacity: text ? 1 : 0,
    });
  }

  hideWinner() {
    if (!playerManager.isHost) return;

    spriteManager.updateSprite("winnerText", { text: "", opacity: 0 });
    spriteManager.updateSprite("winnerCountdownText", { text: "", opacity: 0 });
    spriteManager.updateSprite("centerTitleText", { text: "" });
    spriteManager.updateSprite("centerSubtitleText", { text: "" });
    spriteManager.updateSprite("centerFooterText", { text: "" });
  }

  showOutZone() {
    if (!playerManager.isHost) return;

    spriteManager.updateSprite("outZoneRect", {
      positionX: this.getOutZoneSpriteX(),
      positionY: this.getOutZoneSpriteY(),
      scaleX: this.outZoneSpriteScale,
      scaleY: this.outZoneSpriteScale,
      opacity: 0.9,
    });
    let outZoneTitleOptions: any;
    outZoneTitleOptions = {
      positionX: this.outZoneX,
      positionY: this.getOutZoneTitleY(),
      containerWidth: this.outZoneWidth,
      text: "Penalty Basket",
      fontSize: 28,
      fontWeight: "bold",
      fontColor: "#ffffff",
      strokeThickness: 3,
      strokeColor: "#000000",
      opacity: 1,
    };
    spriteManager.updateSprite("outZoneTitleText", outZoneTitleOptions);
  }

  hideOutZone() {
    if (!playerManager.isHost) return;

    spriteManager.updateSprite("outZoneRect", { opacity: 0 });
    spriteManager.updateSprite("outZoneTitleText", {
      text: "",
      opacity: 0,
    });
  }

  showPlayerListArea() {
    if (!playerManager.isHost) return;

    spriteManager.updateSprite("playerListPanel", {
      positionX: this.playerListPanelX,
      positionY: this.playerListPanelY,
      width: this.playerListPanelWidth,
      height: this.playerListPanelHeight,
      opacity: 0.92,
    });
    let playerListTitleOptions: any;
    playerListTitleOptions = {
      positionX: this.sidebarX + this.sidebarPadding,
      positionY: this.playerListTitleY,
      containerWidth: this.sidebarWidth - this.sidebarPadding * 2,
      text: "Players",
      align: "center",
      fontSize: 30,
      fontWeight: "bold",
      fontColor: "#F01135",
      opacity: 1,
      strokeThickness: 4,
      strokeColor: "#000000",
      fontStrokeColor: "#000000",
    };
    spriteManager.updateSprite("playerListTitleText", playerListTitleOptions);
  }

  refreshPlayerList(phase: string) {
    if (!playerManager.isHost) return;

    this.showPlayerListArea();

    const playerLifeMap = stateManager.getVariable("playerLifeMap");
    const connectedPlayerIds = playerManager.getPlayerIds();
    const orderedPlayerIds: number[] = [];
    const outPlayerIds: number[] = [];
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
      const truncatedPlayerName = this.truncateTextToFit(
        playerName,
        entryTextWidth,
        27,
      );

      let playerListEntryOptions: any;
      playerListEntryOptions = {
        positionX: this.sidebarX + this.sidebarPadding,
        positionY: startY + i * entrySpacing,
        containerWidth: this.sidebarWidth - this.sidebarPadding * 2,
        text: truncatedPlayerName,
        align: "left",
        fontSize: 27,
        fontWeight: "bold",
        fontColor: isOut ? "#808080" : "#F01135",
        opacity: 1,
        strokeThickness: 0,
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

  ensurePlayerListEntrySprite(index: number): string {
    const entryId = "playerListEntryText_" + index.toString();
    if (!spriteManager.getSprite(entryId)) {
      let playerListEntryAddOptions: any;
      playerListEntryAddOptions = {
        uniqueId: entryId,
        positionX: this.sidebarX + this.sidebarPadding,
        positionY: this.playerListPanelY,
        containerWidth: this.sidebarWidth - this.sidebarPadding * 2,
        align: "left",
        text: "",
        fontSize: 27,
        fontWeight: "bold",
        fontColor: "#F01135",
        opacity: 0,
        strokeThickness: 0,
      };
      spriteManager.addSprite("basicText", playerListEntryAddOptions);
    }

    if (index < this.playerListEntryIds.length) {
      this.playerListEntryIds[index] = entryId;
    } else {
      this.playerListEntryIds.push(entryId);
    }
    return entryId;
  }

  getCenterContentPadding(): number {
    return 16;
  }

  getArenaSpan(tileCount: number): number {
    return tileCount * this.tileSize + (tileCount - 1) * this.tileGap;
  }

  isCenterPanelRedTextColor(color: string): boolean {
    return color === this.panelTextColor || color === "#F01135";
  }

  getCenterPanelStrokeColor(color: string): string {
    if (this.isCenterPanelRedTextColor(color)) {
      return this.panelTextStrokeColor;
    }

    return "#000000";
  }

  getCenterContentWidth(): number {
    return this.panelSize - this.getCenterContentPadding() * 2;
  }

  getOutZoneTitleY(): number {
    return this.outZoneY - 36;
  }

  getOutZoneSpriteX(): number {
    return this.outZoneX - Math.floor(
      this.outZoneWidth * (this.outZoneSpriteScale - 1) / 2,
    );
  }

  getOutZoneSpriteY(): number {
    return this.outZoneY - Math.floor(
      this.outZoneHeight * (this.outZoneSpriteScale - 1) / 2,
    );
  }

  getRoundTextY(): number {
    return this.panelY + 12;
  }

  getPhasePromptY(): number {
    return this.panelY + 42;
  }

  getRoundTimerY(): number {
    return this.panelY + 262;
  }

  getLobbyTitleY(): number {
    return this.panelY + 8;
  }

  getLobbySubtitleY(): number {
    return this.panelY + 214;
  }

  getLobbyButtonY(): number {
    return this.panelY + 261;
  }

  getFittedFontSize(
    text: string,
    maxWidth: number,
    preferredFontSize: number,
    minimumFontSize: number,
  ): number {
    if (!text) return preferredFontSize;

    let fontSize = preferredFontSize;
    while (
      fontSize > minimumFontSize &&
      this.getTextBlockWidth(text, fontSize) > maxWidth
    ) {
      fontSize -= 1;
    }

    return fontSize;
  }

  getTextBlockWidth(text: string, fontSize: number): number {
    if (!text) return 0;

    const lines = text.split("\n");
    let widestLine = 0;

    for (let i = 0; i < lines.length; i++) {
      widestLine = Math.max(
        widestLine,
        this.estimateTextWidth(lines[i], fontSize),
      );
    }

    return widestLine;
  }

  getPlayerName(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (playerDetails && playerDetails.username) {
      return playerDetails.username;
    }

    return "Player " + playerId.toString();
  }

  estimateTextWidth(text: string, fontSize: number): number {
    if (!text) return 0;

    let emojiCount = 0;
    let regularCharCount = 0;

    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff) {
        emojiCount += 1;
        i += 1;
      } else if (code >= 0x2600 && code <= 0x27bf) {
        emojiCount += 1;
      } else {
        regularCharCount += 1;
      }
    }

    const charWidth = Math.max(8, fontSize * 0.6);
    const emojiWidth = charWidth * 2.6;
    const baseWidth = regularCharCount * charWidth + emojiCount * emojiWidth;

    return baseWidth * 1.12;
  }

  truncateTextToFit(text: string, maxWidth: number, fontSize: number): string {
    if (!text) return "";
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
      if (!truncatedText) break;

      if (
        this.estimateTextWidth(truncatedText + ellipsis, fontSize) <= maxWidth
      ) {
        return truncatedText + ellipsis;
      }
    }

    return ellipsis;
  }

  removeLastDisplayChar(text: string): string {
    if (!text) return "";

    const lastIndex = text.length - 1;
    if (lastIndex <= 0) return "";

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

  toDisplayFruitName(fruitName: string): string {
    if (!fruitName) return "";
    return fruitName.charAt(0).toUpperCase() + fruitName.slice(1);
  }
}
