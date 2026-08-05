class roleUIManager extends SystemScript {
  uiSystem: any;
  currentState: any;
  revealPopupOpen: boolean;
  helpPopupOpen: boolean;
  acknowledgementSubmitted: boolean;
  acknowledgementSpritePendingRemoval: boolean;
  lastPhase: string;
  lightColor: string;
  yellowColor: string;
  greyColor: string;

  onInit() {
    this.currentState = {};
    this.revealPopupOpen = false;
    this.helpPopupOpen = false;
    this.acknowledgementSubmitted = false;
    this.acknowledgementSpritePendingRemoval = false;
    this.lastPhase = "";
    this.lightColor = "#fff7df";
    this.yellowColor = "#f0d04f";
    this.greyColor = "#a0a0a0";
    this.ensureUiSystem();
  }

  onSpriteClicked({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || !sprite.uniqueId) return;

    if (
      sprite.uniqueId === "ui_role_reveal_acknowledge" ||
      sprite.uniqueId === "ui_role_reveal_acknowledge_hit"
    ) {
      this.acknowledgeRole();
      return;
    }

    if (this.revealPopupOpen) return;

    if (sprite.uniqueId === "ui_help_button") {
      if (this.helpPopupOpen) this.closeHelpPopup();
      else this.showHelpPopup();
      return;
    }

    if (
      sprite.uniqueId === "ui_help_close" ||
      sprite.uniqueId === "ui_help_close_bg"
    ) {
      this.closeHelpPopup();
    }
  }

  onStep() {
    if (!this.acknowledgementSpritePendingRemoval) return;
    this.acknowledgementSpritePendingRemoval = false;
    this.ensureUiSystem().removeMany([
      "ui_role_reveal_acknowledge",
      "ui_role_reveal_acknowledge_hit",
    ]);
  }

  render(state: any) {
    this.ensureUiSystem();
    this.currentState = state || {};
    const phase = this.currentState.phase || "WAITING";

    if (phase === "WAITING" && this.lastPhase !== "WAITING") {
      this.acknowledgementSubmitted = false;
    }
    if (phase === "REVEAL" && this.lastPhase !== "REVEAL") {
      this.acknowledgementSubmitted = false;
    }
    this.lastPhase = phase;

    this.renderRoleBanner();
    this.renderNightResult();
    this.renderHelpButton();
    this.renderRevealPopup();
  }

  renderRoleBanner() {
    const phase = this.currentState.phase;
    const myPlayerId = this.currentState.myPlayerId || 0;
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "roleUIManager.renderRoleBanner",
      this.currentState.roleMap || {},
    );
    const aliveMap = this.currentState.aliveMap || {};
    const deathInfoMap = this.currentState.deathInfoMap || {};
    const roleName = roleMap[myPlayerId.toString()] || "";

    if (phase === "WAITING" || phase === "REVEAL" || !roleName) {
      this.uiSystem.hideText("ui_role_banner");
      this.uiSystem.hideText("ui_role_status");
      return;
    }

    let bannerText = "You are the " + roleName + " role";
    let detailText = "";
    let bannerColor = this.getRoleColor(roleName);

    if (aliveMap[myPlayerId.toString()] === false) {
      const deathInfo = deathInfoMap[myPlayerId.toString()];
      bannerColor = this.greyColor;
      if (deathInfo && deathInfo.cause === "TRICKSTER_ELIMINATION") {
        bannerText = "You were Eliminated by the TRICKSTER team";
      } else if (deathInfo && deathInfo.cause === "CONVICTED") {
        bannerText = "You were convicted during the trial";
      } else {
        bannerText = "You were Eliminated from the game";
      }
    }

    if (
      this.currentState.jokerWinnerPlayerId === myPlayerId &&
      (phase === "END" || phase === "END_EARLY")
    ) {
      detailText = "You also won as the JOKER!";
      bannerColor = this.getRoleColor("JOKER");
    }

    this.uiSystem.updateText("ui_role_banner", {
      positionX: 120,
      positionY: 30,
      containerWidth: 1260,
      align: "center",
      text: bannerText,
      fontSize: 48,
      fontWeight: "bold",
      fontColor: bannerColor,
      opacity: 1,
      isInteractive: false,
      topAdjust: 1200,
    });
    this.uiSystem.updateText("ui_role_status", {
      positionX: 170,
      positionY: 92,
      containerWidth: 1160,
      align: "center",
      text: detailText,
      fontSize: 24,
      fontColor: this.lightColor,
      opacity: detailText ? 1 : 0,
      isInteractive: false,
      topAdjust: 1200,
    });
  }

  renderNightResult() {
    const phase = this.currentState.phase;
    const myPlayerId = this.currentState.myPlayerId || 0;
    const resultMap = this.currentState.playerNightResultMap || {};
    const result = resultMap[myPlayerId.toString()];
    const resultKeys = Object.keys(resultMap);
    const undefinedResultKeys: string[] = [];
    for (let i = 0; i < resultKeys.length; i++) {
      if (resultMap[resultKeys[i]] === undefined) {
        undefinedResultKeys.push(resultKeys[i]);
      }
    }
    console.log(
      "[sync-debug][roleUIManager.renderNightResult][player=" +
        myPlayerId.toString() +
        "] CONSUMER READ playerNightResultMap phase=" +
        (phase || "") +
        " round=" +
        (this.currentState.roundNumber || 0).toString() +
        " phaseNonce=" +
        (this.currentState.phaseNonce || 0).toString() +
        " keys=[" +
        resultKeys.join(",") +
        "] undefinedChildren=[" +
        undefinedResultKeys.join(",") +
        "] myResult=",
      result,
    );
    // A completed result is safe to reveal as soon as its authoritative
    // callback arrives during NIGHT_BUFFER. Once DISCUSS increments the phase
    // nonce, the same result remains current at phaseNonce - 1.
    const shouldShow =
      phase === "NIGHT_BUFFER" || phase === "DISCUSS";
    const expectedActionPhaseNonce =
      phase === "NIGHT_BUFFER"
        ? this.currentState.phaseNonce
        : this.currentState.phaseNonce - 1;
    const isCurrentNightResult =
      result &&
      result.nightNumber === this.currentState.roundNumber &&
      result.actionPhaseNonce === expectedActionPhaseNonce;

    if (!shouldShow || !isCurrentNightResult) {
      console.log(
        "[sprite-debug][roleUIManager.renderNightResult][player=" +
          myPlayerId.toString() +
          "] REMOVE result sprites shouldShow=" +
          shouldShow.toString() +
          " isCurrentNightResult=" +
          (!!isCurrentNightResult).toString() +
          " expectedActionPhaseNonce=" +
          expectedActionPhaseNonce.toString(),
      );
      this.uiSystem.remove("ui_night_result");
      this.uiSystem.remove("ui_night_result_detail");
      return;
    }

    const actionText = result.actionText || result.summaryText || "";
    const detailText = result.detailText || "";

    if (!actionText) {
      console.log(
        "[sprite-debug][roleUIManager.renderNightResult][player=" +
          myPlayerId.toString() +
          "] REMOVE result sprites because actionText is empty",
      );
      this.uiSystem.remove("ui_night_result");
      this.uiSystem.remove("ui_night_result_detail");
      return;
    }

    console.log(
      "[sprite-debug][roleUIManager.renderNightResult][player=" +
        myPlayerId.toString() +
        "] CREATE/UPDATE ui_night_result phase=" +
        phase +
        " actionText=" +
        actionText,
    );
    this.uiSystem.updateText("ui_night_result", {
      positionX: 210,
      positionY: 535,
      containerWidth: 1080,
      align: "center",
      text: actionText,
      fontSize: 32,
      fontWeight: "bold",
      fontColor: this.yellowColor,
      isInteractive: false,
      topAdjust: 1999,
    });
    if (detailText) {
      console.log(
        "[sprite-debug][roleUIManager.renderNightResult][player=" +
          myPlayerId.toString() +
          "] CREATE/UPDATE ui_night_result_detail detailText=" +
          detailText,
      );
      this.uiSystem.updateText("ui_night_result_detail", {
        positionX: 210,
        positionY: 580,
        containerWidth: 1080,
        align: "center",
        text: this.uiSystem.wrapText(detailText, 1060, 28),
        fontSize: 28,
        fontWeight: "bold",
        fontColor: this.lightColor,
        isInteractive: false,
        topAdjust: 1999,
      });
    } else {
      this.uiSystem.remove("ui_night_result_detail");
    }

    // A successful CASE result already reached the same reliable render path
    // as the personal night-result text above. Build permanent CASED labels
    // directly here, in this method, without any pending-map helper pipeline.
    // Every Trickster-team client receives the full result map, so teammates
    // can create the same label even when another Trickster performed CASE.
    const casedRoleMap = this.currentState.roleMap || {};
    const casedSeatMap = this.currentState.seatMap || {};
    const knownCaseMap =
      this.currentState.tricksterCaseTargetMap || {};
    const directCaseMap: any = {};
    const knownCaseIds = Object.keys(knownCaseMap);
    const stateMyRole = this.currentState.myRole || "";
    const roleMapMyRole =
      casedRoleMap[myPlayerId.toString()] || "";
    const effectiveMyRole = stateMyRole || roleMapMyRole || "";

    for (let i = 0; i < knownCaseIds.length; i++) {
      const knownTargetId = knownCaseIds[i];
      const knownRole = knownCaseMap[knownTargetId] || "";
      if (knownRole) directCaseMap[knownTargetId] = knownRole;
    }

    for (let i = 0; i < resultKeys.length; i++) {
      const caseResult = resultMap[resultKeys[i]];
      if (!caseResult) continue;
      if (caseResult.nightNumber !== this.currentState.roundNumber) {
        continue;
      }
      if (
        caseResult.actionPhaseNonce !== expectedActionPhaseNonce ||
        caseResult.status !== "SUCCESS" ||
        caseResult.actionName !== "CASE"
      ) {
        continue;
      }

      const caseTargetId =
        caseResult.targetPlayerId > 0
          ? caseResult.targetPlayerId.toString()
          : "";
      const caseRevealedRole =
        caseResult.revealedRole ||
        (caseTargetId ? casedRoleMap[caseTargetId] || "" : "");
      if (caseTargetId && caseRevealedRole) {
        directCaseMap[caseTargetId] = caseRevealedRole;
      }
    }

    const directCaseIds = Object.keys(directCaseMap);
    console.log(
      "[sprite-debug-CASED][roleUIManager.renderNightResult -> direct permanent labels][player=" +
        myPlayerId.toString() +
        "] CHECK phase=" +
        (phase || "") +
        " stateMyRole=" +
        stateMyRole +
        " roleMapMyRole=" +
        roleMapMyRole +
        " effectiveMyRole=" +
        effectiveMyRole +
        " knownCaseIds=[" +
        knownCaseIds.join(",") +
        "] directCaseIds=[" +
        directCaseIds.join(",") +
        "] roleMapKeys=[" +
        Object.keys(casedRoleMap).join(",") +
        "] seatMapKeys=[" +
        Object.keys(casedSeatMap).join(",") +
        "] knownCaseMap=",
      knownCaseMap,
      " pendingCasedRoleMap=",
      this.currentState.pendingCasedRoleMap,
      " addedCasedRoleMap=",
      this.currentState.addedCasedRoleMap,
      " roleMap=",
      casedRoleMap,
      " seatMap=",
      casedSeatMap,
      " playerNightResultMap=",
      resultMap,
    );

    const isLocalTricksterTeam =
      effectiveMyRole === "TRICKSTER" ||
      effectiveMyRole === "SABOTEUR" ||
      effectiveMyRole === "FRAMER";
    if (!isLocalTricksterTeam) {
      console.log(
        "[sprite-debug-CASED][roleUIManager.renderNightResult -> direct permanent labels][player=" +
          myPlayerId.toString() +
          "] STOP effectiveMyRole=" +
          effectiveMyRole +
          " is not on the Trickster team",
      );
      return;
    }

    for (let i = 0; i < directCaseIds.length; i++) {
      const casedPlayerId = directCaseIds[i];
      const casedPlayerRole = directCaseMap[casedPlayerId] || "";
      const casedSeatData = casedSeatMap[casedPlayerId];
      const casedSpriteId = "ui_cased_" + casedPlayerId;

      if (!casedPlayerRole || !casedSeatData) {
        console.log(
          "[sprite-debug-CASED][roleUIManager.renderNightResult -> direct permanent labels][player=" +
            myPlayerId.toString() +
            "] WAIT " +
            casedSpriteId +
            " roleAvailable=" +
            (!!casedPlayerRole).toString() +
            " seatAvailable=" +
            (!!casedSeatData).toString() +
            " casedPlayerRole=",
          casedPlayerRole,
          " casedSeatData=",
          casedSeatData,
        );
        continue;
      }

      const existingCasedSprite =
        spriteManager.getSprite(casedSpriteId);
      if (existingCasedSprite) {
        console.log(
          "[sprite-debug-CASED][roleUIManager.renderNightResult -> direct permanent labels][player=" +
            myPlayerId.toString() +
            "] KEEP existing " +
            casedSpriteId +
            " sprite=",
          existingCasedSprite,
        );
        continue;
      }

      const formattedCasedRole =
        casedPlayerRole.substring(0, 1) +
        casedPlayerRole.substring(1).toLowerCase();
      const casedSpriteOptions: any = {
        positionX: casedSeatData.voteX,
        positionY: casedSeatData.voteY + 26,
        containerWidth: casedSeatData.labelWidth,
        align: "center",
        text: "CASED: " + formattedCasedRole,
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
        "[sprite-debug-CASED][roleUIManager.renderNightResult -> direct permanent labels][player=" +
          myPlayerId.toString() +
          "] BEFORE create " +
          casedSpriteId +
          " effectiveMyRole=" +
          effectiveMyRole +
          " completeRequestedOptions=",
        casedSpriteOptions,
        " casedSeatData=",
        casedSeatData,
      );
      this.uiSystem.remove(casedSpriteId);
      this.uiSystem.updateText(
        casedSpriteId,
        casedSpriteOptions,
      );
      console.log(
        "[sprite-debug-CASED][roleUIManager.renderNightResult -> direct permanent labels][player=" +
          myPlayerId.toString() +
          "] AFTER create " +
          casedSpriteId +
          " completeRequestedOptions=",
        casedSpriteOptions,
        " createdSprite=",
        spriteManager.getSprite(casedSpriteId),
      );
    }
  }

  renderHelpButton() {
    if (this.currentState.phase === "REVEAL") {
      this.uiSystem.remove("ui_help_button");
      this.closeHelpPopup();
      return;
    }

    this.uiSystem.updateText("ui_help_button", {
      positionX: 1380,
      positionY: 24,
      containerWidth: 70,
      align: "center",
      text: "?",
      fontSize: 46,
      fontWeight: "bold",
      fontColor: this.lightColor,
      isInteractive: true,
      topAdjust: 5000,
    });
  }

  renderRevealPopup() {
    const phase = this.currentState.phase;
    const myPlayerId = this.currentState.myPlayerId || 0;
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "roleUIManager.renderRevealPopup",
      this.currentState.roleMap || {},
    );
    const acknowledgementMap =
      this.currentState.roleRevealAcknowledgementMap || {};
    const roleName = roleMap[myPlayerId.toString()] || "";
    const hasAcknowledged =
      this.acknowledgementSubmitted ||
      acknowledgementMap[myPlayerId.toString()] === true;

    if (phase !== "REVEAL" || !roleName || hasAcknowledged) {
      this.closeRevealPopup();
      return;
    }

    if (!this.revealPopupOpen) this.showRevealPopup(roleName);
  }

  showRevealPopup(roleName: string) {
    const copy = this.getRoleCopy(roleName);
    this.closeHelpPopup();
    this.closeRevealPopup();
    this.revealPopupOpen = true;

    this.uiSystem.ensureRect("ui_role_reveal_panel", {
      positionX: 270,
      positionY: 250,
      width: 960,
      height: 1000,
      fill: "rgba(18, 22, 14, 1)",
      strokeColor: this.lightColor,
      strokeWeight: 5,
      borderRadius: 28,
      isInteractive: true,
      displayLayer: "top",
      topAdjust: 2000,
    });
    this.uiSystem.updateText("ui_role_reveal_heading", {
      positionX: 330,
      positionY: 320,
      containerWidth: 840,
      align: "center",
      text: copy.heading,
      fontSize: 50,
      fontWeight: "bold",
      fontColor: this.getRoleColor(roleName),
      isInteractive: false,
      topAdjust: 4000,
    });
    this.uiSystem.updateText("ui_role_reveal_body", {
      positionX: 340,
      positionY: 440,
      containerWidth: 820,
      align: "left",
      text: this.uiSystem.wrapText(copy.body, 790, 30),
      fontSize: 30,
      fontColor: this.lightColor,
      isInteractive: false,
      topAdjust: 4000,
    });
    this.uiSystem.ensureRect("ui_role_reveal_acknowledge_hit", {
      positionX: 400,
      positionY: 1115,
      width: 700,
      height: 76,
      fill: "rgba(240, 208, 79, 0.10)",
      strokeColor: this.yellowColor,
      strokeWeight: 2,
      borderRadius: 14,
      isInteractive: true,
      displayLayer: "top",
      topAdjust: 3500,
    });
    this.uiSystem.updateText("ui_role_reveal_acknowledge", {
      positionX: 400,
      positionY: 1130,
      containerWidth: 700,
      align: "center",
      text: "I understand my role",
      fontSize: 36,
      fontWeight: "bold",
      fontColor: this.yellowColor,
      isInteractive: false,
      topAdjust: 4000,
    });
    this.uiSystem.ensureRect("ui_role_reveal_acknowledge_underline", {
      positionX: 555,
      positionY: 1180,
      width: 390,
      height: 4,
      fill: this.yellowColor,
      isInteractive: false,
      displayLayer: "top",
      topAdjust: 4000,
    });
  }

  acknowledgeRole() {
    if (!this.revealPopupOpen || this.acknowledgementSubmitted) return;
    if (this.currentState.phase !== "REVEAL") return;

    this.acknowledgementSubmitted = true;
    this.acknowledgementSpritePendingRemoval = true;
    this.uiSystem.updateText("ui_role_reveal_acknowledge", {
      text: "",
      opacity: 0,
      isInteractive: false,
    });
    this.uiSystem.updateRect("ui_role_reveal_acknowledge_hit", {
      isInteractive: false,
    });
    this.closeRevealPopup();
    eventManager.emit("playerAcknowledgesRole", {
      fromPlayerId: this.currentState.myPlayerId,
    });
  }

  closeRevealPopup() {
    this.revealPopupOpen = false;
    const revealSpriteIds = [
      "ui_role_reveal_panel",
      "ui_role_reveal_heading",
      "ui_role_reveal_body",
      "ui_role_reveal_acknowledge_underline",
    ];
    if (!this.acknowledgementSpritePendingRemoval) {
      revealSpriteIds.push("ui_role_reveal_acknowledge");
      revealSpriteIds.push("ui_role_reveal_acknowledge_hit");
    }
    this.ensureUiSystem().removeMany(revealSpriteIds);
  }

  showHelpPopup() {
    const myPlayerId = this.currentState.myPlayerId || 0;
    const roleMap = this.debugReadStateMap(
      "playerRoleMap",
      "roleUIManager.showHelpPopup",
      this.currentState.roleMap || {},
    );
    const roleName = roleMap[myPlayerId.toString()] || "";
    const copy = roleName
      ? this.getRoleCopy(roleName)
      : {
          heading: "How to play Trickster Town",
          body:
            "Every player receives a role and acts simultaneously at night. The Trickster team has three nights to eliminate someone. If they do, the town holds a trial the following day. Convict a member of the Trickster team to give the Townsfolk victory.",
        };

    this.closeHelpPopup();
    this.helpPopupOpen = true;
    this.uiSystem.ensureRect("ui_help_panel", {
      positionX: 270,
      positionY: 250,
      width: 960,
      height: 1000,
      fill: "rgba(18, 22, 14, 1)",
      strokeColor: this.lightColor,
      strokeWeight: 5,
      borderRadius: 28,
      isInteractive: true,
      displayLayer: "top",
      topAdjust: 6000,
    });
    this.uiSystem.updateText("ui_help_heading", {
      positionX: 340,
      positionY: 330,
      containerWidth: 820,
      align: "center",
      text: copy.heading,
      fontSize: 46,
      fontWeight: "bold",
      fontColor: roleName ? this.getRoleColor(roleName) : this.lightColor,
      isInteractive: false,
      topAdjust: 8000,
    });
    this.uiSystem.updateText("ui_help_body", {
      positionX: 340,
      positionY: 450,
      containerWidth: 820,
      align: "left",
      text: this.uiSystem.wrapText(copy.body, 790, 29),
      fontSize: 29,
      fontColor: this.lightColor,
      isInteractive: false,
      topAdjust: 8000,
    });
    this.uiSystem.ensureRect("ui_help_close_bg", {
      positionX: 1130,
      positionY: 280,
      width: 62,
      height: 62,
      fill: "#ff3b30",
      borderRadius: 14,
      isInteractive: true,
      displayLayer: "top",
      topAdjust: 8000,
    });
    this.uiSystem.updateText("ui_help_close", {
      positionX: 1130,
      positionY: 278,
      containerWidth: 62,
      align: "center",
      text: "X",
      fontSize: 40,
      fontWeight: "bold",
      fontColor: "#000000",
      isInteractive: true,
      topAdjust: 9000,
    });
  }

  closeHelpPopup() {
    this.helpPopupOpen = false;
    this.ensureUiSystem().removeMany([
      "ui_help_panel",
      "ui_help_heading",
      "ui_help_body",
      "ui_help_close_bg",
      "ui_help_close",
    ]);
  }

  getRoleCopy(roleName: string) {
    if (roleName === "DETECTIVE") {
      return {
        heading: "You are the DETECTIVE role",
        body:
          "You are Townsfolk. Each night, investigate another player to learn where that player appeared to visit. A blocked player visited no one. Beware: the Framer can create a false visit under another player's identity.",
      };
    }
    if (roleName === "WATCHER") {
      return {
        heading: "You are the WATCHER role",
        body:
          "You are Townsfolk. Each night, watch another player's house to learn which players appeared to visit it. You do not count yourself as a visitor. A Framer and their disguise can both appear in your result.",
      };
    }
    if (roleName === "TRICKSTER") {
      return {
        heading: "You are the TRICKSTER role",
        body:
          "You are on the Trickster team. Each night, choose whether to CASE a player and learn their role or ELIMINATE any living player your team has already cased. Your team wins if the town convicts anyone outside the Trickster team after an elimination.",
      };
    }
    if (roleName === "GUARD") {
      return {
        heading: "You are the GUARD role",
        body:
          "You are Townsfolk. Guard another player each night. Lower-priority visits to that player are stopped completely, and the blocked visitor's action never happens. You are not told who attempted a visit.",
      };
    }
    if (roleName === "JOKER") {
      return {
        heading: "You are the JOKER role",
        body:
          "You are your own team. Visit a player each night; the visit has no other effect. You win if the town convicts you. Your victory can happen at the same time as a Trickster-team victory.",
      };
    }
    if (roleName === "SABOTEUR") {
      return {
        heading: "You are the SABOTEUR role",
        body:
          "You are on the Trickster team. Distract a non-Trickster player each night. Your action resolves first: the distracted player's visit and ability never happen, and they are not told who distracted them.",
      };
    }
    if (roleName === "FRAMER") {
      return {
        heading: "You are the FRAMER role",
        body:
          "You are on the Trickster team. First choose a living player to disguise as, then choose another player to visit. Information roles can see both you and your chosen disguise apparently visit the same target.",
      };
    }
    return {
      heading: "You are the SLEEPER role",
      body:
        "You are Townsfolk. Visit another player to make them sleepy for that night. Their visit and action never happen. Sleepiness does not carry into later nights.",
    };
  }

  getRoleColor(roleName: string): string {
    if (roleName === "TRICKSTER") return "#d74d4d";
    if (roleName === "SABOTEUR") return "#ff6b57";
    if (roleName === "FRAMER") return "#d979ff";
    if (roleName === "DETECTIVE") return "#87d3ff";
    if (roleName === "WATCHER") return "#72e0d1";
    if (roleName === "GUARD") return "#ffe27a";
    if (roleName === "JOKER") return "#f4a1ff";
    if (roleName === "SLEEPER") return "#b8b5ff";
    return this.lightColor;
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
