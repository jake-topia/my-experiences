class trialManager extends SystemScript {
  arenaManagerSystem: any;
  gameManagerSystem: any;
  winConditionManagerSystem: any;

  onInit() {
    if (!playerManager.isHost) return;
    this.ensureSystems();
  }

  onEvent_playerChoosesTrialNominee({
    fromPlayerId,
    targetPlayerId,
    phaseNonce,
  }: {
    fromPlayerId: number;
    targetPlayerId: number;
    phaseNonce: number;
  }) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "TRIAL_NOMINATION") return;
    if (stateManager.getVariable("phaseNonce") !== phaseNonce) return;
    if (!this.isAliveRoundPlayer(fromPlayerId)) return;
    if (!this.isAliveRoundPlayer(targetPlayerId)) return;
    if (fromPlayerId === targetPlayerId) return;

    const nominationMap = this.cloneMap(
      stateManager.getVariable("trialNominationVoteMap"),
    );
    nominationMap[fromPlayerId.toString()] = targetPlayerId;
    stateManager.setVariable("trialNominationVoteMap", nominationMap);
  }

  onEvent_playerChoosesTrialVerdict({
    fromPlayerId,
    verdict,
    phaseNonce,
  }: {
    fromPlayerId: number;
    verdict: string;
    phaseNonce: number;
  }) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "TRIAL_VERDICT") return;
    if (stateManager.getVariable("phaseNonce") !== phaseNonce) return;
    if (!this.isAliveRoundPlayer(fromPlayerId)) return;
    if (stateManager.getVariable("trialAccusedPlayerId") === fromPlayerId) return;
    if (verdict !== "NEW_ACCUSED" && verdict !== "GUILTY") return;

    const verdictMap = this.cloneMap(
      stateManager.getVariable("trialVerdictVoteMap"),
    );
    verdictMap[fromPlayerId.toString()] = verdict;
    stateManager.setVariable("trialVerdictVoteMap", verdictMap);
  }

  beginNomination(messageText?: string) {
    if (!playerManager.isHost) return;
    this.ensureSystems();

    const previousAccusedPlayerId = stateManager.getVariable(
      "trialAccusedPlayerId",
    );
    if (previousAccusedPlayerId > 0) {
      this.arenaManagerSystem.teleportPlayerToSeat(previousAccusedPlayerId);
    }

    stateManager.setVariable("trialAccusedPlayerId", 0);
    stateManager.setVariable("trialNominationVoteMap", {});
    stateManager.setVariable("trialVerdictVoteMap", {});
    stateManager.setVariable("endReasonText", messageText || "");
    this.gameManagerSystem.setPhase(
      "TRIAL_NOMINATION",
      stateManager.getVariable("configuredVotingSeconds") * 1000,
    );
  }

  resolveNomination() {
    if (!playerManager.isHost) return;
    this.ensureSystems();

    const alivePlayerIds = this.getAlivePlayerIds();
    const nominationMap = stateManager.getVariable("trialNominationVoteMap");
    const accusedPlayerId = this.chooseUniqueTopTarget(
      nominationMap,
      alivePlayerIds,
      alivePlayerIds,
    );

    if (accusedPlayerId <= 0) {
      this.beginNomination(
        "The town could not agree on an accused player. Nominate again.",
      );
      return;
    }

    stateManager.setVariable("trialAccusedPlayerId", accusedPlayerId);
    stateManager.setVariable("trialVerdictVoteMap", {});
    stateManager.setVariable("endReasonText", "");
    this.arenaManagerSystem.teleportPlayerToTrialCenter(accusedPlayerId);
    this.gameManagerSystem.setPhase(
      "TRIAL_DEFENSE",
      stateManager.getVariable("configuredDiscussionSeconds") * 1000,
    );
  }

  beginVerdict() {
    if (!playerManager.isHost) return;
    this.ensureSystems();

    if (!this.isAliveRoundPlayer(stateManager.getVariable("trialAccusedPlayerId"))) {
      this.beginNomination("The accused player left. Nominate someone else.");
      return;
    }

    stateManager.setVariable("trialVerdictVoteMap", {});
    this.gameManagerSystem.setPhase(
      "TRIAL_VERDICT",
      stateManager.getVariable("configuredVotingSeconds") * 1000,
    );
  }

  resolveVerdict() {
    if (!playerManager.isHost) return;
    this.ensureSystems();

    const accusedPlayerId = stateManager.getVariable("trialAccusedPlayerId");
    if (!this.isAliveRoundPlayer(accusedPlayerId)) {
      this.beginNomination("The accused player left. Nominate someone else.");
      return;
    }

    const verdictMap = stateManager.getVariable("trialVerdictVoteMap") || {};
    const voterIds = this.getAlivePlayerIds();
    let guiltyVotes = 0;
    let newAccusedVotes = 0;

    for (let i = 0; i < voterIds.length; i++) {
      if (voterIds[i] === accusedPlayerId) continue;

      const verdict = verdictMap[voterIds[i].toString()];
      if (verdict === "GUILTY") guiltyVotes += 1;
      if (verdict === "NEW_ACCUSED") newAccusedVotes += 1;
    }

    if (guiltyVotes > newAccusedVotes && guiltyVotes > 0) {
      this.convictAccused(accusedPlayerId);
      return;
    }

    this.beginNomination(
      "The town chose to put someone else on trial.",
    );
  }

  handleAccusedPlayerLeft(playerId: number) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("trialAccusedPlayerId") !== playerId) return;

    const phase = stateManager.getVariable("gamePhase");
    if (phase !== "TRIAL_DEFENSE" && phase !== "TRIAL_VERDICT") return;
    this.beginNomination("The accused player left. Nominate someone else.");
  }

  convictAccused(accusedPlayerId: number) {
    const aliveMap = this.cloneMap(
      stateManager.getVariable("playerAliveMap"),
    );
    const deathInfoMap = this.cloneMap(
      stateManager.getVariable("playerDeathInfoMap"),
    );
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "trialManager.resolveVerdict",
      ) || {};
    const accusedRole = roleMap[accusedPlayerId.toString()] || "";
    const winningTeam = this.winConditionManagerSystem.getTrialWinningTeam(
      accusedPlayerId,
    );

    aliveMap[accusedPlayerId.toString()] = false;
    deathInfoMap[accusedPlayerId.toString()] = {
      roundNumber: stateManager.getVariable("roundNumber"),
      cause: "CONVICTED",
      eliminatingTeam: "TOWNSFOLK",
    };

    stateManager.setVariable("playerAliveMap", aliveMap);
    stateManager.setVariable("playerDeathInfoMap", deathInfoMap);
    stateManager.setVariable("lastExiledPlayerId", accusedPlayerId);

    if (accusedRole === "JOKER") {
      stateManager.setVariable("jokerWinnerPlayerId", accusedPlayerId);
    }

    this.gameManagerSystem.beginEndPhase(
      winningTeam,
      false,
      this.getPlayerName(accusedPlayerId) +
        " was convicted. Their role was " +
        accusedRole +
        ".",
    );
  }

  chooseUniqueTopTarget(
    voteMap: any,
    validVoterIds: number[],
    validTargetIds: number[],
  ): number {
    const countMap: any = {};
    const targetLookup: any = {};

    for (let i = 0; i < validTargetIds.length; i++) {
      targetLookup[validTargetIds[i].toString()] = true;
    }

    for (let i = 0; i < validVoterIds.length; i++) {
      const voterId = validVoterIds[i];
      const targetPlayerId = voteMap ? voteMap[voterId.toString()] : 0;
      if (!targetPlayerId || targetPlayerId === voterId) continue;
      if (!targetLookup[targetPlayerId.toString()]) continue;

      if (!countMap[targetPlayerId.toString()]) {
        countMap[targetPlayerId.toString()] = 0;
      }
      countMap[targetPlayerId.toString()] += 1;
    }

    const targetIds = Object.keys(countMap);
    let highestCount = 0;
    let highestTargetId = 0;
    let highestTargetCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const voteCount = countMap[targetIds[i]];
      if (voteCount > highestCount) {
        highestCount = voteCount;
        highestTargetId = parseInt(targetIds[i], 10);
        highestTargetCount = 1;
      } else if (voteCount === highestCount) {
        highestTargetCount += 1;
      }
    }

    if (highestTargetCount !== 1) return 0;
    return highestTargetId;
  }

  getAlivePlayerIds(): number[] {
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "trialManager.getAlivePlayerIds",
      ) || {};
    const aliveMap = stateManager.getVariable("playerAliveMap") || {};
    const playerIds = Object.keys(roleMap);
    const alivePlayerIds: number[] = [];

    for (let i = 0; i < playerIds.length; i++) {
      if (aliveMap[playerIds[i]] === true) {
        alivePlayerIds.push(parseInt(playerIds[i], 10));
      }
    }
    return alivePlayerIds;
  }

  isAliveRoundPlayer(playerId: number): boolean {
    if (!playerId || playerId <= 0) return false;
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "trialManager.isAliveRoundPlayer",
      ) || {};
    const aliveMap = stateManager.getVariable("playerAliveMap") || {};
    return (
      !!roleMap[playerId.toString()] &&
      aliveMap[playerId.toString()] === true
    );
  }

  getPlayerName(playerId: number): string {
    const details = playerManager.getPlayerDetails(playerId);
    if (details && details.username) return details.username;
    return "Player " + playerId.toString();
  }

  ensureSystems() {
    if (!this.arenaManagerSystem) {
      this.arenaManagerSystem = scriptManager.getSystem({
        systemName: "arenaManager",
      });
    }
    if (!this.gameManagerSystem) {
      this.gameManagerSystem = scriptManager.getSystem({
        systemName: "gameManager",
      });
    }
    if (!this.winConditionManagerSystem) {
      this.winConditionManagerSystem = scriptManager.getSystem({
        systemName: "winConditionManager",
      });
    }
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
