class clientUIManager extends SystemScript {
  uiSystem: any;
  roleUiSystem: any;
  nightUiSystem: any;
  trialUiSystem: any;
  gameManagerSystem: any;
  myPlayerId: number;
  myRole: string;
  cachedVariableMap: any;
  lastFourPlayerDevStartEnabled: boolean;
  lastSeatPlayerIds: string[];
  pendingCasedRoleMap: any;
  addedCasedRoleMap: any;
  pendingPlayerNightResultMap: any;
  lightColor: string;
  darkColor: string;
  yellowColor: string;
  greyColor: string;

  onInit() {
    this.myPlayerId = 0;
    this.myRole = "";
    this.cachedVariableMap = {};
    // Local UI must wait for populated callback newValue data. Pre-seeding
    // every MAP cache prevents getVariable from falling through to a live
    // stateManager read while MAP children are still hydrating.
    this.cachedVariableMap.playerSeatMap = {};
    this.cachedVariableMap.playerRoleMap = {};
    this.cachedVariableMap.playerAliveMap = {};
    this.cachedVariableMap.playerDeathInfoMap = {};
    this.cachedVariableMap.roleRevealAcknowledgementMap = {};
    this.cachedVariableMap.nightActionMap = {};
    this.cachedVariableMap.playerNightResultMap = {};
    this.cachedVariableMap.tricksterCaseTargetMap = {};
    this.cachedVariableMap.sleepyPlayerMap = {};
    this.cachedVariableMap.trialNominationVoteMap = {};
    this.cachedVariableMap.trialVerdictVoteMap = {};
    this.lastFourPlayerDevStartEnabled = false;
    this.lastSeatPlayerIds = [];
    this.pendingCasedRoleMap = {};
    this.addedCasedRoleMap = {};
    this.pendingPlayerNightResultMap = null;
    this.lightColor = "#fff7df";
    this.darkColor = "#243018";
    this.yellowColor = "#f0d04f";
    this.greyColor = "#a0a0a0";
    this.ensureUiSystems();
    this.removeDeprecatedSprites();
    this.refreshUi();
  }

  onPlayerStart() {
    this.myPlayerId = playerManager.getMyPlayerId();
    this.ensureUiSystems();
    this.removeDeprecatedSprites();
    this.rememberMyRoleFromMap(
      this.getVariable("playerRoleMap", "clientUIManager.onPlayerStart -> rememberMyRoleFromMap"),
    );
    this.tryCommitPendingNightResultMap();
    this.refreshUi();
  }

  onSpectatorStart() {
    this.myPlayerId = playerManager.getMyPlayerId();
    this.ensureUiSystems();
    this.removeDeprecatedSprites();
    this.rememberMyRoleFromMap(
      this.getVariable("playerRoleMap", "clientUIManager.onSpectatorStart -> rememberMyRoleFromMap"),
    );
    this.tryCommitPendingNightResultMap();
    this.refreshUi();
  }

  onPlayerJoined() {
    this.refreshUi();
  }

  onPlayerLeft({ playerId }: { playerId: number }) {
    if (playerId > 0) {
      const playerIdKey = playerId.toString();
      delete this.cachedVariableMap.playerSeatMap[playerIdKey];
      delete this.cachedVariableMap.playerRoleMap[playerIdKey];
      delete this.cachedVariableMap.playerAliveMap[playerIdKey];
      delete this.cachedVariableMap.playerDeathInfoMap[playerIdKey];
      delete this.cachedVariableMap.nightActionMap[playerIdKey];
      this.removeSeatSprites(playerIdKey);
    }
    this.refreshUi();
  }

  onStep() {
    if (this.getVariable("gamePhase") !== "WAITING") return;
    if (!playerManager.isHost) return;
    const isFourPlayerDevStartEnabled = this.getFourPlayerDevStartEnabled();
    if (isFourPlayerDevStartEnabled !== this.lastFourPlayerDevStartEnabled) {
      this.lastFourPlayerDevStartEnabled = isFourPlayerDevStartEnabled;
      this.refreshUi();
      return;
    }
    this.refreshHostFollowStartButton();
  }

  onSpriteClicked({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || !sprite.uniqueId) return;
    const uniqueId = sprite.uniqueId;

    if (uniqueId === "ui_role_reveal_acknowledge" || uniqueId === "ui_role_reveal_acknowledge_hit") {
      this.ensureUiSystems();
      this.roleUiSystem.acknowledgeRole();
      return;
    }

    if (uniqueId === "ui_start_center" || uniqueId === "ui_start_follow") {
      if (!playerManager.isHost) return;
      eventManager.emit("hostStartsGame", {
        fromPlayerId: this.getMyPlayerId(),
      });
      return;
    }

    if (uniqueId === "ui_setting_discussion") {
      this.emitSettingCycle("discussion");
    }
    if (uniqueId === "ui_setting_voting") {
      this.emitSettingCycle("voting");
    }
    if (uniqueId === "ui_setting_night") {
      this.emitSettingCycle("night");
    }
    if (uniqueId === "ui_setting_dev") {
      this.emitSettingCycle("dev");
    }
    if (uniqueId === "ui_setting_four_player_dev") {
      this.emitSettingCycle("fourPlayerDev");
      this.refreshUi();
    }
  }

  onVariableChanged_gamePhase(args: any) {
    if (!args || !this.hasValue(args.newValue)) return;
    this.cachedVariableMap.gamePhase = args.newValue;

    if (args.newValue === "WAITING") this.clearRoundCache();
    if (args.newValue === "REVEAL") {
      this.removeAllCasedPlayerLabels();
      this.cachedVariableMap.roleRevealAcknowledgementMap = {};
      this.cachedVariableMap.nightActionMap = {};
      this.cachedVariableMap.tricksterCaseTargetMap = {};
      this.cachedVariableMap.sleepyPlayerMap = {};
      this.cachedVariableMap.trialNominationVoteMap = {};
      this.cachedVariableMap.trialVerdictVoteMap = {};
    }
    if (args.newValue === "NIGHT") {
      this.cachedVariableMap.nightActionMap = {};
    }
    if (args.newValue === "TRIAL_NOMINATION") {
      this.cachedVariableMap.trialNominationVoteMap = {};
    }
    if (args.newValue === "TRIAL_VERDICT") {
      this.cachedVariableMap.trialVerdictVoteMap = {};
    }

    this.tryCommitPendingNightResultMap();
    this.refreshUi();
  }

