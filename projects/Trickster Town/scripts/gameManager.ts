class gameManager extends SystemScript {
  arenaManagerSystem: any;
  minimumPlayersToStart: number;
  announceDurationMs: number;
  endDurationMs: number;
  fastSkipNightDurationMs: number;
  discussionOptions: number[];
  votingOptions: number[];
  nightOptions: number[];
  eliminatedTintColor: string;
  savedTintColor: string;
  spectatorTintColor: string;
  pendingNightEliminationPlayerId: number;
  chatMessageEntries: any[];
  chatMessageNextId: number;
  chatMessageTopY: number;
  chatMessageVerticalOffset: number;
  chatMessageDisplayDurationMs: number;
  chatMessageFadeDurationMs: number;
  chatMessageBackgroundX: number;
  chatMessageBackgroundWidth: number;
  chatMessageBackgroundHeight: number;
  chatMessageTextPaddingX: number;
  chatMessageTextPaddingY: number;
  chatMessageTextFontSize: number;
  chatMessageBackgroundTopAdjust: number;
  chatMessageTextTopAdjust: number;

  onInit() {
    if (!playerManager.isHost) return;

    this.minimumPlayersToStart = 4;
    this.announceDurationMs = 6000;
    this.endDurationMs = 8000;
    this.fastSkipNightDurationMs = 800;
    this.discussionOptions = [60, 90, 120, 150];
    this.votingOptions = [15, 30, 45, 60];
    this.nightOptions = [15, 30, 45, 60];
    this.eliminatedTintColor = "#b53f3f";
    this.savedTintColor = "#f0d04f";
    this.spectatorTintColor = "#777777";
    this.pendingNightEliminationPlayerId = 0;
    this.chatMessageEntries = [];
    this.chatMessageNextId = 1;
    this.chatMessageTopY = 510;
    this.chatMessageVerticalOffset = 62;
    this.chatMessageDisplayDurationMs = 6000;
    this.chatMessageFadeDurationMs = 1200;
    this.chatMessageBackgroundX = 180;
    this.chatMessageBackgroundWidth = 1140;
    this.chatMessageBackgroundHeight = 52;
    this.chatMessageTextPaddingX = 20;
    this.chatMessageTextPaddingY = 12;
    this.chatMessageTextFontSize = 26;
    // Normal UI tops out at 1000; help popups begin at 2000. Reserve a
    // substantial same-layer gap so each message text stays above its rect.
    this.chatMessageBackgroundTopAdjust = 1001;
    this.chatMessageTextTopAdjust = 1999;

    this.ensureArenaManager();
    this.syncStateVisualsFromVariables();
  }

  onHostStart() {
    if (!playerManager.isHost) return;
    this.ensureChatMessageState();
    this.ensureArenaManager();
    this.syncStateVisualsFromVariables();
  }

  onPhysicsStep() {
    if (!playerManager.isHost) return;
    this.syncPhaseClockFromVariables();
    this.processChatMessages();
  }

  onPlayerJoined({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;

    const phase = stateManager.getVariable("gamePhase");
    if (phase === "WAITING") {
      this.normalizeLobbySettings();
      this.ensureArenaManager().teleportPlayersToWaitingArea([playerId]);
      this.applyPlayerTints();
      return;
    }

    this.ensureArenaManager().teleportPlayersToSpectatorArea([playerId]);
    playerManager.tintPlayer(playerId, this.spectatorTintColor);
    this.bumpPhaseNonce();
  }

  onPlayerLeft({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;

    this.ensureArenaManager().teleportPlayerToOrigin(playerId);

    const phase = stateManager.getVariable("gamePhase");
    if (phase === "WAITING") {
      this.normalizeLobbySettings();
      this.applyPlayerTints();
      return;
    }

    this.removePlayerFromRoundState(playerId);
    this.applyPlayerTints();

    const winningTeam = this.getWinningTeam();
    if (winningTeam !== "") {
      this.beginEndPhase(
        winningTeam,
        true,
        "Too many players left, ending the game early...",
      );
      return;
    }

    this.advanceRoleRevealIfComplete();

    this.bumpPhaseNonce();
  }

  onEvent_hostStartsGame({ fromPlayerId }: { fromPlayerId: number }) {
    if (!playerManager.isHost) return;
    if (!this.isCurrentHostPlayer(fromPlayerId)) return;
    if (stateManager.getVariable("gamePhase") !== "WAITING") return;

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

    if (settingKey === "tricksters") {
      const playerCount = playerManager.getPlayerIds().length;
      const maxTricksters = this.getMaxLegalTricksterCount(playerCount);
      const options: number[] = [];

      for (let i = 1; i <= maxTricksters; i++) {
        options.push(i);
      }

      stateManager.setVariable(
        "configuredTricksterCount",
        this.cycleNumberOption(
          stateManager.getVariable("configuredTricksterCount"),
          options,
        ),
      );
      return;
    }

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
      // Keep this as a host-only lobby shortcut; the existing three timer
      // variables are all the state needed for a five-second development run.
      stateManager.setVariable("configuredDiscussionSeconds", 5);
      stateManager.setVariable("configuredVotingSeconds", 5);
      stateManager.setVariable("configuredNightSeconds", 5);
    }
  }

  onEvent_playerChoosesNightTarget({
    fromPlayerId,
    targetPlayerId,
    phaseName,
  }: {
    fromPlayerId: number;
    targetPlayerId: number;
    phaseName: string;
  }) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== phaseName) return;
    if (!this.isAliveRoundPlayer(fromPlayerId)) return;
    if (!this.isAliveRoundPlayer(targetPlayerId)) return;

    const roleMap = stateManager.getVariable("playerRoleMap");
    const actorRole = roleMap[fromPlayerId.toString()];
    const targetRole = roleMap[targetPlayerId.toString()];
    const phase = stateManager.getVariable("gamePhase");

    if (phase === "NIGHT_TRICKSTER") {
      if (actorRole !== "TRICKSTER") return;
      if (targetRole === "TRICKSTER") return;
    } else if (phase === "NIGHT_DETECTIVE") {
      if (actorRole !== "DETECTIVE") return;
      if (targetPlayerId === fromPlayerId) return;
    } else if (phase === "NIGHT_DOCTOR") {
      if (actorRole !== "DOCTOR") return;
    } else {
      return;
    }

    const nightTargetMap = this.cloneTopLevelMap(
      stateManager.getVariable("nightTargetMap"),
    );
    nightTargetMap[fromPlayerId.toString()] = targetPlayerId;
    stateManager.setVariable("nightTargetMap", nightTargetMap);
  }

  onEvent_playerChoosesDayVote({
    fromPlayerId,
    targetPlayerId,
  }: {
    fromPlayerId: number;
    targetPlayerId: number;
  }) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "VOTE") return;
    if (!this.isAliveRoundPlayer(fromPlayerId)) return;
    if (!this.isAliveRoundPlayer(targetPlayerId)) return;

    const voteMap = this.cloneTopLevelMap(
      stateManager.getVariable("dayVoteTargetMap"),
    );
    voteMap[fromPlayerId.toString()] = targetPlayerId;
    stateManager.setVariable("dayVoteTargetMap", voteMap);
  }

  onEvent_playerSuspectsPlayer({
    fromPlayerId,
    targetPlayerId,
  }: {
    fromPlayerId: number;
    targetPlayerId: number;
  }) {
    if (!playerManager.isHost) return;
    if (!this.isSuspicionChatPhase(stateManager.getVariable("gamePhase"))) return;
    if (fromPlayerId === targetPlayerId) return;
    if (!this.isAliveRoundPlayer(fromPlayerId)) return;
    if (!this.isAliveRoundPlayer(targetPlayerId)) return;

    this.addChatMessage(
      this.getPlayerName(fromPlayerId) +
        " is suspiscous of " +
        this.getPlayerName(targetPlayerId) +
        " 👀",
    );
  }

  onEvent_playerAcknowledgesRole({
    fromPlayerId,
  }: {
    fromPlayerId: number;
  }) {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gamePhase") !== "REVEAL") return;

    const roleMap = stateManager.getVariable("playerRoleMap");
    const playerIdKey = fromPlayerId.toString();
    if (!roleMap || !roleMap[playerIdKey]) return;

    const acknowledgementMap = this.cloneTopLevelMap(
      stateManager.getVariable("roleRevealAcknowledgementMap"),
    );

    if (!acknowledgementMap[playerIdKey]) {
      acknowledgementMap[playerIdKey] = true;
      stateManager.setVariable(
        "roleRevealAcknowledgementMap",
        acknowledgementMap,
      );
    }

    this.advanceRoleRevealIfComplete(acknowledgementMap);
  }

  onEvent_resetGame() {
    if (!playerManager.isHost) return;
    this.resetToWaitingState();
  }

  ensureChatMessageState() {
    if (!this.chatMessageEntries) {
      this.chatMessageEntries = [];
    }
    if (!this.chatMessageNextId) {
      this.chatMessageNextId = 1;
    }
    if (!this.chatMessageTopY) {
      this.chatMessageTopY = 510;
    }
    if (!this.chatMessageVerticalOffset) {
      this.chatMessageVerticalOffset = 62;
    }
    if (!this.chatMessageDisplayDurationMs) {
      this.chatMessageDisplayDurationMs = 6000;
    }
    if (!this.chatMessageFadeDurationMs) {
      this.chatMessageFadeDurationMs = 1200;
    }
    if (!this.chatMessageBackgroundX) {
      this.chatMessageBackgroundX = 180;
    }
    if (!this.chatMessageBackgroundWidth) {
      this.chatMessageBackgroundWidth = 1140;
    }
    if (!this.chatMessageBackgroundHeight) {
      this.chatMessageBackgroundHeight = 52;
    }
    if (!this.chatMessageTextPaddingX) {
      this.chatMessageTextPaddingX = 20;
    }
    if (!this.chatMessageTextPaddingY) {
      this.chatMessageTextPaddingY = 12;
    }
    if (!this.chatMessageTextFontSize) {
      this.chatMessageTextFontSize = 26;
    }
    if (!this.chatMessageBackgroundTopAdjust) {
      this.chatMessageBackgroundTopAdjust = 1001;
    }
    if (!this.chatMessageTextTopAdjust) {
      this.chatMessageTextTopAdjust = 1999;
    }
  }

  isSuspicionChatPhase(phaseName: string): boolean {
    return phaseName === "DISCUSS" || phaseName === "VOTE";
  }

  addChatMessage(messageText: string) {
    if (!playerManager.isHost) return;

    this.ensureChatMessageState();
    this.pushChatMessagesDown();

    const messageId = "chat_message_" + this.chatMessageNextId.toString();
    const backgroundSpriteId = "ui_" + messageId + "_background";
    const textSpriteId = "ui_" + messageId + "_text";
    const nowMs = this.getNowMs();
    const messageEntry: any = {
      messageId: messageId,
      backgroundSpriteId: backgroundSpriteId,
      textSpriteId: textSpriteId,
      positionY: this.chatMessageTopY,
      fadeStartsAtMs: nowMs + this.chatMessageDisplayDurationMs,
      fadeStarted: false,
    };

    this.chatMessageNextId += 1;
    this.chatMessageEntries.push(messageEntry);

    // Both sprites stay on the top layer. Keep opacity, isImpassable, and
    // checkCollisions unset until the pair begins its timed fade.
    spriteManager.addSprite("baseRect", {
      uniqueId: backgroundSpriteId,
      positionX: this.chatMessageBackgroundX,
      positionY: messageEntry.positionY,
      width: this.chatMessageBackgroundWidth,
      height: this.chatMessageBackgroundHeight,
      // Keep the pre-fade background completely opaque without using the
      // sprite opacity property. The fade animation owns opacity later.
      fill: "#141c12",
      strokeColor: "#fff7df",
      strokeWeight: 2,
      borderRadius: 16,
      isInteractive: false,
      allowSpectatorInteraction: false,
      isPlayerControlled: false,
      displayLayer: "top",
      topAdjust: this.chatMessageBackgroundTopAdjust,
    });

    spriteManager.addSprite("baseText", {
      uniqueId: textSpriteId,
      positionX: this.chatMessageBackgroundX + this.chatMessageTextPaddingX,
      positionY: messageEntry.positionY + this.chatMessageTextPaddingY,
      containerWidth: this.chatMessageBackgroundWidth - this.chatMessageTextPaddingX * 2,
      align: "center",
      text: messageText,
      fontSize: this.chatMessageTextFontSize,
      fontWeight: "bold",
      fontColor: "#fff7df",
      isInteractive: false,
      allowSpectatorInteraction: false,
      isPlayerControlled: false,
      displayLayer: "top",
      topAdjust: this.chatMessageTextTopAdjust,
    });
  }

  pushChatMessagesDown() {
    if (!this.chatMessageEntries) return;

    for (let i = 0; i < this.chatMessageEntries.length; i++) {
      const messageEntry = this.chatMessageEntries[i];
      if (!messageEntry) continue;

      messageEntry.positionY += this.chatMessageVerticalOffset;

      if (spriteManager.getSprite(messageEntry.backgroundSpriteId)) {
        spriteManager.updateSprite(messageEntry.backgroundSpriteId, {
          positionY: messageEntry.positionY,
        });
      }
      if (spriteManager.getSprite(messageEntry.textSpriteId)) {
        spriteManager.updateSprite(messageEntry.textSpriteId, {
          positionY: messageEntry.positionY + this.chatMessageTextPaddingY,
        });
      }
    }
  }

  processChatMessages() {
    if (!playerManager.isHost) return;

    this.ensureChatMessageState();

    const nowMs = this.getNowMs();
    for (let i = this.chatMessageEntries.length - 1; i >= 0; i--) {
      const messageEntry = this.chatMessageEntries[i];
      if (!messageEntry) {
        this.chatMessageEntries.splice(i, 1);
        continue;
      }

      const backgroundSprite = spriteManager.getSprite(messageEntry.backgroundSpriteId);
      const textSprite = spriteManager.getSprite(messageEntry.textSpriteId);

      if (!backgroundSprite || !textSprite) {
        this.removeChatMessage(messageEntry.messageId);
        continue;
      }

      if (!messageEntry.fadeStarted && nowMs >= messageEntry.fadeStartsAtMs) {
        this.startChatMessageFade(messageEntry, backgroundSprite, textSprite);
      }
    }
  }

  startChatMessageFade(messageEntry: any, backgroundSprite: PseudoSprite, textSprite: PseudoSprite) {
    if (!messageEntry || messageEntry.fadeStarted) return;
    if (!backgroundSprite || !textSprite) return;

    messageEntry.fadeStarted = true;

    // This is the first time either sprite receives an opacity value. A
    // single animation keeps the text and its background perfectly in sync.
    timerManager.animate({
      targets: [backgroundSprite, textSprite],
      keyframes: {
        0: { opacity: "1" },
        100: { opacity: "0" },
      },
      duration: this.chatMessageFadeDurationMs,
      loop: false,
      alternate: false,
      playbackEase: "Linear",
      onComplete: () => {
        if (!playerManager.isHost) return;
        this.removeChatMessage(messageEntry.messageId);
      },
    });
  }

  removeChatMessage(messageId: string) {
    if (!messageId || !this.chatMessageEntries) return;

    for (let i = this.chatMessageEntries.length - 1; i >= 0; i--) {
      const messageEntry = this.chatMessageEntries[i];
      if (!messageEntry || messageEntry.messageId !== messageId) continue;

      if (spriteManager.getSprite(messageEntry.backgroundSpriteId)) {
        spriteManager.removeSprite(messageEntry.backgroundSpriteId);
      }
      if (spriteManager.getSprite(messageEntry.textSpriteId)) {
        spriteManager.removeSprite(messageEntry.textSpriteId);
      }

      this.chatMessageEntries.splice(i, 1);
      return;
    }
  }

  clearChatMessages() {
    if (!this.chatMessageEntries) return;

    for (let i = 0; i < this.chatMessageEntries.length; i++) {
      const messageEntry = this.chatMessageEntries[i];
      if (!messageEntry) continue;

      if (spriteManager.getSprite(messageEntry.backgroundSpriteId)) {
        spriteManager.removeSprite(messageEntry.backgroundSpriteId);
      }
      if (spriteManager.getSprite(messageEntry.textSpriteId)) {
        spriteManager.removeSprite(messageEntry.textSpriteId);
      }
    }

    this.chatMessageEntries = [];
  }

  ensureArenaManager() {
    if (!this.arenaManagerSystem) {
      this.arenaManagerSystem = scriptManager.getSystem({ systemName: "arenaManager" });
    }

    return this.arenaManagerSystem;
  }

  syncStateVisualsFromVariables() {
    if (!playerManager.isHost) return;

    this.normalizeLobbySettings();

    const phase = stateManager.getVariable("gamePhase");
    const seatMap = stateManager.getVariable("playerSeatMap");
    const isWaiting = phase === "WAITING";

    if (isWaiting) {
      this.ensureArenaManager().setSyncedCountdownText("");
      this.ensureArenaManager().clearSeatBlockers();
      this.ensureArenaManager().setDayMode(true);
      this.ensureArenaManager().teleportPlayersToWaitingArea(playerManager.getPlayerIds());
      this.clearRoundOnlyVariablesForWaiting();
      this.applyPlayerTints();
      return;
    }

    if (!seatMap || Object.keys(seatMap).length === 0) {
      this.resetToWaitingState();
      return;
    }

    this.ensureArenaManager().rebuildSeatBlockersFromSeatMap(seatMap);
    this.ensureArenaManager().setDayMode(this.isDayPhase(phase));
    this.applyPlayerTints();
    this.syncPhaseClockFromVariables();
  }

  startGame() {
    this.normalizeLobbySettings();

    const playerIds = playerManager.getPlayerIds();
    if (playerIds.length < this.minimumPlayersToStart) return;

    const seatMap = this.ensureArenaManager().computeSeatMapForPlayerIds(playerIds);
    const roleMap = this.assignRoles(playerIds);
    const aliveMap: any = {};

    for (let i = 0; i < playerIds.length; i++) {
      aliveMap[playerIds[i].toString()] = true;
    }

    this.pendingNightEliminationPlayerId = 0;
    stateManager.setVariable("playerSeatMap", seatMap);
    stateManager.setVariable("playerRoleMap", roleMap);
    stateManager.setVariable("playerAliveMap", aliveMap);
    // targetPlayerId -> role revealed by the Detective this round.
    stateManager.setVariable("detectivePlayerRoleRevealedMap", {});
    stateManager.setVariable("nightTargetMap", {});
    stateManager.setVariable("dayVoteTargetMap", {});
    stateManager.setVariable("roleRevealAcknowledgementMap", {});
    stateManager.setVariable("savedPlayerId", 0);
    stateManager.setVariable("lastNightEliminatedPlayerId", 0);
    stateManager.setVariable("lastInvestigatedPlayerId", 0);
    stateManager.setVariable("lastExiledPlayerId", 0);
    stateManager.setVariable("winningTeam", "");
    stateManager.setVariable("endReasonText", "");
    stateManager.setVariable("roundNumber", 1);

    this.ensureArenaManager().rebuildSeatBlockersFromSeatMap(seatMap);
    this.ensureArenaManager().teleportPlayersToSeats(seatMap);
    this.applyPlayerTints();
    // Role reveal has no deadline: every player must acknowledge their role copy.
    this.setPhase("REVEAL", 0);
  }

  advancePhase() {
    const phase = stateManager.getVariable("gamePhase");

    if (phase === "REVEAL") {
      this.beginNightTricksterPhase();
      return;
    }

    if (phase === "NIGHT_TRICKSTER") {
      this.resolveTricksterVotes();
      this.beginNightDetectivePhase();
      return;
    }

    if (phase === "NIGHT_DETECTIVE") {
      this.resolveDetectiveChoice();
      this.beginNightDoctorPhase();
      return;
    }

    if (phase === "NIGHT_DOCTOR") {
      this.resolveDoctorChoiceAndNightOutcome();
      this.beginDiscussPhase();
      return;
    }

    if (phase === "DISCUSS") {
      this.beginVotePhase();
      return;
    }

    if (phase === "VOTE") {
      this.resolveVotePhase();
      return;
    }

    if (phase === "ANNOUNCE") {
      this.beginNextRoundNightCycle();
      return;
    }

    if (phase === "END" || phase === "END_EARLY") {
      this.resetToWaitingState();
    }
  }

  advanceRoleRevealIfComplete(acknowledgementMapOverride?: any) {
    if (stateManager.getVariable("gamePhase") !== "REVEAL") return;

    const roleMap = stateManager.getVariable("playerRoleMap") || {};
    const acknowledgementMap = acknowledgementMapOverride ||
      stateManager.getVariable("roleRevealAcknowledgementMap") || {};
    const playerIdKeys = Object.keys(roleMap);

    if (playerIdKeys.length === 0) return;

    for (let i = 0; i < playerIdKeys.length; i++) {
      if (acknowledgementMap[playerIdKeys[i]] !== true) return;
    }

    this.beginNightTricksterPhase();
  }

  beginNightTricksterPhase() {
    this.pendingNightEliminationPlayerId = 0;
    stateManager.setVariable("nightTargetMap", {});
    stateManager.setVariable("dayVoteTargetMap", {});
    stateManager.setVariable("savedPlayerId", 0);
    stateManager.setVariable("lastNightEliminatedPlayerId", 0);
    stateManager.setVariable("lastInvestigatedPlayerId", 0);
    stateManager.setVariable("lastExiledPlayerId", 0);

    this.setPhase(
      "NIGHT_TRICKSTER",
      this.getNightPhaseDurationMs("NIGHT_TRICKSTER"),
    );
  }

  beginNightDetectivePhase() {
    stateManager.setVariable("nightTargetMap", {});
    this.setPhase(
      "NIGHT_DETECTIVE",
      this.getNightPhaseDurationMs("NIGHT_DETECTIVE"),
    );
  }

  beginNightDoctorPhase() {
    stateManager.setVariable("nightTargetMap", {});
    this.setPhase(
      "NIGHT_DOCTOR",
      this.getNightPhaseDurationMs("NIGHT_DOCTOR"),
    );
  }

  beginDiscussPhase() {
    const winningTeam = this.getWinningTeam();
    if (winningTeam !== "") {
      this.beginEndPhase(winningTeam, false, "");
      return;
    }

    stateManager.setVariable("dayVoteTargetMap", {});
    this.applyPlayerTints();
    this.triggerSavedPlayerEffect();
    this.setPhase(
      "DISCUSS",
      stateManager.getVariable("configuredDiscussionSeconds") * 1000,
    );
  }

  beginVotePhase() {
    stateManager.setVariable("dayVoteTargetMap", {});
    stateManager.setVariable("endReasonText", "");
    this.setPhase(
      "VOTE",
      stateManager.getVariable("configuredVotingSeconds") * 1000,
    );
  }

  resolveVotePhase() {
    const alivePlayerIds = this.getAlivePlayerIds();
    const voteTargetMap = stateManager.getVariable("dayVoteTargetMap");
    const voteWasTied = this.hasTiedTopVote(
      voteTargetMap,
      alivePlayerIds,
      alivePlayerIds,
    );
    const chosenPlayerId = this.chooseWinningTarget(
      voteTargetMap,
      alivePlayerIds,
      alivePlayerIds,
    );
    // Publish fresh MAP instances so every non-host receives the changed
    // child values, rather than mutating the host's current MAP in place.
    const aliveMap = this.cloneTopLevelMap(
      stateManager.getVariable("playerAliveMap"),
    );
    const deathInfoMap = this.cloneTopLevelMap(
      stateManager.getVariable("playerDeathInfoMap"),
    );

    stateManager.setVariable(
      "endReasonText",
      voteWasTied
        ? "We could not agree on who to exile... No one was exiled."
        : "",
    );
    stateManager.setVariable("lastExiledPlayerId", chosenPlayerId);

    if (chosenPlayerId > 0) {
      aliveMap[chosenPlayerId.toString()] = false;
      deathInfoMap[chosenPlayerId.toString()] = {
        roundNumber: stateManager.getVariable("roundNumber"),
        cause: "EXILED",
        eliminatingTeam: "TOWNSFOLK",
      };
    }

    stateManager.setVariable("playerAliveMap", aliveMap);
    stateManager.setVariable("playerDeathInfoMap", deathInfoMap);
    this.applyPlayerTints();
    this.setPhase("ANNOUNCE", this.announceDurationMs);
  }

  beginNextRoundNightCycle() {
    const winningTeam = this.getWinningTeam();
    if (winningTeam !== "") {
      this.beginEndPhase(winningTeam, false, "");
      return;
    }

    stateManager.setVariable(
      "roundNumber",
      stateManager.getVariable("roundNumber") + 1,
    );
    this.beginNightTricksterPhase();
  }

  beginEndPhase(winningTeam: string, isEarly: boolean, endReasonText: string) {
    stateManager.setVariable("winningTeam", winningTeam);
    stateManager.setVariable("endReasonText", endReasonText || "");
    this.applyPlayerTints();
    this.setPhase(isEarly ? "END_EARLY" : "END", this.endDurationMs);
  }

  resolveTricksterVotes() {
    const aliveTricksterIds = this.getAlivePlayerIdsForRole("TRICKSTER");
    const validTargets = this.getAliveNonTricksterIds();

    this.pendingNightEliminationPlayerId = this.chooseMajorityTarget(
      stateManager.getVariable("nightTargetMap"),
      aliveTricksterIds,
      validTargets,
    );
  }

  resolveDetectiveChoice() {
    const detectiveIds = this.getAlivePlayerIdsForRole("DETECTIVE");
    const allAlivePlayerIds = this.getAlivePlayerIds();
    const roleMap = stateManager.getVariable("playerRoleMap");
    const revealedRoleMap = this.cloneTopLevelMap(
      stateManager.getVariable("detectivePlayerRoleRevealedMap"),
    );
    let investigatedPlayerId = 0;

    if (detectiveIds.length > 0) {
      investigatedPlayerId = this.chooseMajorityTarget(
        stateManager.getVariable("nightTargetMap"),
        detectiveIds,
        allAlivePlayerIds,
      );
      if (investigatedPlayerId === detectiveIds[0]) {
        investigatedPlayerId = 0;
      }
    }

    if (investigatedPlayerId > 0 && roleMap[investigatedPlayerId.toString()]) {
      // Publish a fresh MAP value so every client receives the detective's
      // accumulated knowledge in an in-band variable update.
      revealedRoleMap[investigatedPlayerId.toString()] = roleMap[investigatedPlayerId.toString()];
      stateManager.setVariable("detectivePlayerRoleRevealedMap", revealedRoleMap);
    }

    stateManager.setVariable("lastInvestigatedPlayerId", investigatedPlayerId);
  }

  resolveDoctorChoiceAndNightOutcome() {
    const doctorIds = this.getAlivePlayerIdsForRole("DOCTOR");
    const allAlivePlayerIds = this.getAlivePlayerIds();
    const nightTargetMap = stateManager.getVariable("nightTargetMap");
    // Publish fresh MAP instances so the night elimination reaches every
    // client's local UI, including all non-host name labels.
    const aliveMap = this.cloneTopLevelMap(
      stateManager.getVariable("playerAliveMap"),
    );
    const deathInfoMap = this.cloneTopLevelMap(
      stateManager.getVariable("playerDeathInfoMap"),
    );

    let doctorProtectedPlayerId = 0;
    if (doctorIds.length > 0) {
      doctorProtectedPlayerId = this.chooseMajorityTarget(
        nightTargetMap,
        doctorIds,
        allAlivePlayerIds,
      );
    }

    let savedPlayerId = 0;
    if (
      this.pendingNightEliminationPlayerId > 0 &&
      this.pendingNightEliminationPlayerId === doctorProtectedPlayerId
    ) {
      savedPlayerId = doctorProtectedPlayerId;
    }

    stateManager.setVariable("savedPlayerId", savedPlayerId);

    let eliminatedPlayerId = 0;
    if (
      this.pendingNightEliminationPlayerId > 0 &&
      this.pendingNightEliminationPlayerId !== savedPlayerId
    ) {
      eliminatedPlayerId = this.pendingNightEliminationPlayerId;
      aliveMap[eliminatedPlayerId.toString()] = false;
      deathInfoMap[eliminatedPlayerId.toString()] = {
        roundNumber: stateManager.getVariable("roundNumber"),
        cause: "TRICKSTER_ELIMINATION",
        eliminatingTeam: "TRICKSTERS",
      };
    }

    stateManager.setVariable("playerAliveMap", aliveMap);
    stateManager.setVariable("playerDeathInfoMap", deathInfoMap);
    stateManager.setVariable("lastNightEliminatedPlayerId", eliminatedPlayerId);
    stateManager.setVariable("nightTargetMap", {});
    this.pendingNightEliminationPlayerId = 0;
  }

  assignRoles(playerIds: number[]) {
    const configuredTricksterCount = this.getClampedConfiguredTricksterCount(playerIds.length);
    const roleMap: any = {};
    const randomizedPlayerIds = this.buildRandomizedRoleOrder(playerIds);

    for (let i = 0; i < playerIds.length; i++) {
      roleMap[playerIds[i].toString()] = "TOWNSFOLK";
    }

    for (
      let i = 0;
      i < configuredTricksterCount && i < randomizedPlayerIds.length;
      i++
    ) {
      roleMap[randomizedPlayerIds[i].toString()] = "TRICKSTER";
    }

    if (configuredTricksterCount < randomizedPlayerIds.length) {
      roleMap[
        randomizedPlayerIds[configuredTricksterCount].toString()
      ] = "DETECTIVE";
    }

    if (configuredTricksterCount + 1 < randomizedPlayerIds.length) {
      roleMap[
        randomizedPlayerIds[configuredTricksterCount + 1].toString()
      ] = "DOCTOR";
    }

    return roleMap;
  }

  buildRandomizedRoleOrder(playerIds: number[]): number[] {
    const randomizedPlayerIds: number[] = [];
    const usedPlayerIdMap: any = {};
    let maxAttempts = playerIds.length * playerIds.length * 4;
    let randomIndex = 0;
    let chosenPlayerId = 0;

    while (
      randomizedPlayerIds.length < playerIds.length &&
      maxAttempts > 0
    ) {
      randomIndex = Math.floor(Math.random() * playerIds.length);
      chosenPlayerId = playerIds[randomIndex];

      if (!usedPlayerIdMap[chosenPlayerId.toString()]) {
        usedPlayerIdMap[chosenPlayerId.toString()] = true;
        randomizedPlayerIds.push(chosenPlayerId);
      }

      maxAttempts -= 1;
    }

    for (let i = 0; i < playerIds.length; i++) {
      if (!usedPlayerIdMap[playerIds[i].toString()]) {
        randomizedPlayerIds.push(playerIds[i]);
      }
    }

    return randomizedPlayerIds;
  }

  chooseWinningTarget(
    targetMap: any,
    validActorIds: number[],
    validTargetIds: number[],
  ): number {
    const voteCountMap = this.buildVoteCountMap(targetMap, validActorIds, validTargetIds);
    const targetIds = Object.keys(voteCountMap);
    if (targetIds.length === 0) return 0;

    let topCount = 0;
    let topTargetIds: number[] = [];

    for (let i = 0; i < targetIds.length; i++) {
      const targetId = parseInt(targetIds[i], 10);
      const targetCount = voteCountMap[targetIds[i]];

      if (targetCount > topCount) {
        topCount = targetCount;
        topTargetIds = [targetId];
      } else if (targetCount === topCount) {
        topTargetIds.push(targetId);
      }
    }

    // Daytime exile requires a single top vote-getter. Night roles use the
    // separate majority resolver below, so this does not alter night votes.
    if (topTargetIds.length !== 1) return 0;

    return topTargetIds[0];
  }

  hasTiedTopVote(
    targetMap: any,
    validActorIds: number[],
    validTargetIds: number[],
  ): boolean {
    const voteCountMap = this.buildVoteCountMap(targetMap, validActorIds, validTargetIds);
    const targetIds = Object.keys(voteCountMap);
    if (targetIds.length < 2) return false;

    let topCount = 0;
    let topTargetCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const targetCount = voteCountMap[targetIds[i]];

      if (targetCount > topCount) {
        topCount = targetCount;
        topTargetCount = 1;
      } else if (targetCount === topCount) {
        topTargetCount += 1;
      }
    }

    return topTargetCount > 1;
  }

  chooseMajorityTarget(
    targetMap: any,
    validActorIds: number[],
    validTargetIds: number[],
  ): number {
    const voteCountMap = this.buildVoteCountMap(targetMap, validActorIds, validTargetIds);
    const targetIds = Object.keys(voteCountMap);
    if (targetIds.length === 0) return 0;

    let topCount = 0;
    let topTargetId = 0;
    let topTargetCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      const targetId = parseInt(targetIds[i], 10);
      const targetCount = voteCountMap[targetIds[i]];

      if (targetCount > topCount) {
        topCount = targetCount;
        topTargetId = targetId;
        topTargetCount = 1;
      } else if (targetCount === topCount) {
        topTargetCount += 1;
      }
    }

    if (topTargetCount !== 1) return 0;
    if (topCount <= validActorIds.length / 2) return 0;

    return topTargetId;
  }

  buildVoteCountMap(
    targetMap: any,
    validActorIds: number[],
    validTargetIds: number[],
  ) {
    const voteCountMap: any = {};

    if (!targetMap || !validActorIds || !validTargetIds) {
      return voteCountMap;
    }

    const validTargetLookup: any = {};
    for (let i = 0; i < validTargetIds.length; i++) {
      validTargetLookup[validTargetIds[i].toString()] = true;
    }

    for (let i = 0; i < validActorIds.length; i++) {
      const actorId = validActorIds[i];
      const actorTargetId = targetMap[actorId.toString()];
      const targetKey = actorTargetId ? actorTargetId.toString() : "";

      if (!validTargetLookup[targetKey]) continue;

      if (!voteCountMap[targetKey]) {
        voteCountMap[targetKey] = 0;
      }

      voteCountMap[targetKey] += 1;
    }

    return voteCountMap;
  }

  applyPlayerTints() {
    const connectedPlayerIds = playerManager.getPlayerIds();
    const roleMap = stateManager.getVariable("playerRoleMap");
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const savedPlayerId = stateManager.getVariable("savedPlayerId");
    const phase = stateManager.getVariable("gamePhase");

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      const playerId = connectedPlayerIds[i];
      let tintColor: string | null;
      tintColor = null;

      if (phase !== "WAITING" && !roleMap[playerId.toString()]) {
        tintColor = this.spectatorTintColor;
      } else if (aliveMap[playerId.toString()] === false) {
        tintColor = this.eliminatedTintColor;
      } else if (phase === "DISCUSS" && savedPlayerId > 0 && playerId === savedPlayerId) {
        tintColor = this.savedTintColor;
      }

      playerManager.tintPlayer(playerId, tintColor);
    }
  }

  removePlayerFromRoundState(playerId: number) {
    const stringPlayerId = playerId.toString();
    // Clone before deleting entries so MAP removals are sent as an in-band
    // state update instead of mutating an already-synced object out of band.
    const roleMap = this.cloneTopLevelMap(
      stateManager.getVariable("playerRoleMap"),
    );
    const seatMap = this.cloneTopLevelMap(
      stateManager.getVariable("playerSeatMap"),
    );
    const aliveMap = this.cloneTopLevelMap(
      stateManager.getVariable("playerAliveMap"),
    );
    const nightTargetMap = this.cloneTopLevelMap(
      stateManager.getVariable("nightTargetMap"),
    );
    const dayVoteTargetMap = this.cloneTopLevelMap(
      stateManager.getVariable("dayVoteTargetMap"),
    );
    const roleRevealAcknowledgementMap = this.cloneTopLevelMap(
      stateManager.getVariable("roleRevealAcknowledgementMap"),
    );

    delete roleMap[stringPlayerId];
    delete seatMap[stringPlayerId];
    delete aliveMap[stringPlayerId];
    delete nightTargetMap[stringPlayerId];
    delete dayVoteTargetMap[stringPlayerId];
    delete roleRevealAcknowledgementMap[stringPlayerId];

    this.removeTargetReferences(nightTargetMap, playerId);
    this.removeTargetReferences(dayVoteTargetMap, playerId);

    stateManager.setVariable("playerRoleMap", roleMap);
    stateManager.setVariable("playerSeatMap", seatMap);
    stateManager.setVariable("playerAliveMap", aliveMap);
    stateManager.setVariable("nightTargetMap", nightTargetMap);
    stateManager.setVariable("dayVoteTargetMap", dayVoteTargetMap);
    stateManager.setVariable(
      "roleRevealAcknowledgementMap",
      roleRevealAcknowledgementMap,
    );

    if (stateManager.getVariable("savedPlayerId") === playerId) {
      stateManager.setVariable("savedPlayerId", 0);
    }
    if (stateManager.getVariable("lastNightEliminatedPlayerId") === playerId) {
      stateManager.setVariable("lastNightEliminatedPlayerId", 0);
    }
    if (stateManager.getVariable("lastInvestigatedPlayerId") === playerId) {
      stateManager.setVariable("lastInvestigatedPlayerId", 0);
    }
    if (stateManager.getVariable("lastExiledPlayerId") === playerId) {
      stateManager.setVariable("lastExiledPlayerId", 0);
    }
    if (this.pendingNightEliminationPlayerId === playerId) {
      this.pendingNightEliminationPlayerId = 0;
    }
  }

  removeTargetReferences(targetMap: any, playerId: number) {
    if (!targetMap) return;

    const keys = Object.keys(targetMap);
    for (let i = 0; i < keys.length; i++) {
      if (targetMap[keys[i]] === playerId) {
        delete targetMap[keys[i]];
      }
    }
  }

  cloneTopLevelMap(sourceMap: any) {
    const clonedMap: any = {};
    if (!sourceMap) return clonedMap;

    const keys = Object.keys(sourceMap);
    for (let i = 0; i < keys.length; i++) {
      clonedMap[keys[i]] = sourceMap[keys[i]];
    }

    return clonedMap;
  }

  resetToWaitingState() {
    this.pendingNightEliminationPlayerId = 0;
    this.clearChatMessages();
    this.clearRoundOnlyVariablesForWaiting();
    this.ensureArenaManager().clearSeatBlockers();
    this.ensureArenaManager().setDayMode(true);
    this.ensureArenaManager().teleportPlayersToWaitingArea(playerManager.getPlayerIds());
    this.applyPlayerTints();
  }

  clearRoundOnlyVariablesForWaiting() {
    this.ensureArenaManager().setSyncedCountdownText("");
    stateManager.setVariable("gamePhase", "WAITING");
    stateManager.setVariable("phaseEndsAtMs", 0);
    stateManager.setVariable("roundNumber", 0);
    stateManager.setVariable("phaseNonce", stateManager.getVariable("phaseNonce") + 1);
    stateManager.setVariable("playerRoleMap", {});
    stateManager.setVariable("playerSeatMap", {});
    stateManager.setVariable("playerAliveMap", {});
    stateManager.setVariable("detectivePlayerRoleRevealedMap", {});
    // Keep historical death records rather than deleting individual MAP
    // children. The engine can report those deletions as out-of-band on
    // non-hosts; UI only reads a record for a current dead round player.
    stateManager.setVariable("nightTargetMap", {});
    stateManager.setVariable("dayVoteTargetMap", {});
    stateManager.setVariable("roleRevealAcknowledgementMap", {});
    stateManager.setVariable("savedPlayerId", 0);
    stateManager.setVariable("lastNightEliminatedPlayerId", 0);
    stateManager.setVariable("lastInvestigatedPlayerId", 0);
    stateManager.setVariable("lastExiledPlayerId", 0);
    stateManager.setVariable("winningTeam", "");
    stateManager.setVariable("endReasonText", "");
  }

  setPhase(phaseName: string, durationMs: number) {
    const phaseEndsAtMs = durationMs > 0 ? this.getNowMs() + durationMs : 0;

    stateManager.setVariable("gamePhase", phaseName as any);
    stateManager.setVariable("phaseEndsAtMs", phaseEndsAtMs);
    this.bumpPhaseNonce();
    this.ensureArenaManager().setDayMode(this.isDayPhase(phaseName));
    this.applyPlayerTints();
    this.syncCountdownSprite(phaseName, phaseEndsAtMs);
  }

  syncPhaseClockFromVariables() {
    const phaseName = stateManager.getVariable("gamePhase");
    const phaseEndsAtMs = stateManager.getVariable("phaseEndsAtMs");

    if (phaseName === "WAITING" || !phaseEndsAtMs || phaseEndsAtMs <= 0) {
      this.ensureArenaManager().setSyncedCountdownText("");
      return;
    }

    const remainingMs = phaseEndsAtMs - this.getNowMs();
    this.syncCountdownSprite(phaseName, phaseEndsAtMs);

    if (remainingMs <= 0) {
      this.advancePhase();
    }
  }

  syncCountdownSprite(phaseName: string, phaseEndsAtMs: number) {
    let countdownText = "";

    if (phaseName !== "WAITING" && phaseEndsAtMs && phaseEndsAtMs > 0) {
      const remainingMs = phaseEndsAtMs - this.getNowMs();
      if (remainingMs > 0) {
        const seconds = Math.ceil(remainingMs / 1000);
        countdownText = seconds.toString() + "...";
      }
    }

    this.ensureArenaManager().setSyncedCountdownText(countdownText);
  }

  bumpPhaseNonce() {
    stateManager.setVariable("phaseNonce", stateManager.getVariable("phaseNonce") + 1);
  }

  normalizeLobbySettings() {
    const playerCount = playerManager.getPlayerIds().length;
    const clampedTricksterCount = this.getClampedConfiguredTricksterCount(playerCount);

    if (stateManager.getVariable("configuredTricksterCount") !== clampedTricksterCount) {
      stateManager.setVariable("configuredTricksterCount", clampedTricksterCount);
    }

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

  getClampedConfiguredTricksterCount(playerCount: number): number {
    const configuredTricksterCount = stateManager.getVariable("configuredTricksterCount");
    const maxTricksters = this.getMaxLegalTricksterCount(playerCount);

    if (
      configuredTricksterCount === undefined ||
      configuredTricksterCount === null
    ) {
      return 1;
    }

    if (configuredTricksterCount < 1) return 1;
    if (configuredTricksterCount > maxTricksters) return maxTricksters;
    return configuredTricksterCount;
  }

  getMaxLegalTricksterCount(playerCount: number): number {
    if (playerCount <= 1) return 1;
    return Math.max(1, Math.min(4, Math.floor((playerCount - 1) / 2)));
  }

  cycleNumberOption(currentValue: number, options: number[]): number {
    if (!options || options.length === 0) return currentValue;

    let currentIndex = -1;
    for (let i = 0; i < options.length; i++) {
      if (options[i] === currentValue) {
        currentIndex = i;
        break;
      }
    }

    if (currentIndex === -1) return options[0];
    return options[(currentIndex + 1) % options.length];
  }

  normalizeNumberOption(currentValue: number, options: number[]): number {
    // Five seconds is reserved for the host's Dev: Enabled lobby shortcut.
    // It is intentionally not part of the normal click-cycle options.
    if (currentValue === 5) return currentValue;

    for (let i = 0; i < options.length; i++) {
      if (options[i] === currentValue) return currentValue;
    }

    return options[0];
  }

  getAlivePlayerIds(): number[] {
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const alivePlayerIds: number[] = [];
    const roleMap = stateManager.getVariable("playerRoleMap");
    const playerIds = Object.keys(roleMap);

    for (let i = 0; i < playerIds.length; i++) {
      if (aliveMap[playerIds[i]] === true) {
        alivePlayerIds.push(parseInt(playerIds[i], 10));
      }
    }

    return alivePlayerIds;
  }

  getAlivePlayerIdsForRole(roleName: string): number[] {
    const roleMap = stateManager.getVariable("playerRoleMap");
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const playerIds = Object.keys(roleMap);
    const matchingPlayerIds: number[] = [];

    for (let i = 0; i < playerIds.length; i++) {
      if (roleMap[playerIds[i]] === roleName && aliveMap[playerIds[i]] === true) {
        matchingPlayerIds.push(parseInt(playerIds[i], 10));
      }
    }

    return matchingPlayerIds;
  }

  getAliveNonTricksterIds(): number[] {
    const roleMap = stateManager.getVariable("playerRoleMap");
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const playerIds = Object.keys(roleMap);
    const playerIdList: number[] = [];

    for (let i = 0; i < playerIds.length; i++) {
      if (roleMap[playerIds[i]] !== "TRICKSTER" && aliveMap[playerIds[i]] === true) {
        playerIdList.push(parseInt(playerIds[i], 10));
      }
    }

    return playerIdList;
  }

  isAliveRoundPlayer(playerId: number): boolean {
    const roleMap = stateManager.getVariable("playerRoleMap");
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const playerIdKey = playerId.toString();

    // A player who joins after the round begins is deliberately absent from
    // the role map and is a spectator, even if another map happens to hydrate
    // before their spectator state does.
    return !!roleMap[playerIdKey] && aliveMap[playerIdKey] === true;
  }

  getPlayerName(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (playerDetails && playerDetails.username) {
      return playerDetails.username;
    }

    return "Player " + playerId.toString();
  }

  getWinningTeam(): string {
    const roleMap = stateManager.getVariable("playerRoleMap");
    const aliveMap = stateManager.getVariable("playerAliveMap");
    const playerIds = Object.keys(roleMap);
    let aliveTricksters = 0;
    let aliveTownsfolk = 0;

    for (let i = 0; i < playerIds.length; i++) {
      if (aliveMap[playerIds[i]] !== true) continue;

      if (roleMap[playerIds[i]] === "TRICKSTER") {
        aliveTricksters += 1;
      } else {
        aliveTownsfolk += 1;
      }
    }

    if (aliveTricksters <= 0) return "TOWNSFOLK";
    if (aliveTricksters >= aliveTownsfolk) return "TRICKSTERS";
    return "";
  }

  getNightPhaseDurationMs(phaseName: string): number {
    let actorCount = 0;

    if (phaseName === "NIGHT_TRICKSTER") {
      actorCount = this.getAlivePlayerIdsForRole("TRICKSTER").length;
    } else if (phaseName === "NIGHT_DETECTIVE") {
      actorCount = this.getAlivePlayerIdsForRole("DETECTIVE").length;
    } else if (phaseName === "NIGHT_DOCTOR") {
      actorCount = this.getAlivePlayerIdsForRole("DOCTOR").length;
    }

    if (actorCount <= 0) return this.fastSkipNightDurationMs;
    return stateManager.getVariable("configuredNightSeconds") * 1000;
  }

  isDayPhase(phaseName: string): boolean {
    return (
      phaseName === "WAITING" ||
      phaseName === "REVEAL" ||
      phaseName === "DISCUSS" ||
      phaseName === "VOTE" ||
      phaseName === "ANNOUNCE" ||
      phaseName === "END" ||
      phaseName === "END_EARLY"
    );
  }

  isCurrentHostPlayer(playerId: number): boolean {
    return playerId === playerManager.getMyPlayerId();
  }

  getInteractivePublicKey(): string {
    let publicKey: string;
    publicKey = "";

    try {
      publicKey = stateManager.getVariable("publicKey" as any);
    } catch (e) {
      publicKey = "";
    }

    return publicKey || "";
  }

  triggerSavedPlayerEffect() {
    if (!playerManager.isHost) return;

    const savedPlayerId = stateManager.getVariable("savedPlayerId");
    const publicKey = this.getInteractivePublicKey();

    if (!savedPlayerId || savedPlayerId <= 0) return;
    if (!publicKey) return;

    try {
      integrationsManager.triggerParticleEffect({
        interactivePublicKey: publicKey,
        particleName: "sparkles_float",
        duration: stateManager.getVariable("configuredDiscussionSeconds") * 1000,
        playerId: savedPlayerId,
        followPlayerId: savedPlayerId,
      } as any);
    } catch (e) {}
  }

  getNowMs(): number {
    return new Date().getTime();
  }
}
