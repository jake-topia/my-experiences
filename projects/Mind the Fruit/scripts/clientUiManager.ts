class clientUiManager extends SystemScript {
  outTextId: string;
  outTextVisible: boolean;
  myPlayerId: number;
  refreshRetryFrames: number;
  currentGamePhase: any;
  currentPlayerLifeMap: any;
  hasCurrentGamePhase: boolean;
  hasCurrentPlayerLifeMap: boolean;

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

    if (this.refreshRetryFrames <= 0) return;

    this.refreshRetryFrames -= 1;
    this.applyOutTextState();
  }

  onVariableChanged_gamePhase({
    newValue,
  }: {
    newValue: any;
  }) {
    this.currentGamePhase = newValue;
    this.hasCurrentGamePhase = true;
    this.scheduleRefreshRetry();
    this.applyOutTextState();
  }

  onVariableChanged_playerLifeMap({
    oldValue,
    newValue,
  }: {
    oldValue: any;
    newValue: any;
  }) {
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

    if (spriteManager.getSprite(this.outTextId)) return;

    const outTextLayout = this.getOutTextLayout();
    let outTextAddOptions: any;
    outTextAddOptions = {
      uniqueId: this.outTextId,
      positionX: outTextLayout.positionX,
      positionY: outTextLayout.positionY,
      containerWidth: outTextLayout.containerWidth,
      align: "center",
      text: "",
      fontSize: 34,
      fontWeight: "bold",
      fontColor: "#b21e35",
      topAdjust: 0,
      strokeThickness: 4,
      opacity: 0,
      isPlayerControlled: true,
    };
    spriteManager.addSprite("basicText", outTextAddOptions);

    this.outTextVisible = false;
  }

  getOutTextLayout(): {
    positionX: number;
    positionY: number;
    containerWidth: number;
  } {
    const outZoneRect = spriteManager.getSprite("outZoneRect");
    if (outZoneRect) {
      return {
        positionX: outZoneRect.position.x,
        positionY: outZoneRect.position.y + outZoneRect.height + 8,
        containerWidth: outZoneRect.width,
      };
    }

    return {
      positionX: 1128,
      positionY: 1428,
      containerWidth: 300,
    };
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

  getMyPlayerId(): number {
    if (!this.myPlayerId) {
      this.myPlayerId = playerManager.getMyPlayerId();
    }

    return this.myPlayerId;
  }

  showOutText() {
    this.ensureOutTextSprite();
    if (!spriteManager.getSprite(this.outTextId)) return;

    const outTextLayout = this.getOutTextLayout();
    let outTextOptions: any;
    outTextOptions = {
      positionX: outTextLayout.positionX,
      positionY: outTextLayout.positionY,
      containerWidth: outTextLayout.containerWidth,
      text: "You're Out!",
      opacity: 1,
      strokeThickness: 4,
    };
    spriteManager.updateSprite(this.outTextId, outTextOptions);
    this.outTextVisible = true;
  }

  hideOutText() {
    this.ensureOutTextSprite();
    if (!spriteManager.getSprite(this.outTextId)) return;

    const outTextLayout = this.getOutTextLayout();
    let hiddenOutTextOptions: any;
    hiddenOutTextOptions = {
      positionX: outTextLayout.positionX,
      positionY: outTextLayout.positionY,
      containerWidth: outTextLayout.containerWidth,
      text: "",
      opacity: 0,
      strokeThickness: 4,
    };
    spriteManager.updateSprite(this.outTextId, hiddenOutTextOptions);
    this.outTextVisible = false;
  }
}