  onVariableChanged_phaseNonce(args: any) {
    this.cacheSimpleValue("phaseNonce", args);
    const phase = this.getVariable("gamePhase");
    if (phase === "NIGHT") this.cachedVariableMap.nightActionMap = {};
    if (phase === "TRIAL_NOMINATION") {
      this.cachedVariableMap.trialNominationVoteMap = {};
    }
    if (phase === "TRIAL_VERDICT") {
      this.cachedVariableMap.trialVerdictVoteMap = {};
    }
    this.tryCommitPendingNightResultMap();
    this.refreshUi();
  }

  onVariableChanged_configuredDiscussionSeconds(args: any) {
    this.cacheAndRefresh("configuredDiscussionSeconds", args, false);
  }

  onVariableChanged_configuredVotingSeconds(args: any) {
    this.cacheAndRefresh("configuredVotingSeconds", args, false);
  }

  onVariableChanged_configuredNightSeconds(args: any) {
    this.cacheAndRefresh("configuredNightSeconds", args, false);
  }

  onVariableChanged_playerSeatMap(args: any) {
    this.logMapCallback("playerSeatMap", "clientUIManager.onVariableChanged_playerSeatMap", args);
    if (!args || !args.newValue) return;
    const populatedSeatMap = this.getPopulatedSeatMap(args.newValue);
    if (Object.keys(populatedSeatMap).length === 0) return;
    this.cacheMapAndRefresh("playerSeatMap", populatedSeatMap);
  }

  onVariableChanged_playerRoleMap(args: any) {
    this.logMapCallback("playerRoleMap", "clientUIManager.onVariableChanged_playerRoleMap", args);
    if (!args || !args.newValue) return;
    const populatedRoleMap = this.getPopulatedRoleMap(args.newValue);
    if (Object.keys(populatedRoleMap).length === 0) return;
    this.cachedVariableMap.playerRoleMap = this.mergePopulatedMap(
      this.cachedVariableMap.playerRoleMap,
      populatedRoleMap,
    );
    this.logMapRead(
      "playerRoleMap",
      "clientUIManager.onVariableChanged_playerRoleMap -> merged callback cache",
      this.cachedVariableMap.playerRoleMap,
      "CACHE WRITE",
    );
    this.rememberMyRoleFromMap(this.cachedVariableMap.playerRoleMap);
    this.tryCommitPendingNightResultMap();
    this.refreshUi();
  }

  onVariableChanged_myRole(args: any) {
    if (!args || !args.newValue) return;
    this.myRole = args.newValue;
    this.refreshUi();
  }

  onVariableChanged_playerAliveMap(args: any) {
    this.cacheAndRefresh("playerAliveMap", args, true);
  }

  onVariableChanged_playerDeathInfoMap(args: any) {
    this.cacheAndRefresh("playerDeathInfoMap", args, true);
  }

  onVariableChanged_roleRevealAcknowledgementMap(args: any) {
    this.cacheAndRefresh("roleRevealAcknowledgementMap", args, true);
  }

  onVariableChanged_nightActionMap(args: any) {
    this.cacheAndRefresh("nightActionMap", args, false);
  }

  onVariableChanged_playerNightResultMap(args: any) {
    this.logMapCallback("playerNightResultMap", "clientUIManager.onVariableChanged_playerNightResultMap", args);
    if (!args || !args.newValue || Object.keys(args.newValue).length === 0) {
      console.log(
        "[sync-debug][clientUIManager.onVariableChanged_playerNightResultMap] REJECTED missing or empty newValue",
      );
      return;
    }

    const normalizedResultMap = this.normalizeNightResultMap(args.newValue);
    this.logMapRead(
      "playerNightResultMap",
      "clientUIManager.onVariableChanged_playerNightResultMap -> normalized newValue",
      normalizedResultMap,
      "NORMALIZED",
    );
    if (Object.keys(normalizedResultMap).length === 0) {
      console.log(
        "[sync-debug][clientUIManager.onVariableChanged_playerNightResultMap] REJECTED normalized result map is empty",
      );
      return;
    }

    // Keep callback data separate until the matching DISCUSS phase metadata is
    // present locally. This callback can precede gamePhase/phaseNonce callbacks.
    this.pendingPlayerNightResultMap = this.mergePopulatedMap(this.pendingPlayerNightResultMap, normalizedResultMap);
    if (this.tryCommitPendingNightResultMap()) this.refreshUi();
  }

  onVariableChanged_tricksterCaseTargetMap(args: any) {
    const newValue = args ? args.newValue : null;
    console.log(
      "[sprite-debug-CASED][clientUIManager.onVariableChanged_tricksterCaseTargetMap][player=" +
        this.getMyPlayerId().toString() +
        "] CALLBACK newValue=",
      newValue,
      " args=",
      args,
    );
    if (!newValue || Object.keys(newValue).length === 0) return;
    if (this.mergePublishedCaseKnowledge(newValue)) this.refreshUi();
  }

  mergeCaseKnowledgeFromNightResults(resultMap: any, roleMapOverride?: any, roundNumberOverride?: number): boolean {
    if (!resultMap || Object.keys(resultMap).length === 0) return false;

    const roleMap =
      roleMapOverride || this.getVariable("playerRoleMap", "clientUIManager.mergeCaseKnowledgeFromNightResults") || {};
    const currentRoundNumber =
      roundNumberOverride !== undefined ? roundNumberOverride : this.cachedVariableMap.roundNumber || 0;
    const existingCaseMap = this.cachedVariableMap.tricksterCaseTargetMap || {};
    const mergedCaseMap: any = {};
    const existingTargetIds = Object.keys(existingCaseMap);

    for (let i = 0; i < existingTargetIds.length; i++) {
      const targetId = existingTargetIds[i];
      mergedCaseMap[targetId] = existingCaseMap[targetId];
    }

    const actorIds = Object.keys(resultMap);
    const newlyLearnedTargetIds: string[] = [];
    let learnedNewCase = false;

    for (let i = 0; i < actorIds.length; i++) {
      const actorId = actorIds[i];
      const result = resultMap[actorId];
      if (!result) continue;
      if (result.actionName === "CASE") {
        console.log(
          "[sprite-debug-CASED][clientUIManager.mergeCaseKnowledgeFromNightResults][player=" +
            this.getMyPlayerId().toString() +
            "] CASE result candidate actorId=" +
            actorId +
            " expectedRound=" +
            currentRoundNumber.toString() +
            " result=",
          result,
        );
      }
      if (result.nightNumber !== currentRoundNumber) continue;
      if (result.status !== "SUCCESS" || result.actionName !== "CASE") {
        continue;
      }

      const targetId = result.targetPlayerId ? result.targetPlayerId.toString() : "";
      // Results are atomic serialized payloads now, so CASE knowledge can use
      // its own revealedRole without depending on playerRoleMap hydration.
      const revealedRole = targetId ? result.revealedRole || roleMap[targetId] || "" : "";
      if (!targetId || !revealedRole) continue;

      if (mergedCaseMap[targetId] !== revealedRole) {
        mergedCaseMap[targetId] = revealedRole;
        newlyLearnedTargetIds.push(targetId);
        learnedNewCase = true;
      }
    }

    if (!learnedNewCase) return false;

    this.cachedVariableMap.tricksterCaseTargetMap = mergedCaseMap;
    console.log("[case-knowledge] client confirmed CASE knowledge from night result:", mergedCaseMap);

    return true;
  }

