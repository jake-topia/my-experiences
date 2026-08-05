class nightUIManager extends SystemScript {
  uiSystem: any;
  currentState: any;
  localSelectedTargetId: number;
  localFramerDisguisePlayerId: number;
  localTricksterActionName: string;
  tricksterEliminateUnavailable: boolean;
  lastPhaseNonce: number;
  lightColor: string;
  yellowColor: string;
  greyColor: string;

  onInit() {
    this.currentState = {};
    this.localSelectedTargetId = 0;
    this.localFramerDisguisePlayerId = 0;
    this.localTricksterActionName = "";
    this.tricksterEliminateUnavailable = false;
    this.lastPhaseNonce = -1;
    this.lightColor = "#fff7df";
    this.yellowColor = "#f0d04f";
    this.greyColor = "#a0a0a0";
    this.ensureUiSystem();
  }

  onSpriteClicked({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || !sprite.uniqueId) return;
    if (!this.currentState || this.currentState.phase !== "NIGHT") return;

    if (sprite.uniqueId === "ui_trickster_action_case") {
      this.selectTricksterAction("CASE");
      return;
    }

    if (sprite.uniqueId === "ui_trickster_action_eliminate") {
      this.selectTricksterAction("ELIMINATE");
      return;
    }

    let playerIdText = "";
    if (sprite.uniqueId.indexOf("ui_seat_hit_") === 0) {
      playerIdText = sprite.uniqueId.replace("ui_seat_hit_", "");
    } else if (sprite.uniqueId.indexOf("ui_name_") === 0) {
      playerIdText = sprite.uniqueId.replace("ui_name_", "");
    } else if (sprite.uniqueId.indexOf("ui_vote_") === 0) {
      playerIdText = sprite.uniqueId.replace("ui_vote_", "");
    } else {
      return;
    }

    this.submitTarget(parseInt(playerIdText, 10));
  }

  render(state: any) {
    this.ensureUiSystem();
    this.currentState = state || {};

    if (
      this.currentState.phase !== "NIGHT" &&
      this.currentState.phase !== "NIGHT_BUFFER"
    ) {
      this.localSelectedTargetId = 0;
      this.localFramerDisguisePlayerId = 0;
      this.localTricksterActionName = "";
      this.tricksterEliminateUnavailable = false;
      this.lastPhaseNonce = -1;
      this.uiSystem.hideText("ui_night_action_message");
      this.hideTricksterActionChoice();
      return;
    }

    if (this.currentState.phase === "NIGHT_BUFFER") {
      this.hideTricksterActionChoice();
      this.renderBufferPrompt();
      return;
    }

    if (this.lastPhaseNonce !== this.currentState.phaseNonce) {
      this.lastPhaseNonce = this.currentState.phaseNonce;
      this.localSelectedTargetId = this.getSyncedSelectedTargetId();
      this.localFramerDisguisePlayerId =
        this.getSyncedFramerDisguisePlayerId();
      this.localTricksterActionName = this.getSyncedTricksterActionName();
      this.tricksterEliminateUnavailable = false;
    } else {
      const syncedTargetId = this.getSyncedSelectedTargetId();
      if (syncedTargetId > 0) this.localSelectedTargetId = syncedTargetId;
      const syncedDisguisePlayerId = this.getSyncedFramerDisguisePlayerId();
      if (syncedDisguisePlayerId > 0) {
        this.localFramerDisguisePlayerId = syncedDisguisePlayerId;
      }
      const syncedTricksterActionName = this.getSyncedTricksterActionName();
      if (syncedTricksterActionName) {
        this.localTricksterActionName = syncedTricksterActionName;
      }
    }

    this.renderTricksterActionChoice();
    this.renderPrompt();
    this.renderSeatActions();
  }

  renderBufferPrompt() {
    this.uiSystem.updateText("ui_night_action_message", {
      positionX: 210,
      positionY: 625,
      containerWidth: 1080,
      align: "center",
      text: "All night choices are locked. Resolving the night...",
      fontSize: 34,
      fontWeight: "bold",
      fontColor: this.lightColor,
      opacity: 1,
      isInteractive: false,
      topAdjust: 1300,
    });
  }

  renderPrompt() {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "nightUIManager.renderPrompt",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};
    const roleName = roleMap[myPlayerId.toString()] || "";
    let promptText = "Spectating Night " + this.currentState.roundNumber.toString();
    let promptColor = this.lightColor;

    if (roleName && aliveMap[myPlayerId.toString()] === false) {
      promptText = "You are Eliminated. Wait for Night " +
        this.currentState.roundNumber.toString() + " to end.";
    } else if (roleName) {
      const actionName = this.getMyActionName();
      if (roleName === "TRICKSTER" && !actionName) {
        promptText = "";
      } else {
        promptText = this.getActionPrompt(actionName);
        promptColor = this.getActionColor(actionName);
      }
    }

    this.uiSystem.updateText("ui_night_action_message", {
      positionX: 210,
      positionY: 625,
      containerWidth: 1080,
      align: "center",
      text: promptText,
      fontSize: 34,
      fontWeight: "bold",
      fontColor: promptColor,
      opacity: 1,
      isInteractive: false,
      topAdjust: 1300,
    });
  }

  getActionPrompt(actionName: string): string {
    if (actionName === "INVESTIGATE") {
      return "Choose a player to INVESTIGATE and learn where they went.";
    }
    if (actionName === "WATCH") {
      return "Choose a player's house to WATCH for visitors.";
    }
    if (actionName === "CASE") {
      return "Choose a player to CASE and secretly learn their role.";
    }
    if (actionName === "ELIMINATE") {
      return "Choose a CASED player to ELIMINATE.";
    }
    if (actionName === "GUARD") {
      return "Choose a player to GUARD from visits.";
    }
    if (actionName === "VISIT") {
      return "Choose a player to VISIT. Your visit has no effect.";
    }
    if (actionName === "DISTRACT") {
      return "Choose a player to DISTRACT and stop their action.";
    }
    if (actionName === "FRAME") {
      if (!(this.localFramerDisguisePlayerId > 0)) {
        return "First vote: choose a player to DISGUISE AS.";
      }
      if (!(this.localSelectedTargetId > 0)) {
        return (
          "Disguised as " +
          this.getPlayerName(this.localFramerDisguisePlayerId) +
          ". Second vote: choose a player to VISIT."
        );
      }
      return (
        "You will appear as " +
        this.getPlayerName(this.localFramerDisguisePlayerId) +
        " while visiting " +
        this.getPlayerName(this.localSelectedTargetId) +
        ". Click a player to start both votes over."
      );
    }
    if (actionName === "SLEEP") {
      return "Choose a player to visit and make SLEEPY for this night.";
    }
    return "You have no available night action.";
  }

  renderSeatActions() {
    const seatMap = this.debugReadStateMap(
      "playerSeatMap",
      "nightUIManager.renderSeatActions",
      this.currentState.seatMap || {},
    );
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "nightUIManager.renderSeatActions",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};
    const playerIds = Object.keys(seatMap);
    const actionName = this.getMyActionName();

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = parseInt(playerIds[i], 10);
      const seatData = seatMap[playerIds[i]];
      const isValid = this.isValidTarget(playerId, actionName, roleMap, aliveMap);
      const isSelected = isValid && playerId === this.localSelectedTargetId;
      const isFramer = actionName === "FRAME";
      const isDisguise =
        isFramer && playerId === this.localFramerDisguisePlayerId;
      const isFramerSelected = isDisguise || isSelected;
      let voteText = isSelected ? "SELECTED" : "CHOOSE";

      if (isFramer) {
        if (isDisguise && isSelected) {
          voteText = "BOTH";
        } else if (isDisguise) {
          voteText = "DISGUISE";
        } else if (isSelected) {
          voteText = "VISIT";
        } else if (!(this.localFramerDisguisePlayerId > 0)) {
          voteText = "DISGUISE?";
        } else if (!(this.localSelectedTargetId > 0)) {
          voteText = "VISIT?";
        } else {
          voteText = "RESTART?";
        }
      }

      if (isValid || isDisguise) {
        this.uiSystem.updateText("ui_vote_" + playerIds[i], {
          positionX: seatData.voteX,
          positionY: seatData.voteY,
          containerWidth: seatData.labelWidth,
          align: "center",
          text: voteText,
          fontSize: 20,
          fontWeight: "bold",
          fontColor: this.yellowColor,
          opacity: 1,
          isInteractive: isValid,
          topAdjust: 1400,
        });
      } else {
        this.uiSystem.updateText("ui_vote_" + playerIds[i], {
          positionX: seatData.voteX,
          positionY: seatData.voteY,
          containerWidth: seatData.labelWidth,
          align: "center",
          text: "",
          fontSize: 20,
          fontWeight: "bold",
          fontColor: this.yellowColor,
          opacity: 0,
          isInteractive: false,
          topAdjust: 1400,
        });
      }

      this.uiSystem.updateRect("ui_seat_frame_" + playerIds[i], {
        strokeColor: isFramerSelected
          ? (isSelected ? this.yellowColor : "#d979ff")
          : isSelected
            ? this.yellowColor
          : "rgba(255, 247, 223, 0.75)",
        strokeWeight: isFramerSelected || isSelected ? 18 : 3,
        borderRadius: 22,
      });
    }
  }

  submitTarget(targetPlayerId: number) {
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "nightUIManager.submitTarget",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};
    const actionName = this.getMyActionName();

    if (!this.isValidTarget(targetPlayerId, actionName, roleMap, aliveMap)) return;

    if (actionName === "FRAME") {
      if (
        !(this.localFramerDisguisePlayerId > 0) ||
        this.localSelectedTargetId > 0
      ) {
        this.localFramerDisguisePlayerId = targetPlayerId;
        this.localSelectedTargetId = 0;
      } else {
        this.localSelectedTargetId = targetPlayerId;
      }
    } else {
      this.localSelectedTargetId = targetPlayerId;
    }
    eventManager.emit("playerSubmitsNightAction", {
      fromPlayerId: this.currentState.myPlayerId,
      actionName: actionName,
      targetPlayerId: targetPlayerId,
      phaseNonce: this.currentState.phaseNonce,
    });
    this.renderSeatActions();
  }

  getSyncedSelectedTargetId(): number {
    const actionMap = this.currentState.nightActionMap || {};
    const action = actionMap[this.currentState.myPlayerId.toString()];
    if (!action || action.phaseNonce !== this.currentState.phaseNonce) return 0;
    return action.targetPlayerId || 0;
  }

  getSyncedFramerDisguisePlayerId(): number {
    const actionMap = this.currentState.nightActionMap || {};
    const action = actionMap[this.currentState.myPlayerId.toString()];
    if (!action || action.phaseNonce !== this.currentState.phaseNonce) return 0;
    if (action.actionName !== "FRAME") return 0;
    return action.disguisePlayerId || 0;
  }

  getSyncedTricksterActionName(): string {
    const actionMap = this.currentState.nightActionMap || {};
    const action = actionMap[this.currentState.myPlayerId.toString()];
    if (!action || action.phaseNonce !== this.currentState.phaseNonce) return "";
    if (action.actionName === "CASE" || action.actionName === "ELIMINATE") {
      return action.actionName;
    }
    return "";
  }

  getMyActionName(): string {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "nightUIManager.getMyActionName",
      this.currentState.roleMap || {},
    );
    const roleName = roleMap[myPlayerId.toString()] || "";

    if (roleName === "SLEEPER") return "SLEEP";
    if (roleName === "DETECTIVE") return "INVESTIGATE";
    if (roleName === "WATCHER") return "WATCH";
    if (roleName === "GUARD") return "GUARD";
    if (roleName === "JOKER") return "VISIT";
    if (roleName === "SABOTEUR") return "DISTRACT";
    if (roleName === "FRAMER") return "FRAME";
    if (roleName === "TRICKSTER") return this.localTricksterActionName;
    return "";
  }

  isValidTarget(
    targetPlayerId: number,
    actionName: string,
    roleMap: any,
    aliveMap: any,
  ): boolean {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const myKey = myPlayerId.toString();
    const targetKey = targetPlayerId.toString();
    if (!roleMap[myKey] || aliveMap[myKey] !== true) return false;
    if (!roleMap[targetKey] || aliveMap[targetKey] !== true) return false;
    if (myPlayerId === targetPlayerId || !actionName) return false;


    if (
      actionName === "FRAME" &&
      this.localFramerDisguisePlayerId > 0 &&
      !(this.localSelectedTargetId > 0) &&
      targetPlayerId === this.localFramerDisguisePlayerId
    ) {
      return false;
    }

    if (
      actionName === "CASE" ||
      actionName === "ELIMINATE" ||
      actionName === "DISTRACT"
    ) {
      if (this.isTricksterTeamRole(roleMap[targetKey])) return false;
    }

    if (actionName === "ELIMINATE") {
      const caseMap = this.currentState.tricksterCaseTargetMap || {};
      return (
        !!caseMap[targetKey] ||
        !!spriteManager.getSprite("ui_cased_" + targetKey)
      );
    }

    return true;
  }

  renderTricksterActionChoice() {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const playerKey = myPlayerId.toString();
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "nightUIManager.renderTricksterActionChoice",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};
    const shouldShow =
      roleMap[playerKey] === "TRICKSTER" &&
      aliveMap[playerKey] === true &&
      !this.localTricksterActionName;

    if (!shouldShow) {
      this.hideTricksterActionChoice();
      return;
    }

    const actionFontSize = 28;
    this.uiSystem.updateText("ui_trickster_action_prompt", {
      positionX: 400,
      positionY: 535,
      containerWidth: 700,
      align: "center",
      text: "Select an action to do:",
      fontSize: 30,
      fontWeight: "bold",
      fontColor: this.lightColor,
      opacity: 1,
      isInteractive: false,
      topAdjust: 1500,
    });
    this.uiSystem.updateText("ui_trickster_action_case", {
      positionX: 250,
      positionY: 590,
      containerWidth: 400,
      align: "center",
      text: "Case A Player",
      fontSize: actionFontSize,
      fontWeight: "bold",
      fontColor: this.lightColor,
      opacity: 1,
      isInteractive: true,
      topAdjust: 1500,
    });
    this.uiSystem.updateText("ui_trickster_action_eliminate", {
      positionX: 650,
      positionY: 590,
      containerWidth: 700,
      align: "center",
      text: this.tricksterEliminateUnavailable
        ? "No cased players available to eliminate"
        : "Eliminate A Player",
      fontSize: actionFontSize,
      fontWeight: "bold",
      fontColor: this.tricksterEliminateUnavailable
        ? this.greyColor
        : this.lightColor,
      opacity: 1,
      isInteractive: true,
      topAdjust: 1500,
    });
  }

  hideTricksterActionChoice() {
    this.uiSystem.hideText("ui_trickster_action_prompt");
    this.uiSystem.hideText("ui_trickster_action_case");
    this.uiSystem.hideText("ui_trickster_action_eliminate");
  }

  selectTricksterAction(actionName: string) {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const playerKey = myPlayerId.toString();
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "nightUIManager.selectTricksterAction",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};

    if (roleMap[playerKey] !== "TRICKSTER") return;
    if (aliveMap[playerKey] !== true) return;
    if (this.localTricksterActionName) return;

    if (
      actionName === "ELIMINATE" &&
      !this.hasCasedPlayersAvailableToEliminate()
    ) {
      this.tricksterEliminateUnavailable = true;
      this.renderTricksterActionChoice();
      return;
    }

    if (actionName !== "CASE" && actionName !== "ELIMINATE") return;

    this.localTricksterActionName = actionName;
    this.tricksterEliminateUnavailable = false;
    this.localSelectedTargetId = 0;
    this.hideTricksterActionChoice();
    this.renderPrompt();
    this.renderSeatActions();
  }

  hasCasedPlayersAvailableToEliminate(): boolean {
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "nightUIManager.hasCasedPlayersAvailableToEliminate",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};
    const playerIds = Object.keys(roleMap);

    for (let i = 0; i < playerIds.length; i++) {
      const targetPlayerId = parseInt(playerIds[i], 10);
      if (
        this.isValidTarget(
          targetPlayerId,
          "ELIMINATE",
          roleMap,
          aliveMap,
        )
      ) {
        return true;
      }
    }

    return false;
  }

  isTricksterTeamRole(roleName: string): boolean {
    return (
      roleName === "TRICKSTER" ||
      roleName === "SABOTEUR" ||
      roleName === "FRAMER"
    );
  }

  getActionColor(actionName: string): string {
    if (actionName === "CASE" || actionName === "ELIMINATE") return "#d74d4d";
    if (actionName === "DISTRACT") return "#ff6b57";
    if (actionName === "FRAME") return "#d979ff";
    if (actionName === "INVESTIGATE") return "#87d3ff";
    if (actionName === "WATCH") return "#72e0d1";
    if (actionName === "GUARD") return "#ffe27a";
    if (actionName === "SLEEP") return "#b8b5ff";
    if (actionName === "VISIT") return "#f4a1ff";
    return this.lightColor;
  }

  getPlayerName(playerId: number): string {
    const details = playerManager.getPlayerDetails(playerId);
    if (details && details.username) return details.username;
    return "Player " + playerId.toString();
  }

  ensureUiSystem() {
    if (!this.uiSystem) {
      this.uiSystem = scriptManager.getSystem({ systemName: "uiSpriteManager" });
    }
    return this.uiSystem;
  }

  debugReadStateMap(
    variableName: string,
    sourceLocation: string,
    value: any,
  ) {
    const keys = value ? Object.keys(value) : [];
    const undefinedChildKeys: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) undefinedChildKeys.push(keys[i]);
    }
    console.log(
      "[sync-debug][" +
        sourceLocation +
        "][player=" +
        (this.currentState.myPlayerId || 0).toString() +
        "] CONSUMER READ " +
        variableName +
        " keys=[" +
        keys.join(",") +
        "] undefinedChildren=[" +
        undefinedChildKeys.join(",") +
        "] value=",
      value,
    );
    return value;
  }
}
