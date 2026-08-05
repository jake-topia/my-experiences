const REWIND_ITEM_NAME = "Rewind";

class clientUiManager extends SystemScript {
  outTextId: string;
  rewindPromptId: string;
  outTextVisible: boolean;
  rewindPromptVisible: boolean;
  myPlayerId: number;
  refreshRetryFrames: number;
  currentGamePhase: any;
  currentPlayerLifeMap: any;
  currentPlayerRewindUsedMap: any;
  hasCurrentGamePhase: boolean;
  hasCurrentPlayerLifeMap: boolean;
  hasCurrentPlayerRewindUsedMap: boolean;
  lastRewindItemId: string;
  rewindItemQuantity: number;
  hasLoadedRewindQuantity: boolean;
  isLoadingRewindQuantity: boolean;
  pendingRewindRequest: boolean;

  onInit() {
    this.outTextId = "localOutText";
    this.rewindPromptId = "localRewindPromptText";
    this.outTextVisible = false;
    this.rewindPromptVisible = false;
    this.myPlayerId = 0;
    this.refreshRetryFrames = 0;
    this.currentGamePhase = "";
    this.currentPlayerLifeMap = null;
    this.currentPlayerRewindUsedMap = null;
    this.hasCurrentGamePhase = false;
    this.hasCurrentPlayerLifeMap = false;
    this.hasCurrentPlayerRewindUsedMap = false;
    this.lastRewindItemId = "";
    this.rewindItemQuantity = 0;
    this.hasLoadedRewindQuantity = false;
    this.isLoadingRewindQuantity = false;
    this.pendingRewindRequest = false;
    this.ensureOutTextSprite();
    this.ensureRewindPromptSprite();
    this.primeStateFromVariables();
    this.applyOutTextState();
    this.fetchMyRewindQuantity();
  }

  onPlayerStart() {
    this.myPlayerId = playerManager.getMyPlayerId();
    this.scheduleRefreshRetry();
    this.ensureOutTextSprite();
    this.ensureRewindPromptSprite();
    this.primeStateFromVariables();
    this.fetchMyRewindQuantity();
    this.applyOutTextState();
  }

  onSpectatorStart() {
    this.myPlayerId = playerManager.getMyPlayerId();
    this.scheduleRefreshRetry();
    this.ensureOutTextSprite();
    this.ensureRewindPromptSprite();
    this.primeStateFromVariables();
    this.fetchMyRewindQuantity();
    this.applyOutTextState();
  }

  onStep() {
    if (!spriteManager.getSprite(this.outTextId)) {
      this.ensureOutTextSprite();
      this.scheduleRefreshRetry();
    }
    if (!spriteManager.getSprite(this.rewindPromptId)) {
      this.ensureRewindPromptSprite();
      this.scheduleRefreshRetry();
    }

    if (!this.hasLoadedRewindQuantity && !this.isLoadingRewindQuantity) {
      this.fetchMyRewindQuantity();
    }

    if (this.refreshRetryFrames <= 0) return;

    this.refreshRetryFrames -= 1;
    this.applyOutTextState();
  }

  onSpriteClicked({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || sprite.uniqueId !== this.rewindPromptId) return;
    if (!this.canUseRewindNow()) return;
    if (this.pendingRewindRequest) return;

    this.pendingRewindRequest = true;
    eventManager.emit("playerRequestsRewindUse", {
      fromPlayerId: this.getMyPlayerId(),
    });
    this.scheduleRefreshRetry();
    this.applyOutTextState();
  }

  onVariableChanged_gamePhase({
    newValue,
  }: {
    newValue: any;
  }) {
    this.currentGamePhase = newValue;
    this.hasCurrentGamePhase = true;
    if (newValue === "WAITING" || newValue === "MEMORIZE") {
      this.pendingRewindRequest = false;
    }
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
    if (newValue && newValue[this.getMyPlayerId().toString()] === true) {
      this.pendingRewindRequest = false;
    }
    this.scheduleRefreshRetry();
    this.applyOutTextState();
  }

  onVariableChanged_playerRewindUsedMap({
    newValue,
  }: {
    newValue: any;
  }) {
    this.currentPlayerRewindUsedMap = newValue;
    this.hasCurrentPlayerRewindUsedMap = true;
    if (
      newValue &&
      newValue[this.getMyPlayerId().toString()] === true
    ) {
      this.pendingRewindRequest = false;
    }
    this.scheduleRefreshRetry();
    this.applyOutTextState();
  }

  onVariableChanged_roundResolutionNonce() {
    this.scheduleRefreshRetry();
    this.applyOutTextState();
  }