  mergePublishedCaseKnowledge(publishedCaseMap: any): boolean {
    const roleMap = this.getVariable("playerRoleMap", "clientUIManager.mergePublishedCaseKnowledge") || {};
    const existingCaseMap = this.cachedVariableMap.tricksterCaseTargetMap || {};
    const mergedCaseMap: any = {};
    const existingTargetIds = Object.keys(existingCaseMap);

    for (let i = 0; i < existingTargetIds.length; i++) {
      const targetId = existingTargetIds[i];
      mergedCaseMap[targetId] = existingCaseMap[targetId];
    }

    const currentPlayerIds = Object.keys(publishedCaseMap);
    const newlyLearnedTargetIds: string[] = [];
    let learnedNewCase = false;

    for (let i = 0; i < currentPlayerIds.length; i++) {
      const targetId = currentPlayerIds[i];
      const publishedRole = publishedCaseMap[targetId] || "";
      if (!publishedRole) continue;
      if (roleMap[targetId] && publishedRole !== roleMap[targetId]) continue;

      if (mergedCaseMap[targetId] !== publishedRole) {
        mergedCaseMap[targetId] = publishedRole;
        newlyLearnedTargetIds.push(targetId);
        learnedNewCase = true;
      }
    }

    if (!learnedNewCase) return false;

    this.cachedVariableMap.tricksterCaseTargetMap = mergedCaseMap;
    console.log("[case-knowledge] client received committed CASE knowledge:", mergedCaseMap);
    return true;
  }

  onVariableChanged_sleepyPlayerMap(args: any) {
    this.cacheAndRefresh("sleepyPlayerMap", args, true);
  }

  onVariableChanged_trialNominationVoteMap(args: any) {
    this.cacheAndRefresh("trialNominationVoteMap", args, false);
  }

  onVariableChanged_trialVerdictVoteMap(args: any) {
    this.cacheAndRefresh("trialVerdictVoteMap", args, false);
  }

  onVariableChanged_trialAccusedPlayerId(args: any) {
    this.cacheAndRefresh("trialAccusedPlayerId", args, false);
  }

  onVariableChanged_jokerWinnerPlayerId(args: any) {
    this.cacheAndRefresh("jokerWinnerPlayerId", args, false);
  }

  onVariableChanged_lastNightEliminatedPlayerId(args: any) {
    this.cacheAndRefresh("lastNightEliminatedPlayerId", args, false);
  }

  onVariableChanged_winningTeam(args: any) {
    this.cacheAndRefresh("winningTeam", args, false);
  }

  onVariableChanged_endReasonText(args: any) {
    this.cacheAndRefresh("endReasonText", args, false);
  }

  onVariableChanged_roundNumber(args: any) {
    this.cacheAndRefresh("roundNumber", args, false);
  }

  refreshUi() {
    this.ensureUiSystems();
    if (!this.uiSystem || !this.roleUiSystem || !this.nightUiSystem || !this.trialUiSystem) {
      return;
    }

    const phase = this.getVariable("gamePhase") || "WAITING";
    const roundNumber = this.getVariable("roundNumber") || 0;
    let roleMap = this.getVariable("playerRoleMap", "clientUIManager.refreshUi -> build local UI state") || {};
    const myPlayerKey = this.getMyPlayerId().toString();
    if (this.myRole && !roleMap[myPlayerKey]) {
      roleMap = this.mergePopulatedMap(roleMap, {});
      roleMap[myPlayerKey] = this.myRole;
    }
    const rawPlayerNightResultMap =
      this.getVariable("playerNightResultMap", "clientUIManager.refreshUi -> build local UI state") || {};
    const playerNightResultMap = this.normalizeNightResultMap(rawPlayerNightResultMap);
    this.logMapRead(
      "playerNightResultMap",
      "clientUIManager.refreshUi -> final normalized UI state",
      playerNightResultMap,
      "NORMALIZED CONSUMER VALUE",
    );
    if (Object.keys(playerNightResultMap).length > 0) {
      this.pendingPlayerNightResultMap = this.mergePopulatedMap(this.pendingPlayerNightResultMap, playerNightResultMap);
      this.tryCommitPendingNightResultMap();
    }
    const seatMap = this.getVariable("playerSeatMap", "clientUIManager.refreshUi -> build local UI state") || {};

    // The ordinary refresh that displays each player's night result also
    // promotes successful CASE data. This does not depend on either MAP's
    // dedicated variable callback arriving on the client.
    this.mergeCaseKnowledgeFromNightResults(playerNightResultMap, roleMap, roundNumber);

    const state = {
      phase: phase,
      phaseNonce: this.getVariable("phaseNonce") || 0,
      roundNumber: roundNumber,
      myPlayerId: this.getMyPlayerId(),
      myRole: this.myRole || roleMap[myPlayerKey] || "",
      seatMap: seatMap,
      roleMap: roleMap,
      aliveMap: this.getVariable("playerAliveMap") || {},
      deathInfoMap: this.getVariable("playerDeathInfoMap") || {},
      roleRevealAcknowledgementMap: this.getVariable("roleRevealAcknowledgementMap") || {},
      nightActionMap: this.getVariable("nightActionMap") || {},
      playerNightResultMap: playerNightResultMap,
      tricksterCaseTargetMap: this.getVariable("tricksterCaseTargetMap") || {},
      sleepyPlayerMap: this.getVariable("sleepyPlayerMap") || {},
      trialNominationVoteMap: this.getVariable("trialNominationVoteMap") || {},
      trialVerdictVoteMap: this.getVariable("trialVerdictVoteMap") || {},
      trialAccusedPlayerId: this.getVariable("trialAccusedPlayerId") || 0,
      jokerWinnerPlayerId: this.getVariable("jokerWinnerPlayerId") || 0,
      lastNightEliminatedPlayerId: this.getVariable("lastNightEliminatedPlayerId") || 0,
      winningTeam: this.getVariable("winningTeam") || "",
      endReasonText: this.getVariable("endReasonText") || "",
      pendingCasedRoleMap: this.pendingCasedRoleMap || {},
      addedCasedRoleMap: this.addedCasedRoleMap || {},
    };

    this.renderLobby(phase);
    this.renderSeats(state);
    this.renderGeneralCenterMessage(state);
    this.roleUiSystem.render(state);
    this.nightUiSystem.render(state);
    this.trialUiSystem.render(state);
  }

