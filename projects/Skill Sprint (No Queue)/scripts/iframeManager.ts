class iframeManager extends SystemScript {
  
  numQuestions: number;
  // Host-only latch: has the host produced questionData for this round yet?
  // This must never be read by client code - it is a synced property, so a
  // client would be reading the host's value, not its own state.
  questionDataCreated: boolean;
  gameDataStartScheduled: boolean;

  // Host-only finish bookkeeping, and synced properties like the latch above -
  // client code must never branch on them.
  //
  // The host is the sequencer for the race: whichever completion it hears
  // first gets the lower rank. Nothing here compares wall-clock timestamps
  // between machines. Because these are synced properties, a client promoted
  // to host inherits the counter and the clock origin, so ranks and times stay
  // continuous across a host change.
  roundStartAtMs: number;
  nextFinishRank: number;
  rankedSlots: Record<string, number>;

  constructor(){
    // load state (no async!)
  };

  onInit(){
    this.numQuestions = Number(stateManager.getVariable('numQuestions'));
    this.questionDataCreated = false;
    this.gameDataStartScheduled = false;
    this.roundStartAtMs = 0;
    this.nextFinishRank = 1;
    this.rankedSlots = {};
    //this.animator = scriptManager.getSystem({ systemName: 'animator' });
  };


  onEvent_fromIframe(event) {
    if (event.type === "connected") {
      console.log("[Skill Sprint] iframe data channel connected for player " + event.playerId);
      eventManager.emit('buttonClicked', { button: 'iframeHeartbeat', playerId: event.playerId.toString() });

      // A reconnecting iframe missed every snapshot published while it was
      // away, so hand it the current board immediately. Reading the variable
      // directly is fine here - this is not an onVariableChanged_* callback.
      const publishedLeaderboard: Record<string, any> = stateManager.getVariable('leaderboard');
      if (publishedLeaderboard && Object.keys(publishedLeaderboard).length > 0) {
        this.fireIframeMessage("leaderboard", { entries: this.toLeaderboardEntries(publishedLeaderboard) });
      }

      if (stateManager.getVariable("gameStarted") !== true) return;

      // The round is already running. Holding a slot means this iframe belongs
      // in the race, so re-send the questions: a reconnecting iframe recovers
      // instead of being wrongly told it joined late. Only a client with no
      // slot actually joined late.
      const myAssignment: number = stateManager.getVariable("playerAssignment");
      if (myAssignment > 0) {
        const questionData: Record<string, any> = stateManager.getVariable("questionData");
        if (questionData && Object.keys(questionData).length > 0) {
          console.log("engine side: re-sending question data to a (re)connected iframe");
          this.fireIframeMessage("start", questionData);
          stateManager.setVariable("myIframeGotQuestions", true);
        }
        // If questionData is not ready yet, onVariableChanged_questionData will
        // deliver it. Either way this player is not late.
        return;
      }

      console.log("engine side: sending iframe game already started message");
      this.fireIframeMessage("gameStartedOnConnect", {});
      return;
    }

    if (event.type === "connectionHeartbeat") {
      eventManager.emit('buttonClicked', { button: 'iframeHeartbeat', playerId: event.playerId.toString() });
      return;
    }

    if (event.type === "iframeConnectionClosing") {
      console.log("[Skill Sprint] iframe is closing for player " + event.playerId);
      eventManager.emit('buttonClicked', { button: 'iframeConnectionClosed', playerId: event.playerId.toString() });
      return;
    }
    
    if (event.type === "answer") {
      const utils: any = scriptManager.getSystem({ systemName: 'utils' });
      console.log("engine received an answer from " + event.playerId);
      
      // emit event moving forward with the param event.playerId
      const pIdString = event.playerId.toString();
      const questionAnsweredID: number = Number(event.questionId);
      const playerAssignment : number = stateManager.getVariable("playerAssignment");
      const playerPosition : number = stateManager.getVariable("playerPosition");

      // Read numQuestions from the config variable rather than this.numQuestions.
      // That property is only assigned in onInit, which runs on the host only, so
      // on a client it stays undefined until the system hydrates - and an
      // undefined comparison below would silently stop the player ever finishing.
      const numQuestions : number = Number(stateManager.getVariable('numQuestions'));

      // internal position setting in case of repeat messages //
      if (questionAnsweredID + 1 === playerPosition) return;
      stateManager.setVariable("playerPosition", questionAnsweredID + 1);
      
      console.log("player now at: " + (questionAnsweredID + 1));

      eventManager.emit('movingForward', {playerId: pIdString});

      // console.log("checking for win condition qAnsweredID + 1 = " + (questionAnsweredID + 1) + " numQ's: " + numQuestions);
      if (questionAnsweredID + 1 === numQuestions) {
        console.log("Player " + pIdString + " finished!");
        const utils: any = scriptManager.getSystem({ systemName: 'utils' });
        console.log("Player " + pIdString + " is emitting playerCompleted input event with playerAssignment: " + playerAssignment);
        eventManager.emit("playerCompleted", { playerAssignment : playerAssignment, time : event.time });
      }                   
    }
  }

  fireIframeMessage(type : string, payload : any) {
    console.log("firing toIframe")
    eventManager.emit('toIframe', {
      type: type,
      payload: payload,
    });
  }

  async onEvent_playerCompleted( { playerAssignment, time } ) {
    if (!playerManager.isHost) return;
    const utils: any = scriptManager.getSystem({ systemName: 'utils' });

    // A client whose local playerAssignment never landed would send 0 here, and
    // getPlayerData throws on anything outside 1-8. Bailing out beats letting
    // that throw abort the rank claim and the snapshot below.
    if (!playerAssignment || playerAssignment < 1 || playerAssignment > 8) {
      console.log("[Skill Sprint] completion arrived with an unusable slot: " + playerAssignment);
      return;
    }

    const slotKey = playerAssignment.toString();

    // A finishing iframe can emit this more than once. Ranking the same slot
    // twice would burn a rank and let a later finisher inherit a lower one.
    if (this.rankedSlots[slotKey]) {
      console.log("[Skill Sprint] ignoring repeat completion for slot " + playerAssignment);
      return;
    }

    const playerData: Record<string, any> = utils.getPlayerData(playerAssignment);
    if (!playerData || Object.keys(playerData).length === 0) {
      console.log("[Skill Sprint] completion arrived for empty slot " + playerAssignment);
      return;
    }

    // Claim the rank synchronously, before any await. Awaiting first would let
    // a second completion interleave here, read the same counter, and tie.
    const finishRank = this.nextFinishRank > 0 ? this.nextFinishRank : 1;
    this.nextFinishRank = finishRank + 1;
    this.rankedSlots[slotKey] = finishRank;

    // Measured on the host's clock so every row on the board is comparable.
    // The finisher's own elapsed time is only a fallback for a host that took
    // over mid-round and therefore has no clock origin of its own.
    const elapsedMs = this.roundStartAtMs > 0 ? Date.now() - this.roundStartAtMs : Number(time);

    console.log("The next playerX data changed should be for " + playerAssignment + " completion");
    console.log("[Skill Sprint] slot " + playerAssignment + " finished at rank " + finishRank + " in " + elapsedMs + "ms");
    await utils.setCompleted(playerAssignment, elapsedMs, finishRank);
    this.publishLeaderboard(false);
  }

  // Host-authoritative snapshot of the whole board, republished in full on
  // every finish. Clients used to accumulate their own board from individual
  // completion messages, so any missed message left that player permanently
  // out of step; replacing the whole thing each time makes every iframe
  // converge on the host's order instead.
  publishLeaderboard(includeUnfinished: boolean) {
    if (!playerManager.isHost) return;
    const utils: any = scriptManager.getSystem({ systemName: 'utils' });

    const snapshot: Record<string, any> = {};

    for (let slot = 1; slot <= 8; slot++) {
      const playerData: Record<string, any> = utils.getPlayerData(slot);
      if (!playerData) continue;

      const playerIds = Object.keys(playerData);
      if (playerIds.length === 0) continue;

      const playerId = playerIds[0];
      const record = playerData[playerId];
      if (!record) continue;
      if (!record.hasCompleted && !includeUnfinished) continue;

      const playerDetails = playerManager.getPlayerDetails(Number(playerId));

      snapshot[slot.toString()] = {
        playerId: playerId,
        username: playerDetails && playerDetails.username ? playerDetails.username : 'Player ' + slot,
        time: record.hasCompleted ? record.time : 'DNF',
        finishRank: record.hasCompleted ? record.finishRank : 0,
      };
    }

    stateManager.setVariable('leaderboard', snapshot);
  }

  onVariableChanged_leaderboard({ newValue }) {
    // A MAP callback can arrive before its child keys hydrate. The host
    // republishes the whole board on every finish, so dropping a bad payload
    // costs nothing - the next one carries the real values.
    if (!newValue || Object.keys(newValue).length === 0) return;
    this.fireIframeMessage("leaderboard", { entries: this.toLeaderboardEntries(newValue) });
  }

  // Ordering lives here, once, so every iframe renders the same rows in the
  // same order: host-assigned rank ascending, then anyone who did not finish.
  toLeaderboardEntries(snapshot: Record<string, any>): any[] {
    const entries: any[] = [];
    const slotKeys = Object.keys(snapshot);

    for (let i = 0; i < slotKeys.length; i++) {
      const entry = snapshot[slotKeys[i]];
      // Child values may not have hydrated yet on a client.
      if (!entry || !entry.username) continue;
      entries.push(entry);
    }

    entries.sort(function (a, b) {
      const rankA = a.finishRank > 0 ? a.finishRank : 999;
      const rankB = b.finishRank > 0 ? b.finishRank : 999;
      return rankA - rankB;
    });

    return entries;
  }

  // if we joined late show iframe to give context:
  onEvent_joinedLate() {
    console.log("engine side: we joined late signal");
    // exit if we're not actually in the game
    const id = playerManager.getMyPlayerId();
    const ids = playerManager.getPlayerIds();
    if (ids.indexOf(id) === -1) return;

    // The iframe was created before the player joined. Reopen its drawer
    // without recreating the iframe or its data channel.
    integrationsManager.forceOpenIframeById({
      iframeId: 'myIframe',
      title: 'game iframe',
    });
  }
  
  onVariableChanged_gameStarted({ newValue }) {
    if (!playerManager.isHost || newValue !== true || this.gameDataStartScheduled || this.questionDataCreated) return;

    // Iframes connected during onBeforeJoinGameAsPlayer. Keep the original
    // brief grace period, then create the game data once for the whole round.
    this.gameDataStartScheduled = true;
    timerManager.createTimer({ autoplay: true, duration: 5000, loop: false, onComplete: (t) => {
      if (!playerManager.isHost || this.questionDataCreated) return;
      // Latch before building so a second firing cannot regenerate questions.
      this.questionDataCreated = true;
      const questions = this.makeGameData();
      console.log(JSON.stringify(questions));
      // Fresh round: nobody has finished yet, so the rank counter starts over.
      this.nextFinishRank = 1;
      this.rankedSlots = {};
      // Clock origin for every finish time the host publishes. Stamped against
      // the questionData write because that write is what starts the round for
      // all iframes at once, so one origin keeps every row comparable.
      this.roundStartAtMs = Date.now();
      stateManager.setVariable("questionData", questions);
    } });
  }

  onVariableChanged_questionData({ newValue }) {
    if (!newValue || Object.keys(newValue).length === 0) return;
    console.log("qdata changed");
    this.fireIframeMessage("start", newValue);
    // Local to this client: my iframe has been handed the questions.
    stateManager.setVariable("myIframeGotQuestions", true);
  }

  

  playerDataChanged(newValue: Record<string, any>, playerSlot: number) {
    // A slot being vacated sets its map to {}, and a MAP callback can also
    // arrive before its child keys hydrate. Both used to throw here.
    if (!newValue || Object.keys(newValue).length === 0) return;

    const playerData: Record<string, any> = newValue;
    const playerId = Object.keys(playerData)[0];
    const playerIdNum = Number(playerId);

    // Slot assignment is host-authoritative now, so this callback is how each
    // client learns which slot it owns. Read it off the key before touching the
    // record: the key is present as soon as the parent MAP arrives, and a
    // follow-up callback for the child values is not guaranteed.
    if (playerIdNum === playerManager.getMyPlayerId()) {
      stateManager.setVariable("playerAssignment", playerSlot);
    }

    // Completions deliberately do not fan out from here any more. Every
    // machine used to build its own board off these eight callbacks, which
    // drifted apart the moment one of them was missed or arrived unhydrated.
    // The host now publishes a single ordered snapshot instead - see
    // publishLeaderboard and onVariableChanged_leaderboard.
  }

  onVariableChanged_player1Data({ newValue }) {
    this.playerDataChanged(newValue, 1);
  }

  onVariableChanged_player2Data({ newValue }) {
    this.playerDataChanged(newValue, 2);
  }

  onVariableChanged_player3Data({ newValue }) {
    this.playerDataChanged(newValue, 3);
  }

  onVariableChanged_player4Data({ newValue }) {
    this.playerDataChanged(newValue, 4);
  }

  onVariableChanged_player5Data({ newValue }) {
    this.playerDataChanged(newValue, 5);
  }

  onVariableChanged_player6Data({ newValue }) {
    this.playerDataChanged(newValue, 6);
  }

  onVariableChanged_player7Data({ newValue }) {
    this.playerDataChanged(newValue, 7);
  }

  onVariableChanged_player8Data({ newValue }) {
    this.playerDataChanged(newValue, 8);
  }

  onVariableChanged_sendDNF() {
    // Final snapshot of the round: every slot still held without a completion
    // is published as a DNF. Clients pick this up through the leaderboard
    // variable rather than building their own DNF rows, so nobody can end the
    // round looking at a different board. Iterating slots also drops the old
    // ghost-player special case - a player with no slot simply has no row.
    if (!playerManager.isHost) return;
    this.publishLeaderboard(true);
  }


  // checkPlayersLoaded() : boolean {
  //   const playerData = stateManager.getVariable("playerData");
  //   console.log("checking if players are loaded playerData: " + JSON.stringify(playerData));

  //   const ids = playerManager.getPlayerIds();
  //   for (let id of ids) {
  //     // Not all players are loaded if we didnt find all playerIds in the mapping
  //     if (!playerData[id]?.hasLoaded) {
  //       console.log("Still waiting for player Id: " + id);
  //       return false;
  //     }
  //   }
    
  //   return true;
  // }

  
  makeGameData(): GameData | TypingGameData {
    const mathOp = stateManager.getVariable('mathOperator');
    const numQuestions = +stateManager.getVariable('numQuestions');
    const questions: Record<string, QuizQuestion> = {};

    if (mathOp === 'typing') {
      return this.makeTypingGameData();
    }

    // compute answer 
    const compute = (a: number, b: number): number => {
      switch (mathOp) {
        case '+': return a + b;
        case '-': return a - b;
        case 'x':       
        case '*': return a * b;
        case '/': return Math.floor(a / b);
        case 'mixed': {
          const ops = [a + b, a - b, a * b, Math.floor(a / b)];
          return ops[mathRandomInt(0, ops.length - 1)];
        }
        default:
          throw new Error(`Unsupported mathOp: ${mathOp}`);
      }
    };

    // our replacement for the includes() func
    const contains = (arr: number[], val: number): boolean => {
      for (let k = 0; k < arr.length; k++) {
        if (arr[k] === val) return true;
      }
      return false;
    };

    // build 4 unique choices, then shuffle
    const makeOptions = (correct: number): string[] => {
      const opts: number[] = [correct];
      while (opts.length < 4) {
        const delta = mathRandomInt(-5, 5);
        const cand  = correct + delta;
        if (cand > 0 && !contains(opts, cand)) {
          opts.push(cand);
        }
      }
      // shuffle options
      for (let i = opts.length - 1; i > 0; i--) {
        const j = mathRandomInt(0, i);
        [opts[i], opts[j]] = [opts[j], opts[i]];
      }
      return opts.map(n => n.toString());
    };

    for (let i = 0; i < numQuestions; i++) {
      const qn    = i + 1;
      const key   = `q${qn}`;
      const a     = mathRandomInt(1, 12);
      const b     = mathRandomInt(1, 12);
      const ans   = compute(a, b);
      const opts  = makeOptions(ans);

      questions[key] = {
        questionNumber: qn,
        text:           `${a} ${mathOp} ${b} = ?`,
        options:        opts,
        correctIndex:   opts.indexOf(ans.toString()),
      };
    }

    const json = JSON.stringify(questions, null, 2);
    // console.log(json);

    return { questions };
  }

  makeTypingGameData() : TypingGameData {
    return { words: ["word1", "word2"]};
  }


};