  onEvent_USER_INVENTORY_ITEM_UPDATE(payload: {
    itemId: string;
    name: string;
    quantity: number;
    grantedByPlayerId: string;
    playerId: string;
    droppedAssetId: string;
  }) {
    if (payload.name !== REWIND_ITEM_NAME) return;

    this.lastRewindItemId = payload.itemId;
    this.rewindItemQuantity = payload.quantity;
    this.hasLoadedRewindQuantity = true;
    this.isLoadingRewindQuantity = false;
    this.pendingRewindRequest = false;
    this.scheduleRefreshRetry();
    this.applyOutTextState();
  }

  scheduleRefreshRetry() {
    this.refreshRetryFrames = 60;
  }

  primeStateFromVariables() {
    this.currentGamePhase = stateManager.getVariable("gamePhase");
    this.currentPlayerLifeMap = stateManager.getVariable("playerLifeMap");
    this.currentPlayerRewindUsedMap = stateManager.getVariable("playerRewindUsedMap");
    this.hasCurrentGamePhase = true;
    this.hasCurrentPlayerLifeMap = true;
    this.hasCurrentPlayerRewindUsedMap = true;
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

  ensureRewindPromptSprite() {
    if (!this.rewindPromptId) {
      this.rewindPromptId = "localRewindPromptText";
    }

    if (spriteManager.getSprite(this.rewindPromptId)) return;

    const rewindPromptLayout = this.getRewindPromptLayout();
    let rewindPromptAddOptions: any;
    rewindPromptAddOptions = {
      uniqueId: this.rewindPromptId,
      positionX: rewindPromptLayout.positionX,
      positionY: rewindPromptLayout.positionY,
      containerWidth: rewindPromptLayout.containerWidth,
      align: "center",
      text: "",
      fontSize: 22,
      fontWeight: "bold",
      fontColor: "#6b6b6b",
      topAdjust: 0,
      strokeThickness: 3,
      strokeColor: "#000000",
      opacity: 0,
      isInteractive: false,
      isPlayerControlled: true,
    };
    spriteManager.addSprite("basicText", rewindPromptAddOptions);

    this.rewindPromptVisible = false;
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

  getRewindPromptLayout(): {
    positionX: number;
    positionY: number;
    containerWidth: number;
  } {
    const outTextLayout = this.getOutTextLayout();
    return {
      positionX: outTextLayout.positionX,
      positionY: outTextLayout.positionY + 56,
      containerWidth: outTextLayout.containerWidth,
    };
  }

  async fetchMyRewindQuantity() {
    if (this.isLoadingRewindQuantity) return;

    const myPlayerId = this.getMyPlayerId();
    if (!myPlayerId) return;

    const publicKey = this.getInteractivePublicKey();
    if (!publicKey) return;

    const playerDetails = playerManager.getPlayerDetails(myPlayerId);
    if (!playerDetails || !playerDetails.profileId) return;

    this.isLoadingRewindQuantity = true;

    try {
      const targetItemId = await this.getTargetItemId();
      if (!targetItemId) {
        this.rewindItemQuantity = 0;
        this.hasLoadedRewindQuantity = true;
        return;
      }

      const ownedItems = await integrationsManager.getUserInventoryItems({
        interactivePublicKey: publicKey,
        profileId: playerDetails.profileId,
      });
      let rewindQuantity = 0;
      for (let i = 0; i < ownedItems.length; i++) {
        if (ownedItems[i].itemId === targetItemId) {
          rewindQuantity = ownedItems[i].quantity;
          break;
        }
      }

      this.rewindItemQuantity = rewindQuantity;
      this.hasLoadedRewindQuantity = true;
    } catch (e) {
      console.log("Unable to fetch Rewind inventory", { e });
    } finally {
      this.isLoadingRewindQuantity = false;
    }
    this.scheduleRefreshRetry();
    this.applyOutTextState();
  }

  async getTargetItemId(): Promise<string> {
    if (this.lastRewindItemId) return this.lastRewindItemId;
    if (!integrationsManager.getPublicKeyInventoryItems) return "";

    const publicKey = this.getInteractivePublicKey();
    if (!publicKey) return "";

    try {
      const publicKeyItems = await integrationsManager.getPublicKeyInventoryItems({
        interactivePublicKey: publicKey,
      });

      for (let i = 0; i < publicKeyItems.length; i++) {
        if (publicKeyItems[i].name === REWIND_ITEM_NAME) {
          this.lastRewindItemId = publicKeyItems[i].id;
          return this.lastRewindItemId;
        }
      }
    } catch (e) {
      console.log("Unable to resolve Rewind catalog item id", { e });
    }

    return "";
  }

  getInteractivePublicKey(): string {
    return stateManager.getVariable("publicKey");
  }

  applyOutTextState() {
    this.ensureOutTextSprite();
    this.ensureRewindPromptSprite();

    if (
      !this.hasCurrentGamePhase ||
      !this.hasCurrentPlayerLifeMap ||
      !this.hasCurrentPlayerRewindUsedMap
    ) {
      this.hideOutUi();
      return;
    }

    if (this.currentGamePhase === "WAITING") {
      this.hideOutUi();
      return;
    }

    const myPlayerId = this.getMyPlayerId();
    if (!myPlayerId || !this.currentPlayerLifeMap) {
      this.hideOutUi();
      return;
    }

    const isOut = this.currentPlayerLifeMap[myPlayerId.toString()] === false;
    if (!isOut) {
      this.hideOutUi();
      return;
    }

    this.showOutText();
    this.showRewindPrompt();
  }

  hideOutUi() {
    if (this.outTextVisible) {
      this.hideOutText();
    }
    if (this.rewindPromptVisible) {
      this.hideRewindPrompt();
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
      fontColor: "#b21e35",
    };
    spriteManager.updateSprite(this.outTextId, outTextOptions);
    this.outTextVisible = true;
  }

  showRewindPrompt() {
    this.ensureRewindPromptSprite();
    if (!spriteManager.getSprite(this.rewindPromptId)) return;

    const rewindPromptLayout = this.getRewindPromptLayout();
    const isClickable = this.canUseRewindNow();
    const quantityText = this.hasLoadedRewindQuantity
      ? this.rewindItemQuantity.toString()
      : "...";
    let promptText =
      "Click here to use \u23EA.\n(" + quantityText +
      " \u23EA items remaining)";

    if (this.pendingRewindRequest) {
      promptText += "\nUsing \u23EA...";
    } else if (this.playerAlreadyUsedRewindThisGame()) {
      promptText += "\nYou already used \u23EA this game.";
    } else if (!this.isRewindTimingWindowOpen()) {
      promptText += "\nAvailable when 1 player is left alive.";
    } else if (this.hasLoadedRewindQuantity && this.rewindItemQuantity <= 0) {
      promptText += "\nYou do not have a \u23EA item.";
    }

    let rewindPromptOptions: any;
    rewindPromptOptions = {
      positionX: rewindPromptLayout.positionX,
      positionY: rewindPromptLayout.positionY,
      containerWidth: rewindPromptLayout.containerWidth,
      text: promptText,
      fontSize: 22,
      fontWeight: "bold",
      fontColor: isClickable ? "#1d6d2b" : "#6b6b6b",
      opacity: 1,
      strokeThickness: 3,
      strokeColor: "#000000",
      isInteractive: isClickable,
    };
    spriteManager.updateSprite(this.rewindPromptId, rewindPromptOptions);
    this.rewindPromptVisible = true;
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

  hideRewindPrompt() {
    this.ensureRewindPromptSprite();
    if (!spriteManager.getSprite(this.rewindPromptId)) return;

    const rewindPromptLayout = this.getRewindPromptLayout();
    let hiddenRewindPromptOptions: any;
    hiddenRewindPromptOptions = {
      positionX: rewindPromptLayout.positionX,
      positionY: rewindPromptLayout.positionY,
      containerWidth: rewindPromptLayout.containerWidth,
      text: "",
      opacity: 0,
      strokeThickness: 3,
      isInteractive: false,
    };
    spriteManager.updateSprite(this.rewindPromptId, hiddenRewindPromptOptions);
    this.rewindPromptVisible = false;
  }

  getAlivePlayerCount(): number {
    if (!this.currentPlayerLifeMap) return 0;

    const connectedPlayerIds = playerManager.getPlayerIds();
    let alivePlayerCount = 0;
    for (let i = 0; i < connectedPlayerIds.length; i++) {
      if (this.currentPlayerLifeMap[connectedPlayerIds[i].toString()] === true) {
        alivePlayerCount += 1;
      }
    }

    return alivePlayerCount;
  }

  playerAlreadyUsedRewindThisGame(): boolean {
    const myPlayerId = this.getMyPlayerId();
    if (!myPlayerId || !this.currentPlayerRewindUsedMap) return false;

    return this.currentPlayerRewindUsedMap[myPlayerId.toString()] === true;
  }

  isRewindTimingWindowOpen(): boolean {
    return this.currentGamePhase === "RESOLVE" && this.getAlivePlayerCount() === 1;
  }

  canUseRewindNow(): boolean {
    if (!this.hasCurrentPlayerLifeMap || !this.currentPlayerLifeMap) return false;
    if (this.currentPlayerLifeMap[this.getMyPlayerId().toString()] !== false) {
      return false;
    }
    if (this.pendingRewindRequest) return false;
    if (this.playerAlreadyUsedRewindThisGame()) return false;
    if (!this.isRewindTimingWindowOpen()) return false;
    if (!this.hasLoadedRewindQuantity) return false;

    return this.rewindItemQuantity > 0;
  }
}
