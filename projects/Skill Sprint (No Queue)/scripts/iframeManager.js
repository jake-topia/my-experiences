"use strict";
class iframeManager extends SystemScript {
    numQuestions;
    dataSent;
    constructor() {
        // load state (no async!)
    }
    ;
    onInit() {
        this.numQuestions = Number(stateManager.getVariable('numQuestions'));
        this.dataSent = false;
        //this.animator = scriptManager.getSystem({ systemName: 'animator' });
    }
    ;
    onEvent_fromIframe(event) {
        if (event.type === "connected") {
            // For letting the player know they joined late
            if (stateManager.getVariable("gameStarted") === true && this.dataSent === true) {
                console.log("engine side: sending iframe game already started message");
                this.fireIframeMessage("gameStartedOnConnect", {});
            }
            // after first connect just give everyone 5 second waiting time to connect instead of keeping track of hasLoaded due to race conditions
            // after 5 seconds just set question data on the host's machine to start the game.
            if (!playerManager.isHost)
                return;
            timerManager.createTimer({ autoplay: true, duration: 5000, loop: false, onComplete: (t) => {
                    const questions = this.makeGameData();
                    console.log(JSON.stringify(questions));
                    stateManager.setVariable("questionData", questions);
                } });
            return;
        }
        if (event.type === "answer") {
            const utils = scriptManager.getSystem({ systemName: 'utils' });
            console.log("engine received an answer from " + event.playerId);
            // emit event moving forward with the param event.playerId
            const pIdString = event.playerId.toString();
            const questionAnsweredID = Number(event.questionId);
            const playerAssignment = stateManager.getVariable("playerAssignment");
            const playerPosition = stateManager.getVariable("playerPosition");
            // internal position setting in case of repeat messages //
            if (questionAnsweredID + 1 === playerPosition)
                return;
            stateManager.setVariable("playerPosition", questionAnsweredID + 1);
            console.log("player now at: " + (questionAnsweredID + 1));
            eventManager.emit('movingForward', { playerId: pIdString });
            // console.log("checking for win condition qAnsweredID + 1 = " + (questionAnsweredID + 1) + " numQ's: " + this.numQuestions);
            if (questionAnsweredID + 1 === this.numQuestions) {
                console.log("Player " + pIdString + " finished!");
                const utils = scriptManager.getSystem({ systemName: 'utils' });
                console.log("Player " + pIdString + " is emitting playerCompleted input event with playerAssignment: " + playerAssignment);
                eventManager.emit("playerCompleted", { playerAssignment: playerAssignment, time: event.time });
            }
        }
    }
    fireIframeMessage(type, payload) {
        console.log("firing toIframe");
        eventManager.emit('toIframe', {
            type: type,
            payload: payload,
        });
    }
    async onEvent_playerCompleted({ playerAssignment, time }) {
        if (!playerManager.isHost)
            return;
        const utils = scriptManager.getSystem({ systemName: 'utils' });
        console.log("The next playerX data changed should be for " + playerAssignment + " completion");
        await utils.setCompleted(playerAssignment, time);
    }
    // if we joined late show iframe to give context:
    onEvent_joinedLate() {
        console.log("engine side: we joined late signal");
        // exit if we're not actually in the game
        const id = playerManager.getMyPlayerId();
        const ids = playerManager.getPlayerIds();
        if (ids.indexOf(id) === -1)
            return;
        // o/w open iframe
        integrationsManager.openIframe({
            interactivePublicKey: stateManager.getVariable('interactivePublicKey'),
            hasDataChannel: 'true',
            iframeId: 'myIframe',
            isOpenLinkInDrawer: true,
            link: stateManager.getVariable('iframeUrl'),
            linkSamlQueryParams: undefined,
            title: 'game iframe',
        });
        const iframeManager = scriptManager.getSystem({ systemName: 'iframeManager', });
        if (!iframeManager) {
            scriptManager.attachSystem({ scriptId: 'iframeManager' });
        }
        ;
    }
    onVariableChanged_questionData() {
        console.log("qdata changed");
        //@TODO: only send if active player
        this.dataSent = true;
        this.fireIframeMessage("start", stateManager.getVariable("questionData"));
    }
    playerDataChanged(newValue) {
        const playerData = newValue;
        const playerId = Object.keys(playerData)[0];
        const playerIdNum = Number(playerId);
        const hasCompleted = playerData[playerId].hasCompleted;
        if (!hasCompleted)
            return;
        const time = playerData[playerId].time;
        const { username } = playerManager.getPlayerDetails(playerIdNum);
        console.log("firing completion message for playerX with playerData: " + JSON.stringify(newValue));
        this.fireIframeMessage("completion", { username, time });
    }
    onVariableChanged_player1Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_player2Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_player3Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_player4Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_player5Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_player6Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_player7Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_player8Data({ newValue }) {
        this.playerDataChanged(newValue);
    }
    onVariableChanged_sendDNF() {
        // For each playerXData that has an entry but doesnt have hasCompleted true, send a DNF to iframes for that player
        const utils = scriptManager.getSystem({ systemName: 'utils' });
        const playerIds = playerManager.getPlayerIds();
        for (let id of playerIds) {
            const playerInfo = utils.findExistingSlotOnly(id);
            if (playerInfo === null) { // player is somehow a ghost and wasnt assigned a boat.
                console.log("found ghost player w/ id " + id + " while sending DNFs");
                return;
            }
            const { hasCompleted } = playerInfo;
            if (!hasCompleted) {
                const { username } = playerManager.getPlayerDetails(id);
                this.fireIframeMessage("completion", { username, time: "DNF" });
            }
        }
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
    makeGameData() {
        const mathOp = stateManager.getVariable('mathOperator');
        const numQuestions = +stateManager.getVariable('numQuestions');
        const questions = {};
        if (mathOp === 'typing') {
            return this.makeTypingGameData();
        }
        // compute answer 
        const compute = (a, b) => {
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
        const contains = (arr, val) => {
            for (let k = 0; k < arr.length; k++) {
                if (arr[k] === val)
                    return true;
            }
            return false;
        };
        // build 4 unique choices, then shuffle
        const makeOptions = (correct) => {
            const opts = [correct];
            while (opts.length < 4) {
                const delta = mathRandomInt(-5, 5);
                const cand = correct + delta;
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
            const qn = i + 1;
            const key = `q${qn}`;
            const a = mathRandomInt(1, 12);
            const b = mathRandomInt(1, 12);
            const ans = compute(a, b);
            const opts = makeOptions(ans);
            questions[key] = {
                questionNumber: qn,
                text: `${a} ${mathOp} ${b} = ?`,
                options: opts,
                correctIndex: opts.indexOf(ans.toString()),
            };
        }
        const json = JSON.stringify(questions, null, 2);
        // console.log(json);
        return { questions };
    }
    makeTypingGameData() {
        return { words: ["word1", "word2"] };
    }
}
;