  renderLobby(phase: string) {
    const isWaiting = phase === "WAITING";
    const titleColor = this.darkColor;
    const playerCount = playerManager.getPlayerIds().length;
    const isFourPlayerDevStartEnabled = this.getFourPlayerDevStartEnabled();

    this.uiSystem.updateText("ui_title", {
      positionX: 350,
      positionY: 120,
      containerWidth: 800,
      align: "center",
      text: isWaiting ? "Trickster Town" : "",
      fontSize: 58,
      fontWeight: "bold",
      fontColor: titleColor,
      opacity: isWaiting ? 1 : 0,
      isInteractive: false,
      topAdjust: 1200,
    });
    this.uiSystem.updateText("ui_subtitle", {
      positionX: 350,
      positionY: 185,
      containerWidth: 800,
      align: "center",
      text: isWaiting
        ? "waiting for players... (" +
          playerCount.toString() +
          (isFourPlayerDevStartEnabled ? "/4 minimum in Dev)" : "/5 minimum)")
        : "",
      fontSize: 28,
      fontColor: titleColor,
      opacity: isWaiting ? 1 : 0,
      isInteractive: false,
      topAdjust: 1200,
    });

    this.uiSystem.remove("ui_setting_tricksters");

    this.renderSetting(
      "ui_setting_discussion",
      1010,
      560,
      isWaiting ? "Discussion / Defense: " + this.getVariable("configuredDiscussionSeconds").toString() + "s" : "",
      isWaiting,
    );
    this.renderSetting(
      "ui_setting_voting",
      1010,
      620,
      isWaiting ? "Trial Voting: " + this.getVariable("configuredVotingSeconds").toString() + "s" : "",
      isWaiting,
    );
    this.renderSetting(
      "ui_setting_night",
      1010,
      680,
      isWaiting ? "Night: " + this.getVariable("configuredNightSeconds").toString() + "s" : "",
      isWaiting,
    );
    this.renderSetting(
      "ui_setting_dev",
      1010,
      740,
      isWaiting && playerManager.isHost ? "Dev: 5 second timers" : "",
      isWaiting && playerManager.isHost,
    );
    this.renderSetting(
      "ui_setting_four_player_dev",
      1010,
      800,
      isWaiting && playerManager.isHost
        ? "Dev: 4-player start " + (isFourPlayerDevStartEnabled ? "(ON)" : "(OFF)")
        : "",
      isWaiting && playerManager.isHost,
    );

    this.uiSystem.updateText("ui_start_center", {
      positionX: 450,
      positionY: 930,
      containerWidth: 600,
      align: "center",
      text: isWaiting ? "Click here to start" : "",
      fontSize: 38,
      fontWeight: "bold",
      fontColor: titleColor,
      opacity: isWaiting ? 1 : 0,
      isInteractive: isWaiting && playerManager.isHost,
      topAdjust: 1200,
    });
    this.refreshHostFollowStartButton();
  }

  renderSetting(uniqueId: string, positionX: number, positionY: number, text: string, isVisible: boolean) {
    this.uiSystem.updateText(uniqueId, {
      positionX: positionX,
      positionY: positionY,
      containerWidth: 390,
      align: "right",
      text: text,
      fontSize: 26,
      fontWeight: "bold",
      fontColor: this.darkColor,
      opacity: isVisible ? 1 : 0,
      isInteractive: isVisible && playerManager.isHost,
      topAdjust: 1200,
    });
  }

  refreshHostFollowStartButton() {
    const isVisible = this.getVariable("gamePhase") === "WAITING" && playerManager.isHost;
    let positionX = 0;
    let positionY = 0;

    if (isVisible) {
      const details = playerManager.getPlayerDetails(this.getMyPlayerId());
      if (details) {
        positionX = details.x - 90;
        positionY = details.y + 50;
      }
    }

    this.uiSystem.updateText("ui_start_follow", {
      positionX: positionX,
      positionY: positionY,
      containerWidth: 180,
      align: "center",
      text: isVisible ? "Click here" : "",
      fontSize: 26,
      fontWeight: "bold",
      fontColor: this.darkColor,
      opacity: isVisible ? 1 : 0,
      isInteractive: isVisible,
      topAdjust: 1200,
    });
  }

