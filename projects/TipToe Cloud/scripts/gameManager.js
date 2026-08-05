"use strict";
class gameManager extends SystemScript {
    experienceWidth;
    experienceHeight;
    centralText;
    winnerText;
    timerAnim;
    timerAnimIsCounting;
    timerAnimTimeLeft;
    utils;
    // constructor(){
    //   // load state (no async!)
    // };
    onInit() {
        this.experienceHeight = 1500;
        this.experienceWidth = 1500;
        scriptManager.attachSystem({ scriptId: "utils" });
        this.utils = scriptManager.getSystem({ systemName: "utils" });
        this.centralText = this.utils.makeText({ text: "", align: "center", justify: "start" });
        spriteManager.updateSprite(this.centralText.uniqueId, {
            positionX: this.experienceWidth / 2 - 230,
            positionY: this.experienceHeight / 2,
            text: "",
            fontSize: 50,
        });
        // this.centralText = spriteManager.addSprite("basicText", {positionX: this.experienceWidth/2 - 200,
        //   positionY: this.experienceHeight/2, text: "", fontSize: 50});
        this.timerAnim = timerManager.animate({
            targets: [this.centralText],
            keyframes: {
                0: { topAdjust: "+=1" },
                100: { topAdjust: "+=-1" },
            },
            duration: 1000,
            loop: true,
            alternate: false,
            playbackEase: "Linear",
            // onUpdate: () => {
            //   console.log("text animate update");
            // },
            onLoop: () => {
                if (!playerManager.isHost)
                    return;
                if (this.timerAnimIsCounting) {
                    spriteManager.updateSprite(this.centralText.uniqueId, {
                        text: "Game restarting in: " + this.timerAnimTimeLeft.toString(),
                    });
                    if (this.timerAnimTimeLeft === 1) {
                        // teleport players early to avoid unwanted colliding:
                        console.log("timerAnim timeout gameManager teleport");
                        playerManager.teleportPlayers(playerManager.getPlayerIds(), {
                            distributionType: "area",
                            positionX: 50,
                            positionY: 1425,
                            width: 1400,
                            height: 50,
                        });
                    }
                    if (this.timerAnimTimeLeft === 0) {
                        this.timerAnimIsCounting = false;
                        stateManager.setVariable("winnerAnnounced", false);
                        stateManager.setVariable("firstTileRevealed", false);
                        spriteManager.updateSprite(this.centralText.uniqueId, { text: "" });
                        eventManager.emit("reset");
                        return;
                    }
                    this.timerAnimTimeLeft -= 1;
                    return;
                }
                if (stateManager.getVariable("winnerAnnounced") === true) {
                    // start counting
                    this.timerAnimIsCounting = true;
                    this.timerAnimTimeLeft = 7;
                }
            },
            onBegin: () => {
                console.log("Begin text animation");
            },
            // onLoop: this.onLoop,
        });
    }
    onPlayerJoined({ playerId }) {
        // playerManager.tintPlayer(playerId, '#f56969ff');
        playerManager.setNameplate(playerId, "\uD83E\uDD76 " + playerManager.getPlayerDetails(playerId).username + " \uD83E\uDD76");
    }
}
// onEvent_winner({playerName}) {
//   console.log("on event winner");
//   spriteManager.updateSprite(this.winnerText.uniqueId, {text: playerName + " wins!"});
// }
// class animator extends SystemScript {
//   // maybe use constructor once lobby has been finalized, then in constructor take in props of the boat sprites that are gonna be moved and store them here
//   // constructor(){
//   //   // load state (no async!)
//   // };
//   // @TODO? boatSprites : PseudoList
//   animation1: any;
//   waveAnimation: any;
//   waveAnimation2: any;
//   boatIntervalAnimation: any;
//   boat1: PseudoSprite;
//   sprites: PseudoList;
//   numQuestions: number;
//   experienceWidth: number;
//   boatX: number;
//   animationInterval: number;
//   animationIntervalString: string;
//   waves1: PseudoList;
//   waves2: PseudoList;
//   boats: PseudoList;
//   textAnimation: any;
//   startTextAnimation: any;
//   finishTextAnimation: any;
//   countdownText: PseudoSprite;
//   startText: PseudoSprite;
//   finishText: PseudoSprite;
//   textBg: PseudoSprite;
//   startTextAnimDirection: boolean;
//   startTimeLeft: number;
//   finishTimeLeft: number;
//   gameStarted: boolean;
//   firstFinish: boolean;
//   onInit() {
//     const utils: any = scriptManager.getSystem({ systemName: 'utils' });
//     this.numQuestions = Number(stateManager.getVariable('numQuestions'));
//     this.experienceWidth = 1500;
//     this.boatX = this.experienceWidth - 400;
//     this.animationInterval = (this.boatX) / this.numQuestions;
//     this.animationIntervalString = '+=' + this.animationInterval.toString();
//     this.waves1 = [];
//     this.waves2 = [];
//     this.boats = [];
//     // this.textBg = spriteManager.addSprite("blue", {
//     //   positionX: 550,
//     //   positionY: 250,
//     //   // topAdjust: 60,
//     //   // bottomAdjust: "BRING_TO_BACK",
//     // });
//     this.startTimeLeft = 10;
//     this.finishTimeLeft = 10;
//     this.countdownText = utils.makeText({text: 'The race will start in: ' + this.startTimeLeft, align: 'center', justify: 'center'});
//     this.startText = utils.makeText({text: 'Waiting for more players...', align: 'center', justify: 'center'});
//     this.finishText = utils.makeText({text: this.finishTimeLeft + ' seconds remaining.', align: 'center', justify: 'center'});
//     this.countdownText.position.y = 350;
//     this.countdownText.position.x = 600;
//     this.countdownText.topAdjust = 100;
//     this.startText.position.y = 320;
//     this.startText.position.x = 600;
//     this.startText.topAdjust = 100;
//     this.finishText.position.y = -75;
//     this.finishText.position.x = 600;
//     this.finishText.topAdjust = 100;
//     this.finishText.opacity = 0;
//     this.startTextAnimDirection = true;
//     this.gameStarted = false;
//     this.firstFinish = false;
//     stageManager.setCurrentStage("waveBg");
// // @TODO? optimize by making each group of waves 1 sprite instead of 8.
//     for (let i = 0; i < 16; i++) {
//       let wave: PseudoSprite;
//       if (i % 2 === 1) {
//         wave = spriteManager.addSprite("wave1", {positionY: -75 + (i * 50), topAdjust: 40});
//         this.waves1.push(wave);
//       } else {
//         wave = spriteManager.addSprite("wave2", {positionY: -50 + (i * 50), topAdjust: 20});
//         this.waves2.push(wave);
//       }
//     }
//     // this.boat1 = spriteManager.addSprite("boat1", {});
//     this.waveAnimation = timerManager.animate({
//       targets: this.waves1.toArray(),
//       keyframes: {
//         0: { positionX: "+=0", positionY: "+=0" },
//         100: { positionX: "+=15", positionY: "+=2" },
//         200: { positionX: "+=15", positionY: "+=-2" },
//         300: { positionX: "+=-15", positionY: "+=-2" },
//         400: { positionX: "+=-15", positionY: "+=2" },
//       },
//       duration: 1000,
//       loop: true,
//       alternate: false,
//       playbackEase: "Linear",
//       onBegin: () => {
//         console.log("hello world - begin waveAnimation - from arrow fn");
//       },
//       // onLoop: this.onLoop,
//     });
//     this.waveAnimation2 = timerManager.animate({
//       targets: this.waves2.toArray(),
//       keyframes: {
//         0: { positionX: "+=0", positionY: "+=0" },
//         100: { positionX: "+=15", positionY: "+=5" },
//         200: { positionX: "+=15", positionY: "+=-5" },
//         300: { positionX: "+=-15", positionY: "+=-5" },
//         400: { positionX: "+=-15", positionY: "+=5" },
//       },
//       duration: 500,
//       loop: true,
//       alternate: false,
//       playbackEase: "Linear",
//       onBegin: () => {
//         console.log("hello world - begin waveAnimation2 - from arrow fn");
//       },
//       // onLoop: this.onLoop,
//     });
//     this.textAnimation = timerManager.animate({
//       targets: [this.countdownText],
//       keyframes: {
//         0: { topAdjust: "+=1" },
//         100: { topAdjust: "+=-1" },
//       },
//       duration: 1000,
//       loop: true,
//       alternate: false,
//       playbackEase: "Linear",
//       // onUpdate: () => {
//       //   console.log("text animate update");
//       // },
//       onLoop: () => {
//         this.startTimeLeft = this.startTimeLeft - 1;
//         console.log(this.startTimeLeft.toString());
//         spriteManager.updateSprite(this.countdownText.uniqueId, {text: "The race will start in: " + this.startTimeLeft.toString(), topAdjust: 100} );
//         if (this.startTimeLeft < 0) {
//           spriteManager.updateSprite(this.countdownText.uniqueId, {text: ""} );
//           spriteManager.updateSprite(this.startText.uniqueId, {text: ""} );
//           // spriteManager.updateSprite(this.textBg.uniqueId, {opacity: 0});
//           if (this.gameStarted === false) {
//             // emit game start event
//             console.log("setting gameStarted to true");
//             stateManager.setVariable("gameStarted", true);
//             this.gameStarted = true;
//           }
//         }
//       },
//       onBegin: () => {
//         console.log("Begin text animation");
//       },
//       // onLoop: this.onLoop,
//     });
//     this.startTextAnimation = timerManager.animate({
//       targets: [this.startText],
//       keyframes: {
//         0: { topAdjust: "+=1" },
//         100: { topAdjust: "+=-1" },
//       },
//       duration: 250,
//       loop: true,
//       alternate: false,
//       playbackEase: "Linear",
//       onLoop: () => {
//         const periodCount : number = this.countTrailingPeriods(this.startText.text);
//         if (this.startTimeLeft <= 0) {
//           return;
//         } else if (periodCount >= 3) {
//           spriteManager.updateSprite(this.startText.uniqueId, {text: 'Waiting for more players..', topAdjust: 100} );
//           this.startTextAnimDirection = true;
//         } else if (periodCount === 2 ) {
//           if (this.startTextAnimDirection) {
//             spriteManager.updateSprite(this.startText.uniqueId, {text: 'Waiting for more players.', topAdjust: 100} );
//           } else {
//             spriteManager.updateSprite(this.startText.uniqueId, {text: 'Waiting for more players...', topAdjust: 100} );
//           }
//         } else if (periodCount === 1) {
//           if (this.startTextAnimDirection) {
//             spriteManager.updateSprite(this.startText.uniqueId, {text: 'Waiting for more players', topAdjust: 100} );
//           } else {
//             spriteManager.updateSprite(this.startText.uniqueId, {text: 'Waiting for more players..', topAdjust: 100} );
//           }
//         } else {
//           spriteManager.updateSprite(this.startText.uniqueId, {text: 'Waiting for more players.', topAdjust: 100} );
//           this.startTextAnimDirection = false;
//         }
//       },
//     });
//     this.finishTextAnimation = timerManager.animate({
//       targets: [this.finishText],
//       keyframes: {
//         0: { topAdjust: "+=1" },
//         100: { topAdjust: "+=-1" },
//       },
//       duration: 1000,
//       loop: true,
//       alternate: false,
//       playbackEase: "Linear",
//       onLoop: () => {
//         if (this.firstFinish) {
//           if (this.finishTimeLeft <= 0) {
//             // For each playerXData that has an entry but doesnt have hasCompleted true, send a DNF to iframes for that player
//             stateManager.setVariable("sendDNF", true);
//             spriteManager.updateSprite(this.finishText.uniqueId, {text: "Game Over!", topAdjust: 100} );
//             timerManager.createTimer( { autoplay: true, duration: 5000, loop: false, onComplete: (t) => {
//               stateManager.setVariable("closeIframeEvent", true);
//             } } );
//           } else {
//             this.finishTimeLeft = this.finishTimeLeft - 1;
//             spriteManager.updateSprite(this.finishText.uniqueId, {text: this.finishTimeLeft.toString() + " seconds remaining.", topAdjust: 100} );
//           }
//         }
//       },
//     });
//   }
//   onVariableChanged_closeIframeEvent({ newValue }) {
//     if (newValue === true) {
//       console.log("closingIframe");
//       integrationsManager.closeIframe();
//       if (playerManager.isHost) {
//         console.log("kicking host");
//         //playerManager.kickFromGame(playerManager.getMyPlayerId());
//         playerManager.leaveGame();
//       }
//     }
//   }
//   onEvent_restartCountdown() {
//     if (!playerManager.isHost) return;
//     console.log("RESTART COUNTDOWN!!!!!!!!!!!!");
//     if (this.startTimeLeft < 10) {
//       this.startTimeLeft = 10;
//     }
//   }
//   // for correctly setting local state on gameStarted
//   onVariableChanged_gameStarted() {
//     if (!playerManager.isHost) return;
//   }
//   onEvent_playerCompleted() {
//     if (!playerManager.isHost || this.firstFinish) return;
//     spriteManager.updateSprite(this.finishText.uniqueId, {opacity: 1} );
//     this.firstFinish = true
//   }
//   onEvent_movingForward({ playerId }) {
//     if (!playerManager.isHost) return;
//     const utils: any = scriptManager.getSystem({ systemName: 'utils' });
//     const playerAssignment = utils.findPlayerAssignment(playerId);
//     const playerData: Record<string, any> = utils.getPlayerData(playerAssignment);
//     const boatId = playerData[playerId]?.boatId;
//     if (boatId === undefined) {
//       console.log("error getting the boat assignment of " + playerId);
//       return;
//     }
//     const boat = spriteManager.getSprite(boatId);
//     this.boatIntervalAnimation = timerManager.animate({
//       targets: [boat],
//       keyframes: {
//         0: { positionX: "+=0" },
//         100: { positionX: this.animationIntervalString },
//       },
//       duration: 1000,
//       loop: false,
//       alternate: false,
//       playbackEase: "inOut(3)",
//       onBegin: () => {
//         console.log("hello world - begin animation1 - from arrow fn");
//       },
//       // onLoop: this.onLoop,
//     });
//   }
// 	countTrailingPeriods(str: string): number {
// 		let count = 0;
// 		for (let i = str.length - 1; i >= 0; i--) {
// 			if (str[i] === ".") {
// 				count++;
// 			} else {
// 				break;
// 			}
// 		}
// 		return count;
// 	}
//   // onLoop(animation) {
//   //   console.log('Hello world on loop this.loop', animation);
//   // }
// }
