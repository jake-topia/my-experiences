class clientUIManager extends SystemScript {
  myPlayerId: number;
  lastSeatPlayerIds: string[];
  lastSpriteStateMap: any;
  syncedUiVariableMap: any;
  localDisplayedTargetMapByPhase: any;
  pendingLocalTargetByPhase: any;
  lightTextColor: string;
  darkTextColor: string;
  yellowTextColor: string;
  redTextColor: string;
  detectiveTextColor: string;
  doctorTextColor: string;
  spectatorTextColor: string;
  eliminatedNameColor: string;
  seatClickRectFill: string;
  seatClickRectOpacity: number;
  seatFrameStrokeColor: string;
  seatFrameStrokeWeight: number;
  seatFrameBorderRadius: number;
  selectedSeatFrameStrokeColor: string;
  selectedSeatFrameStrokeWeight: number;
  selectedSeatFrameBorderRadius: number;
  seatClickRectPadding: number;
  seatClickRectTopAdjust: number;
  seatNameFontSize: number;
  seatVoteFontSize: number;
  suspicionIconFontSize: number;
  suspicionIconOffsetX: number;
  suspicionIconTopAdjust: number;
  roleBannerFontSize: number;
  roleDetailFontSize: number;
  detectiveResultFontSize: number;
  roleBannerY: number;
  roleDetailY: number;
  detectiveResultY: number;
  centerHighlightFontSize: number;
  centerMessageY: number;
  centerMessageTopY: number;
  centerMessageBottomY: number;
  highlightWordShiftX: number;
  yourTurnFontSize: number;
  yourTurnY: number;
  yourTurnUnderlineHeight: number;
  helpDrawerOpen: boolean;
  helpOverlaySpriteIds: string[];
  helpPopupMargin: number;
  helpPopupTopAdjust: number;
  roleRevealPopupOpen: boolean;
  roleRevealPopupSpriteIds: string[];
  roleRevealAcknowledgementSubmitted: boolean;
  lastReceivedRoleRevealRole: string;
  roleRevealPopupMargin: number;
  roleRevealHeadingFontSize: number;
  roleRevealBodyFontSize: number;
  roleRevealAcknowledgeFontSize: number;

  onInit() {
    this.myPlayerId = 0;
    this.lastSeatPlayerIds = [];
    this.lastSpriteStateMap = {};
    this.syncedUiVariableMap = {};
    this.localDisplayedTargetMapByPhase = {};
    this.pendingLocalTargetByPhase = {};
    this.lightTextColor = "#fff7df";
    this.darkTextColor = "#243018";
    this.yellowTextColor = "#f0d04f";
    this.redTextColor = "#d74d4d";
    this.detectiveTextColor = "#87d3ff";
    this.doctorTextColor = "#ffe27a";
    this.spectatorTextColor = "#a0a0a0";
    this.eliminatedNameColor = "#a0a0a0";
    this.seatClickRectFill = this.lightTextColor;
    this.seatClickRectOpacity = 0.01;
    this.seatFrameStrokeColor = "rgba(255, 247, 223, 0.75)";
    this.seatFrameStrokeWeight = 3;
    this.seatFrameBorderRadius = 22;
    this.selectedSeatFrameStrokeColor = this.yellowTextColor;
    this.selectedSeatFrameStrokeWeight = 21;
    this.selectedSeatFrameBorderRadius = this.seatFrameBorderRadius;
    this.seatClickRectPadding = 12;
    this.seatClickRectTopAdjust = 1000;
    this.seatNameFontSize = 24;
    this.seatVoteFontSize = 20;
    this.suspicionIconFontSize = 42;
    this.suspicionIconOffsetX = -16;
    // Keep the Eyes control behind every popup background. The role-reveal
    // panel begins at 0, while the help panel is higher still.
    this.suspicionIconTopAdjust = -1;
    this.roleBannerFontSize = 56;
    this.roleDetailFontSize = 30;
    this.detectiveResultFontSize = 22;
    this.roleBannerY = 36;
    this.roleDetailY = 104;
    this.detectiveResultY = 148;
    this.centerHighlightFontSize = 34;
    this.centerMessageY = 675;
    this.centerMessageTopY = 648;
    this.centerMessageBottomY = 706;
    this.highlightWordShiftX = -75;
    this.yourTurnFontSize = 58;
    // Keep the prompt visibly above the two-line center instructions.
    this.yourTurnY = 560;
    this.yourTurnUnderlineHeight = 4;
    this.helpDrawerOpen = false;
    this.helpOverlaySpriteIds = [];
    this.helpPopupMargin = 300;
    this.helpPopupTopAdjust = 50;
    this.roleRevealPopupOpen = false;
    this.roleRevealPopupSpriteIds = [];
    this.roleRevealAcknowledgementSubmitted = false;
    this.lastReceivedRoleRevealRole = "";
    this.roleRevealPopupMargin = 300;
    this.roleRevealHeadingFontSize = 52;
    this.roleRevealBodyFontSize = 34;
    this.roleRevealAcknowledgeFontSize = 36;

    this.ensurePersistentSprites();
    this.removeDeprecatedLocalCountdownSprite();
    this.refreshUi();
  }

  onPlayerStart() {
    this.myPlayerId = playerManager.getMyPlayerId();
    this.ensurePersistentSprites();
    this.removeDeprecatedLocalCountdownSprite();
    this.refreshUi();
  }

  onSpectatorStart() {
    this.myPlayerId = playerManager.getMyPlayerId();
    this.ensurePersistentSprites();
    this.removeDeprecatedLocalCountdownSprite();
    this.refreshUi();
  }

  onPlayerJoined() {
    this.refreshUi();
  }

  onPlayerLeft() {
    this.refreshUi();
  }

  onVariableChanged_gamePhase(args: any) {
    if (!args || args.newValue === undefined || args.newValue === null || args.newValue === "") {
      return;
    }

    if (args.newValue === "REVEAL") {
      this.roleRevealAcknowledgementSubmitted = false;
      // Ignore acknowledgement state from the preceding round until this
      // round's reset acknowledgement MAP arrives on this client.
      if (this.syncedUiVariableMap) {
        this.syncedUiVariableMap.roleRevealAcknowledgementMap = {};
      }
    } else {
      this.closeRoleRevealPopup();
      if (args.newValue === "WAITING") {
        this.lastReceivedRoleRevealRole = "";
      }
    }

    this.onTrackedVariableChanged("gamePhase", args);
  }

  onVariableChanged_phaseNonce(args: any) {
    this.onTrackedVariableChanged("phaseNonce", args);
  }

  onVariableChanged_configuredTricksterCount(args: any) {
    this.onTrackedVariableChanged("configuredTricksterCount", args);
  }

  onVariableChanged_configuredDiscussionSeconds(args: any) {
    this.onTrackedVariableChanged("configuredDiscussionSeconds", args);
  }

  onVariableChanged_configuredVotingSeconds(args: any) {
    this.onTrackedVariableChanged("configuredVotingSeconds", args);
  }

  onVariableChanged_configuredNightSeconds(args: any) {
    this.onTrackedVariableChanged("configuredNightSeconds", args);
  }

  onVariableChanged_playerSeatMap(args: any) {
    this.onTrackedVariableChanged("playerSeatMap", args);
  }

  onVariableChanged_playerRoleMap(args: any) {
    if (!args) return;

    const newValue = args.newValue;
    const oldValue = args.oldValue;

    console.log(
      "[rolemap-debug] playerRoleMap onVariableChanged newValue=" +
        this.formatDebugValue(newValue) +
        " oldValue=" +
        this.formatDebugValue(oldValue),
    );

    if (!newValue) return;

    const receivedRole = newValue[this.getMyPlayerId().toString()];
    if (!receivedRole) return;

    this.lastReceivedRoleRevealRole = receivedRole;
    this.refreshRoleRevealPopupFromReceivedRoleMap(newValue);
    this.onTrackedVariableChanged("playerRoleMap", {
      newValue: newValue,
      oldValue: oldValue,
    });
  }

  onVariableChanged_playerAliveMap(args: any) {
    // A MAP can briefly arrive empty while its child values hydrate. Do not
    // replace the last known complete roster with that transient payload.
    if (!args || !args.newValue || Object.keys(args.newValue).length === 0) {
      return;
    }

    const resolvedAliveMap = this.mergePlayerAliveMapUpdate(args.newValue);

    if (!resolvedAliveMap || Object.keys(resolvedAliveMap).length === 0) {
      return;
    }

    console.log(
      "AliveMap-debug applying newValue=" +
        this.formatDebugValue(args.newValue) +
        " oldValue=" +
        this.formatDebugValue(args.oldValue) +
        " resolvedAliveMap=" +
        this.formatDebugValue(resolvedAliveMap),
    );

    this.syncedUiVariableMap.playerAliveMap = resolvedAliveMap;
    this.applyEliminatedNameColors(resolvedAliveMap);
    // This only reapplies the detective's local revealed-role colors. It
    // never writes white; eliminated names remain grey because that helper
    // skips dead players.
    this.applyDetectiveKnowledgeNameColors();
    // An eliminated target must immediately lose its displayed vote counter,
    // without invoking a general UI refresh that could touch name sprites.
    this.refreshSeatVoteVisualsForCurrentState();
    this.refreshLocalRoleBannerFromAliveMap();
  }

  onVariableChanged_playerDeathInfoMap(args: any) {
    // As with playerAliveMap, wait for a populated MAP so an eliminated
    // player's local banner is never rebuilt from a transient empty payload.
    if (!args || !args.newValue || Object.keys(args.newValue).length === 0) {
      return;
    }

    this.syncedUiVariableMap.playerDeathInfoMap = args.newValue;
    this.refreshLocalRoleBannerFromAliveMap();
  }

  onVariableChanged_detectivePlayerRoleRevealedMap(args: any) {
    // Ignore a transient empty MAP payload. A populated newValue is the
    // authoritative record of every role the Detective has learned so far.
    if (!args || !args.newValue || Object.keys(args.newValue).length === 0) {
      return;
    }

    this.syncedUiVariableMap.detectivePlayerRoleRevealedMap = args.newValue;
    this.applyDetectiveKnowledgeNameColors();
  }

  onVariableChanged_nightTargetMap(args: any) {
    this.onTargetMapVariableChanged("nightTargetMap", args);
  }

  onVariableChanged_dayVoteTargetMap(args: any) {
    this.onTargetMapVariableChanged("dayVoteTargetMap", args);
  }

  onVariableChanged_roleRevealAcknowledgementMap(args: any) {
    this.onTrackedVariableChanged("roleRevealAcknowledgementMap", args);
  }

  onVariableChanged_savedPlayerId(args: any) {
    this.onTrackedVariableChanged("savedPlayerId", args);
  }

  onVariableChanged_lastNightEliminatedPlayerId(args: any) {
    this.onTrackedVariableChanged("lastNightEliminatedPlayerId", args);
  }

  onVariableChanged_lastInvestigatedPlayerId({ newValue }: { newValue: any }) {
    const investigatedPlayerId = newValue || 0;
    this.syncedUiVariableMap.lastInvestigatedPlayerId = investigatedPlayerId;
    this.refreshLocalDetectiveResult();
  }

  onVariableChanged_lastExiledPlayerId(args: any) {
    this.onTrackedVariableChanged("lastExiledPlayerId", args);
  }

  onVariableChanged_winningTeam(args: any) {
    this.onTrackedVariableChanged("winningTeam", args);
  }

  onVariableChanged_endReasonText(args: any) {
    this.onTrackedVariableChanged("endReasonText", args);
  }

  onVariableChanged_roundNumber(args: any) {
    this.onTrackedVariableChanged("roundNumber", args);
  }

  onSpriteClicked({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || !sprite.uniqueId) return;

    const uniqueId = sprite.uniqueId;

    if (uniqueId === "ui_role_reveal_acknowledge") {
      this.acknowledgeRoleReveal();
      return;
    }

    if (this.roleRevealPopupOpen) return;

    if (uniqueId === "ui_help_button") {
      this.toggleHelpDrawer();
      return;
    }

    if (uniqueId === "ui_help_close" || uniqueId === "ui_help_close_bg") {
      this.closeHelpDrawer();
      return;
    }

    if (uniqueId === "ui_start_center" || uniqueId === "ui_start_follow") {
      if (!playerManager.isHost) return;
      eventManager.emit("hostStartsGame", {
        fromPlayerId: this.getMyPlayerId(),
      });
      return;
    }

    if (uniqueId === "ui_setting_tricksters") {
      this.emitSettingCycle("tricksters");
      return;
    }

    if (uniqueId === "ui_setting_discussion") {
      this.emitSettingCycle("discussion");
      return;
    }

    if (uniqueId === "ui_setting_voting") {
      this.emitSettingCycle("voting");
      return;
    }

    if (uniqueId === "ui_setting_night") {
      this.emitSettingCycle("night");
      return;
    }

    if (uniqueId === "ui_setting_dev") {
      this.emitSettingCycle("dev");
      return;
    }

    if (uniqueId.indexOf("ui_seat_hit_") === 0) {
      const targetPlayerId = parseInt(uniqueId.replace("ui_seat_hit_", ""), 10);
      this.handlePlayerNameClick(targetPlayerId);
      return;
    }

    if (uniqueId.indexOf("ui_name_") === 0) {
      const targetPlayerId = parseInt(uniqueId.replace("ui_name_", ""), 10);
      this.handlePlayerNameClick(targetPlayerId);
      return;
    }

    if (uniqueId.indexOf("ui_vote_") === 0) {
      const targetPlayerId = parseInt(uniqueId.replace("ui_vote_", ""), 10);
      this.handlePlayerNameClick(targetPlayerId);
      return;
    }

    if (uniqueId.indexOf("ui_suspicion_") === 0) {
      const targetPlayerId = parseInt(uniqueId.replace("ui_suspicion_", ""), 10);
      this.submitSuspicion(targetPlayerId);
      return;
    }
  }

  emitSettingCycle(settingKey: string) {
    if (!playerManager.isHost) return;

    eventManager.emit("hostCyclesLobbySetting", {
      fromPlayerId: this.getMyPlayerId(),
      settingKey: settingKey,
    });
  }

  handlePlayerNameClick(targetPlayerId: number) {
    const phase = stateManager.getVariable("gamePhase");
    const roleMap = stateManager.getVariable("playerRoleMap");
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const myPlayerId = this.getMyPlayerId();
    const myRole = roleMap && myPlayerId ? roleMap[myPlayerId.toString()] : "";

    if (!phase || !myPlayerId || !targetPlayerId) return;
    // Late joiners are spectators for the current round. Require a role-map
    // entry and an explicit alive value before allowing any target selection.
    if (!roleMap || !roleMap[myPlayerId.toString()]) return;
    if (!aliveMap || aliveMap[myPlayerId.toString()] !== true) return;
    if (!roleMap[targetPlayerId.toString()]) return;
    if (aliveMap[targetPlayerId.toString()] !== true) return;

    if (phase === "VOTE") {
      this.submitLocalTargetSelection(phase, targetPlayerId);
      return;
    }

    if (phase === "NIGHT_TRICKSTER") {
      if (myRole !== "TRICKSTER") return;
      if (roleMap[targetPlayerId.toString()] === "TRICKSTER") return;
      this.submitLocalTargetSelection(phase, targetPlayerId);
      return;
    }

    if (phase === "NIGHT_DETECTIVE") {
      if (myRole !== "DETECTIVE") return;
      if (targetPlayerId === myPlayerId) return;
      this.submitLocalTargetSelection(phase, targetPlayerId);
      return;
    }

    if (phase === "NIGHT_DOCTOR") {
      if (myRole !== "DOCTOR") return;
      this.submitLocalTargetSelection(phase, targetPlayerId);
    }
  }

  submitSuspicion(targetPlayerId: number) {
    const phase = stateManager.getVariable("gamePhase");
    const roleMap = stateManager.getVariable("playerRoleMap");
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const myPlayerId = this.getMyPlayerId();

    if (!this.canLocalPlayerSendSuspicion(phase, myPlayerId, targetPlayerId, roleMap, aliveMap)) {
      return;
    }

    eventManager.emit("playerSuspectsPlayer", {
      fromPlayerId: myPlayerId,
      targetPlayerId: targetPlayerId,
    });
  }

  canLocalPlayerSendSuspicion(
    phase: string,
    myPlayerId: number,
    targetPlayerId: number,
    roleMap: any,
    aliveMap: any,
  ): boolean {
    if (phase !== "DISCUSS" && phase !== "VOTE") return false;
    if (!myPlayerId || !targetPlayerId || myPlayerId === targetPlayerId) return false;
    if (!roleMap || !aliveMap) return false;
    if (!roleMap[myPlayerId.toString()] || !roleMap[targetPlayerId.toString()]) return false;
    if (aliveMap[myPlayerId.toString()] !== true) return false;
    if (aliveMap[targetPlayerId.toString()] !== true) return false;

    return true;
  }

  refreshUi() {
    this.promoteHydratedUiMaps();

    const phase = this.getUiVariable("gamePhase");
    const playerCount = playerManager.getPlayerIds().length;
    const configuredTricksterCount = this.getUiVariable("configuredTricksterCount");
    const configuredDiscussionSeconds = this.getUiVariable("configuredDiscussionSeconds");
    const configuredVotingSeconds = this.getUiVariable("configuredVotingSeconds");
    const configuredNightSeconds = this.getUiVariable("configuredNightSeconds");
    const seatMap = this.getUiVariable("playerSeatMap");
    const roleMap = this.getUiVariable("playerRoleMap");
    const aliveMap = this.getUiVariable("playerAliveMap");
    const deathInfoMap = this.getUiVariable("playerDeathInfoMap");
    const myPlayerId = this.getMyPlayerId();
    const myRole = roleMap && myPlayerId ? roleMap[myPlayerId.toString()] : "";
    const isRoundPlayer = roleMap && myPlayerId ? !!roleMap[myPlayerId.toString()] : false;
    const myAlive = aliveMap && myPlayerId ? aliveMap[myPlayerId.toString()] !== false : isRoundPlayer;
    const titleColor = phase === "WAITING" ? this.darkTextColor : this.lightTextColor;

    this.logRevealDebugSummary(phase, myPlayerId, myRole, isRoundPlayer, myAlive, seatMap, roleMap, aliveMap);

    this.updateTextSprite("ui_title", {
      text: phase === "WAITING" ? "Trickster Town" : "",
      fontColor: titleColor,
      opacity: phase === "WAITING" ? 1 : 0,
      isInteractive: false,
    });
    this.updateTextSprite("ui_subtitle", {
      text: phase === "WAITING" ? "waiting for players... (" + playerCount.toString() + "/4 minimum)" : "",
      fontColor: titleColor,
      opacity: phase === "WAITING" ? 1 : 0,
      isInteractive: false,
    });
    this.updateTextSprite("ui_setting_tricksters", {
      text: phase === "WAITING" ? "# of Tricksters: " + configuredTricksterCount.toString() : "",
      fontColor: titleColor,
      opacity: phase === "WAITING" ? 1 : 0,
      isInteractive: phase === "WAITING" && playerManager.isHost,
    });
    this.updateTextSprite("ui_setting_discussion", {
      text: phase === "WAITING" ? "Discussion: " + configuredDiscussionSeconds.toString() + "s" : "",
      fontColor: titleColor,
      opacity: phase === "WAITING" ? 1 : 0,
      isInteractive: phase === "WAITING" && playerManager.isHost,
    });
    this.updateTextSprite("ui_setting_voting", {
      text: phase === "WAITING" ? "Voting: " + configuredVotingSeconds.toString() + "s" : "",
      fontColor: titleColor,
      opacity: phase === "WAITING" ? 1 : 0,
      isInteractive: phase === "WAITING" && playerManager.isHost,
    });
    this.updateTextSprite("ui_setting_night", {
      text: phase === "WAITING" ? "Night: " + configuredNightSeconds.toString() + "s / role" : "",
      fontColor: titleColor,
      opacity: phase === "WAITING" ? 1 : 0,
      isInteractive: phase === "WAITING" && playerManager.isHost,
    });
    this.updateTextSprite("ui_setting_dev", {
      text: phase === "WAITING" && playerManager.isHost ? "Dev: Enabled" : "",
      fontColor: titleColor,
      opacity: phase === "WAITING" && playerManager.isHost ? 1 : 0,
      isInteractive: phase === "WAITING" && playerManager.isHost,
    });
    this.updateTextSprite("ui_start_center", {
      text: phase === "WAITING" ? "Click here to start" : "",
      fontColor: phase === "WAITING" ? titleColor : this.lightTextColor,
      opacity: phase === "WAITING" ? 1 : 0,
      isInteractive: phase === "WAITING" && playerManager.isHost,
    });

    this.refreshHostFollowStartButton(phase, titleColor);
    this.refreshRoleBanner(phase, myRole, myAlive, isRoundPlayer, deathInfoMap);
    this.refreshCenterMessage(phase, myRole, myAlive, isRoundPlayer);
    this.refreshYourTurnPrompt(phase, myRole, myAlive, isRoundPlayer);
    this.refreshDetectiveResult(phase, myRole);
    this.refreshSeatLabels(phase, seatMap, roleMap, aliveMap, myRole, myAlive, isRoundPlayer);
    // Run after seat labels: the investigation callback can arrive before a
    // local ui_name sprite has been created. This is detective-only and never
    // resets any name to white.
    this.applyDetectiveKnowledgeNameColors();
    this.refreshHelpButton(phase);
    this.refreshRoleRevealPopup(phase, myRole, isRoundPlayer);
  }

  refreshRoleBanner(phase: string, myRole: string, myAlive: boolean, isRoundPlayer: boolean, deathInfoMap: any) {
    this.hideTextSprite("ui_role_banner");
    this.hideTextSprite("ui_role_detail");
    this.hideHighlightedTextLine("ui_role_banner_highlight");
    this.hideHighlightedTextLine("ui_role_detail_highlight");

    if (phase === "REVEAL") return;

    if (phase === "WAITING" || !isRoundPlayer) {
      return;
    }

    if (!myAlive) {
      const deathInfo = deathInfoMap ? deathInfoMap[this.getMyPlayerId().toString()] : null;

      if (deathInfo && (deathInfo.cause === "EXILED" || deathInfo.cause === "VOTED_OUT")) {
        this.rebuildEliminatedRoleBanner(
          "You were Eliminated in round " + deathInfo.roundNumber.toString(),
        );
        return;
      }

      if (deathInfo && (deathInfo.cause === "TRICKSTER_ELIMINATION" || deathInfo.cause === "TRICKSTER_KILL")) {
        this.rebuildEliminatedRoleBanner("You were Eliminated by a TRICKSTER");
        return;
      }

      this.rebuildEliminatedRoleBanner("You were Eliminated from the round");
      return;
    }

    if (myRole === "TRICKSTER" || myRole === "DETECTIVE" || myRole === "DOCTOR") {
      this.renderCenteredHighlightLine(
        "ui_role_banner_highlight",
        750,
        this.roleBannerY,
        this.roleBannerFontSize,
        "You are the ",
        myRole,
        " role",
        this.lightTextColor,
        this.getRoleHighlightColor(myRole),
        this.highlightWordShiftX,
      );
    } else {
      this.updateTextSprite("ui_role_banner", {
        text: "You are the TOWNSFOLK role",
        fontColor: this.lightTextColor,
        opacity: 1,
        isInteractive: false,
      });
    }

  }

  refreshDetectiveResult(phase: string, myRole: string) {
    this.hideTextSprite("ui_detective_result");
    this.hideHighlightedTextLine("ui_detective_result_highlight");

    if (phase === "WAITING" || myRole !== "DETECTIVE") {
      return;
    }

    const investigatedPlayerId = this.getUiVariable("lastInvestigatedPlayerId");
    const roleMap = this.getUiVariable("playerRoleMap");

    if (!investigatedPlayerId || investigatedPlayerId <= 0) {
      return;
    }

    const investigatedPlayerName = this.getPlayerName(investigatedPlayerId);
    if (roleMap[investigatedPlayerId.toString()] === "TRICKSTER") {
      this.renderCenteredHighlightLine(
        "ui_detective_result_highlight",
        750,
        this.detectiveResultY,
        this.detectiveResultFontSize,
        "Detective note: " + investigatedPlayerName + " is a ",
        "TRICKSTER",
        "",
        this.lightTextColor,
        this.redTextColor,
        this.highlightWordShiftX,
      );
      return;
    }

    this.renderCenteredHighlightLine(
      "ui_detective_result_highlight",
      750,
      this.detectiveResultY,
      this.detectiveResultFontSize,
      "Detective note: " + investigatedPlayerName + " is not a ",
      "TRICKSTER",
      "",
      this.lightTextColor,
      this.redTextColor,
      this.highlightWordShiftX,
    );
  }

  refreshLocalDetectiveResult() {
    const roleMap = this.getUiVariable("playerRoleMap");
    const myPlayerId = this.getMyPlayerId();
    const myRole = roleMap && myPlayerId ? roleMap[myPlayerId.toString()] : "";

    this.refreshDetectiveResult(this.getUiVariable("gamePhase"), myRole);
  }

  refreshCenterMessage(phase: string, myRole: string, myAlive: boolean, isRoundPlayer: boolean) {
    this.hideTextSprite("ui_center_message");
    this.hideHighlightedTextLine("ui_center_highlight");

    if (phase === "WAITING") {
      return;
    }

    if (phase === "REVEAL") {
      if (isRoundPlayer && this.hasAcknowledgedRoleReveal()) {
        this.showCenterMessage("Waiting for the other players to understand their roles...");
      }
      return;
    }

    if (phase === "NIGHT_TRICKSTER") {
      if (!isRoundPlayer) {
        this.showSpectatorMessage();
        return;
      }

      if (!myAlive) {
        this.showEliminatedWaitMessage();
        return;
      }

      if (myRole === "TRICKSTER") {
        this.showCenterMessageWithHighlightBelow(
          "Choose a TOWNSFOLK to",
          "",
          "ELIMINATE",
          " from the game!",
          this.redTextColor,
        );
        return;
      }

      this.showCenterHighlightWithMessageBelow(
        "Waiting for the ",
        "TRICKSTER",
        " team",
        this.redTextColor,
        "to make their move",
        this.highlightWordShiftX,
      );
      return;
    }

    if (phase === "NIGHT_DETECTIVE") {
      if (!isRoundPlayer) {
        this.showSpectatorMessage();
        return;
      }

      if (!myAlive) {
        this.showEliminatedWaitMessage();
        return;
      }

      if (myRole === "DETECTIVE") {
        this.showCenterMessageWithHighlightBelow("Choose a player to", "", "INVESTIGATE", "", this.detectiveTextColor);
        return;
      }

      this.showCenterHighlightWithMessageBelow(
        "Waiting for the ",
        "DETECTIVE",
        "",
        this.detectiveTextColor,
        "to make their move",
        this.highlightWordShiftX,
      );
      return;
    }

    if (phase === "NIGHT_DOCTOR") {
      if (!isRoundPlayer) {
        this.showSpectatorMessage();
        return;
      }

      if (!myAlive) {
        this.showEliminatedWaitMessage();
        return;
      }

      if (myRole === "DOCTOR") {
        this.showCenterMessageWithHighlightBelow("Choose a player to", "", "PROTECT", "", this.doctorTextColor);
        return;
      }

      this.showCenterHighlightWithMessageBelow(
        "Waiting for the ",
        "DOCTOR",
        "",
        this.doctorTextColor,
        "to make their move",
        this.highlightWordShiftX,
      );
      return;
    }

    if (phase === "DISCUSS") {
      const lastNightEliminatedPlayerId = this.getUiVariable("lastNightEliminatedPlayerId");
      const savedPlayerId = this.getUiVariable("savedPlayerId");

      if (lastNightEliminatedPlayerId > 0) {
        this.showCenterMessage(
          "Discuss what happened during the night.\n" +
            this.getPlayerName(lastNightEliminatedPlayerId) +
            " was Eliminated.",
        );
        return;
      }

      if (savedPlayerId > 0) {
        this.showCenterMessageWithHighlightBelow(
          "Discuss what happened during the night.",
          "The ",
          "DOCTOR",
          " protected someone.",
          this.doctorTextColor,
        );
        return;
      }

      this.showCenterMessage("Discuss what happened during the night.\nNo one was Eliminated last night.");
      return;
    }

    if (phase === "VOTE") {
      if (!isRoundPlayer) {
        this.showSpectatorMessage();
        return;
      }

      if (!myAlive) {
        this.showCenterMessage("The town is voting.\nWait for the result.");
        return;
      }

      this.showCenterMessage("Choose a player to Exile from the town!");
      return;
    }

    if (phase === "ANNOUNCE") {
      const lastExiledPlayerId = this.getUiVariable("lastExiledPlayerId");
      const dayVoteResultText = this.getUiVariable("endReasonText");
      this.showCenterMessage(
        lastExiledPlayerId > 0
          ? this.getPlayerName(lastExiledPlayerId) + " was Exiled from the town."
          : dayVoteResultText || "No one was Exiled.",
      );
      return;
    }

    if (phase === "END") {
      this.showCenterMessage(this.getUiVariable("winningTeam") + " win!");
      return;
    }

    if (phase === "END_EARLY") {
      this.showCenterMessage(this.getUiVariable("endReasonText") + "\n" + this.getUiVariable("winningTeam") + " win!");
    }
  }

  showCenterMessage(text: string, positionY?: number, fontColor?: string) {
    this.updateTextSprite("ui_center_message", {
      positionY: positionY === undefined ? this.centerMessageY : positionY,
      text: text,
      fontColor: fontColor || this.lightTextColor,
      opacity: 1,
      isInteractive: false,
    });
  }

  showCenterMessageWithHighlightBelow(
    topText: string,
    prefix: string,
    keyword: string,
    suffix: string,
    keywordColor: string,
    trailingOffsetX?: number,
  ) {
    this.showCenterMessage(topText, this.centerMessageTopY);
    this.renderCenteredHighlightLine(
      "ui_center_highlight",
      750,
      this.centerMessageBottomY,
      this.centerHighlightFontSize,
      prefix,
      keyword,
      suffix,
      this.lightTextColor,
      keywordColor,
      trailingOffsetX,
    );
  }

  showCenterHighlightWithMessageBelow(
    prefix: string,
    keyword: string,
    suffix: string,
    keywordColor: string,
    bottomText: string,
    trailingOffsetX?: number,
  ) {
    this.renderCenteredHighlightLine(
      "ui_center_highlight",
      750,
      this.centerMessageTopY,
      this.centerHighlightFontSize,
      prefix,
      keyword,
      suffix,
      this.lightTextColor,
      keywordColor,
      trailingOffsetX,
    );
    this.showCenterMessage(bottomText, this.centerMessageBottomY);
  }

  showSpectatorMessage() {
    this.showCenterMessage("Spectating current round", this.centerMessageY, this.spectatorTextColor);
  }

  showEliminatedWaitMessage() {
    this.showCenterMessage("You are Eliminated.\nWait for the round to end.");
  }

  refreshYourTurnPrompt(
    phase: string,
    myRole: string,
    myAlive: boolean,
    isRoundPlayer: boolean,
  ) {
    const promptText = "YOUR TURN";
    const promptWidth = Math.round(
      this.estimateTextWidth(promptText, this.yourTurnFontSize),
    );
    const canAct = this.canLocalPlayerActInPhase(
      phase,
      myRole,
      myAlive,
      isRoundPlayer,
    );

    if (!canAct) {
      this.hideTextSprite("ui_your_turn");
      this.updateRectSprite("ui_your_turn_underline", {
        opacity: 0,
        isInteractive: false,
      });
      return;
    }

    this.updateTextSprite("ui_your_turn", {
      positionX: 250,
      positionY: this.yourTurnY,
      containerWidth: 1000,
      text: promptText,
      fontSize: this.yourTurnFontSize,
      fontColor: this.yellowTextColor,
      opacity: 1,
      isInteractive: false,
    });
    this.updateRectSprite("ui_your_turn_underline", {
      positionX: Math.round(750 - promptWidth / 2),
      positionY: this.yourTurnY + this.yourTurnFontSize + 12,
      width: promptWidth,
      height: this.yourTurnUnderlineHeight,
      fill: this.yellowTextColor,
      opacity: 1,
      isInteractive: false,
    });
  }

  refreshSeatLabels(
    phase: string,
    seatMap: any,
    roleMap: any,
    aliveMap: any,
    myRole: string,
    myAlive: boolean,
    isRoundPlayer: boolean,
  ) {
    const seatPlayerIds = seatMap ? Object.keys(seatMap) : [];

    if (phase === "REVEAL" && seatPlayerIds.length === 0) {
      this.logRevealDebug("refreshSeatLabels preserving existing reveal UI", "seatMap empty");
      return;
    }

    const removedPlayerIds = this.getRemovedSeatPlayerIds(seatPlayerIds);
    const myPlayerId = this.getMyPlayerId();

    for (let i = 0; i < removedPlayerIds.length; i++) {
      this.removeSeatSpritesForPlayerId(removedPlayerIds[i]);
    }

    this.lastSeatPlayerIds = seatPlayerIds.slice();

    for (let i = 0; i < seatPlayerIds.length; i++) {
      const playerId = seatPlayerIds[i];
      const seatData = seatMap[playerId];
      if (
        !spriteManager.getSprite("ui_seat_hit_" + playerId) ||
        !spriteManager.getSprite("ui_seat_frame_" + playerId)
      ) {
        this.ensureSeatSpritesForPlayerId(playerId, seatData);
      }
      const seatHitRect = this.getSeatHitRectOptions(seatData);
      const seatFrameRect = this.getSeatFrameRectOptions(seatData);
      this.updateRectSprite("ui_seat_hit_" + playerId, {
        positionX: seatHitRect.positionX,
        positionY: seatHitRect.positionY,
        width: seatHitRect.width,
        height: seatHitRect.height,
        fill: this.seatClickRectFill,
        opacity: this.seatClickRectOpacity,
        isInteractive: true,
      });
    }

    this.refreshSeatTextSprites(phase, seatMap, roleMap, aliveMap, myRole, myAlive, isRoundPlayer);

    if (phase === "REVEAL") {
      this.logRevealDebug(
        "refreshSeatLabels complete",
        "seatPlayerIds=" +
          seatPlayerIds.join(",") +
          " existingNameSprites=" +
          this.countExistingSeatSprites(seatPlayerIds, "ui_name_").toString() +
          " existingVoteSprites=" +
          this.countExistingSeatSprites(seatPlayerIds, "ui_vote_").toString(),
      );
    }
  }

  canLocalPlayerActInPhase(phase: string, myRole: string, myAlive: boolean, isRoundPlayer: boolean): boolean {
    if (!isRoundPlayer || !myAlive) return false;

    if (phase === "VOTE") return true;
    if (phase === "NIGHT_TRICKSTER") return myRole === "TRICKSTER";
    if (phase === "NIGHT_DETECTIVE") return myRole === "DETECTIVE";
    if (phase === "NIGHT_DOCTOR") return myRole === "DOCTOR";

    return false;
  }

  isValidNightTarget(phase: string, myRole: string, targetPlayerId: number, targetRole: string): boolean {
    const myPlayerId = this.getMyPlayerId();

    if (phase === "NIGHT_TRICKSTER") {
      return myRole === "TRICKSTER" && targetRole !== "TRICKSTER";
    }

    if (phase === "NIGHT_DETECTIVE") {
      return myRole === "DETECTIVE" && targetPlayerId !== myPlayerId;
    }

    if (phase === "NIGHT_DOCTOR") {
      return myRole === "DOCTOR";
    }

    return false;
  }

  getDisplayedCountMap(phase: string, roleMap: any, aliveMap: any) {
    const countMap: any = {};
    const sourceMap = this.getDisplayedTargetMapForPhase(phase);
    let voterIds: number[];

    if (phase === "VOTE") {
      voterIds = this.getAliveIdsByPredicate(roleMap, aliveMap, "ANY");
    } else if (phase === "NIGHT_TRICKSTER") {
      voterIds = this.getAliveIdsByPredicate(roleMap, aliveMap, "TRICKSTER");
    } else if (phase === "NIGHT_DETECTIVE") {
      voterIds = this.getAliveIdsByPredicate(roleMap, aliveMap, "DETECTIVE");
    } else if (phase === "NIGHT_DOCTOR") {
      voterIds = this.getAliveIdsByPredicate(roleMap, aliveMap, "DOCTOR");
    } else {
      return countMap;
    }

    if (!sourceMap) return countMap;

    for (let i = 0; i < voterIds.length; i++) {
      const targetPlayerId = sourceMap[voterIds[i].toString()];
      if (!targetPlayerId || targetPlayerId <= 0) continue;
      // Ignore stale local/synced selections that still point at a player who
      // has been eliminated. They are not legal vote targets this phase.
      if (aliveMap[targetPlayerId.toString()] !== true) continue;

      if (!countMap[targetPlayerId.toString()]) {
        countMap[targetPlayerId.toString()] = 0;
      }

      countMap[targetPlayerId.toString()] += 1;
    }

    return countMap;
  }

  getDisplayedCountDenominator(phase: string, roleMap: any, aliveMap: any): number {
    if (phase === "VOTE") {
      return this.getAliveIdsByPredicate(roleMap, aliveMap, "ANY").length;
    }

    if (phase === "NIGHT_TRICKSTER") {
      return this.getAliveIdsByPredicate(roleMap, aliveMap, "TRICKSTER").length;
    }

    if (phase === "NIGHT_DETECTIVE") {
      return this.getAliveIdsByPredicate(roleMap, aliveMap, "DETECTIVE").length;
    }

    if (phase === "NIGHT_DOCTOR") {
      return this.getAliveIdsByPredicate(roleMap, aliveMap, "DOCTOR").length;
    }

    return 0;
  }

  getAliveIdsByPredicate(roleMap: any, aliveMap: any, roleName: string): number[] {
    const playerIds = roleMap ? Object.keys(roleMap) : [];
    const aliveIds: number[] = [];

    for (let i = 0; i < playerIds.length; i++) {
      if (aliveMap[playerIds[i]] !== true) continue;
      if (roleName !== "ANY" && roleMap[playerIds[i]] !== roleName) continue;
      aliveIds.push(parseInt(playerIds[i], 10));
    }

    return aliveIds;
  }

  getCountForPlayerId(countMap: any, playerId: number): number {
    if (!countMap) return 0;
    if (!countMap[playerId.toString()]) return 0;
    return countMap[playerId.toString()];
  }

  refreshSeatTextSprites(
    phase: string,
    seatMap: any,
    roleMap: any,
    aliveMap: any,
    myRole: string,
    myAlive: boolean,
    isRoundPlayer: boolean,
  ) {
    const seatPlayerIds = seatMap ? Object.keys(seatMap) : [];
    const countMap = this.getDisplayedCountMap(phase, roleMap, aliveMap);
    const countDenominator = this.getDisplayedCountDenominator(phase, roleMap, aliveMap);
    const savedPlayerId = this.getUiVariable("savedPlayerId");
    const canInteractWithNames = this.canLocalPlayerActInPhase(phase, myRole, myAlive, isRoundPlayer);
    const myPlayerId = this.getMyPlayerId();
    const displayedTargetMap = this.getDisplayedTargetMapForPhase(phase);
    const selectedTargetPlayerId =
      displayedTargetMap && myPlayerId ? displayedTargetMap[myPlayerId.toString()] || 0 : 0;

    for (let i = 0; i < seatPlayerIds.length; i++) {
      const playerId = seatPlayerIds[i];
      const seatData = seatMap[playerId];
      const numericPlayerId = parseInt(playerId, 10);
      const nameSpriteWasMissing = !spriteManager.getSprite("ui_name_" + playerId);
      const voteSpriteWasMissing = !spriteManager.getSprite("ui_vote_" + playerId);
      const suspicionSpriteWasMissing = !spriteManager.getSprite("ui_suspicion_" + playerId);
      const isSelectedTarget = canInteractWithNames && selectedTargetPlayerId === numericPlayerId;
      const seatFrameRect = this.getSeatFrameRectOptions(seatData);
      const suspicionIconOptions = this.getSuspicionIconOptions(seatData);
      const seatTextSpriteState = this.getSeatTextSpriteState(
        phase,
        playerId,
        seatData,
        roleMap,
        aliveMap,
        myPlayerId,
        myRole,
        canInteractWithNames,
        countMap,
        countDenominator,
        savedPlayerId,
      );

      if (nameSpriteWasMissing || voteSpriteWasMissing || suspicionSpriteWasMissing) {
        this.ensureSeatSpritesForPlayerId(playerId, seatData);
      }

      this.updateRectSprite("ui_seat_frame_" + playerId, {
        positionX: seatFrameRect.positionX,
        positionY: seatFrameRect.positionY,
        width: seatFrameRect.width,
        height: seatFrameRect.height,
        fill: "rgba(0, 0, 0, 0)",
        opacity: 1,
        strokeColor: isSelectedTarget ? this.selectedSeatFrameStrokeColor : this.seatFrameStrokeColor,
        strokeWeight: isSelectedTarget ? this.selectedSeatFrameStrokeWeight : this.seatFrameStrokeWeight,
        borderRadius: isSelectedTarget ? this.selectedSeatFrameBorderRadius : this.seatFrameBorderRadius,
        isInteractive: false,
      });
      if (nameSpriteWasMissing) {
        // A seat name is white when the seat is created. Its only later color
        // transition is playerAliveMap setting that player to false.
        this.updateTextSprite("ui_name_" + playerId, {
          positionX: seatData.nameX,
          positionY: seatData.nameY,
          containerWidth: seatData.labelWidth,
          text: seatTextSpriteState.displayName,
          fontSize: this.seatNameFontSize,
          fontWeight: "bold",
          fontColor:
            aliveMap && aliveMap[playerId] === false
              ? this.eliminatedNameColor
              : this.lightTextColor,
          opacity: 1,
          isInteractive: true,
        });
      }
      this.updateTextSprite("ui_vote_" + playerId, {
        positionX: seatData.voteX,
        positionY: seatData.voteY,
        containerWidth: seatData.labelWidth,
        text: seatTextSpriteState.voteText,
        fontSize: this.seatVoteFontSize,
        fontWeight: "bold",
        fontColor: seatTextSpriteState.voteColor,
        opacity: seatTextSpriteState.voteText ? 1 : 0,
        isInteractive: true,
      });
      this.updateTextSprite("ui_suspicion_" + playerId, {
        positionX: suspicionIconOptions.positionX,
        positionY: suspicionIconOptions.positionY,
        containerWidth: suspicionIconOptions.containerWidth,
        text: "👀",
        fontSize: this.suspicionIconFontSize,
        topAdjust: this.suspicionIconTopAdjust,
        opacity: 1,
        isInteractive: this.canLocalPlayerSendSuspicion(
          phase,
          myPlayerId,
          numericPlayerId,
          roleMap,
          aliveMap,
        ),
      });
    }
  }

  applyEliminatedNameColors(aliveMap: any) {
    const seatMap = this.getUiVariable("playerSeatMap") || {};
    const seatPlayerIds = Object.keys(seatMap);

    for (let i = 0; i < seatPlayerIds.length; i++) {
      const playerId = seatPlayerIds[i];
      const nameSpriteId = "ui_name_" + playerId;

      if (aliveMap[playerId] !== false) continue;
      if (!spriteManager.getSprite(nameSpriteId)) continue;

      // This is the sole in-round name-color mutation. It remains grey until
      // the seat disappears when the round is reset.
      spriteManager.updateSprite(nameSpriteId, {
        fontColor: this.eliminatedNameColor,
      });

      if (this.lastSpriteStateMap[nameSpriteId]) {
        this.lastSpriteStateMap[nameSpriteId].fontColor = this.eliminatedNameColor;
      }
    }
  }

  refreshLocalRoleBannerFromAliveMap() {
    const phase = this.getUiVariable("gamePhase");
    const roleMap = this.getUiVariable("playerRoleMap");
    const aliveMap = this.getUiVariable("playerAliveMap");
    const deathInfoMap = this.getUiVariable("playerDeathInfoMap");
    const myPlayerId = this.getMyPlayerId();
    const myRole = roleMap && myPlayerId ? roleMap[myPlayerId.toString()] : "";
    const isRoundPlayer = roleMap && myPlayerId ? !!roleMap[myPlayerId.toString()] : false;
    const myAlive = aliveMap && myPlayerId ? aliveMap[myPlayerId.toString()] !== false : isRoundPlayer;

    this.refreshRoleBanner(phase, myRole, myAlive, isRoundPlayer, deathInfoMap);
    this.refreshYourTurnPrompt(phase, myRole, myAlive, isRoundPlayer);
  }

  rebuildEliminatedRoleBanner(text: string) {
    if (spriteManager.getSprite("ui_role_banner")) {
      spriteManager.removeSprite("ui_role_banner");
    }
    delete this.lastSpriteStateMap.ui_role_banner;

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_role_banner",
      positionX: 120,
      positionY: this.roleBannerY,
      containerWidth: 1260,
      align: "center",
      text: text,
      fontSize: this.roleBannerFontSize,
      fontWeight: "bold",
      fontColor: this.lightTextColor,
      opacity: 1,
      isInteractive: false,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: 10,
    });

    this.lastSpriteStateMap.ui_role_banner = {
      positionX: 120,
      positionY: this.roleBannerY,
      containerWidth: 1260,
      text: text,
      fontColor: this.lightTextColor,
      opacity: 1,
      isInteractive: false,
    };
  }

  getSeatTextSpriteState(
    phase: string,
    playerId: string,
    seatData: any,
    roleMap: any,
    aliveMap: any,
    myPlayerId: number,
    myRole: string,
    canInteractWithNames: boolean,
    countMap: any,
    countDenominator: number,
    savedPlayerId: number,
  ) {
    const numericPlayerId = parseInt(playerId, 10);
    const playerRole = roleMap ? roleMap[playerId] : "";
    // Vote labels fail closed while MAPs hydrate: a seat needs an explicit
    // true entry to be a legal vote target. In particular, false never gets
    // rendered as an (x/3) target label.
    const playerAlive = !!aliveMap && aliveMap[playerId] === true;
    const playerVoteCount = this.getCountForPlayerId(countMap, numericPlayerId);
    const displayName = this.truncateTextToFit(
      this.getPlayerName(numericPlayerId),
      seatData.labelWidth - 8,
      this.seatNameFontSize,
    );
    let voteColor = this.yellowTextColor;
    let voteText = "";

    if (phase === "VOTE" && playerAlive) {
      voteText = "(" + playerVoteCount.toString() + "/" + countDenominator.toString() + ")";
    }

    if (
      (phase === "NIGHT_TRICKSTER" || phase === "NIGHT_DETECTIVE" || phase === "NIGHT_DOCTOR") &&
      canInteractWithNames &&
      playerAlive
    ) {
      if (this.isValidNightTarget(phase, myRole, numericPlayerId, playerRole)) {
        if (countDenominator > 0) {
          voteText = "(" + playerVoteCount.toString() + "/" + countDenominator.toString() + ")";
        }

      }
    }

    return {
      displayName: displayName,
      voteColor: voteColor,
      voteText: voteText,
    };
  }

  refreshSeatVoteVisualsForCurrentState(phaseOverride?: string) {
    // Keep target-map refreshes on the same callback-backed state as the
    // alive-map renderer. A raw MAP can still be stale on non-hosts here.
    const phase = phaseOverride || this.getUiVariable("gamePhase");
    const seatMap = this.getUiVariable("playerSeatMap") || {};
    const roleMap = this.getUiVariable("playerRoleMap") || {};
    const aliveMap = this.getUiVariable("playerAliveMap") || {};
    const myPlayerId = this.getMyPlayerId();
    const myRole = roleMap && myPlayerId ? roleMap[myPlayerId.toString()] : "";
    const isRoundPlayer = roleMap && myPlayerId ? !!roleMap[myPlayerId.toString()] : false;
    const myAlive = aliveMap && myPlayerId ? aliveMap[myPlayerId.toString()] !== false : isRoundPlayer;

    this.refreshSeatTextSprites(phase, seatMap, roleMap, aliveMap, myRole, myAlive, isRoundPlayer);
  }

  submitLocalTargetSelection(phase: string, targetPlayerId: number) {
    const myPlayerId = this.getMyPlayerId();

    // Give this player immediate feedback using their player-controlled UI.
    // Input events are forwarded to the host, but should never be on the
    // critical path for rendering this player's selection. The host's synced
    // target map will still reconcile this optimistic display when it arrives.
    this.applyLocalDisplayedTargetSelection(phase, targetPlayerId);
    this.refreshSeatVoteVisualsForCurrentState(phase);

    if (phase === "VOTE") {
      eventManager.emit("playerChoosesDayVote", {
        fromPlayerId: myPlayerId,
        targetPlayerId: targetPlayerId,
      });
    } else {
      eventManager.emit("playerChoosesNightTarget", {
        fromPlayerId: myPlayerId,
        targetPlayerId: targetPlayerId,
        phaseName: phase,
      });
    }
  }

  refreshHostFollowStartButton(phase: string, titleColor: string) {
    let opacity = 0;
    let positionX = 0;
    let positionY = 0;
    let isInteractive = false;
    let text = "";

    if (phase === "WAITING" && playerManager.isHost) {
      const myDetails = playerManager.getPlayerDetails(this.getMyPlayerId());
      if (myDetails) {
        opacity = 1;
        positionX = myDetails.x - 80;
        positionY = myDetails.y + 50;
        isInteractive = true;
        text = "Click here";
      }
    }

    this.updateTextSprite("ui_start_follow", {
      positionX: positionX,
      positionY: positionY,
      text: text,
      fontColor: titleColor,
      opacity: opacity,
      isInteractive: isInteractive,
    });
  }

  ensurePersistentSprites() {
    this.ensureTextSprite("ui_title", {
      positionX: 350,
      positionY: 120,
      containerWidth: 800,
      fontSize: 58,
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_subtitle", {
      positionX: 350,
      positionY: 185,
      containerWidth: 800,
      fontSize: 28,
      fontColor: this.darkTextColor,
    });
    this.ensureTextSprite("ui_setting_tricksters", {
      positionX: 80,
      positionY: 610,
      containerWidth: 360,
      fontSize: 28,
      align: "left",
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_setting_discussion", {
      positionX: 1010,
      positionY: 560,
      containerWidth: 360,
      fontSize: 28,
      align: "right",
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_setting_voting", {
      positionX: 1010,
      positionY: 620,
      containerWidth: 360,
      fontSize: 28,
      align: "right",
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_setting_night", {
      positionX: 930,
      positionY: 680,
      containerWidth: 440,
      fontSize: 28,
      align: "right",
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_setting_dev", {
      positionX: 1010,
      positionY: 740,
      containerWidth: 360,
      fontSize: 28,
      align: "right",
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_start_center", {
      positionX: 450,
      positionY: 930,
      containerWidth: 600,
      fontSize: 38,
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_start_follow", {
      positionX: 0,
      positionY: 0,
      containerWidth: 180,
      fontSize: 26,
      fontColor: this.darkTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_role_banner", {
      positionX: 120,
      positionY: this.roleBannerY,
      containerWidth: 1260,
      fontSize: this.roleBannerFontSize,
      fontColor: this.lightTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_role_detail", {
      positionX: 120,
      positionY: this.roleDetailY,
      containerWidth: 1260,
      fontSize: this.roleDetailFontSize,
      fontColor: this.lightTextColor,
    });
    this.ensureTextSprite("ui_detective_result", {
      positionX: 120,
      positionY: this.detectiveResultY,
      containerWidth: 1260,
      fontSize: this.detectiveResultFontSize,
      fontColor: this.lightTextColor,
    });
    this.ensureTextSprite("ui_center_message", {
      positionX: 240,
      positionY: 675,
      containerWidth: 1020,
      fontSize: this.centerHighlightFontSize,
      fontColor: this.lightTextColor,
      fontWeight: "bold",
    });
    this.ensureTextSprite("ui_your_turn", {
      positionX: 250,
      positionY: this.yourTurnY,
      containerWidth: 1000,
      fontSize: this.yourTurnFontSize,
      fontColor: this.yellowTextColor,
      fontWeight: "bold",
    });
    this.ensureRectSprite("ui_your_turn_underline", {
      positionX: 0,
      positionY: 0,
      width: 1,
      height: this.yourTurnUnderlineHeight,
      fill: this.yellowTextColor,
      opacity: 0,
      topAdjust: 10,
    });
    this.renderHelpButton();

    this.ensureHighlightTextLine("ui_role_banner_highlight", {
      positionY: this.roleBannerY,
      fontSize: this.roleBannerFontSize,
      fontWeight: "bold",
    });
    this.ensureHighlightTextLine("ui_role_detail_highlight", {
      positionY: this.roleDetailY,
      fontSize: this.roleDetailFontSize,
      fontWeight: "normal",
    });
    this.ensureHighlightTextLine("ui_detective_result_highlight", {
      positionY: this.detectiveResultY,
      fontSize: this.detectiveResultFontSize,
      fontWeight: "normal",
    });
    this.ensureHighlightTextLine("ui_center_highlight", {
      positionY: 675,
      fontSize: this.centerHighlightFontSize,
      fontWeight: "bold",
    });
  }

  renderHelpButton() {
    if (spriteManager.getSprite("ui_help_button")) return;

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_help_button",
      positionX: 1330,
      positionY: 48,
      containerWidth: 120,
      align: "center",
      text: "?",
      fontSize: 78,
      fontColor: this.lightTextColor,
      fontWeight: "bold",
      isInteractive: true,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: this.helpPopupTopAdjust + 4,
    });
  }

  refreshRoleRevealPopup(phase: string, myRole: string, isRoundPlayer: boolean) {
    if (!phase) return;

    if (phase !== "REVEAL") {
      this.closeRoleRevealPopup();
      return;
    }

    const resolvedRole = myRole || this.lastReceivedRoleRevealRole;
    const resolvedIsRoundPlayer = isRoundPlayer || !!resolvedRole;

    // During MAP hydration, unrelated variable updates can refresh this UI
    // while the local role map is temporarily empty. That must not clear an
    // already-open reveal popup or discard a role received in a valid callback.
    if (!resolvedIsRoundPlayer || !resolvedRole) return;

    if (this.hasAcknowledgedRoleReveal()) {
      this.closeRoleRevealPopup();
      return;
    }

    if (!this.roleRevealPopupOpen) {
      this.showRoleRevealPopup(resolvedRole);
    }
  }

  showRoleRevealPopup(roleName: string) {
    const popupWidth = 1500 - this.roleRevealPopupMargin * 2;
    const popupHeight = 1500 - this.roleRevealPopupMargin * 2;
    const popupCenterX = 750;
    const popupTop = this.roleRevealPopupMargin;
    const popupContentWidth = popupWidth - 100;
    const roleCopy = this.getRoleRevealCopy(roleName);
    const acknowledgementText = "I understand my role";
    const acknowledgementWidth = this.estimateTextWidth(
      acknowledgementText,
      this.roleRevealAcknowledgeFontSize,
    );

    this.closeHelpDrawer();
    this.removeRoleRevealPopupSprites();
    this.roleRevealPopupOpen = true;

    spriteManager.addSprite("baseRect", {
      uniqueId: "ui_role_reveal_panel",
      positionX: this.roleRevealPopupMargin,
      positionY: popupTop,
      width: popupWidth,
      height: popupHeight,
      // Keep the panel fully opaque without passing the renderer's separate
      // opacity option. The known-working Last Card popup uses this path;
      // an explicit rect opacity can otherwise composite over same-layer text.
      fill: "rgba(18, 22, 14, 1)",
      strokeColor: this.lightTextColor,
      strokeWeight: 5,
      borderRadius: 28,
      isInteractive: false,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: 0,
      checkCollisions: false,
      isImpassable: false,
    });
    this.roleRevealPopupSpriteIds.push("ui_role_reveal_panel");

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_role_reveal_heading",
      positionX: this.roleRevealPopupMargin + 50,
      positionY: popupTop + 68,
      containerWidth: popupContentWidth,
      align: "center",
      text: roleCopy.heading,
      fontSize: this.roleRevealHeadingFontSize,
      fontWeight: "bold",
      fontColor: this.getRoleHighlightColor(roleName),
      opacity: 1,
      isInteractive: false,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      // Top-layer ordering is based on the sprite's adjusted base, not just
      // creation order. This matches Last Card's working popup text and
      // places the heading past the large panel's lower edge.
      topAdjust: 1000,
      strokeColor: "#000000",
      strokeWeight: 1,
    });
    this.roleRevealPopupSpriteIds.push("ui_role_reveal_heading");

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_role_reveal_body",
      positionX: this.roleRevealPopupMargin + 50,
      positionY: popupTop + 182,
      containerWidth: popupContentWidth,
      align: "left",
      text: this.wrapRoleRevealCopy(
        roleCopy.body,
        popupContentWidth,
        this.roleRevealBodyFontSize,
      ),
      fontSize: this.roleRevealBodyFontSize,
      fontWeight: "normal",
      fontColor: this.lightTextColor,
      opacity: 1,
      isInteractive: false,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: 1000,
      strokeColor: "#000000",
      strokeWeight: 1,
    });
    this.roleRevealPopupSpriteIds.push("ui_role_reveal_body");

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_role_reveal_acknowledge",
      positionX: this.roleRevealPopupMargin + 50,
      positionY: popupTop + popupHeight - 112,
      containerWidth: popupContentWidth,
      align: "center",
      text: acknowledgementText,
      fontSize: this.roleRevealAcknowledgeFontSize,
      fontWeight: "bold",
      fontColor: this.yellowTextColor,
      opacity: 1,
      isInteractive: true,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: 1000,
      strokeColor: "#000000",
      strokeWeight: 1,
    });
    this.roleRevealPopupSpriteIds.push("ui_role_reveal_acknowledge");

    spriteManager.addSprite("baseRect", {
      uniqueId: "ui_role_reveal_acknowledge_underline",
      positionX: Math.round(popupCenterX - acknowledgementWidth / 2),
      positionY: popupTop + popupHeight - 66,
      width: Math.round(acknowledgementWidth),
      height: 4,
      fill: this.yellowTextColor,
      isInteractive: false,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: 1000,
      checkCollisions: false,
      isImpassable: false,
    });
    this.roleRevealPopupSpriteIds.push("ui_role_reveal_acknowledge_underline");
  }

  acknowledgeRoleReveal() {
    if (!this.roleRevealPopupOpen) return;
    if (this.roleRevealAcknowledgementSubmitted) return;
    if (stateManager.getVariable("gamePhase") !== "REVEAL") return;

    this.roleRevealAcknowledgementSubmitted = true;
    this.closeRoleRevealPopup();
    eventManager.emit("playerAcknowledgesRole", {
      fromPlayerId: this.getMyPlayerId(),
    });
    this.refreshUi();
  }

  hasAcknowledgedRoleReveal(): boolean {
    if (this.roleRevealAcknowledgementSubmitted) return true;

    const acknowledgementMap = this.getUiVariable(
      "roleRevealAcknowledgementMap",
    ) || {};
    const myPlayerId = this.getMyPlayerId();

    return acknowledgementMap[myPlayerId.toString()] === true;
  }

  // The engine cannot read workspace files at runtime, so keep this runtime copy in sync with role-copy.txt.
  getRoleRevealCopy(roleName: string) {
    if (roleName === "TRICKSTER") {
      return {
        heading: "You are the TRICKSTER role",
        body:
          "Your goal is to work with the other TRICKSTERS to eliminate TOWNSFOLK from the game!\n\nDuring the nighttime you and your other TRICKSTERS may vote to eliminate a TOWNSFOLK from the game.\n\nBe careful, the DETECTIVE may also use their ability during the night to find out if you're a TRICKSTER and may report you to the town. The TOWNSFOLK may also choose to exile you during the day if you're being suspicious.",
      };
    }

    if (roleName === "DOCTOR") {
      return {
        heading: "You are the DOCTOR role",
        body:
          "Your goal is to eliminate TRICKSTERS from the game by voting to exile them during the day. You and the other TOWNSFOLK win when all TRICKSTERS are gone!\nYou have a special ability to save TOWNSFOLK who you think may be targeted by a TRICKSTER. You'll have an opportunity to use this ability during nighttime.\n\nDuring the nighttime, TRICKSTERS and other players with a special role will have time to use their abilities on any player.",
      };
    }

    if (roleName === "DETECTIVE") {
      return {
        heading: "You are the DETECTIVE role",
        body:
          "Your goal is to eliminate TRICKSTERS from the game by voting to exile them during the day. You and the other TOWNSFOLK win when all TRICKSTERS are gone!\nYou have a special ability to investigate players who you think may be a TRICKSTER. You'll have an opportunity to use this ability during nighttime.\n\nDuring the nighttime, TRICKSTERS and other players with a special role will have time to use their abilities on any player.",
      };
    }

    if (roleName === "ASSASSIN") {
      return {
        heading: "You are the ASSASSIN role",
        body:
          "You win when the player who is your TARGET is eliminated. No one else can see who your TARGET is. \nYour win does not have to coinside with a TRICKSTER or TOWNSFOLK win.",
      };
    }

    return {
      heading: "You are the TOWNSFOLK role",
      body:
        "Your goal is to eliminate TRICKSTERS from the game by voting to exile them during the day. You and the other TOWNSFOLK win when all TRICKSTERS are gone!\nYou have no special abilities, sorry.\n\nDuring the nighttime, TRICKSTERS and other players with a special role will have time to use their abilities on any player.",
    };
  }

  getHelpPopupCopy(phase: string, roleName: string) {
    if (phase !== "WAITING" && roleName) {
      return this.getRoleRevealCopy(roleName);
    }

    return {
      heading: "The game has not started yet or you are a spectator",
      body:
        "\nTrickster Town is a multiplayer game where you are assigned a role and you have to work with or against other players to win!\n\nTricksters are the imposter role and have time during the night to eliminate players, they win when enough normal players (Townsfolk) are eliminated\n\nTownsfolk (including adjacent roles such as the Detective and the Doctor) win by voting together to exile suspected Tricksters during the daytime.\n\nSpecial roles can also act during the night to use their abilities. For example, the Detective may investigate to reveal if a player is a Trickster.",
    };
  }

  wrapRoleRevealCopy(text: string, maxWidth: number, fontSize: number): string {
    const paragraphs = text.split("\n");
    const wrappedLines: string[] = [];
    // estimateTextWidth intentionally reserves extra room for general UI.
    // Role-copy lines can use substantially more of their known text container
    // before we add a manual newline.
    const roleCopyWrapWidth = Math.round(maxWidth * 1.35);

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      if (!paragraph) {
        wrappedLines.push("");
        continue;
      }

      const words = paragraph.split(" ");
      let currentLine = "";

      for (let j = 0; j < words.length; j++) {
        const nextLine = currentLine ? currentLine + " " + words[j] : words[j];

        if (currentLine && this.estimateTextWidth(nextLine, fontSize) > roleCopyWrapWidth) {
          wrappedLines.push(currentLine);
          currentLine = words[j];
        } else {
          currentLine = nextLine;
        }
      }

      if (currentLine) {
        wrappedLines.push(currentLine);
      }
    }

    return wrappedLines.join("\n");
  }

  closeRoleRevealPopup() {
    this.roleRevealPopupOpen = false;
    this.removeRoleRevealPopupSprites();
  }

  removeRoleRevealPopupSprites() {
    const spriteIds = this.roleRevealPopupSpriteIds || [];
    const knownSpriteIds = [
      "ui_role_reveal_panel",
      "ui_role_reveal_heading",
      "ui_role_reveal_body",
      "ui_role_reveal_acknowledge",
      "ui_role_reveal_acknowledge_underline",
    ];
    let resolvedSpriteIds = spriteIds.slice();

    for (let i = 0; i < knownSpriteIds.length; i++) {
      if (resolvedSpriteIds.indexOf(knownSpriteIds[i]) === -1) {
        resolvedSpriteIds.push(knownSpriteIds[i]);
      }
    }

    for (let i = 0; i < resolvedSpriteIds.length; i++) {
      if (spriteManager.getSprite(resolvedSpriteIds[i])) {
        spriteManager.removeSprite(resolvedSpriteIds[i]);
      }
      delete this.lastSpriteStateMap[resolvedSpriteIds[i]];
    }

    this.roleRevealPopupSpriteIds = [];
  }

  toggleHelpDrawer() {
    if (this.helpDrawerOpen) {
      this.closeHelpDrawer();
      return;
    }

    this.showHelpDrawer();
  }

  showHelpDrawer() {
    const popupWidth = 1500 - this.helpPopupMargin * 2;
    const popupHeight = 1500 - this.helpPopupMargin * 2;
    const popupRight = this.helpPopupMargin + popupWidth;
    const popupTop = this.helpPopupMargin;
    const popupContentWidth = popupWidth - 100;
    const closeButtonSize = 52;
    const closeButtonInset = 32;
    const closeButtonX = popupRight - closeButtonInset - closeButtonSize;
    const closeButtonY = popupTop + closeButtonInset;
    // The synced countdown occupies the top layer at 1000. Keep every part of
    // this local popup above it, including the opaque panel itself.
    const popupLayerAdjust = 2000;
    const popupContentLayerAdjust = popupLayerAdjust + 1000;
    const roleMap = this.getUiVariable("playerRoleMap");
    const myPlayerId = this.getMyPlayerId();
    const myRole = roleMap && myPlayerId ? roleMap[myPlayerId.toString()] : "";
    const roleCopy = this.getHelpPopupCopy(this.getUiVariable("gamePhase"), myRole);

    this.removeHelpDrawerSprites();
    this.helpDrawerOpen = true;

    spriteManager.addSprite("baseRect", {
      uniqueId: "ui_help_panel",
      positionX: this.helpPopupMargin,
      positionY: this.helpPopupMargin,
      width: popupWidth,
      height: popupHeight,
      // Match the role-reveal popup: use an opaque RGBA fill instead of the
      // separate opacity option so same-layer text can stay correctly ordered.
      fill: "rgba(18, 22, 14, 1)",
      strokeColor: this.lightTextColor,
      strokeWeight: 5,
      borderRadius: 28,
      isInteractive: false,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: popupLayerAdjust,
      checkCollisions: false,
      isImpassable: false,
    });
    this.helpOverlaySpriteIds.push("ui_help_panel");

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_help_heading",
      positionX: this.helpPopupMargin + 50,
      positionY: popupTop + 68,
      containerWidth: popupContentWidth,
      align: "center",
      text: this.wrapRoleRevealCopy(
        roleCopy.heading,
        popupContentWidth,
        this.roleRevealHeadingFontSize,
      ),
      fontSize: this.roleRevealHeadingFontSize,
      fontWeight: "bold",
      fontColor: myRole ? this.getRoleHighlightColor(myRole) : this.lightTextColor,
      isInteractive: false,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: popupContentLayerAdjust,
      strokeColor: "#000000",
      strokeWeight: 1,
    });
    this.helpOverlaySpriteIds.push("ui_help_heading");

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_help_body",
      positionX: this.helpPopupMargin + 50,
      positionY: popupTop + 182,
      containerWidth: popupContentWidth,
      align: "left",
      text: this.wrapRoleRevealCopy(
        roleCopy.body,
        popupContentWidth,
        this.roleRevealBodyFontSize,
      ),
      fontSize: this.roleRevealBodyFontSize,
      fontWeight: "normal",
      fontColor: this.lightTextColor,
      isInteractive: false,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: popupContentLayerAdjust,
      strokeColor: "#000000",
      strokeWeight: 1,
    });
    this.helpOverlaySpriteIds.push("ui_help_body");

    spriteManager.addSprite("baseRect", {
      uniqueId: "ui_help_close_bg",
      positionX: closeButtonX,
      positionY: closeButtonY,
      width: closeButtonSize,
      height: closeButtonSize,
      fill: "#ff3b30",
      borderRadius: 14,
      isInteractive: true,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: popupContentLayerAdjust,
    });
    this.helpOverlaySpriteIds.push("ui_help_close_bg");

    spriteManager.addSprite("baseText", {
      uniqueId: "ui_help_close",
      positionX: closeButtonX,
      positionY: closeButtonY - 2,
      containerWidth: closeButtonSize,
      align: "center",
      text: "X",
      fontSize: 40,
      fontWeight: "bold",
      fontColor: "#000000",
      isInteractive: true,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: "top",
      topAdjust: popupContentLayerAdjust + 5,
    });
    this.helpOverlaySpriteIds.push("ui_help_close");
  }

  closeHelpDrawer() {
    this.helpDrawerOpen = false;
    this.removeHelpDrawerSprites();
  }

  refreshHelpButton(phase?: string) {
    const resolvedPhase = phase || this.getUiVariable("gamePhase");
    const shouldShowHelpButton = resolvedPhase !== "REVEAL";

    if (!shouldShowHelpButton && this.helpDrawerOpen) {
      this.closeHelpDrawer();
    }

    if (!shouldShowHelpButton) {
      if (spriteManager.getSprite("ui_help_button")) {
        spriteManager.removeSprite("ui_help_button");
      }
      delete this.lastSpriteStateMap.ui_help_button;
      return;
    }

    this.renderHelpButton();
    this.updateTextSprite("ui_help_button", {
      text: "?",
      isInteractive: true,
    });
  }

  removeHelpDrawerSprites() {
    const spriteIds = this.helpOverlaySpriteIds || [];
    const knownSpriteIds = [
      "ui_help_panel",
      "ui_help_heading",
      "ui_help_body",
      "ui_help_close_bg",
      "ui_help_close",
    ];
    let resolvedSpriteIds = spriteIds.slice();

    for (let i = 0; i < knownSpriteIds.length; i++) {
      if (resolvedSpriteIds.indexOf(knownSpriteIds[i]) === -1) {
        resolvedSpriteIds.push(knownSpriteIds[i]);
      }
    }

    for (let i = 0; i < resolvedSpriteIds.length; i++) {
      if (spriteManager.getSprite(resolvedSpriteIds[i])) {
        spriteManager.removeSprite(resolvedSpriteIds[i]);
      }
      delete this.lastSpriteStateMap[resolvedSpriteIds[i]];
    }

    this.helpOverlaySpriteIds = [];
  }

  ensureHighlightTextLine(baseId: string, defaultOptions: any) {
    this.ensureTextSprite(baseId + "_prefix", {
      positionX: 0,
      positionY: defaultOptions.positionY || 0,
      containerWidth: 100,
      align: "left",
      fontSize: defaultOptions.fontSize,
      fontColor: this.lightTextColor,
      fontWeight: defaultOptions.fontWeight,
    });
    this.ensureTextSprite(baseId + "_keyword", {
      positionX: 0,
      positionY: defaultOptions.positionY || 0,
      containerWidth: 100,
      align: "left",
      fontSize: defaultOptions.fontSize,
      fontColor: this.lightTextColor,
      fontWeight: defaultOptions.fontWeight,
    });
    this.ensureTextSprite(baseId + "_suffix", {
      positionX: 0,
      positionY: defaultOptions.positionY || 0,
      containerWidth: 100,
      align: "left",
      fontSize: defaultOptions.fontSize,
      fontColor: this.lightTextColor,
      fontWeight: defaultOptions.fontWeight,
    });
  }

  renderCenteredHighlightLine(
    baseId: string,
    centerX: number,
    positionY: number,
    fontSize: number,
    prefix: string,
    keyword: string,
    suffix: string,
    normalColor: string,
    keywordColor: string,
    trailingOffsetX?: number,
  ) {
    const safePrefix = prefix || "";
    const safeKeyword = keyword || "";
    const safeSuffix = suffix || "";
    const requestedTrailingOffsetX = trailingOffsetX || 0;
    const prefixWidth = this.estimateTextWidth(safePrefix, fontSize);
    const keywordWidth = this.estimateTextWidth(safeKeyword, fontSize);
    const suffixWidth = this.estimateTextWidth(safeSuffix, fontSize);
    const totalWidth = prefixWidth + keywordWidth + suffixWidth;
    let safeTrailingOffsetX = requestedTrailingOffsetX;
    let autoBalanceShiftX = 0;

    if (totalWidth <= 0) {
      this.hideHighlightedTextLine(baseId);
      return;
    }

    if (safePrefix !== "" && safeSuffix !== "" && prefixWidth > suffixWidth) {
      // Pull the highlighted word left when the lead-in text is visually heavier than the trailing text.
      autoBalanceShiftX = -Math.round((prefixWidth - suffixWidth) * 0.4);
      safeTrailingOffsetX = Math.min(requestedTrailingOffsetX, autoBalanceShiftX);
    } else if (requestedTrailingOffsetX < 0 && prefixWidth > 0) {
      safeTrailingOffsetX = Math.max(requestedTrailingOffsetX, -Math.round(prefixWidth * 0.2));
    }

    const startX = centerX - totalWidth / 2;

    this.updateTextSprite(baseId + "_prefix", {
      positionX: Math.round(startX),
      positionY: positionY,
      containerWidth: Math.max(1, Math.round(prefixWidth + 8)),
      text: safePrefix,
      fontColor: normalColor,
      opacity: safePrefix ? 1 : 0,
      isInteractive: false,
    });
    this.updateTextSprite(baseId + "_keyword", {
      positionX: Math.round(startX + prefixWidth + safeTrailingOffsetX),
      positionY: positionY,
      containerWidth: Math.max(1, Math.round(keywordWidth + 8)),
      text: safeKeyword,
      fontColor: keywordColor,
      opacity: safeKeyword ? 1 : 0,
      isInteractive: false,
    });
    this.updateTextSprite(baseId + "_suffix", {
      positionX: Math.round(startX + prefixWidth + keywordWidth + safeTrailingOffsetX),
      positionY: positionY,
      containerWidth: Math.max(1, Math.round(suffixWidth + 8)),
      text: safeSuffix,
      fontColor: normalColor,
      opacity: safeSuffix ? 1 : 0,
      isInteractive: false,
    });
  }

  hideHighlightedTextLine(baseId: string) {
    this.hideTextSprite(baseId + "_prefix");
    this.hideTextSprite(baseId + "_keyword");
    this.hideTextSprite(baseId + "_suffix");
  }

  ensureSeatSpritesForPlayerId(playerId: string, seatData: any) {
    const seatHitRect = this.getSeatHitRectOptions(seatData);

    this.ensureRectSprite("ui_seat_hit_" + playerId, {
      positionX: seatHitRect.positionX,
      positionY: seatHitRect.positionY,
      width: seatHitRect.width,
      height: seatHitRect.height,
      fill: this.seatClickRectFill,
      opacity: this.seatClickRectOpacity,
      topAdjust: this.seatClickRectTopAdjust,
    });
    const seatFrameRect = this.getSeatFrameRectOptions(seatData);
    this.ensureRectSprite("ui_seat_frame_" + playerId, {
      positionX: seatFrameRect.positionX,
      positionY: seatFrameRect.positionY,
      width: seatFrameRect.width,
      height: seatFrameRect.height,
      fill: "rgba(0, 0, 0, 0)",
      opacity: 1,
      strokeColor: this.seatFrameStrokeColor,
      strokeWeight: this.seatFrameStrokeWeight,
      borderRadius: this.seatFrameBorderRadius,
      topAdjust: this.seatClickRectTopAdjust - 1,
    });
    const suspicionIconOptions = this.getSuspicionIconOptions(seatData);
    this.ensureTextSprite("ui_suspicion_" + playerId, {
      positionX: suspicionIconOptions.positionX,
      positionY: suspicionIconOptions.positionY,
      containerWidth: suspicionIconOptions.containerWidth,
      fontSize: this.suspicionIconFontSize,
      fontWeight: "bold",
      topAdjust: this.suspicionIconTopAdjust,
    });
  }

  removeSeatSpritesForPlayerId(playerId: string) {
    if (spriteManager.getSprite("ui_seat_hit_" + playerId)) {
      spriteManager.removeSprite("ui_seat_hit_" + playerId);
    }
    if (spriteManager.getSprite("ui_seat_frame_" + playerId)) {
      spriteManager.removeSprite("ui_seat_frame_" + playerId);
    }
    if (spriteManager.getSprite("ui_name_" + playerId)) {
      spriteManager.removeSprite("ui_name_" + playerId);
    }
    if (spriteManager.getSprite("ui_vote_" + playerId)) {
      spriteManager.removeSprite("ui_vote_" + playerId);
    }
    if (spriteManager.getSprite("ui_suspicion_" + playerId)) {
      spriteManager.removeSprite("ui_suspicion_" + playerId);
    }

    delete this.lastSpriteStateMap["ui_seat_hit_" + playerId];
    delete this.lastSpriteStateMap["ui_seat_frame_" + playerId];
    delete this.lastSpriteStateMap["ui_name_" + playerId];
    delete this.lastSpriteStateMap["ui_vote_" + playerId];
    delete this.lastSpriteStateMap["ui_suspicion_" + playerId];
  }

  getSuspicionIconOptions(seatData: any) {
    const boothSize = seatData && seatData.boothSize ? seatData.boothSize : 140;
    const halfBoothSize = Math.floor(boothSize / 2);

    return {
      positionX: seatData.nameX + seatData.labelWidth + this.suspicionIconOffsetX,
      positionY: seatData.playerY - halfBoothSize - this.seatClickRectPadding,
      containerWidth: 56,
    };
  }

  getSeatHitRectOptions(seatData: any) {
    const boothSize = seatData && seatData.boothSize ? seatData.boothSize : 140;
    const halfBoothSize = Math.floor(boothSize / 2);
    const boothLeft = seatData.playerX - halfBoothSize - this.seatClickRectPadding;
    const boothTop = seatData.playerY - halfBoothSize - this.seatClickRectPadding;
    const boothRight = seatData.playerX + halfBoothSize + this.seatClickRectPadding;
    const boothBottom = seatData.playerY + halfBoothSize + this.seatClickRectPadding;
    const labelLeft = seatData.nameX - this.seatClickRectPadding;
    const labelRight = seatData.nameX + seatData.labelWidth + this.seatClickRectPadding;
    const labelBottom =
      seatData.voteY + this.seatVoteFontSize + this.seatClickRectPadding + 8;
    const rectLeft = Math.min(boothLeft, labelLeft);
    const rectTop = boothTop;
    const rectRight = Math.max(boothRight, labelRight);
    const rectBottom = Math.max(boothBottom, labelBottom);

    return {
      positionX: rectLeft,
      positionY: rectTop,
      width: rectRight - rectLeft,
      height: rectBottom - rectTop,
    };
  }

  getSeatFrameRectOptions(seatData: any) {
    const boothSize = seatData && seatData.boothSize ? seatData.boothSize : 140;
    const halfBoothSize = Math.floor(boothSize / 2);

    return {
      positionX: seatData.playerX - halfBoothSize - this.seatClickRectPadding,
      positionY: seatData.playerY - halfBoothSize - this.seatClickRectPadding,
      width: boothSize + this.seatClickRectPadding * 2,
      height: boothSize + this.seatClickRectPadding * 2,
    };
  }

  getRemovedSeatPlayerIds(currentSeatPlayerIds: string[]): string[] {
    const removedPlayerIds: string[] = [];

    for (let i = 0; i < this.lastSeatPlayerIds.length; i++) {
      if (currentSeatPlayerIds.indexOf(this.lastSeatPlayerIds[i]) === -1) {
        removedPlayerIds.push(this.lastSeatPlayerIds[i]);
      }
    }

    return removedPlayerIds;
  }

  onTrackedVariableChanged(variableName: string, args: any) {
    if (args && this.hasOwnKey(args, "newValue")) {
      this.syncedUiVariableMap[variableName] = args.newValue;

      if (variableName === "gamePhase") {
        this.clearLocalDisplayedTargets();
        const targetVariableName = this.getTargetVariableNameForPhase(args.newValue);

        if (targetVariableName) {
          this.localDisplayedTargetMapByPhase[args.newValue] = {};
        }

        if (args.newValue === "WAITING") {
          this.clearCachedRoundUiStateForWaiting();
        }
      }
    }

    this.refreshUi();
  }

  mergePlayerAliveMapUpdate(newAliveMap: any) {
    const resolvedAliveMap = this.cloneState(
      this.syncedUiVariableMap.playerAliveMap,
    );
    const phase = this.getUiVariable("gamePhase");
    const roleMap = this.getUiVariable("playerRoleMap") || {};
    const rolePlayerIds = Object.keys(roleMap);
    const newPlayerIds = Object.keys(newAliveMap);
    const isRoundInProgress = phase !== "WAITING";

    // Once a round starts, the role map is the locked roster. Start any
    // missing roster entry as alive, then only accept false transitions from
    // playerAliveMap. This protects local UI from partial or stale MAP data
    // that could otherwise make an eliminated player appear alive again.
    if (isRoundInProgress && rolePlayerIds.length > 0) {
      for (let i = 0; i < rolePlayerIds.length; i++) {
        if (!this.hasOwnKey(resolvedAliveMap, rolePlayerIds[i])) {
          resolvedAliveMap[rolePlayerIds[i]] = true;
        }
      }
    }

    for (let i = 0; i < newPlayerIds.length; i++) {
      const playerId = newPlayerIds[i];
      const reportedAlive = newAliveMap[playerId];

      if (reportedAlive !== true && reportedAlive !== false) continue;

      if (
        isRoundInProgress &&
        rolePlayerIds.length > 0 &&
        !this.hasOwnKey(roleMap, playerId)
      ) {
        // Late joiners are spectators and must not become round players from
        // a partial alive-map payload.
        continue;
      }

      if (reportedAlive === false) {
        resolvedAliveMap[playerId] = false;
        continue;
      }

      // A player may be marked alive while the initial roster hydrates, but
      // an eliminated player never returns to the round.
      if (resolvedAliveMap[playerId] !== false) {
        resolvedAliveMap[playerId] = true;
      }
    }

    return resolvedAliveMap;
  }

  onTargetMapVariableChanged(variableName: string, args: any) {
    if (args && this.hasOwnKey(args, "newValue")) {
      this.syncedUiVariableMap[variableName] = args.newValue;
    }

    const targetPhase = this.getTargetDisplayPhaseForVariable(
      variableName,
      this.getUiVariable("gamePhase"),
    );

    if (!targetPhase) {
      this.refreshSeatVoteVisualsForCurrentState();
      return;
    }

    this.applySyncedTargetMapToDisplayedPhase(targetPhase, args ? args.newValue : null);
    this.refreshSeatVoteVisualsForCurrentState(targetPhase);
  }

  clearCachedRoundUiStateForWaiting() {
    // A reset must not depend on a later empty-MAP hydration callback to
    // remove local seat UI. Tear down every remembered seat immediately,
    // including its selected-frame highlight and invisible hit rect.
    this.removeAllSeatSpritesForRoundReset();
    this.syncedUiVariableMap.playerRoleMap = {};
    this.syncedUiVariableMap.playerSeatMap = {};
    this.syncedUiVariableMap.playerAliveMap = {};
    this.syncedUiVariableMap.playerDeathInfoMap = {};
    this.syncedUiVariableMap.detectivePlayerRoleRevealedMap = {};
    this.syncedUiVariableMap.nightTargetMap = {};
    this.syncedUiVariableMap.dayVoteTargetMap = {};
    this.syncedUiVariableMap.roleRevealAcknowledgementMap = {};
    this.syncedUiVariableMap.savedPlayerId = 0;
    this.syncedUiVariableMap.lastNightEliminatedPlayerId = 0;
    this.syncedUiVariableMap.lastInvestigatedPlayerId = 0;
    this.syncedUiVariableMap.lastExiledPlayerId = 0;
    this.syncedUiVariableMap.winningTeam = "";
    this.syncedUiVariableMap.endReasonText = "";
    this.syncedUiVariableMap.roundNumber = 0;
    this.clearLocalDisplayedTargets();
  }

  removeAllSeatSpritesForRoundReset() {
    const playerIdMap: any = {};
    const cachedSeatMap = this.syncedUiVariableMap.playerSeatMap || {};
    const liveSeatMap = stateManager.getVariable("playerSeatMap") || {};
    const trackedSpriteIds = Object.keys(this.lastSpriteStateMap);
    const seatSpritePrefixes = ["ui_seat_hit_", "ui_seat_frame_", "ui_name_", "ui_vote_", "ui_suspicion_"];

    for (let i = 0; i < this.lastSeatPlayerIds.length; i++) {
      playerIdMap[this.lastSeatPlayerIds[i]] = true;
    }

    const cachedSeatPlayerIds = Object.keys(cachedSeatMap);
    for (let i = 0; i < cachedSeatPlayerIds.length; i++) {
      playerIdMap[cachedSeatPlayerIds[i]] = true;
    }

    const liveSeatPlayerIds = Object.keys(liveSeatMap);
    for (let i = 0; i < liveSeatPlayerIds.length; i++) {
      playerIdMap[liveSeatPlayerIds[i]] = true;
    }

    for (let i = 0; i < trackedSpriteIds.length; i++) {
      for (let j = 0; j < seatSpritePrefixes.length; j++) {
        const prefix = seatSpritePrefixes[j];
        if (trackedSpriteIds[i].indexOf(prefix) !== 0) continue;
        playerIdMap[trackedSpriteIds[i].substring(prefix.length)] = true;
        break;
      }
    }

    const playerIds = Object.keys(playerIdMap);
    for (let i = 0; i < playerIds.length; i++) {
      this.removeSeatSpritesForPlayerId(playerIds[i]);
    }

    this.lastSeatPlayerIds = [];
  }

  getUiVariable(variableName: string) {
    const liveValue = stateManager.getVariable(variableName);
    if (this.syncedUiVariableMap && this.hasOwnKey(this.syncedUiVariableMap, variableName)) {
      if (
        this.isHydratableUiMapVariable(variableName) &&
        this.shouldPromoteHydratedMapValue(this.syncedUiVariableMap[variableName], liveValue)
      ) {
        // Keep using the callback newValue until the live MAP has fully hydrated locally.
        this.syncedUiVariableMap[variableName] = liveValue;
        return liveValue;
      }

      return this.syncedUiVariableMap[variableName];
    }

    return liveValue;
  }

  refreshRoleRevealPopupFromReceivedRoleMap(receivedRoleMap: any) {
    const phase = this.getUiVariable("gamePhase");
    const myPlayerId = this.getMyPlayerId();
    const myRole =
      receivedRoleMap && myPlayerId
        ? receivedRoleMap[myPlayerId.toString()]
        : "";
    console.log("my role is: ", myRole);
    if (!myRole) return;

    this.lastReceivedRoleRevealRole = myRole;

    // The received map is complete even when stateManager's local MAP has not
    // hydrated yet, so this is the reliable client-side reveal entry point.
    this.refreshRoleRevealPopup(phase, myRole, true);
  }

  promoteHydratedUiMaps() {
    const mapVariableNames = [
      "playerSeatMap",
      "playerRoleMap",
      "playerAliveMap",
      "playerDeathInfoMap",
      "detectivePlayerRoleRevealedMap",
      "nightTargetMap",
      "dayVoteTargetMap",
      "roleRevealAcknowledgementMap",
    ];

    for (let i = 0; i < mapVariableNames.length; i++) {
      const variableName = mapVariableNames[i];
      const liveValue = stateManager.getVariable(variableName);

      if (!this.syncedUiVariableMap || !this.hasOwnKey(this.syncedUiVariableMap, variableName)) {
        continue;
      }

      if (this.shouldPromoteHydratedMapValue(this.syncedUiVariableMap[variableName], liveValue)) {
        this.syncedUiVariableMap[variableName] = liveValue;
      }
    }
  }

  isHydratableUiMapVariable(variableName: string): boolean {
    return (
      variableName === "playerSeatMap" ||
      variableName === "playerRoleMap" ||
      variableName === "playerAliveMap" ||
      variableName === "playerDeathInfoMap" ||
      variableName === "detectivePlayerRoleRevealedMap" ||
      variableName === "nightTargetMap" ||
      variableName === "dayVoteTargetMap" ||
      variableName === "roleRevealAcknowledgementMap"
    );
  }

  shouldPromoteHydratedMapValue(cachedValue: any, liveValue: any): boolean {
    if (!cachedValue || !liveValue) return false;
    return this.getTopLevelKeyCount(liveValue) > this.getTopLevelKeyCount(cachedValue);
  }

  getTopLevelKeyCount(mapValue: any): number {
    if (!mapValue) return 0;
    return Object.keys(mapValue).length;
  }

  hasOwnKey(target: any, key: string): boolean {
    if (!target) return false;
    return Object.keys(target).indexOf(key) !== -1;
  }

  shouldLogRevealDebug(phase?: string): boolean {
    const resolvedPhase = phase || this.getUiVariable("gamePhase");
    return resolvedPhase === "REVEAL" && !playerManager.isHost;
  }

  isRevealTrackedTextSprite(uniqueId: string): boolean {
    return (
      uniqueId === "ui_role_banner" ||
      uniqueId === "ui_role_detail" ||
      uniqueId.indexOf("ui_role_banner_highlight_") === 0 ||
      uniqueId.indexOf("ui_name_") === 0 ||
      uniqueId.indexOf("ui_vote_") === 0
    );
  }

  logRevealDebug(label: string, details?: any) {
    let message = "[reveal-debug] " + label;

    if (!this.shouldLogRevealDebug()) return;

    if (details !== undefined) {
      message += " | " + this.formatDebugValue(details);
    }

    console.log(message);
  }

  logRevealDebugSummary(
    phase: string,
    myPlayerId: number,
    myRole: string,
    isRoundPlayer: boolean,
    myAlive: boolean,
    seatMap: any,
    roleMap: any,
    aliveMap: any,
  ) {
    let seatPlayerIds: string[] = [];

    if (!this.shouldLogRevealDebug(phase)) return;
    if (seatMap) {
      seatPlayerIds = Object.keys(seatMap);
    }

    this.logRevealDebug("refreshUi summary", {
      myPlayerId: myPlayerId,
      myRole: myRole,
      isRoundPlayer: isRoundPlayer,
      myAlive: myAlive,
      seatMapKeys: seatPlayerIds,
      roleMapKeys: roleMap ? Object.keys(roleMap) : [],
      aliveMapKeys: aliveMap ? Object.keys(aliveMap) : [],
      hasRoleBannerSprite: !!spriteManager.getSprite("ui_role_banner"),
      hasRoleBannerHighlightPrefix: !!spriteManager.getSprite("ui_role_banner_highlight_prefix"),
      existingNameSprites: this.countExistingSeatSprites(seatPlayerIds, "ui_name_"),
      existingVoteSprites: this.countExistingSeatSprites(seatPlayerIds, "ui_vote_"),
    });
  }

  countExistingSeatSprites(playerIds: string[], prefix: string): number {
    let count = 0;

    for (let i = 0; i < playerIds.length; i++) {
      if (spriteManager.getSprite(prefix + playerIds[i])) {
        count += 1;
      }
    }

    return count;
  }

  formatDebugValue(value: any): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value.toString();
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      if (value && value.toString) {
        return value.toString();
      }

      return "[unserializable]";
    }
  }

  ensureTextSprite(uniqueId: string, defaultOptions: any) {
    if (spriteManager.getSprite(uniqueId)) {
      // `ensure` is creation-only. Dynamic state belongs in the targeted
      // update methods, otherwise a default font color can overwrite a
      // freshly rendered eliminated-player color during a later refresh.
      return;
    }

    const spriteOptions: any = {
      uniqueId: uniqueId,
      positionX: defaultOptions.positionX || 0,
      positionY: defaultOptions.positionY || 0,
      containerWidth: defaultOptions.containerWidth || 300,
      align: defaultOptions.align || "center",
      text: "",
      fontSize: defaultOptions.fontSize || 24,
      fontWeight: defaultOptions.fontWeight || "normal",
      fontColor: defaultOptions.fontColor || this.lightTextColor,
      opacity: 0,
      isInteractive: false,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: defaultOptions.displayLayer || "top",
      topAdjust: defaultOptions.topAdjust !== undefined ? defaultOptions.topAdjust : 10,
    };

    if (this.shouldLogRevealDebug() && this.isRevealTrackedTextSprite(uniqueId)) {
      this.logRevealDebug(
        "ensureTextSprite creating sprite",
        uniqueId + " displayLayer=" + spriteOptions.displayLayer + " topAdjust=" + spriteOptions.topAdjust.toString(),
      );
    }

    spriteManager.addSprite("baseText", spriteOptions);
  }

  ensureRectSprite(uniqueId: string, defaultOptions: any) {
    if (spriteManager.getSprite(uniqueId)) {
      return;
    }

    const spriteOptions: any = {
      uniqueId: uniqueId,
      positionX: defaultOptions.positionX || 0,
      positionY: defaultOptions.positionY || 0,
      width: defaultOptions.width || 1,
      height: defaultOptions.height || 1,
      fill: defaultOptions.fill || "#ffffff",
      opacity: defaultOptions.opacity !== undefined ? defaultOptions.opacity : 0,
      strokeColor: defaultOptions.strokeColor,
      strokeWeight: defaultOptions.strokeWeight,
      borderRadius: defaultOptions.borderRadius,
      isInteractive: defaultOptions.isInteractive === true,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: defaultOptions.displayLayer || "top",
      topAdjust: defaultOptions.topAdjust !== undefined ? defaultOptions.topAdjust : 1000,
      isStatic: true,
      checkCollisions: false,
      isImpassable: false,
    };

    spriteManager.addSprite("baseRect", spriteOptions);
  }

  updateTextSprite(uniqueId: string, updateOptions: any) {
    if (!spriteManager.getSprite(uniqueId)) {
      if (this.shouldLogRevealDebug() && this.isRevealTrackedTextSprite(uniqueId)) {
        this.logRevealDebug("updateTextSprite missing before ensure", uniqueId);
      }
      this.ensureTextSprite(uniqueId, updateOptions);
    }

    if (!spriteManager.getSprite(uniqueId)) {
      if (this.shouldLogRevealDebug() && this.isRevealTrackedTextSprite(uniqueId)) {
        this.logRevealDebug("updateTextSprite still missing after ensure", uniqueId);
      }
      return;
    }

    let spriteUpdateOptions: any;
    let previousState: any;
    let nextState: any;
    let keys: string[];
    let hasChanges = false;
    spriteUpdateOptions = {};

    if (updateOptions.positionX !== undefined) {
      spriteUpdateOptions.positionX = updateOptions.positionX;
    }
    if (updateOptions.positionY !== undefined) {
      spriteUpdateOptions.positionY = updateOptions.positionY;
    }
    if (updateOptions.containerWidth !== undefined) {
      spriteUpdateOptions.containerWidth = updateOptions.containerWidth;
    }
    if (updateOptions.fontSize !== undefined) {
      spriteUpdateOptions.fontSize = updateOptions.fontSize;
    }
    if (updateOptions.text !== undefined) {
      spriteUpdateOptions.text = updateOptions.text;
    }
    if (updateOptions.fontColor !== undefined) {
      spriteUpdateOptions.fontColor = updateOptions.fontColor;
    }
    if (updateOptions.opacity !== undefined) {
      spriteUpdateOptions.opacity = updateOptions.opacity;
    }
    if (updateOptions.isInteractive !== undefined) {
      spriteUpdateOptions.isInteractive = updateOptions.isInteractive;
    }
    if (updateOptions.topAdjust !== undefined) {
      spriteUpdateOptions.topAdjust = updateOptions.topAdjust;
    }

    previousState = this.lastSpriteStateMap[uniqueId];
    nextState = this.cloneState(previousState);
    keys = Object.keys(spriteUpdateOptions);

    for (let i = 0; i < keys.length; i++) {
      if (nextState[keys[i]] !== spriteUpdateOptions[keys[i]]) {
        nextState[keys[i]] = spriteUpdateOptions[keys[i]];
        hasChanges = true;
      }
    }

    if (!hasChanges) return;

    this.lastSpriteStateMap[uniqueId] = nextState;
    spriteManager.updateSprite(uniqueId, spriteUpdateOptions);

    if (this.shouldLogRevealDebug() && this.isRevealTrackedTextSprite(uniqueId)) {
      this.logRevealDebug(
        "updateTextSprite applied",
        uniqueId +
          " text=" +
          (spriteUpdateOptions.text || "") +
          " opacity=" +
          (spriteUpdateOptions.opacity !== undefined ? spriteUpdateOptions.opacity.toString() : "unchanged"),
      );
    }
  }

  updateRectSprite(uniqueId: string, updateOptions: any) {
    if (!spriteManager.getSprite(uniqueId)) {
      this.ensureRectSprite(uniqueId, updateOptions);
    }

    if (!spriteManager.getSprite(uniqueId)) {
      return;
    }

    let spriteUpdateOptions: any;
    let previousState: any;
    let nextState: any;
    let keys: string[];
    let hasChanges = false;
    spriteUpdateOptions = {};

    if (updateOptions.positionX !== undefined) {
      spriteUpdateOptions.positionX = updateOptions.positionX;
    }
    if (updateOptions.positionY !== undefined) {
      spriteUpdateOptions.positionY = updateOptions.positionY;
    }
    if (updateOptions.width !== undefined) {
      spriteUpdateOptions.width = updateOptions.width;
    }
    if (updateOptions.height !== undefined) {
      spriteUpdateOptions.height = updateOptions.height;
    }
    if (updateOptions.fill !== undefined) {
      spriteUpdateOptions.fill = updateOptions.fill;
    }
    if (updateOptions.opacity !== undefined) {
      spriteUpdateOptions.opacity = updateOptions.opacity;
    }
    if (updateOptions.strokeColor !== undefined) {
      spriteUpdateOptions.strokeColor = updateOptions.strokeColor;
    }
    if (updateOptions.strokeWeight !== undefined) {
      spriteUpdateOptions.strokeWeight = updateOptions.strokeWeight;
    }
    if (updateOptions.borderRadius !== undefined) {
      spriteUpdateOptions.borderRadius = updateOptions.borderRadius;
    }
    if (updateOptions.isInteractive !== undefined) {
      spriteUpdateOptions.isInteractive = updateOptions.isInteractive;
    }

    previousState = this.lastSpriteStateMap[uniqueId];
    nextState = this.cloneState(previousState);
    keys = Object.keys(spriteUpdateOptions);

    for (let i = 0; i < keys.length; i++) {
      if (nextState[keys[i]] !== spriteUpdateOptions[keys[i]]) {
        nextState[keys[i]] = spriteUpdateOptions[keys[i]];
        hasChanges = true;
      }
    }

    if (!hasChanges) return;

    this.lastSpriteStateMap[uniqueId] = nextState;
    spriteManager.updateSprite(uniqueId, spriteUpdateOptions);
  }

  hideTextSprite(uniqueId: string) {
    this.updateTextSprite(uniqueId, {
      text: "",
      opacity: 0,
      isInteractive: false,
    });
  }

  removeDeprecatedLocalCountdownSprite() {
    if (!spriteManager.getSprite("ui_countdown")) return;

    spriteManager.removeSprite("ui_countdown");
    delete this.lastSpriteStateMap.ui_countdown;
  }

  cloneState(input: any) {
    const output: any = {};
    if (!input) return output;

    const keys = Object.keys(input);
    for (let i = 0; i < keys.length; i++) {
      output[keys[i]] = input[keys[i]];
    }

    return output;
  }

  clearLocalDisplayedTargets() {
    this.localDisplayedTargetMapByPhase = {};
    this.pendingLocalTargetByPhase = {};
  }

  getTargetVariableNameForPhase(phase: string): string {
    if (phase === "VOTE") return "dayVoteTargetMap";

    if (
      phase === "NIGHT_TRICKSTER" ||
      phase === "NIGHT_DETECTIVE" ||
      phase === "NIGHT_DOCTOR"
    ) {
      return "nightTargetMap";
    }

    return "";
  }

  getTargetDisplayPhaseForVariable(variableName: string, currentPhase: string): string {
    if (variableName === "dayVoteTargetMap" && currentPhase === "VOTE") {
      return "VOTE";
    }

    if (
      variableName === "nightTargetMap" &&
      (
        currentPhase === "NIGHT_TRICKSTER" ||
        currentPhase === "NIGHT_DETECTIVE" ||
        currentPhase === "NIGHT_DOCTOR"
      )
    ) {
      return currentPhase;
    }

    return "";
  }

  getDisplayedTargetMapForPhase(phase: string) {
    const variableName = this.getTargetVariableNameForPhase(phase);

    if (!variableName) return null;

    if (this.localDisplayedTargetMapByPhase && this.hasOwnKey(this.localDisplayedTargetMapByPhase, phase)) {
      return this.localDisplayedTargetMapByPhase[phase];
    }

    return this.getUiVariable(variableName);
  }

  getPendingLocalTarget(phase: string): number {
    if (!phase || !this.pendingLocalTargetByPhase) return 0;
    return this.pendingLocalTargetByPhase[phase] || 0;
  }

  applyLocalDisplayedTargetSelection(phase: string, targetPlayerId: number) {
    const myPlayerId = this.getMyPlayerId();
    const displayedTargetMap = this.cloneState(this.getDisplayedTargetMapForPhase(phase));

    if (!myPlayerId || !targetPlayerId || targetPlayerId <= 0) return;

    displayedTargetMap[myPlayerId.toString()] = targetPlayerId;
    this.localDisplayedTargetMapByPhase[phase] = displayedTargetMap;
    this.pendingLocalTargetByPhase[phase] = targetPlayerId;
  }

  applySyncedTargetMapToDisplayedPhase(phase: string, sourceMap: any) {
    const displayedTargetMap = this.cloneState(sourceMap);
    const myPlayerId = this.getMyPlayerId();
    const pendingTargetId = this.getPendingLocalTarget(phase);
    const livePhase = stateManager.getVariable("gamePhase");

    if (
      phase === livePhase &&
      myPlayerId > 0 &&
      pendingTargetId > 0
    ) {
      if (displayedTargetMap[myPlayerId.toString()] === pendingTargetId) {
        delete this.pendingLocalTargetByPhase[phase];
      } else {
        displayedTargetMap[myPlayerId.toString()] = pendingTargetId;
      }
    }

    this.localDisplayedTargetMapByPhase[phase] = displayedTargetMap;
  }

  getMyPlayerId(): number {
    if (!this.myPlayerId) {
      this.myPlayerId = playerManager.getMyPlayerId();
    }

    return this.myPlayerId;
  }

  getPlayerName(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (playerDetails && playerDetails.username) {
      return playerDetails.username;
    }

    return "Player " + playerId.toString();
  }

  getRoleHighlightColor(roleName: string): string {
    if (roleName === "TRICKSTER") return this.redTextColor;
    if (roleName === "DETECTIVE") return this.detectiveTextColor;
    if (roleName === "DOCTOR") return this.doctorTextColor;
    return this.lightTextColor;
  }

  applyDetectiveKnowledgeNameColors() {
    const roleMap = this.getUiVariable("playerRoleMap") || {};
    const aliveMap = this.getUiVariable("playerAliveMap") || {};
    const revealedRoleMap = this.getUiVariable("detectivePlayerRoleRevealedMap") || {};
    const myPlayerId = this.getMyPlayerId();
    const myRole = myPlayerId ? roleMap[myPlayerId.toString()] : "";
    const revealedPlayerIds = Object.keys(revealedRoleMap);

    if (myRole !== "DETECTIVE") return;

    for (let i = 0; i < revealedPlayerIds.length; i++) {
      const playerId = revealedPlayerIds[i];
      const nameSpriteId = "ui_name_" + playerId;
      const revealedRole = revealedRoleMap[playerId];
      const revealedRoleColor = this.getRoleHighlightColor(revealedRole);

      // Death is the final name color: a revealed player always turns grey
      // once eliminated and is never recolored afterward.
      if (aliveMap[playerId] === false) continue;
      if (!spriteManager.getSprite(nameSpriteId)) continue;
      // Townsfolk have the baseline white color. Do not reapply that color
      // during later MAP updates; special roles receive only their own tint.
      if (revealedRoleColor === this.lightTextColor) continue;

      spriteManager.updateSprite(nameSpriteId, {
        fontColor: revealedRoleColor,
      });

      if (this.lastSpriteStateMap[nameSpriteId]) {
        this.lastSpriteStateMap[nameSpriteId].fontColor = revealedRoleColor;
      }
    }
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

      if (this.estimateTextWidth(truncatedText + ellipsis, fontSize) <= maxWidth) {
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
}
