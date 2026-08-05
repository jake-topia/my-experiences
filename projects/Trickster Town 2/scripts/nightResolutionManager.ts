class nightResolutionManager extends SystemScript {
  roleManagerSystem: any;

  onInit() {
    if (!playerManager.isHost) return;
    this.ensureRoleManager();
  }

  resolveNight(): number {
    if (!playerManager.isHost) return 0;

    const nightNumber = stateManager.getVariable("roundNumber");
    const phaseNonce = stateManager.getVariable("phaseNonce");
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "nightResolutionManager.resolveNight -> resolution input",
      ) || {};
    const aliveMap = this.cloneMap(
      stateManager.getVariable("playerAliveMap"),
    );
    const deathInfoMap = this.cloneMap(
      stateManager.getVariable("playerDeathInfoMap"),
    );
    const submittedActionMap =
      stateManager.getVariable("nightActionMap") || {};
    let caseTargetMap = this.cloneMap(
      stateManager.getVariable("tricksterCaseTargetMap"),
    );
    const actorIds = Object.keys(roleMap);
    const validActionMap: any = {};
    let blockedReasonMap: any = {};
    let protectedTargetMap: any = {};
    const successfulActionMap: any = {};
    let framerDisguiseMap: any = {};
    let reportedDestinationsByActor: any = {};
    let reportedVisitorsByTarget: any = {};
    const guardedVisitorCountMap: any = {};
    console.log(
      "[resolution-debug][nightResolutionManager.resolveNight][HOST] submittedActionMap=",
      submittedActionMap,
    );

    for (let i = 0; i < actorIds.length; i++) {
      const actorId = parseInt(actorIds[i], 10);
      const actorKey = actorIds[i];
      const submittedAction = submittedActionMap[actorKey];
      if (aliveMap[actorKey] !== true || !submittedAction) continue;
      if (submittedAction.phaseNonce !== phaseNonce) continue;

      const expectedActionName = this.ensureRoleManager().getNightActionName(
        actorId,
        roleMap,
        caseTargetMap,
        submittedAction.actionName,
      );
      const targetPlayerId = submittedAction.targetPlayerId;

      if (submittedAction.actionName !== expectedActionName) continue;
      if (
        !this.ensureRoleManager().isValidNightTarget(
          actorId,
          targetPlayerId,
          expectedActionName,
          roleMap,
          aliveMap,
          caseTargetMap,
        )
      ) {
        continue;
      }

      let disguisePlayerId = 0;
      if (expectedActionName === "FRAME") {
        disguisePlayerId = submittedAction.disguisePlayerId || 0;
        if (disguisePlayerId === targetPlayerId) continue;
        if (
          !this.ensureRoleManager().isValidNightTarget(
            actorId,
            disguisePlayerId,
            expectedActionName,
            roleMap,
            aliveMap,
            caseTargetMap,
          )
        ) {
          continue;
        }
      }

      validActionMap[actorKey] = {
        actionName: expectedActionName,
        targetPlayerId: targetPlayerId,
        disguisePlayerId: disguisePlayerId,
      };
    }
    console.log(
      "[resolution-debug][nightResolutionManager.resolveNight][HOST] validActionMap=",
      validActionMap,
    );

    // Blocking priority is deterministic: Saboteur, then Sleeper, then Guard.
    // A higher-priority block has already prevented the later role from acting.
    blockedReasonMap = this.applySaboteurBlocks(
      validActionMap,
      blockedReasonMap,
    );
    blockedReasonMap = this.applySleeperBlocks(
      validActionMap,
      blockedReasonMap,
    );
    protectedTargetMap = this.applyGuardProtection(
      validActionMap,
      blockedReasonMap,
      protectedTargetMap,
    );
    console.log(
      "[resolution-debug][nightResolutionManager.resolveNight][HOST] after priority resolution blockedReasonMap=",
      blockedReasonMap,
      " protectedTargetMap=",
      protectedTargetMap,
    );

    const validActorIds = Object.keys(validActionMap);
    for (let i = 0; i < validActorIds.length; i++) {
      const actorKey = validActorIds[i];
      const action = validActionMap[actorKey];

      if (
        blockedReasonMap[actorKey] &&
        blockedReasonMap[actorKey] !== "SLEEPY_AFTER_ACTION"
      ) {
        continue;
      }

      if (
        action.actionName !== "DISTRACT" &&
        action.actionName !== "SLEEP" &&
        action.actionName !== "GUARD" &&
        protectedTargetMap[action.targetPlayerId.toString()] === true
      ) {
        blockedReasonMap[actorKey] = "GUARDED";
        const guardedTargetKey = action.targetPlayerId.toString();
        guardedVisitorCountMap[guardedTargetKey] =
          (guardedVisitorCountMap[guardedTargetKey] || 0) + 1;
        continue;
      }

      successfulActionMap[actorKey] = action;
    }
    console.log(
      "[resolution-debug][nightResolutionManager.resolveNight][HOST] successfulActionMap=",
      successfulActionMap,
      " guardedVisitorCountMap=",
      guardedVisitorCountMap,
    );

    const reportedVisitData = this.buildReportedVisits(
      successfulActionMap,
    );
    framerDisguiseMap = reportedVisitData.framerDisguiseMap;
    reportedDestinationsByActor =
      reportedVisitData.reportedDestinationsByActor;
    reportedVisitorsByTarget = reportedVisitData.reportedVisitorsByTarget;
    console.log(
      "[resolution-debug][nightResolutionManager.resolveNight][HOST] reportedDestinationsByActor=",
      reportedDestinationsByActor,
      " reportedVisitorsByTarget=",
      reportedVisitorsByTarget,
      " framerDisguiseMap=",
      framerDisguiseMap,
    );

    const eliminatedPlayerId = this.resolveTricksterElimination(
      successfulActionMap,
      caseTargetMap,
      aliveMap,
    );

    if (eliminatedPlayerId > 0) {
      aliveMap[eliminatedPlayerId.toString()] = false;
      deathInfoMap[eliminatedPlayerId.toString()] = {
        roundNumber: nightNumber,
        cause: "TRICKSTER_ELIMINATION",
        eliminatingTeam: "TRICKSTERS",
      };
    }

    caseTargetMap = this.resolveSuccessfulCases(
      successfulActionMap,
      roleMap,
      caseTargetMap,
    );

    const playerNightResultMap = this.buildNightResultMap(
      nightNumber,
      phaseNonce,
      this.debugGetGlobalMap(
        "playerNightResultMap",
        "nightResolutionManager.resolveNight -> previous result history",
      ),
      roleMap,
      aliveMap,
      validActionMap,
      successfulActionMap,
      blockedReasonMap,
      framerDisguiseMap,
      reportedDestinationsByActor,
      reportedVisitorsByTarget,
      guardedVisitorCountMap,
      eliminatedPlayerId,
    );
    const generatedResultKeys = Object.keys(playerNightResultMap);
    console.log(
      "[sync-debug][nightResolutionManager.resolveNight][HOST] GENERATED playerNightResultMap night=" +
        nightNumber.toString() +
        " actionPhaseNonce=" +
        phaseNonce.toString() +
        " keys=[" +
        generatedResultKeys.join(",") +
        "] value=",
      playerNightResultMap,
    );

    stateManager.setVariable("tricksterCaseTargetMap", caseTargetMap);
    // Sleepiness is a one-night action block, never a persistent status.
    stateManager.setVariable("sleepyPlayerMap", {});
    stateManager.setVariable("playerAliveMap", aliveMap);
    stateManager.setVariable("playerDeathInfoMap", deathInfoMap);
    stateManager.setVariable("lastNightEliminatedPlayerId", eliminatedPlayerId);
    stateManager.setVariable("playerNightResultMap", playerNightResultMap);
    stateManager.setVariable("nightActionMap", {});

    return eliminatedPlayerId;
  }

  applySaboteurBlocks(actionMap: any, blockedReasonMap: any) {
    const nextBlockedReasonMap = this.cloneMap(blockedReasonMap);
    const actorIds = Object.keys(actionMap);

    for (let i = 0; i < actorIds.length; i++) {
      const action = actionMap[actorIds[i]];
      if (action.actionName !== "DISTRACT") continue;
      nextBlockedReasonMap[action.targetPlayerId.toString()] = "DISTRACTED";
    }
    return nextBlockedReasonMap;
  }

  applySleeperBlocks(actionMap: any, blockedReasonMap: any) {
    const nextBlockedReasonMap = this.cloneMap(blockedReasonMap);
    const actorIds = Object.keys(actionMap);

    for (let i = 0; i < actorIds.length; i++) {
      const actorKey = actorIds[i];
      const action = actionMap[actorKey];
      if (action.actionName !== "SLEEP") continue;
      if (nextBlockedReasonMap[actorKey]) continue;

      const targetKey = action.targetPlayerId.toString();
      const targetAction = actionMap[targetKey];
      if (targetAction && targetAction.actionName === "DISTRACT") {
        // Saboteur actions resolve before Sleeper actions, so this night's
        // distraction has already happened and there is no later status.
        nextBlockedReasonMap[targetKey] = "SLEEPY_AFTER_ACTION";
        continue;
      }
      if (!nextBlockedReasonMap[targetKey]) {
        nextBlockedReasonMap[targetKey] = "SLEEPY";
      }
    }
    return nextBlockedReasonMap;
  }

  applyGuardProtection(
    actionMap: any,
    blockedReasonMap: any,
    protectedTargetMap: any,
  ) {
    const nextProtectedTargetMap = this.cloneMap(protectedTargetMap);
    const actorIds = Object.keys(actionMap);

    for (let i = 0; i < actorIds.length; i++) {
      const actorKey = actorIds[i];
      const action = actionMap[actorKey];
      if (action.actionName !== "GUARD") continue;
      if (
        blockedReasonMap[actorKey] &&
        blockedReasonMap[actorKey] !== "SLEEPY_AFTER_ACTION"
      ) {
        continue;
      }
      nextProtectedTargetMap[action.targetPlayerId.toString()] = true;
    }
    return nextProtectedTargetMap;
  }

  buildReportedVisits(successfulActionMap: any) {
    const framerDisguiseMap: any = {};
    const reportedDestinationsByActor: any = {};
    const reportedVisitorsByTarget: any = {};
    const actorIds = Object.keys(successfulActionMap);

    for (let i = 0; i < actorIds.length; i++) {
      const actorKey = actorIds[i];
      const actorPlayerId = parseInt(actorKey, 10);
      const action = successfulActionMap[actorKey];
      const targetPlayerId = action.targetPlayerId;
      const targetKey = targetPlayerId.toString();
      if (!reportedDestinationsByActor[actorKey]) {
        reportedDestinationsByActor[actorKey] = [];
      }
      if (
        reportedDestinationsByActor[actorKey].indexOf(targetPlayerId) === -1
      ) {
        reportedDestinationsByActor[actorKey].push(targetPlayerId);
      }
      if (!reportedVisitorsByTarget[targetKey]) {
        reportedVisitorsByTarget[targetKey] = [];
      }
      if (
        reportedVisitorsByTarget[targetKey].indexOf(actorPlayerId) === -1
      ) {
        reportedVisitorsByTarget[targetKey].push(actorPlayerId);
      }

      if (action.actionName === "FRAME") {
        const disguisePlayerId = action.disguisePlayerId || 0;

        if (disguisePlayerId > 0) {
          framerDisguiseMap[actorKey] = disguisePlayerId;
          const disguiseKey = disguisePlayerId.toString();
          if (!reportedDestinationsByActor[disguiseKey]) {
            reportedDestinationsByActor[disguiseKey] = [];
          }
          if (
            reportedDestinationsByActor[disguiseKey].indexOf(
              targetPlayerId,
            ) === -1
          ) {
            reportedDestinationsByActor[disguiseKey].push(targetPlayerId);
          }
          if (
            reportedVisitorsByTarget[targetKey].indexOf(disguisePlayerId) ===
            -1
          ) {
            reportedVisitorsByTarget[targetKey].push(disguisePlayerId);
          }
        }
      }
    }
    return {
      framerDisguiseMap: framerDisguiseMap,
      reportedDestinationsByActor: reportedDestinationsByActor,
      reportedVisitorsByTarget: reportedVisitorsByTarget,
    };
  }

  resolveTricksterElimination(
    successfulActionMap: any,
    caseTargetMap: any,
    aliveMap: any,
  ): number {
    const actorIds = Object.keys(successfulActionMap);

    for (let i = 0; i < actorIds.length; i++) {
      const actorKey = actorIds[i];
      const action = successfulActionMap[actorKey];
      if (action.actionName !== "ELIMINATE") continue;
      if (!caseTargetMap[action.targetPlayerId.toString()]) continue;
      if (aliveMap[action.targetPlayerId.toString()] !== true) continue;
      return action.targetPlayerId;
    }

    return 0;
  }

  resolveSuccessfulCases(
    successfulActionMap: any,
    roleMap: any,
    caseTargetMap: any,
  ) {
    const resolvedCaseTargetMap = this.cloneMap(caseTargetMap);
    const actorIds = Object.keys(successfulActionMap);

    for (let i = 0; i < actorIds.length; i++) {
      const actorKey = actorIds[i];
      const action = successfulActionMap[actorKey];
      if (action.actionName !== "CASE") continue;
      const targetKey = action.targetPlayerId.toString();
      if (!roleMap[targetKey]) continue;
      // Match the Detective's persistent knowledge-map pattern: publish a
      // fresh targetPlayerId -> revealed role MAP after night resolution.
      resolvedCaseTargetMap[targetKey] = roleMap[targetKey];
      console.log(
        "[case-knowledge] host committed CASE target=" +
          targetKey +
          " role=" +
          roleMap[targetKey],
      );
    }
    return resolvedCaseTargetMap;
  }

  buildNightResultMap(
    nightNumber: number,
    actionPhaseNonce: number,
    previousResultMap: any,
    roleMap: any,
    aliveMapAfterResolution: any,
    validActionMap: any,
    successfulActionMap: any,
    blockedReasonMap: any,
    framerDisguiseMap: any,
    reportedDestinationsByActor: any,
    reportedVisitorsByTarget: any,
    guardedVisitorCountMap: any,
    eliminatedPlayerId: number,
  ) {
    // Retain previous children and update current players in-band. Each result
    // is serialized into one atomic MAP child value so clients cannot observe
    // a fresh night/nonce object shell before its action/detail fields hydrate.
    // Freshness is still carried by the night number and action-phase nonce.
    const resultMap: any = this.cloneMap(previousResultMap);
    const playerIds = Object.keys(roleMap);

    for (let i = 0; i < playerIds.length; i++) {
      const playerKey = playerIds[i];
      const playerId = parseInt(playerKey, 10);
      const roleName = roleMap[playerKey];
      const action = validActionMap[playerKey];
      let actionText = action
        ? this.getActionText(action, false)
        : "You did not choose a night action.";
      let detailText = "";
      let status = "NO_ACTION";

      if (action && blockedReasonMap[playerKey] === "DISTRACTED") {
        detailText = "You were distracted. Your action never happened.";
        status = "BLOCKED";
      } else if (action && blockedReasonMap[playerKey] === "SLEEPY") {
        detailText = "You became too sleepy. Your action never happened.";
        status = "BLOCKED";
      } else if (action && blockedReasonMap[playerKey] === "GUARDED") {
        detailText = "A Guard stopped your visit. Your action never happened.";
        status = "BLOCKED";
      } else if (action && successfulActionMap[playerKey]) {
        status = "SUCCESS";
        actionText = this.getActionText(action, true);
        detailText = this.getSuccessfulActionResultText(
          playerId,
          roleName,
          action,
          roleMap,
          framerDisguiseMap,
          reportedDestinationsByActor,
          reportedVisitorsByTarget,
          guardedVisitorCountMap,
          blockedReasonMap,
          eliminatedPlayerId,
        );
      }

      if (
        playerId === eliminatedPlayerId &&
        (roleName === "DETECTIVE" || roleName === "WATCHER")
      ) {
        detailText = "You were Eliminated before receiving any information.";
        status = "ELIMINATED";
      }

      let summaryText = actionText;
      if (detailText) summaryText += " " + detailText;

      const playerResult = {
        nightNumber: nightNumber,
        actionPhaseNonce: actionPhaseNonce,
        actionName: action ? action.actionName : "",
        targetPlayerId: action ? action.targetPlayerId : 0,
        revealedRole:
          status === "SUCCESS" && action && action.actionName === "CASE"
            ? roleMap[action.targetPlayerId.toString()] || ""
            : "",
        status: status,
        actionText: actionText,
        detailText: detailText,
        summaryText: summaryText,
        isAlive: aliveMapAfterResolution[playerKey] === true,
      };
      resultMap[playerKey] = JSON.stringify(playerResult);
    }

    return resultMap;
  }

  getActionText(action: any, wasSuccessful: boolean): string {
    if (!action) return "You did not choose a night action.";

    const targetName = this.getPlayerName(action.targetPlayerId);
    const prefix = wasSuccessful ? "You " : "You tried to ";

    if (action.actionName === "INVESTIGATE") {
      return prefix + "investigate" + (wasSuccessful ? "d " : " ") + targetName + ".";
    }
    if (action.actionName === "WATCH") {
      return prefix + "watch" + (wasSuccessful ? "ed " : " ") + targetName + ".";
    }
    if (action.actionName === "CASE") {
      return prefix + "case" + (wasSuccessful ? "d " : " ") + targetName + ".";
    }
    if (action.actionName === "ELIMINATE") {
      return wasSuccessful
        ? "You eliminated " + targetName + "."
        : "You tried to eliminate " + targetName + ".";
    }
    if (action.actionName === "GUARD") {
      return prefix + "guard" + (wasSuccessful ? "ed " : " ") + targetName + ".";
    }
    if (action.actionName === "DISTRACT") {
      return prefix + "distract" + (wasSuccessful ? "ed " : " ") + targetName + ".";
    }
    if (action.actionName === "FRAME") {
      return prefix + "visit" + (wasSuccessful ? "ed " : " ") + targetName + ".";
    }
    if (action.actionName === "SLEEP") {
      return prefix + "visit" + (wasSuccessful ? "ed " : " ") + targetName + ".";
    }
    if (action.actionName === "VISIT") {
      return prefix + "visit" + (wasSuccessful ? "ed " : " ") + targetName + ".";
    }

    return wasSuccessful
      ? "Your night action succeeded."
      : "You tried to perform your night action.";
  }

  getSuccessfulActionResultText(
    actorPlayerId: number,
    roleName: string,
    action: any,
    roleMap: any,
    framerDisguiseMap: any,
    destinationsByActor: any,
    visitorsByTarget: any,
    guardedVisitorCountMap: any,
    blockedReasonMap: any,
    eliminatedPlayerId: number,
  ): string {
    const targetPlayerId = action.targetPlayerId;
    const targetName = this.getPlayerName(targetPlayerId);

    if (action.actionName === "INVESTIGATE") {
      const destinations = destinationsByActor[targetPlayerId.toString()] || [];
      if (destinations.length === 0) {
        return "You discovered " + targetName + " visited no one.";
      }
      return (
        "You discovered " +
        targetName +
        " visited " +
        this.joinPlayerNames(destinations) +
        "."
      );
    }

    if (action.actionName === "WATCH") {
      const reportedVisitors = visitorsByTarget[targetPlayerId.toString()] || [];
      const visibleVisitors: number[] = [];

      for (let i = 0; i < reportedVisitors.length; i++) {
        if (reportedVisitors[i] !== actorPlayerId) {
          visibleVisitors.push(reportedVisitors[i]);
        }
      }

      if (visibleVisitors.length === 0) {
        return "You witnessed no one visit " + targetName + ".";
      }
      return (
        "You witnessed " +
        targetName +
        " was visited by " +
        this.joinPlayerNames(visibleVisitors) +
        "."
      );
    }

    if (action.actionName === "CASE") {
      return (
        "You discovered they are the " +
        roleMap[targetPlayerId.toString()] +
        ". You now have the option to eliminate this player in future nights."
      );
    }

    if (action.actionName === "ELIMINATE") {
      if (eliminatedPlayerId === targetPlayerId) {
        return "The elimination succeeded.";
      }
      return "Your elimination did not succeed.";
    }

    if (action.actionName === "GUARD") {
      const visitorCount = guardedVisitorCountMap[targetPlayerId.toString()] || 0;
      return (
        "You protected them against " +
        visitorCount.toString() +
        (visitorCount === 1 ? " visitor." : " visitors.")
      );
    }

    if (action.actionName === "DISTRACT") {
      return "Their action was stopped.";
    }

    if (action.actionName === "FRAME") {
      const disguisePlayerId = framerDisguiseMap[actorPlayerId.toString()] || 0;
      if (disguisePlayerId > 0) {
        return (
          "You were disguised as " +
          this.getPlayerName(disguisePlayerId) +
          ". Both identities appeared to visit."
        );
      }
      return "You had no available disguise.";
    }

    if (action.actionName === "SLEEP") {
      if (
        blockedReasonMap[targetPlayerId.toString()] ===
        "SLEEPY_AFTER_ACTION"
      ) {
        return (
          "You tried to make " +
          targetName +
          " sleepy, but their higher-priority action already happened."
        );
      }
      return (
        "You made them sleepy for the night. Their action was stopped."
      );
    }

    if (action.actionName === "VISIT") {
      return "Your visit had no additional effect.";
    }

    return roleName + " action completed.";
  }

  joinPlayerNames(playerIds: number[]): string {
    let text = "";

    for (let i = 0; i < playerIds.length; i++) {
      if (i > 0 && i === playerIds.length - 1) {
        text += " and ";
      } else if (i > 0) {
        text += ", ";
      }
      text += this.getPlayerName(playerIds[i]);
    }

    return text;
  }

  getPlayerName(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (playerDetails && playerDetails.username) return playerDetails.username;
    return "Player " + playerId.toString();
  }

  ensureRoleManager() {
    if (!this.roleManagerSystem) {
      this.roleManagerSystem = scriptManager.getSystem({
        systemName: "roleManager",
      });
    }
    return this.roleManagerSystem;
  }

  debugGetGlobalMap(variableName: string, sourceLocation: string) {
    const value = stateManager.getVariable(variableName);
    const keys = value ? Object.keys(value) : [];
    const undefinedChildKeys: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      if (value[keys[i]] === undefined) undefinedChildKeys.push(keys[i]);
    }
    console.log(
      "[sync-debug][" +
        sourceLocation +
        "][HOST] stateManager READ " +
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

  cloneMap(sourceMap: any) {
    const clonedMap: any = {};
    if (!sourceMap) return clonedMap;

    const keys = Object.keys(sourceMap);
    for (let i = 0; i < keys.length; i++) {
      clonedMap[keys[i]] = sourceMap[keys[i]];
    }
    return clonedMap;
  }
}
