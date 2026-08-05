class winConditionManager extends SystemScript {
  roleManagerSystem: any;

  onInit() {
    if (!playerManager.isHost) return;
    this.ensureRoleManager();
  }

  getTrialWinningTeam(convictedPlayerId: number): string {
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "winConditionManager.getTrialWinningTeam",
      ) || {};
    const convictedRole = roleMap[convictedPlayerId.toString()] || "";

    if (this.ensureRoleManager().isTricksterTeamRole(convictedRole)) {
      return "TOWNSFOLK";
    }

    return "TRICKSTERS";
  }

  getEarlyWinningTeam(): string {
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "winConditionManager.getEarlyWinningTeam",
      ) || {};
    const aliveMap = stateManager.getVariable("playerAliveMap") || {};
    const playerIds = Object.keys(roleMap);
    let aliveTricksterTeamCount = 0;
    let aliveTownsfolkCount = 0;

    for (let i = 0; i < playerIds.length; i++) {
      if (aliveMap[playerIds[i]] !== true) continue;

      const teamName = this.ensureRoleManager().getTeamForRole(
        roleMap[playerIds[i]],
      );
      if (teamName === "TRICKSTERS") aliveTricksterTeamCount += 1;
      if (teamName === "TOWNSFOLK") aliveTownsfolkCount += 1;
    }

    if (aliveTricksterTeamCount === 0) return "TOWNSFOLK";
    if (aliveTownsfolkCount === 0) return "TRICKSTERS";
    return "";
  }

  getNoEliminationWinningTeam(
    completedNightNumber: number,
    eliminatedPlayerId: number,
  ): string {
    if (completedNightNumber >= 3 && eliminatedPlayerId <= 0) {
      return "TOWNSFOLK";
    }
    return "";
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
}
