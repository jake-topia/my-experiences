class trialUIManager extends SystemScript {
  uiSystem: any;
  currentState: any;
  localNomineePlayerId: number;
  localVerdict: string;
  lastPhaseNonce: number;
  lightColor: string;
  yellowColor: string;
  redColor: string;

  onInit() {
    this.currentState = {};
    this.localNomineePlayerId = 0;
    this.localVerdict = "";
    this.lastPhaseNonce = -1;
    this.lightColor = "#fff7df";
    this.yellowColor = "#f0d04f";
    this.redColor = "#d74d4d";
    this.ensureUiSystem();
  }

  onSpriteClicked({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || !sprite.uniqueId || !this.currentState) return;

    if (this.currentState.phase === "TRIAL_NOMINATION") {
      let playerIdText = "";
      if (sprite.uniqueId.indexOf("ui_seat_hit_") === 0) {
        playerIdText = sprite.uniqueId.replace("ui_seat_hit_", "");
      } else if (sprite.uniqueId.indexOf("ui_name_") === 0) {
        playerIdText = sprite.uniqueId.replace("ui_name_", "");
      } else if (sprite.uniqueId.indexOf("ui_vote_") === 0) {
        playerIdText = sprite.uniqueId.replace("ui_vote_", "");
      }

      if (playerIdText) this.submitNominee(parseInt(playerIdText, 10));
      return;
    }

    if (this.currentState.phase !== "TRIAL_VERDICT") return;
    if (sprite.uniqueId === "ui_trial_option_new") {
      this.submitVerdict("NEW_ACCUSED");
    }
    if (sprite.uniqueId === "ui_trial_option_guilty") {
      this.submitVerdict("GUILTY");
    }
  }

  render(state: any) {
    this.ensureUiSystem();
    this.currentState = state || {};
    const phase = this.currentState.phase || "";

    if (phase.indexOf("TRIAL_") !== 0) {
      this.localNomineePlayerId = 0;
      this.localVerdict = "";
      this.lastPhaseNonce = -1;
      this.hideTrialSprites();
      return;
    }

    if (this.lastPhaseNonce !== this.currentState.phaseNonce) {
      this.lastPhaseNonce = this.currentState.phaseNonce;
      this.localNomineePlayerId = this.getSyncedNominee();
      this.localVerdict = this.getSyncedVerdict();
    } else {
      const syncedNominee = this.getSyncedNominee();
      const syncedVerdict = this.getSyncedVerdict();
      if (syncedNominee > 0) this.localNomineePlayerId = syncedNominee;
      if (syncedVerdict) this.localVerdict = syncedVerdict;
    }

    if (phase === "TRIAL_NOMINATION") this.renderNomination();
    if (phase === "TRIAL_DEFENSE") this.renderDefense();
    if (phase === "TRIAL_VERDICT") this.renderVerdict();
  }

  renderNomination() {
    this.hideVerdictOptions();
    const aliveMap = this.currentState.aliveMap || {};
    const seatMap = this.debugReadStateMap(
      "playerSeatMap",
      "trialUIManager.renderNomination",
      this.currentState.seatMap || {},
    );
    const playerIds = Object.keys(seatMap);
    const nominationMap = this.currentState.trialNominationVoteMap || {};
    const aliveCount = this.countAlivePlayers(aliveMap);

    const nominationMessage = this.currentState.endReasonText
      ? this.currentState.endReasonText +
        "\nChoose someone to put on trial."
      : "An elimination occurred. Choose someone to put on trial.";
    this.renderTrialMessage(nominationMessage, this.yellowColor);

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = parseInt(playerIds[i], 10);
      const seatData = seatMap[playerIds[i]];
      const roleMap = this.debugReadStateMap(
        "playerRoleMap",
        "trialUIManager.renderNomination",
        this.currentState.roleMap || {},
      );
      const isAliveTarget =
        !!roleMap[playerIds[i]] && aliveMap[playerIds[i]] === true;
      const canSelect = this.isValidNominee(playerId);
      const isSelected = canSelect && playerId === this.localNomineePlayerId;
      const voteCount = this.countNominationVotes(nominationMap, playerId);

      if (isAliveTarget) {
        this.uiSystem.updateText("ui_vote_" + playerIds[i], {
          positionX: seatData.voteX,
          positionY: seatData.voteY,
          containerWidth: seatData.labelWidth,
          align: "center",
          text: "(" + voteCount.toString() + "/" + aliveCount.toString() + ")",
          fontSize: 20,
          fontWeight: "bold",
          fontColor: this.yellowColor,
          opacity: 1,
          isInteractive: canSelect,
          topAdjust: 1400,
        });
      }

      this.uiSystem.updateRect("ui_seat_frame_" + playerIds[i], {
        strokeColor: isSelected
          ? this.yellowColor
          : "rgba(255, 247, 223, 0.75)",
        strokeWeight: isSelected ? 18 : 3,
        borderRadius: 22,
      });
    }
  }

  renderDefense() {
    this.hideVerdictOptions();
    const accusedPlayerId = this.currentState.trialAccusedPlayerId || 0;
    const myPlayerId = this.currentState.myPlayerId || 0;
    const accusedName = this.getPlayerName(accusedPlayerId);

    if (myPlayerId === accusedPlayerId) {
      this.renderTrialMessage(
        "You are on trial. Convince the town that you are innocent!",
        this.yellowColor,
      );
    } else {
      this.renderTrialMessage(
        accusedName + " is on trial. Listen to their defense.",
        this.yellowColor,
      );
    }
  }

  renderVerdict() {
    const accusedPlayerId = this.currentState.trialAccusedPlayerId || 0;
    const myPlayerId = this.currentState.myPlayerId || 0;
    const aliveMap = this.currentState.aliveMap || {};
    const verdictMap = this.currentState.trialVerdictVoteMap || {};
    const eligibleVoterCount = Math.max(0, this.countAlivePlayers(aliveMap) - 1);
    const newAccusedCount = this.countVerdictVotes(verdictMap, "NEW_ACCUSED");
    const guiltyCount = this.countVerdictVotes(verdictMap, "GUILTY");
    const canVote =
      myPlayerId !== accusedPlayerId &&
      aliveMap[myPlayerId.toString()] === true;

    this.renderTrialMessage(
      myPlayerId === accusedPlayerId
        ? "The town is deciding your verdict."
        : "Decide the accused player's fate.",
      this.yellowColor,
    );

    this.uiSystem.updateText("ui_trial_option_new", {
      positionX: 300,
      positionY: 875,
      containerWidth: 420,
      align: "center",
      text: "Put Someone Else on Trial",
      fontSize: 28,
      fontWeight: "bold",
      fontColor:
        this.localVerdict === "NEW_ACCUSED" ? this.yellowColor : this.lightColor,
      opacity: 1,
      isInteractive: canVote,
      topAdjust: 1500,
    });
    this.uiSystem.updateText("ui_trial_option_new_votes", {
      positionX: 300,
      positionY: 922,
      containerWidth: 420,
      align: "center",
      text: "(" + newAccusedCount.toString() + "/" + eligibleVoterCount.toString() + ")",
      fontSize: 23,
      fontWeight: "bold",
      fontColor: this.yellowColor,
      opacity: 1,
      isInteractive: false,
      topAdjust: 1500,
    });
    this.uiSystem.updateText("ui_trial_option_guilty", {
      positionX: 780,
      positionY: 875,
      containerWidth: 420,
      align: "center",
      text: "They're Guilty!",
      fontSize: 32,
      fontWeight: "bold",
      fontColor:
        this.localVerdict === "GUILTY" ? this.yellowColor : this.redColor,
      opacity: 1,
      isInteractive: canVote,
      topAdjust: 1500,
    });
    this.uiSystem.updateText("ui_trial_option_guilty_votes", {
      positionX: 780,
      positionY: 922,
      containerWidth: 420,
      align: "center",
      text: "(" + guiltyCount.toString() + "/" + eligibleVoterCount.toString() + ")",
      fontSize: 23,
      fontWeight: "bold",
      fontColor: this.yellowColor,
      opacity: 1,
      isInteractive: false,
      topAdjust: 1500,
    });
  }

  renderTrialMessage(text: string, color: string) {
    this.uiSystem.updateText("ui_trial_message", {
      positionX: 210,
      positionY: 610,
      containerWidth: 1080,
      align: "center",
      text: text,
      fontSize: 34,
      fontWeight: "bold",
      fontColor: color,
      opacity: 1,
      isInteractive: false,
      topAdjust: 1400,
    });
  }

  submitNominee(targetPlayerId: number) {
    if (!this.isValidNominee(targetPlayerId)) return;
    this.localNomineePlayerId = targetPlayerId;
    eventManager.emit("playerChoosesTrialNominee", {
      fromPlayerId: this.currentState.myPlayerId,
      targetPlayerId: targetPlayerId,
      phaseNonce: this.currentState.phaseNonce,
    });
    this.renderNomination();
  }

  submitVerdict(verdict: string) {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const aliveMap = this.currentState.aliveMap || {};
    if (aliveMap[myPlayerId.toString()] !== true) return;
    if (myPlayerId === this.currentState.trialAccusedPlayerId) return;

    this.localVerdict = verdict;
    eventManager.emit("playerChoosesTrialVerdict", {
      fromPlayerId: myPlayerId,
      verdict: verdict,
      phaseNonce: this.currentState.phaseNonce,
    });
    this.renderVerdict();
  }

  isValidNominee(targetPlayerId: number): boolean {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "trialUIManager.isAliveRoundPlayer",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};
    if (!roleMap[myPlayerId.toString()]) return false;
    if (aliveMap[myPlayerId.toString()] !== true) return false;
    if (!roleMap[targetPlayerId.toString()]) return false;
    if (aliveMap[targetPlayerId.toString()] !== true) return false;
    return targetPlayerId !== myPlayerId;
  }

  getSyncedNominee(): number {
    const nominationMap = this.currentState.trialNominationVoteMap || {};
    return nominationMap[this.currentState.myPlayerId.toString()] || 0;
  }

  getSyncedVerdict(): string {
    const verdictMap = this.currentState.trialVerdictVoteMap || {};
    return verdictMap[this.currentState.myPlayerId.toString()] || "";
  }

  countNominationVotes(nominationMap: any, targetPlayerId: number): number {
    const voterIds = Object.keys(nominationMap);
    const myPlayerId = this.currentState.myPlayerId || 0;
    let count = 0;
    for (let i = 0; i < voterIds.length; i++) {
      if (voterIds[i] === myPlayerId.toString()) continue;
      if (nominationMap[voterIds[i]] === targetPlayerId) count += 1;
    }
    if (this.localNomineePlayerId === targetPlayerId) count += 1;
    return count;
  }

  countVerdictVotes(verdictMap: any, verdict: string): number {
    const voterIds = Object.keys(verdictMap);
    const myPlayerId = this.currentState.myPlayerId || 0;
    let count = 0;
    for (let i = 0; i < voterIds.length; i++) {
      if (voterIds[i] === myPlayerId.toString()) continue;
      if (verdictMap[voterIds[i]] === verdict) count += 1;
    }
    if (this.localVerdict === verdict) count += 1;
    return count;
  }

  countAlivePlayers(aliveMap: any): number {
    const playerIds = Object.keys(aliveMap);
    let count = 0;
    for (let i = 0; i < playerIds.length; i++) {
      if (aliveMap[playerIds[i]] === true) count += 1;
    }
    return count;
  }

  hideTrialSprites() {
    this.uiSystem.hideText("ui_trial_message");
    this.hideVerdictOptions();
  }

  hideVerdictOptions() {
    this.uiSystem.hideText("ui_trial_option_new");
    this.uiSystem.hideText("ui_trial_option_new_votes");
    this.uiSystem.hideText("ui_trial_option_guilty");
    this.uiSystem.hideText("ui_trial_option_guilty_votes");
  }

  getPlayerName(playerId: number): string {
    const details = playerManager.getPlayerDetails(playerId);
    if (details && details.username) return details.username;
    return "Player " + playerId.toString();
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

  ensureUiSystem() {
    if (!this.uiSystem) {
      this.uiSystem = scriptManager.getSystem({ systemName: "uiSpriteManager" });
    }
    return this.uiSystem;
  }
}
