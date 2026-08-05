class nightActionManager extends SystemScript {
  roleManagerSystem: any;

  onInit() {
    if (!playerManager.isHost) return;
    this.ensureRoleManager();
  }

  onEvent_playerSubmitsNightAction({
    fromPlayerId,
    actionName: requestedActionName,
    targetPlayerId,
    phaseNonce,
  }: {
    fromPlayerId: number;
    actionName: string;
    targetPlayerId: number;
    phaseNonce: number;
  }) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "NIGHT") return;
    if (stateManager.getVariable("phaseNonce") !== phaseNonce) return;

    const roleMap = this.debugGetGlobalMap(
      "playerRoleMap",
      "nightActionManager.onEvent_playerSubmitsNightAction",
    );
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const tricksterCaseTargetMap = stateManager.getVariable(
      "tricksterCaseTargetMap",
    );
    const actionName = this.ensureRoleManager().getNightActionName(
      fromPlayerId,
      roleMap,
      tricksterCaseTargetMap,
      requestedActionName,
    );

    if (
      !this.ensureRoleManager().isValidNightTarget(
        fromPlayerId,
        targetPlayerId,
        actionName,
        roleMap,
        aliveMap,
        tricksterCaseTargetMap,
      )
    ) {
      return;
    }

    const nightActionMap = this.cloneMap(
      stateManager.getVariable("nightActionMap"),
    );

    if (actionName === "FRAME") {
      const actorKey = fromPlayerId.toString();
      const existingAction = nightActionMap[actorKey];
      const hasPartialSelection =
        existingAction &&
        existingAction.actionName === "FRAME" &&
        existingAction.phaseNonce === phaseNonce &&
        existingAction.disguisePlayerId > 0 &&
        !(existingAction.targetPlayerId > 0);

      if (hasPartialSelection) {
        if (existingAction.disguisePlayerId === targetPlayerId) return;
        nightActionMap[actorKey] = {
          actionName: actionName,
          disguisePlayerId: existingAction.disguisePlayerId,
          targetPlayerId: targetPlayerId,
          phaseNonce: phaseNonce,
        };
      } else {
        nightActionMap[actorKey] = {
          actionName: actionName,
          disguisePlayerId: targetPlayerId,
          targetPlayerId: 0,
          phaseNonce: phaseNonce,
        };
      }

      stateManager.setVariable("nightActionMap", nightActionMap);
      return;
    }

    nightActionMap[fromPlayerId.toString()] = {
      actionName: actionName,
      targetPlayerId: targetPlayerId,
      phaseNonce: phaseNonce,
    };
    stateManager.setVariable("nightActionMap", nightActionMap);
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
