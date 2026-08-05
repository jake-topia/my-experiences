class gameManager extends SystemScript {
  arenaManagerSystem: any;
  roleManagerSystem: any;
  nightResolutionManagerSystem: any;
  trialManagerSystem: any;
  winConditionManagerSystem: any;
  minimumPlayersToStart: number;
  fourPlayerDevStartEnabled: boolean;
  endDurationMs: number;
  discussionOptions: number[];
  votingOptions: number[];
  nightOptions: number[];
  nightBufferDurationMs: number;
  nightResultSyncDurationMs: number;
  nightResultsPublished: boolean;
  nightResultsRepublished: boolean;
  nightResultsPublishDeadlineMs: number;
  gameSetupPublished: boolean;
  gameSetupRepublished: boolean;
  gameSetupPublishDeadlineMs: number;
  eliminatedTintColor: string;
  spectatorTintColor: string;
  accusedTintColor: string;

  onInit() {
    if (!playerManager.isHost) return;

    this.minimumPlayersToStart = 5;
    this.fourPlayerDevStartEnabled = false;
    this.endDurationMs = 10000;
    this.discussionOptions = [60, 90, 120, 150];
    this.votingOptions = [15, 30, 45, 60];
    this.nightOptions = [15, 30, 45, 60];
    this.nightBufferDurationMs = 2000;
    this.nightResultSyncDurationMs = 1000;
    this.nightResultsPublished = false;
    this.nightResultsRepublished = false;
    this.nightResultsPublishDeadlineMs = 0;
    this.gameSetupPublished = false;
    this.gameSetupRepublished = false;
    this.gameSetupPublishDeadlineMs = 0;
    this.eliminatedTintColor = "#b53f3f";
    this.spectatorTintColor = "#777777";
    this.accusedTintColor = "#f0d04f";

    this.ensureSystems();
    this.syncStateVisualsFromVariables();
  }

  onHostStart() {
    if (!playerManager.isHost) return;
    this.ensureSystems();
    this.syncStateVisualsFromVariables();
  }

  onPhysicsStep() {
    if (!playerManager.isHost) return;
    const phase = stateManager.getVariable("gamePhase");
    if (phase === "WAITING" && this.gameSetupPublished) {
      this.advanceGameSetupPublish();
      return;
    }
    if (phase === "NIGHT") {
      const missingPlayerIds = this.getMissingNightActionPlayerIds();
      this.syncNightWaitingSprite(missingPlayerIds);
      if (missingPlayerIds.length === 0) {
        this.beginNightBuffer();
        return;
      }
    } else if (phase === "NIGHT_BUFFER") {
      // resolveNight clears nightActionMap after publishing its results. Once
      // that publish has happened, do not mistake the intentionally empty map
      // for disconnected/missing selections and reopen the night.
      if (!this.nightResultsPublished) {
        const missingPlayerIds = this.getMissingNightActionPlayerIds();
        if (missingPlayerIds.length > 0) {
          this.resumeNightSelectionFromBuffer();
          return;
        }
      }
      this.arenaManagerSystem.setSyncedNightWaitingText("");
    } else {
      this.arenaManagerSystem.setSyncedNightWaitingText("");
    }
    this.syncPhaseClockFromVariables();
  }

  onPlayerJoined({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;
    this.ensureSystems();

    if (stateManager.getVariable("gamePhase") === "WAITING") {
      if (this.gameSetupPublished) this.cancelPendingGameSetup();
      this.normalizeLobbySettings();
      this.arenaManagerSystem.teleportPlayersToWaitingArea([playerId]);
      this.applyPlayerTints();
      return;
    }

    this.arenaManagerSystem.teleportPlayersToSpectatorArea([playerId]);
    playerManager.tintPlayer(playerId, this.spectatorTintColor);
  }

  onPlayerLeft({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;
    this.ensureSystems();
    this.arenaManagerSystem.teleportPlayerToOrigin(playerId);
    const phase = stateManager.getVariable("gamePhase");

    if (phase === "WAITING") {
      if (this.gameSetupPublished) this.cancelPendingGameSetup();
      this.normalizeLobbySettings();
      this.applyPlayerTints();
      return;
    }

    this.removePlayerFromRoundState(playerId);
    this.trialManagerSystem.handleAccusedPlayerLeft(playerId);
    this.applyPlayerTints();

    if (phase === "END" || phase === "END_EARLY") return;

    const winningTeam = this.winConditionManagerSystem.getEarlyWinningTeam();
    if (winningTeam !== "") {
      this.beginEndPhase(
        winningTeam,
        true,
        "Too many players left, ending the game early...",
      );
      return;
    }

    this.advanceRoleRevealIfComplete();
  }

  onEvent_hostStartsGame({ fromPlayerId }: { fromPlayerId: number }) {
    if (!playerManager.isHost) return;
    if (!this.isCurrentHostPlayer(fromPlayerId)) return;
    if (stateManager.getVariable("gamePhase") !== "WAITING") return;
    if (this.gameSetupPublished) return;
    this.startGame();
  }

  onEvent_hostCyclesLobbySetting({
    fromPlayerId,
    settingKey,
  }: {
    fromPlayerId: number;
    settingKey: string;
  }) {
    if (!playerManager.isHost) return;
    if (!this.isCurrentHostPlayer(fromPlayerId)) return;
    if (stateManager.getVariable("gamePhase") !== "WAITING") return;

    if (settingKey === "discussion") {
      stateManager.setVariable(
        "configuredDiscussionSeconds",
        this.cycleNumberOption(
          stateManager.getVariable("configuredDiscussionSeconds"),
          this.discussionOptions,
        ),
      );
      return;
    }

    if (settingKey === "voting") {
      stateManager.setVariable(
        "configuredVotingSeconds",
        this.cycleNumberOption(
          stateManager.getVariable("configuredVotingSeconds"),
          this.votingOptions,
        ),
      );
      return;
    }

    if (settingKey === "night") {
      stateManager.setVariable(
        "configuredNightSeconds",
        this.cycleNumberOption(
          stateManager.getVariable("configuredNightSeconds"),
          this.nightOptions,
        ),
      );
      return;
    }

    if (settingKey === "dev") {
      stateManager.setVariable("configuredDiscussionSeconds", 5);
      stateManager.setVariable("configuredVotingSeconds", 5);
      stateManager.setVariable("configuredNightSeconds", 5);
      return;
    }

    if (settingKey === "fourPlayerDev") {
      this.fourPlayerDevStartEnabled = !this.fourPlayerDevStartEnabled;
    }
  }

  onEvent_playerAcknowledgesRole({
    fromPlayerId,
  }: {
    fromPlayerId: number;
  }) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "REVEAL") return;

    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "gameManager.onEvent_playerAcknowledgesRole",
      ) || {};
    const playerIdKey = fromPlayerId.toString();
    if (!roleMap[playerIdKey]) return;

    const acknowledgementMap = this.cloneMap(
      stateManager.getVariable("roleRevealAcknowledgementMap"),
    );
    acknowledgementMap[playerIdKey] = true;
    stateManager.setVariable("roleRevealAcknowledgementMap", acknowledgementMap);
    this.advanceRoleRevealIfComplete(acknowledgementMap);
  }

  onEvent_resetGame() {
    if (!playerManager.isHost) return;
    this.resetToWaitingState();
  }

  startGame() {
    this.ensureSystems();
    this.normalizeLobbySettings();

    const playerIds = playerManager.getPlayerIds();
    const isFourPlayerDevStart =
      playerIds.length === 4 && this.fourPlayerDevStartEnabled === true;
    if (
      playerIds.length < this.minimumPlayersToStart &&
      !isFourPlayerDevStart
    ) {
      return;
    }

    const seatMap = this.arenaManagerSystem.computeSeatMapForPlayerIds(playerIds);
    const roleMap = this.roleManagerSystem.assignRoles(playerIds);
    console.log(
      "[sync-debug][gameManager.startGame][HOST] GENERATED playerSeatMap keys=[" +
        Object.keys(seatMap).join(",") +
        "] value=",
      seatMap,
    );
    console.log(
      "[sync-debug][gameManager.startGame][HOST] GENERATED playerRoleMap keys=[" +
        Object.keys(roleMap).join(",") +
        "] value=",
      roleMap,
    );
    const aliveMap: any = {};
    const acknowledgementMap = this.cloneMap(
      stateManager.getVariable("roleRevealAcknowledgementMap"),
    );
    const caseTargetMap = this.cloneMap(
      stateManager.getVariable("tricksterCaseTargetMap"),
    );

    for (let i = 0; i < playerIds.length; i++) {
      const playerIdKey = playerIds[i].toString();
      aliveMap[playerIdKey] = true;
      // Retain historical MAP children and reset current players in-band.
      // Deleting acknowledgement children can arrive on clients as an
      // out-of-band removal instead of a usable MAP newValue callback.
      acknowledgementMap[playerIdKey] = false;
      // Reset current-round knowledge by updating retained MAP children. An
      // empty role is not considered cased by either action or UI logic.
      caseTargetMap[playerIdKey] = "";
    }

    stateManager.setVariable("playerSeatMap", seatMap);
    stateManager.setVariable("playerRoleMap", roleMap);
    stateManager.setVariable("playerAliveMap", aliveMap);
    stateManager.setVariable("playerDeathInfoMap", {});
    stateManager.setVariable(
      "roleRevealAcknowledgementMap",
      acknowledgementMap,
    );
    stateManager.setVariable("nightActionMap", {});
    // Keep night-result MAP children allocated. Each entry carries its own
    // night/nonce, so clients can reject prior-game results without relying on
    // child deletion callbacks that the Engine may report as out of band.
    // Persistent targetPlayerId -> role knowledge shared by the Trickster team.
    stateManager.setVariable("tricksterCaseTargetMap", caseTargetMap);
    stateManager.setVariable("sleepyPlayerMap", {});
    stateManager.setVariable("trialNominationVoteMap", {});
    stateManager.setVariable("trialVerdictVoteMap", {});
    stateManager.setVariable("trialAccusedPlayerId", 0);
    stateManager.setVariable("jokerWinnerPlayerId", 0);
    stateManager.setVariable("lastNightEliminatedPlayerId", 0);
    stateManager.setVariable("lastExiledPlayerId", 0);
    stateManager.setVariable("winningTeam", "");
    stateManager.setVariable("endReasonText", "");
    stateManager.setVariable("roundNumber", 1);

    // Old variables remain reset while the migrated scripts no longer use them.
    stateManager.setVariable("nightTargetMap", {});
    stateManager.setVariable("dayVoteTargetMap", {});
    stateManager.setVariable("detectivePlayerRoleRevealedMap", {});
    stateManager.setVariable("lastInvestigatedPlayerId", 0);
    stateManager.setVariable("savedPlayerId", 0);

    this.arenaManagerSystem.rebuildSeatBlockersFromSeatMap(seatMap);
    this.arenaManagerSystem.teleportPlayersToSeats(seatMap);
    this.applyPlayerTints();
    this.gameSetupPublished = true;
    this.gameSetupRepublished = false;
    this.gameSetupPublishDeadlineMs =
      this.getNowMs() + this.nightResultSyncDurationMs;
    console.log(
      "[game-setup] roles and seats published; waiting before stable republish",
    );
  }

  advanceGameSetupPublish() {
    if (!this.gameSetupPublished) return;
    if (!(this.gameSetupPublishDeadlineMs > 0)) return;
    if (this.getNowMs() < this.gameSetupPublishDeadlineMs) return;

    if (!this.gameSetupRepublished) {
      stateManager.setVariable(
        "playerSeatMap",
        this.cloneMap(
          this.debugGetGlobalMap(
            "playerSeatMap",
            "gameManager.advanceGameSetupPublish -> stable republish",
          ),
        ),
      );
      stateManager.setVariable(
        "playerRoleMap",
        this.cloneMap(
          this.debugGetGlobalMap(
            "playerRoleMap",
            "gameManager.advanceGameSetupPublish -> stable republish",
          ),
        ),
      );
      stateManager.setVariable(
        "playerAliveMap",
        this.cloneMap(stateManager.getVariable("playerAliveMap")),
      );
      this.gameSetupRepublished = true;
      this.gameSetupPublishDeadlineMs =
        this.getNowMs() + this.nightResultSyncDurationMs;
      console.log(
        "[game-setup] republished stable roles and seats; waiting before REVEAL",
      );
      return;
    }

    // Keep gameSetupPublished latched until the phase write is visible so a
    // delayed WAITING read cannot start a second setup.
    this.gameSetupPublishDeadlineMs = 0;
    this.setPhase("REVEAL", 0);
  }

  cancelPendingGameSetup() {
    if (!this.gameSetupPublished) return;
    this.gameSetupPublished = false;
    this.gameSetupRepublished = false;
    this.gameSetupPublishDeadlineMs = 0;
    this.resetToWaitingState();
  }

  advanceRoleRevealIfComplete(acknowledgementMapOverride?: any) {
    if (stateManager.getVariable("gamePhase") !== "REVEAL") return;

    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "gameManager.advanceRoleRevealIfComplete",
      ) || {};
    const acknowledgementMap =
      acknowledgementMapOverride ||
      stateManager.getVariable("roleRevealAcknowledgementMap") ||
      {};
    const playerIds = Object.keys(roleMap);
    if (playerIds.length === 0) return;

    for (let i = 0; i < playerIds.length; i++) {
      if (acknowledgementMap[playerIds[i]] !== true) return;
    }

    this.beginNight();
  }

  beginNight() {
    this.ensureSystems();
    this.nightResultsPublished = false;
    this.nightResultsRepublished = false;
    this.nightResultsPublishDeadlineMs = 0;
    stateManager.setVariable("nightActionMap", {});
    this.arenaManagerSystem.setSyncedNightWaitingText("");
    stateManager.setVariable("lastNightEliminatedPlayerId", 0);
    stateManager.setVariable("lastExiledPlayerId", 0);
    stateManager.setVariable("trialAccusedPlayerId", 0);
    stateManager.setVariable("trialNominationVoteMap", {});
    stateManager.setVariable("trialVerdictVoteMap", {});
    stateManager.setVariable("endReasonText", "");
    this.setPhase(
      "NIGHT",
      stateManager.getVariable("configuredNightSeconds") * 1000,
    );
  }

  resolveNightAndBeginDay() {
    this.ensureSystems();

    if (!this.nightResultsPublished) {
      this.nightResolutionManagerSystem.resolveNight();
      this.applyPlayerTints();
      this.nightResultsPublished = true;
      this.nightResultsRepublished = false;
      this.nightResultsPublishDeadlineMs =
        this.getNowMs() + this.nightResultSyncDurationMs;
      console.log(
        "[night-resolution] results published; waiting for client sync before DISCUSS",
      );
      return;
    }

    if (!(this.nightResultsPublishDeadlineMs > 0)) return;
    if (this.getNowMs() < this.nightResultsPublishDeadlineMs) return;

    if (!this.nightResultsRepublished) {
      const resultMap = this.cloneMap(
        this.debugGetGlobalMap(
          "playerNightResultMap",
          "gameManager.resolveNightAndBeginDay -> stable result republish",
        ),
      );
      resultMap["_nightResultSync"] =
        "night-result:" +
        stateManager.getVariable("roundNumber").toString() +
        ":" +
        stateManager.getVariable("phaseNonce").toString();
      stateManager.setVariable("playerNightResultMap", resultMap);
      this.nightResultsRepublished = true;
      this.nightResultsPublishDeadlineMs =
        this.getNowMs() + this.nightResultSyncDurationMs;
      console.log(
        "[night-resolution] republished stable result MAP; waiting for callback delivery",
      );
      return;
    }

    // Clear only the deadline before the phase write, while leaving the
    // published latch set. Even if the Engine applies that write
    // asynchronously, later physics ticks can neither resolve twice nor bump
    // the phase nonce twice.
    this.nightResultsPublishDeadlineMs = 0;
    this.setPhase(
      "DISCUSS",
      stateManager.getVariable("configuredDiscussionSeconds") * 1000,
    );
  }

  beginNightBuffer() {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "NIGHT") return;
    if (this.getMissingNightActionPlayerIds().length > 0) return;

    this.nightResultsPublished = false;
    this.nightResultsRepublished = false;
    this.nightResultsPublishDeadlineMs = 0;
    this.arenaManagerSystem.setSyncedNightWaitingText("");
    const phaseEndsAtMs = this.getNowMs() + this.nightBufferDurationMs;
    // Keep the NIGHT nonce unchanged so the host resolves the exact actions
    // accepted for this night after the final two-second sync buffer.
    stateManager.setVariable("gamePhase", "NIGHT_BUFFER" as any);
    stateManager.setVariable("phaseEndsAtMs", phaseEndsAtMs);
    this.arenaManagerSystem.setDayMode(false);
    this.applyPlayerTints();
    this.syncCountdownSprite("NIGHT_BUFFER", phaseEndsAtMs);
  }

  resumeNightSelectionFromBuffer() {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "NIGHT_BUFFER") return;

    this.nightResultsPublished = false;
    this.nightResultsRepublished = false;
    this.nightResultsPublishDeadlineMs = 0;
    const phaseEndsAtMs =
      this.getNowMs() +
      stateManager.getVariable("configuredNightSeconds") * 1000;
    // A disconnect can invalidate another player's target during the buffer.
    // Reopen selection without changing the night nonce or discarding every
    // other player's still-valid submitted action.
    stateManager.setVariable("gamePhase", "NIGHT" as any);
    stateManager.setVariable("phaseEndsAtMs", phaseEndsAtMs);
    this.arenaManagerSystem.setDayMode(false);
    this.applyPlayerTints();
    this.syncCountdownSprite("NIGHT", phaseEndsAtMs);
  }

  advanceAfterDiscussion() {
    const eliminatedPlayerId = stateManager.getVariable(
      "lastNightEliminatedPlayerId",
    );
    const nightNumber = stateManager.getVariable("roundNumber");

    if (eliminatedPlayerId > 0) {
      this.ensureSystems();
      this.trialManagerSystem.beginNomination();
      return;
    }

    const noEliminationWinner =
      this.winConditionManagerSystem.getNoEliminationWinningTeam(
        nightNumber,
        eliminatedPlayerId,
      );
    if (noEliminationWinner !== "") {
      this.beginEndPhase(
        noEliminationWinner,
        false,
        "The Trickster team failed to eliminate anyone within three nights.",
      );
      return;
    }

    stateManager.setVariable("roundNumber", nightNumber + 1);
    this.beginNight();
  }

  advancePhase() {
    const phase = stateManager.getVariable("gamePhase");

    if (phase === "NIGHT") {
      this.beginNightBuffer();
      return;
    }
    if (phase === "NIGHT_BUFFER") {
      this.resolveNightAndBeginDay();
      return;
    }
    if (phase === "DISCUSS") {
      this.advanceAfterDiscussion();
      return;
    }
    if (phase === "TRIAL_NOMINATION") {
      this.trialManagerSystem.resolveNomination();
      return;
    }
    if (phase === "TRIAL_DEFENSE") {
      this.trialManagerSystem.beginVerdict();
      return;
    }
    if (phase === "TRIAL_VERDICT") {
      this.trialManagerSystem.resolveVerdict();
      return;
    }
    if (phase === "END" || phase === "END_EARLY") {
      this.resetToWaitingState();
    }
  }

  beginEndPhase(winningTeam: string, isEarly: boolean, reasonText: string) {
    stateManager.setVariable("winningTeam", winningTeam);
    stateManager.setVariable("endReasonText", reasonText || "");
    this.applyPlayerTints();
    this.setPhase(isEarly ? "END_EARLY" : "END", this.endDurationMs);
  }

  setPhase(phaseName: string, durationMs: number) {
    const phaseEndsAtMs = durationMs > 0 ? this.getNowMs() + durationMs : 0;

    stateManager.setVariable("gamePhase", phaseName as any);
    stateManager.setVariable("phaseEndsAtMs", phaseEndsAtMs);
    this.bumpPhaseNonce();
    this.arenaManagerSystem.setDayMode(this.isDayPhase(phaseName));
    this.applyPlayerTints();
    this.syncCountdownSprite(phaseName, phaseEndsAtMs);
  }

  syncPhaseClockFromVariables() {
    const phaseName = stateManager.getVariable("gamePhase");
    const phaseEndsAtMs = stateManager.getVariable("phaseEndsAtMs");

    if (phaseName === "WAITING" || !phaseEndsAtMs || phaseEndsAtMs <= 0) {
      this.arenaManagerSystem.setSyncedCountdownText("");
      return;
    }

    const remainingMs = phaseEndsAtMs - this.getNowMs();
    this.syncCountdownSprite(phaseName, phaseEndsAtMs);
    if (remainingMs <= 0) this.advancePhase();
  }

  syncCountdownSprite(phaseName: string, phaseEndsAtMs: number) {
    let countdownText = "";

    if (phaseName !== "WAITING" && phaseEndsAtMs > 0) {
      const remainingMs = phaseEndsAtMs - this.getNowMs();
      if (remainingMs > 0) {
        countdownText = Math.ceil(remainingMs / 1000).toString() + "...";
      }
    }
    this.arenaManagerSystem.setSyncedCountdownText(countdownText);
  }

  syncStateVisualsFromVariables() {
    this.ensureSystems();
    this.normalizeLobbySettings();

    const phase = stateManager.getVariable("gamePhase");
    const seatMap = this.debugGetGlobalMap(
      "playerSeatMap",
      "gameManager.syncStateVisualsFromVariables",
    );

    if (phase === "WAITING") {
      this.arenaManagerSystem.setSyncedCountdownText("");
      this.arenaManagerSystem.clearSeatBlockers();
      this.arenaManagerSystem.setDayMode(true);
      this.arenaManagerSystem.teleportPlayersToWaitingArea(
        playerManager.getPlayerIds(),
      );
      this.clearRoundVariablesForWaiting();
      this.applyPlayerTints();
      return;
    }

    if (!seatMap || Object.keys(seatMap).length === 0) {
      this.resetToWaitingState();
      return;
    }

    this.arenaManagerSystem.rebuildSeatBlockersFromSeatMap(seatMap);
    this.arenaManagerSystem.setDayMode(this.isDayPhase(phase));

    const accusedPlayerId = stateManager.getVariable("trialAccusedPlayerId");
    if (
      accusedPlayerId > 0 &&
      (phase === "TRIAL_DEFENSE" || phase === "TRIAL_VERDICT")
    ) {
      this.arenaManagerSystem.teleportPlayerToTrialCenter(accusedPlayerId);
    }

    this.applyPlayerTints();
    this.syncPhaseClockFromVariables();
  }

  resetToWaitingState() {
    this.ensureSystems();
    this.clearRoundVariablesForWaiting();
    this.arenaManagerSystem.clearSeatBlockers();
    this.arenaManagerSystem.setDayMode(true);
    this.arenaManagerSystem.teleportPlayersToWaitingArea(
      playerManager.getPlayerIds(),
    );
    this.applyPlayerTints();
  }

  clearRoundVariablesForWaiting() {
    this.nightResultsPublished = false;
    this.nightResultsRepublished = false;
    this.nightResultsPublishDeadlineMs = 0;
    this.gameSetupPublished = false;
    this.gameSetupRepublished = false;
    this.gameSetupPublishDeadlineMs = 0;
    this.arenaManagerSystem.setSyncedCountdownText("");
    this.arenaManagerSystem.setSyncedNightWaitingText("");
    stateManager.setVariable("gamePhase", "WAITING");
    stateManager.setVariable("phaseEndsAtMs", 0);
    stateManager.setVariable("roundNumber", 0);
    this.bumpPhaseNonce();
    stateManager.setVariable("playerRoleMap", {});
    stateManager.setVariable("playerSeatMap", {});
    stateManager.setVariable("playerAliveMap", {});
    stateManager.setVariable("playerDeathInfoMap", {});
    // Keep acknowledgement history on the host. The WAITING phase callback
    // clears local round UI, while avoiding unreliable MAP child deletions.
    stateManager.setVariable("nightActionMap", {});
    // Keep case-knowledge children as well. startGame resets current roster
    // entries in-band before any new CASE action can resolve.
    stateManager.setVariable("sleepyPlayerMap", {});
    stateManager.setVariable("trialNominationVoteMap", {});
    stateManager.setVariable("trialVerdictVoteMap", {});
    stateManager.setVariable("trialAccusedPlayerId", 0);
    stateManager.setVariable("jokerWinnerPlayerId", 0);
    stateManager.setVariable("lastNightEliminatedPlayerId", 0);
    stateManager.setVariable("lastExiledPlayerId", 0);
    stateManager.setVariable("winningTeam", "");
    stateManager.setVariable("endReasonText", "");
    stateManager.setVariable("nightTargetMap", {});
    stateManager.setVariable("dayVoteTargetMap", {});
    stateManager.setVariable("detectivePlayerRoleRevealedMap", {});
    stateManager.setVariable("lastInvestigatedPlayerId", 0);
    stateManager.setVariable("savedPlayerId", 0);
  }

  removePlayerFromRoundState(playerId: number) {
    const playerIdKey = playerId.toString();
    const mapVariableNames = [
      "playerRoleMap",
      "playerSeatMap",
      "playerAliveMap",
      "sleepyPlayerMap",
      "trialNominationVoteMap",
      "trialVerdictVoteMap",
    ];

    for (let i = 0; i < mapVariableNames.length; i++) {
      const variableName = mapVariableNames[i];
      const rawStateMap =
        variableName === "playerRoleMap" || variableName === "playerSeatMap"
          ? this.debugGetGlobalMap(
              variableName,
              "gameManager.removePlayerFromRoundState",
            )
          : stateManager.getVariable(variableName);
      const stateMap = this.cloneMap(rawStateMap);
      delete stateMap[playerIdKey];

      if (
        variableName === "trialNominationVoteMap"
      ) {
        this.removeNumericTargetReferences(stateMap, playerId);
      }

      stateManager.setVariable(variableName, stateMap);
    }

    this.removePlayerNightActions(playerId);
  }

  removePlayerNightActions(playerId: number) {
    const playerIdKey = playerId.toString();
    const nightActionMap = this.cloneMap(
      stateManager.getVariable("nightActionMap"),
    );
    const actorIds = Object.keys(nightActionMap);

    delete nightActionMap[playerIdKey];
    for (let i = 0; i < actorIds.length; i++) {
      const action = nightActionMap[actorIds[i]];
      if (
        action &&
        (action.targetPlayerId === playerId ||
          action.disguisePlayerId === playerId)
      ) {
        delete nightActionMap[actorIds[i]];
      }
    }

    stateManager.setVariable("nightActionMap", nightActionMap);
  }

  removeNumericTargetReferences(targetMap: any, playerId: number) {
    const keys = Object.keys(targetMap);
    for (let i = 0; i < keys.length; i++) {
      if (targetMap[keys[i]] === playerId) delete targetMap[keys[i]];
    }
  }

  applyPlayerTints() {
    const connectedPlayerIds = playerManager.getPlayerIds();
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "gameManager.applyPlayerTints",
      ) || {};
    const aliveMap = stateManager.getVariable("playerAliveMap") || {};
    const phase = stateManager.getVariable("gamePhase");
    const accusedPlayerId = stateManager.getVariable("trialAccusedPlayerId");

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      const playerId = connectedPlayerIds[i];
      let tintColor: string | null = null;

      if (phase !== "WAITING" && !roleMap[playerId.toString()]) {
        tintColor = this.spectatorTintColor;
      } else if (aliveMap[playerId.toString()] === false) {
        tintColor = this.eliminatedTintColor;
      } else if (
        playerId === accusedPlayerId &&
        (phase === "TRIAL_DEFENSE" || phase === "TRIAL_VERDICT")
      ) {
        tintColor = this.accusedTintColor;
      }

      playerManager.tintPlayer(playerId, tintColor);
    }
  }

  normalizeLobbySettings() {
    stateManager.setVariable(
      "configuredDiscussionSeconds",
      this.normalizeNumberOption(
        stateManager.getVariable("configuredDiscussionSeconds"),
        this.discussionOptions,
      ),
    );
    stateManager.setVariable(
      "configuredVotingSeconds",
      this.normalizeNumberOption(
        stateManager.getVariable("configuredVotingSeconds"),
        this.votingOptions,
      ),
    );
    stateManager.setVariable(
      "configuredNightSeconds",
      this.normalizeNumberOption(
        stateManager.getVariable("configuredNightSeconds"),
        this.nightOptions,
      ),
    );
  }

  cycleNumberOption(currentValue: number, options: number[]): number {
    for (let i = 0; i < options.length; i++) {
      if (options[i] === currentValue) {
        return options[(i + 1) % options.length];
      }
    }
    return options[0];
  }

  normalizeNumberOption(currentValue: number, options: number[]): number {
    if (currentValue === 5) return currentValue;
    for (let i = 0; i < options.length; i++) {
      if (options[i] === currentValue) return currentValue;
    }
    return options[0];
  }

  isDayPhase(phaseName: string): boolean {
    return phaseName !== "NIGHT" && phaseName !== "NIGHT_BUFFER";
  }

  getMissingNightActionPlayerIds(): number[] {
    this.ensureSystems();
    const roleMap =
      this.debugGetGlobalMap(
        "playerRoleMap",
        "gameManager.getMissingNightActionPlayerIds",
      ) || {};
    const aliveMap = stateManager.getVariable("playerAliveMap") || {};
    const actionMap = stateManager.getVariable("nightActionMap") || {};
    const phaseNonce = stateManager.getVariable("phaseNonce");
    const playerIdKeys = Object.keys(roleMap);
    const missingPlayerIds: number[] = [];

    for (let i = 0; i < playerIdKeys.length; i++) {
      const playerIdKey = playerIdKeys[i];
      if (aliveMap[playerIdKey] !== true) continue;

      const playerId = parseInt(playerIdKey, 10);
      const submittedAction = actionMap[playerIdKey];
      const isCompleteAction =
        submittedAction &&
        submittedAction.phaseNonce === phaseNonce &&
        submittedAction.targetPlayerId > 0 &&
        (submittedAction.actionName !== "FRAME" ||
          submittedAction.disguisePlayerId > 0);
      if (!isCompleteAction) {
        missingPlayerIds.push(playerId);
      }
    }

    return missingPlayerIds;
  }

  syncNightWaitingSprite(missingPlayerIds: number[]) {
    if (missingPlayerIds.length === 0 || missingPlayerIds.length > 2) {
      this.arenaManagerSystem.setSyncedNightWaitingText("");
      return;
    }

    let playerNames = "";
    for (let i = 0; i < missingPlayerIds.length; i++) {
      if (i > 0) playerNames += " and ";
      playerNames += this.getPlayerName(missingPlayerIds[i]);
    }

    this.arenaManagerSystem.setSyncedNightWaitingText(
      "Waiting for night choices from: " + playerNames,
    );
  }

  getPlayerName(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (playerDetails && playerDetails.username) return playerDetails.username;
    return "Player " + playerId.toString();
  }

  bumpPhaseNonce() {
    stateManager.setVariable(
      "phaseNonce",
      stateManager.getVariable("phaseNonce") + 1,
    );
  }

  isCurrentHostPlayer(playerId: number): boolean {
    return playerId === playerManager.getMyPlayerId();
  }

  ensureSystems() {
    if (!this.arenaManagerSystem) {
      this.arenaManagerSystem = scriptManager.getSystem({
        systemName: "arenaManager",
      });
    }
    if (!this.roleManagerSystem) {
      this.roleManagerSystem = scriptManager.getSystem({
        systemName: "roleManager",
      });
    }
    if (!this.nightResolutionManagerSystem) {
      this.nightResolutionManagerSystem = scriptManager.getSystem({
        systemName: "nightResolutionManager",
      });
    }
    if (!this.trialManagerSystem) {
      this.trialManagerSystem = scriptManager.getSystem({
        systemName: "trialManager",
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

  getNowMs(): number {
    return new Date().getTime();
  }
}