  renderSeats(state: any) {
    const seatMap = state.seatMap || {};
    const roleMap = state.roleMap || {};
    this.logMapRead("playerSeatMap", "clientUIManager.renderSeats -> state.seatMap", seatMap, "CONSUMER READ");
    this.logMapRead("playerRoleMap", "clientUIManager.renderSeats -> state.roleMap", roleMap, "CONSUMER READ");
    const aliveMap = state.aliveMap || {};
    const seatPlayerIds = state.phase === "WAITING" ? [] : Object.keys(seatMap);

    for (let i = 0; i < this.lastSeatPlayerIds.length; i++) {
      if (seatPlayerIds.indexOf(this.lastSeatPlayerIds[i]) === -1) {
        this.removeSeatSprites(this.lastSeatPlayerIds[i]);
      }
    }
    this.lastSeatPlayerIds = seatPlayerIds.slice();

    for (let i = 0; i < seatPlayerIds.length; i++) {
      const playerId = seatPlayerIds[i];
      const numericPlayerId = parseInt(playerId, 10);
      const seatData = seatMap[playerId];
      if (!seatData || !roleMap[playerId]) continue;

      const boothSize = seatData.boothSize || 150;
      this.uiSystem.updateRect("ui_seat_hit_" + playerId, {
        positionX: seatData.playerX - Math.floor(boothSize / 2) - 12,
        positionY: seatData.playerY - Math.floor(boothSize / 2) - 12,
        width: boothSize + 24,
        height: boothSize + 24,
        fill: this.lightColor,
        opacity: 0.01,
        isInteractive: true,
        displayLayer: "top",
        topAdjust: 1000,
      });
      this.uiSystem.updateRect("ui_seat_frame_" + playerId, {
        positionX: seatData.playerX - Math.floor(boothSize / 2) - 8,
        positionY: seatData.playerY - Math.floor(boothSize / 2) - 8,
        width: boothSize + 16,
        height: boothSize + 16,
        fill: "rgba(0, 0, 0, 0)",
        strokeColor: "rgba(255, 247, 223, 0.75)",
        strokeWeight: 3,
        borderRadius: 22,
        opacity: 1,
        isInteractive: false,
        displayLayer: "top",
        topAdjust: 100,
      });
      this.uiSystem.updateText("ui_name_" + playerId, {
        positionX: seatData.nameX,
        positionY: seatData.nameY,
        containerWidth: seatData.labelWidth,
        align: "center",
        text: this.truncatePlayerName(this.getPlayerName(numericPlayerId), seatData.labelWidth),
        fontSize: 24,
        fontWeight: "bold",
        fontColor: aliveMap[playerId] === false ? this.greyColor : this.lightColor,
        opacity: 1,
        isInteractive: true,
        topAdjust: 1300,
      });
      this.uiSystem.updateText("ui_vote_" + playerId, {
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
  }

  queueCasedPlayerLabels(
    playerIds: string[],
    casedPlayerRoleMap: any,
    pendingCasedRoleMap: any,
    addedCasedRoleMap: any,
  ) {
    // Topia can discard child-key mutation across helper boundaries. Build
    // fresh maps locally and make refreshUi explicitly accept the returned
    // state instead of treating these arguments or module maps as outputs.
    const nextPendingCasedRoleMap: any = {};
    const nextAddedCasedRoleMap: any = {};
    const pendingPlayerIds = pendingCasedRoleMap ? Object.keys(pendingCasedRoleMap) : [];
    const addedPlayerIds = addedCasedRoleMap ? Object.keys(addedCasedRoleMap) : [];

    for (let i = 0; i < pendingPlayerIds.length; i++) {
      const pendingPlayerId = pendingPlayerIds[i];
      const pendingRole = pendingCasedRoleMap[pendingPlayerId];
      if (pendingRole) {
        nextPendingCasedRoleMap[pendingPlayerId] = pendingRole;
      }
    }
    for (let i = 0; i < addedPlayerIds.length; i++) {
      const addedPlayerId = addedPlayerIds[i];
      const addedRole = addedCasedRoleMap[addedPlayerId];
      if (addedRole) {
        nextAddedCasedRoleMap[addedPlayerId] = addedRole;
      }
    }

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const casedRoleName = casedPlayerRoleMap[playerId] || "";
      if (!casedRoleName) continue;

      const uniqueId = "ui_cased_" + playerId;
      if (nextAddedCasedRoleMap[playerId]) {
        if (spriteManager.getSprite(uniqueId)) continue;
        delete nextAddedCasedRoleMap[playerId];
        console.log(
          "[sprite-debug-CASED][clientUIManager.queueCasedPlayerLabels][player=" +
            this.getMyPlayerId().toString() +
            "] RETRY " +
            uniqueId +
            " was recorded as added but the local sprite is missing",
        );
      }
      nextPendingCasedRoleMap[playerId] = casedRoleName;
      console.log(
        "[sprite-debug-CASED][clientUIManager.queueCasedPlayerLabels][player=" +
          this.getMyPlayerId().toString() +
          "] QUEUED " +
          uniqueId +
          " role=" +
          casedRoleName +
          " nextPendingCasedRoleMap=",
        nextPendingCasedRoleMap,
      );
    }

    return {
      pendingCasedRoleMap: nextPendingCasedRoleMap,
      addedCasedRoleMap: nextAddedCasedRoleMap,
    };
  }

  flushPendingCasedPlayerLabels(roleMap: any, seatMapOverride: any, pendingCasedRoleMap: any, addedCasedRoleMap: any) {
    // Return replacements rather than mutating map arguments or nested module
    // maps and assuming those child writes survive this helper boundary.
    const nextPendingCasedRoleMap: any = {};
    const nextAddedCasedRoleMap: any = {};
    const sourcePendingPlayerIds = pendingCasedRoleMap ? Object.keys(pendingCasedRoleMap) : [];
    const sourceAddedPlayerIds = addedCasedRoleMap ? Object.keys(addedCasedRoleMap) : [];

    for (let i = 0; i < sourcePendingPlayerIds.length; i++) {
      const sourcePendingPlayerId = sourcePendingPlayerIds[i];
      const sourcePendingRole = pendingCasedRoleMap[sourcePendingPlayerId];
      if (sourcePendingRole) {
        nextPendingCasedRoleMap[sourcePendingPlayerId] = sourcePendingRole;
      }
    }
    for (let i = 0; i < sourceAddedPlayerIds.length; i++) {
      const sourceAddedPlayerId = sourceAddedPlayerIds[i];
      const sourceAddedRole = addedCasedRoleMap[sourceAddedPlayerId];
      if (sourceAddedRole) {
        nextAddedCasedRoleMap[sourceAddedPlayerId] = sourceAddedRole;
      }
    }

    const pendingPlayerIds = Object.keys(nextPendingCasedRoleMap);
    if (pendingPlayerIds.length === 0) {
      return {
        pendingCasedRoleMap: nextPendingCasedRoleMap,
        addedCasedRoleMap: nextAddedCasedRoleMap,
      };
    }

    const localPlayerId = this.getMyPlayerId();
    const roleMapRole = roleMap[localPlayerId.toString()] || "";
    const myRole = this.myRole || roleMapRole || "";
    console.log(
      "[sprite-debug-CASED][clientUIManager.flushPendingCasedPlayerLabels][player=" +
        localPlayerId.toString() +
        "] ENTER pendingIds=[" +
        pendingPlayerIds.join(",") +
        "] latchedLocalRole=" +
        (this.myRole || "") +
        " roleMapRole=" +
        roleMapRole +
        " effectiveLocalRole=" +
        myRole +
        " pendingCasedRoleMap=",
      nextPendingCasedRoleMap,
    );
    if (!myRole) {
      console.log(
        "[sprite-debug-CASED][clientUIManager.flushPendingCasedPlayerLabels][player=" +
          localPlayerId.toString() +
          "] STOP local role is unavailable",
      );
      return {
        pendingCasedRoleMap: nextPendingCasedRoleMap,
        addedCasedRoleMap: nextAddedCasedRoleMap,
      };
    }

    if (!this.isTricksterTeamRole(myRole)) {
      console.log(
        "[sprite-debug-CASED][clientUIManager.flushPendingCasedPlayerLabels][player=" +
          localPlayerId.toString() +
          "] STOP effectiveLocalRole=" +
          myRole +
          " is not on the Trickster team",
      );
      return {
        pendingCasedRoleMap: nextPendingCasedRoleMap,
        addedCasedRoleMap: nextAddedCasedRoleMap,
      };
    }

    const seatMap =
      seatMapOverride || this.getVariable("playerSeatMap", "clientUIManager.flushPendingCasedPlayerLabels") || {};
    this.ensureUiSystems();

    for (let i = 0; i < pendingPlayerIds.length; i++) {
      const playerId = pendingPlayerIds[i];
      const seatData = seatMap[playerId];
      const casedRoleName = nextPendingCasedRoleMap[playerId] || "";
      const uniqueId = "ui_cased_" + playerId;
      if (!seatData || !casedRoleName) {
        console.log(
          "[sprite-debug-CASED][clientUIManager.flushPendingCasedPlayerLabels][player=" +
            localPlayerId.toString() +
            "] WAIT " +
            uniqueId +
            " seatAvailable=" +
            (!!seatData).toString() +
            " roleAvailable=" +
            (!!casedRoleName).toString() +
            " seatData=",
          seatData,
          " casedRoleName=",
          casedRoleName,
        );
        continue;
      }

      // Match the reliable night-result sprite path: rebuild this local text
      // without opacity/collision props and place it well above ordinary seat
      // UI. Do not mark it complete unless creation can be confirmed.
      const casedSpriteOptions: any = {
        positionX: seatData.voteX,
        positionY: seatData.voteY + 26,
        containerWidth: seatData.labelWidth,
        align: "center",
        text: "CASED: " + this.formatRoleName(casedRoleName),
        fontSize: 20,
        fontWeight: "bold",
        fontColor: this.yellowColor,
        strokeColor: "#000000",
        strokeWeight: 2,
        displayLayer: "top",
        isInteractive: false,
        topAdjust: 1999,
      };
      console.log(
        "[sprite-debug-CASED][clientUIManager.flushPendingCasedPlayerLabels][player=" +
          localPlayerId.toString() +
          "] BEFORE create " +
          uniqueId +
          " effectiveLocalRole=" +
          myRole +
          " seatData=",
        seatData,
        " completeRequestedOptions=",
        casedSpriteOptions,
        " spriteBeforeRemove=",
        spriteManager.getSprite(uniqueId),
      );
      this.uiSystem.remove(uniqueId);
      this.uiSystem.updateText(uniqueId, casedSpriteOptions);

      const createdCasedSprite = spriteManager.getSprite(uniqueId);
      console.log(
        "[sprite-debug-CASED][clientUIManager.flushPendingCasedPlayerLabels][player=" +
          localPlayerId.toString() +
          "] AFTER create " +
          uniqueId +
          " completeRequestedOptions=",
        casedSpriteOptions,
        " createdSprite=",
        createdCasedSprite,
      );
      if (!createdCasedSprite) {
        console.log(
          "[sprite-debug-CASED][clientUIManager.flushPendingCasedPlayerLabels][player=" +
            localPlayerId.toString() +
            "] RETRY " +
            uniqueId +
            " creation returned without a local sprite",
        );
        continue;
      }

      nextAddedCasedRoleMap[playerId] = casedRoleName;
      delete nextPendingCasedRoleMap[playerId];
      console.log(
        "[case-ui] ADDED " + uniqueId + " as CASED: " + this.formatRoleName(casedRoleName) + " localRole=" + myRole,
      );
    }

    return {
      pendingCasedRoleMap: nextPendingCasedRoleMap,
      addedCasedRoleMap: nextAddedCasedRoleMap,
    };
  }

  removeAllCasedPlayerLabels() {
    for (let i = 0; i < this.lastSeatPlayerIds.length; i++) {
      this.uiSystem.remove("ui_cased_" + this.lastSeatPlayerIds[i]);
    }
    this.pendingCasedRoleMap = {};
    this.addedCasedRoleMap = {};
  }

  renderGeneralCenterMessage(state: any) {
    let messageText = "";
    const phase = state.phase;

    if (phase === "REVEAL") {
      const acknowledgementMap = state.roleRevealAcknowledgementMap || {};
      if (acknowledgementMap[state.myPlayerId.toString()] === true) {
        messageText = "Waiting for the other players to understand their roles...";
      }
    }

    if (phase === "DISCUSS") {
      if (state.lastNightEliminatedPlayerId > 0) {
        messageText =
          "Day " +
          state.roundNumber.toString() +
          ": Discuss the night. " +
          this.getPlayerName(state.lastNightEliminatedPlayerId) +
          " was Eliminated.";
      } else {
        messageText = "Day " + state.roundNumber.toString() + ": Discuss the night. No one was Eliminated.";
      }
    }

    if (phase === "END" || phase === "END_EARLY") {
      messageText = state.endReasonText || "";
      if (messageText) messageText += "\n";
      messageText += state.winningTeam + " win!";

      if (state.jokerWinnerPlayerId > 0) {
        messageText += "\n" + this.getPlayerName(state.jokerWinnerPlayerId) + " also wins as the JOKER!";
      }
    }

    this.uiSystem.updateText("ui_center_message", {
      positionX: 210,
      positionY: 680,
      containerWidth: 1080,
      align: "center",
      text: messageText,
      fontSize: 34,
      fontWeight: "bold",
      fontColor: this.lightColor,
      opacity: messageText ? 1 : 0,
      isInteractive: false,
      topAdjust: 1300,
    });
  }

  removeSeatSprites(playerId: string) {
    this.uiSystem.removeMany([
      "ui_seat_hit_" + playerId,
      "ui_seat_frame_" + playerId,
      "ui_name_" + playerId,
      "ui_vote_" + playerId,
      "ui_cased_" + playerId,
    ]);
    if (this.pendingCasedRoleMap) delete this.pendingCasedRoleMap[playerId];
    if (this.addedCasedRoleMap) delete this.addedCasedRoleMap[playerId];
  }

  removeDeprecatedSprites() {
    this.uiSystem.removeMany([
      "ui_role_detail",
      "ui_detective_result",
      "ui_role_banner_highlight_prefix",
      "ui_role_banner_highlight_keyword",
      "ui_role_banner_highlight_suffix",
      "ui_role_detail_highlight_prefix",
      "ui_role_detail_highlight_keyword",
      "ui_role_detail_highlight_suffix",
      "ui_detective_result_highlight_prefix",
      "ui_detective_result_highlight_keyword",
      "ui_detective_result_highlight_suffix",
      "ui_center_highlight_prefix",
      "ui_center_highlight_keyword",
      "ui_center_highlight_suffix",
      "ui_countdown",
    ]);
  }

  emitSettingCycle(settingKey: string) {
    if (!playerManager.isHost) return;
    eventManager.emit("hostCyclesLobbySetting", {
      fromPlayerId: this.getMyPlayerId(),
      settingKey: settingKey,
    });
  }

  cacheAndRefresh(variableName: string, args: any, isMap: boolean) {
    if (!args || !this.hasOwnKey(args, "newValue")) return;
    const newValue = args.newValue;

    if (isMap) {
      if (!newValue || Object.keys(newValue).length === 0) return;
      this.cachedVariableMap[variableName] = this.mergePopulatedMap(this.cachedVariableMap[variableName], newValue);
    } else {
      this.cachedVariableMap[variableName] = newValue;
    }

    this.tryCommitPendingNightResultMap();
    this.refreshUi();
  }

  cacheMapAndRefresh(variableName: string, newValue: any) {
    this.cachedVariableMap[variableName] = this.mergePopulatedMap(this.cachedVariableMap[variableName], newValue);
    if (
      variableName === "playerSeatMap" ||
      variableName === "playerRoleMap" ||
      variableName === "playerNightResultMap"
    ) {
      this.logMapRead(
        variableName,
        "clientUIManager.cacheMapAndRefresh",
        this.cachedVariableMap[variableName],
        "CACHE WRITE",
      );
    }
    this.tryCommitPendingNightResultMap();
    this.refreshUi();
  }

  mergePopulatedMap(existingMap: any, newValue: any) {
    const mergedMap: any = {};
    const existingKeys = existingMap ? Object.keys(existingMap) : [];
    const newKeys = newValue ? Object.keys(newValue) : [];

    for (let i = 0; i < existingKeys.length; i++) {
      const existingKey = existingKeys[i];
      const existingValue = existingMap[existingKey];
      if (existingValue !== undefined && existingValue !== null) {
        mergedMap[existingKey] = existingValue;
      }
    }

    for (let i = 0; i < newKeys.length; i++) {
      const newKey = newKeys[i];
      const newEntryValue = newValue[newKey];
      if (newEntryValue !== undefined && newEntryValue !== null) {
        mergedMap[newKey] = newEntryValue;
      }
    }

    return mergedMap;
  }

  getPopulatedSeatMap(sourceMap: any) {
    const populatedSeatMap: any = {};
    if (!sourceMap) return populatedSeatMap;
    const playerIds = Object.keys(sourceMap);

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const seatData = sourceMap[playerId];
      if (!seatData) continue;
      if (
        seatData.playerX === undefined ||
        seatData.playerY === undefined ||
        seatData.nameX === undefined ||
        seatData.nameY === undefined ||
        seatData.voteX === undefined ||
        seatData.voteY === undefined
      ) {
        continue;
      }
      populatedSeatMap[playerId] = seatData;
    }

    return populatedSeatMap;
  }

  getPopulatedRoleMap(sourceMap: any) {
    const populatedRoleMap: any = {};
    if (!sourceMap) return populatedRoleMap;
    const playerIds = Object.keys(sourceMap);

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const roleName = sourceMap[playerId];
      if (roleName) populatedRoleMap[playerId] = roleName;
    }

    return populatedRoleMap;
  }

  rememberMyRoleFromMap(roleMap: any) {
    if (!roleMap) return;
    const myPlayerId = this.getMyPlayerId();
    if (!(myPlayerId > 0)) return;
    const roleName = roleMap[myPlayerId.toString()] || "";
    if (!roleName || roleName === this.myRole) return;

    this.myRole = roleName;
    // myRole is the user-provided LOCAL variable, so this write stays on this
    // client and protects personal UI from later MAP hydration regressions.
    stateManager.setVariable("myRole", roleName);
  }

  normalizeNightResultMap(sourceMap: any) {
    const normalizedMap: any = {};
    if (!sourceMap) return normalizedMap;

    const playerIds = Object.keys(sourceMap);
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      const sourceResult = sourceMap[playerId];
      let parsedResult = sourceResult;

      if (typeof sourceResult === "string") {
        try {
          parsedResult = JSON.parse(sourceResult);
        } catch (e) {
          parsedResult = null;
        }
      }

      if (parsedResult) normalizedMap[playerId] = parsedResult;
    }

    return normalizedMap;
  }

  tryCommitPendingNightResultMap(): boolean {
    const pendingResultMap = this.pendingPlayerNightResultMap;
    this.logMapRead(
      "playerNightResultMap",
      "clientUIManager.tryCommitPendingNightResultMap -> pending callback data",
      pendingResultMap,
      "PENDING READ",
    );
    if (!pendingResultMap || Object.keys(pendingResultMap).length === 0) {
      console.log(
        "[sync-debug][clientUIManager.tryCommitPendingNightResultMap] WAIT pending playerNightResultMap is missing or empty",
      );
      return false;
    }

    const resultPhase = this.cachedVariableMap.gamePhase;
    if (resultPhase !== "NIGHT_BUFFER" && resultPhase !== "DISCUSS") {
      console.log(
        "[sync-debug][clientUIManager.tryCommitPendingNightResultMap] WAIT gamePhase=" +
          (resultPhase || "undefined") +
          " expected=NIGHT_BUFFER or DISCUSS",
      );
      return false;
    }

    const myPlayerId = this.getMyPlayerId();
    const myPlayerKey = myPlayerId > 0 ? myPlayerId.toString() : "";
    if (!myPlayerKey) return false;
    const result = pendingResultMap[myPlayerKey];
    const roundNumber = this.cachedVariableMap.roundNumber || 0;
    const phaseNonce = this.cachedVariableMap.phaseNonce || 0;
    const expectedActionPhaseNonce = resultPhase === "NIGHT_BUFFER" ? phaseNonce : phaseNonce - 1;

    if (!this.isCompleteNightResultPayload(result, roundNumber, expectedActionPhaseNonce)) {
      console.log(
        "[sync-debug][clientUIManager.tryCommitPendingNightResultMap] WAIT incomplete or stale personal result expectedRound=" +
          roundNumber.toString() +
          " expectedActionPhaseNonce=" +
          expectedActionPhaseNonce.toString() +
          " actualResult=",
        result,
      );
      return false;
    }

    this.cachedVariableMap.playerNightResultMap = pendingResultMap;
    this.pendingPlayerNightResultMap = null;
    this.mergeCaseKnowledgeFromNightResults(
      pendingResultMap,
      this.getVariable("playerRoleMap", "clientUIManager.tryCommitPendingNightResultMap -> CASE promotion") || {},
      roundNumber,
    );
    console.log("[night-result] accepted night " + roundNumber.toString() + " result from callback newValue");
    return true;
  }

  isCompleteNightResultPayload(result: any, roundNumber: number, actionPhaseNonce: number): boolean {
    if (!result) return false;
    if (result.nightNumber !== roundNumber) return false;
    if (result.actionPhaseNonce !== actionPhaseNonce) return false;
    if (!result.status || !result.actionText || !result.summaryText) {
      return false;
    }

    if (result.status === "NO_ACTION") {
      const aliveMap = this.cachedVariableMap.playerAliveMap || {};
      return aliveMap[this.getMyPlayerId().toString()] === false;
    }

    if (result.status !== "SUCCESS" && result.status !== "BLOCKED" && result.status !== "ELIMINATED") {
      return false;
    }

    return !!result.actionName && result.targetPlayerId > 0 && !!result.detailText;
  }

  cacheSimpleValue(variableName: string, args: any) {
    if (!args || !this.hasOwnKey(args, "newValue")) return;
    this.cachedVariableMap[variableName] = args.newValue;
  }

  clearRoundCache() {
    this.removeAllCasedPlayerLabels();
    this.cachedVariableMap.playerSeatMap = {};
    this.cachedVariableMap.playerRoleMap = {};
    this.cachedVariableMap.playerAliveMap = {};
    this.cachedVariableMap.playerDeathInfoMap = {};
    this.cachedVariableMap.roleRevealAcknowledgementMap = {};
    this.cachedVariableMap.nightActionMap = {};
    this.cachedVariableMap.tricksterCaseTargetMap = {};
    this.cachedVariableMap.sleepyPlayerMap = {};
    this.cachedVariableMap.trialNominationVoteMap = {};
    this.cachedVariableMap.trialVerdictVoteMap = {};
    this.cachedVariableMap.trialAccusedPlayerId = 0;
    this.cachedVariableMap.jokerWinnerPlayerId = 0;
    this.cachedVariableMap.lastNightEliminatedPlayerId = 0;
    this.cachedVariableMap.winningTeam = "";
    this.cachedVariableMap.endReasonText = "";
    this.cachedVariableMap.roundNumber = 0;
  }

  getVariable(variableName: string, sourceLocation?: string) {
    let value: any;
    let sourceName = "stateManager fallback";
    if (this.hasOwnKey(this.cachedVariableMap, variableName)) {
      value = this.cachedVariableMap[variableName];
      sourceName = "callback cache";
    } else {
      value = stateManager.getVariable(variableName);
    }

    if (
      variableName === "playerSeatMap" ||
      variableName === "playerRoleMap" ||
      variableName === "playerNightResultMap"
    ) {
      this.logMapRead(
        variableName,
        sourceLocation || "clientUIManager.getVariable caller unspecified",
        value,
        "READ from " + sourceName,
      );
    }
    return value;
  }

  logMapCallback(variableName: string, sourceLocation: string, args: any) {
    const oldValue = args ? args.oldValue : undefined;
    const newValue = args ? args.newValue : undefined;
    console.log(
      "[sync-debug][" +
        sourceLocation +
        "][player=" +
        this.getMyPlayerId().toString() +
        "] CALLBACK " +
        variableName +
        " old(" +
        this.describeMapValue(oldValue) +
        ") new(" +
        this.describeMapValue(newValue) +
        ") args=",
      args,
    );
  }

  logMapRead(variableName: string, sourceLocation: string, value: any, actionName: string) {
    console.log(
      "[sync-debug][" +
        sourceLocation +
        "][player=" +
        this.getMyPlayerId().toString() +
        "] " +
        actionName +
        " " +
        variableName +
        " " +
        this.describeMapValue(value) +
        " value=",
      value,
    );
  }

  describeMapValue(value: any): string {
    if (value === undefined) return "value=undefined";
    if (value === null) return "value=null";
    const keys = Object.keys(value);
    const undefinedChildKeys: string[] = [];

    for (let i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) undefinedChildKeys.push(keys[i]);
    }

    return "keys=[" + keys.join(",") + "] undefinedChildren=[" + undefinedChildKeys.join(",") + "]";
  }

  getFourPlayerDevStartEnabled(): boolean {
    if (!this.gameManagerSystem) {
      this.gameManagerSystem = scriptManager.getSystem({
        systemName: "gameManager",
      });
    }
    return this.gameManagerSystem && this.gameManagerSystem.fourPlayerDevStartEnabled === true;
  }

  hasOwnKey(target: any, key: string): boolean {
    if (!target) return false;
    return Object.keys(target).indexOf(key) !== -1;
  }

  hasValue(value: any): boolean {
    return value !== undefined && value !== null && value !== "";
  }

  truncatePlayerName(playerName: string, maxWidth: number): string {
    let truncatedName = playerName;
    while (truncatedName.length > 3 && this.uiSystem.estimateTextWidth(truncatedName, 24) > maxWidth - 8) {
      truncatedName = truncatedName.substring(0, truncatedName.length - 1);
    }
    if (truncatedName !== playerName) truncatedName += "...";
    return truncatedName;
  }

  formatRoleName(roleName: string): string {
    if (!roleName) return "";
    return roleName.substring(0, 1) + roleName.substring(1).toLowerCase();
  }

  isTricksterTeamRole(roleName: string): boolean {
    return roleName === "TRICKSTER" || roleName === "SABOTEUR" || roleName === "FRAMER";
  }

  getMyPlayerId(): number {
    if (!this.myPlayerId) this.myPlayerId = playerManager.getMyPlayerId();
    return this.myPlayerId;
  }

  getPlayerName(playerId: number): string {
    const details = playerManager.getPlayerDetails(playerId);
    if (details && details.username) return details.username;
    return "Player " + playerId.toString();
  }

  ensureUiSystems() {
    if (!this.uiSystem) {
      this.uiSystem = scriptManager.getSystem({ systemName: "uiSpriteManager" });
    }
    if (!this.roleUiSystem) {
      this.roleUiSystem = scriptManager.getSystem({ systemName: "roleUIManager" });
    }
    if (!this.nightUiSystem) {
      this.nightUiSystem = scriptManager.getSystem({ systemName: "nightUIManager" });
    }
    if (!this.trialUiSystem) {
      this.trialUiSystem = scriptManager.getSystem({ systemName: "trialUIManager" });
    }
  }
}
