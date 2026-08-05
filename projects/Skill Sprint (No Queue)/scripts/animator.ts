class animator extends SystemScript {
  // maybe use constructor once lobby has been finalized, then in constructor take in props of the boat sprites that are gonna be moved and store them here
  // constructor(){
  //   // load state (no async!)
  // };

  // @TODO? boatSprites : PseudoList
  animation1: any;
  waveAnimation: any;
  waveAnimation2: any;
  boatIntervalAnimation: any;
  boat1: PseudoSprite;
  sprites: PseudoList;

  numQuestions: number;
  experienceWidth: number;
  boatX: number;
  animationInterval: number;
  animationIntervalString: string;

  waves1: PseudoList;
  waves2: PseudoList;
  boats: PseudoList;

  finishTextAnimation: any;
  
  finishText: PseudoSprite;
  textBg: PseudoSprite;
  
  startTextAnimDirection: boolean;
  startTimeLeft: number;
  finishTimeLeft: number;
  gameStarted: boolean;
  firstFinish: boolean;
  gameOverFired: boolean;
  sceneReady: boolean;
  sceneBuildIndex: number;
  sceneBuildLastSpriteId: string;
  sceneBuildBoatStartX: number;
  waveAnimationsStarted: boolean;

  onInit() {
    const utils: any = scriptManager.getSystem({ systemName: 'utils' });
    this.numQuestions = Number(stateManager.getVariable('numQuestions'));
    this.experienceWidth = 1650;
    // The waves retain their 150px translation, while the starting line and
    // boat spawn boundary now extend another 50px to x=200. Shortening travel
    // by the same amount keeps every boat's final position at the finish.
    const boatStartX: number = 200;
    this.sceneBuildBoatStartX = boatStartX;
    this.boatX = this.experienceWidth - boatStartX - 400;
    this.animationInterval = (this.boatX) / this.numQuestions;
    this.animationIntervalString = '+=' + this.animationInterval.toString();
    this.waves1 = [];
    this.waves2 = [];
    this.boats = [];
    
    // this.textBg = spriteManager.addSprite("blue", {
    //   positionX: 700, 
    //   positionY: 250, 
    //   // topAdjust: 60,
    //   // bottomAdjust: "BRING_TO_BACK",
    // });
    this.startTimeLeft = 0;
    this.finishTimeLeft = 10;
    this.finishText = utils.makeText({text: this.finishTimeLeft + ' seconds remaining.', align: 'center', justify: 'center'});
    this.finishText.position.y = 0;
    this.finishText.position.x = 750;
    this.finishText.topAdjust = 100;
    this.finishText.opacity = 0;
    this.startTextAnimDirection = true;
    this.gameStarted = false;
    this.firstFinish = false;
    this.gameOverFired = false;
    this.sceneReady = false;
    this.sceneBuildIndex = 0;
    this.sceneBuildLastSpriteId = '';
    this.waveAnimationsStarted = false;

    stageManager.setCurrentStage("waveBg");
    this.clearOrderedSceneSprites();

    this.finishTextAnimation = timerManager.animate({
      targets: [this.finishText], 
      keyframes: {
        0: { topAdjust: "+=1" },
        100: { topAdjust: "+=-1" },
      },
      duration: 1000,
      loop: true,
      alternate: false,
      playbackEase: "Linear",
      onLoop: () => {
        if (!playerManager.isHost) return;
        if (!this.firstFinish || this.gameOverFired) return;

        if (this.finishTimeLeft > 0) {
          this.finishTimeLeft = this.finishTimeLeft - 1;
          spriteManager.updateSprite(this.finishText.uniqueId, {text: this.finishTimeLeft.toString() + " seconds remaining.", topAdjust: 100} );
          return;
        }

        // Latch before firing. Without this, firstFinish stays true and
        // finishTimeLeft stays 0, so every following 1s loop re-set sendDNF and
        // spawned another 5s timer, forever.
        this.gameOverFired = true;

        // For each playerXData that has an entry but doesnt have hasCompleted true, send a DNF to iframes for that player
        stateManager.setVariable("sendDNF", true);
        spriteManager.updateSprite(this.finishText.uniqueId, {text: "Game Over!", topAdjust: 100} );

        timerManager.createTimer( { autoplay: true, duration: 5000, loop: false, onComplete: (t) => {
          stateManager.setVariable("closeIframeEvent", true);
        } } );
      },
    });

    
  }

  onPhysicsStep() {
    if (!playerManager.isHost || this.sceneReady) return;

    // Do not start the next row until the prior row's boat is observable.
    if (
      this.sceneBuildLastSpriteId &&
      !spriteManager.getSprite(this.sceneBuildLastSpriteId)
    ) {
      return;
    }

    if (!this.orderedSceneIsCleared()) return;

    // Establish the background separately, then create one complete row during
    // each following onPhysicsStep: wave2 -> wave1 -> boat.
    if (this.sceneBuildIndex === 0) {
      this.textBg = this.addOrderedBackground();
      this.sceneBuildLastSpriteId = 'skillSprintBlueBackground';
      this.sceneBuildIndex = 1;
      return;
    }

    if (this.sceneBuildIndex <= 24) {
      const playerSlot = Math.floor(
        (this.sceneBuildIndex - 1) / 3,
      ) + 1;
      const wave2 = this.addOrderedWave(
        'wave2',
        'skillSprintWave2_' + playerSlot.toString(),
        25 + ((playerSlot - 1) * 100),
      );
      this.waves2.push(wave2);

      const wave1 = this.addOrderedWave(
        'wave1',
        'skillSprintWave1_' + playerSlot.toString(),
        50 + ((playerSlot - 1) * 100),
      );
      this.waves1.push(wave1);

      const boat = this.addOrderedBoat(
        playerSlot,
        this.sceneBuildBoatStartX,
      );
      this.boats.push(boat);

      this.sceneBuildLastSpriteId =
        'skillSprintBoat' + playerSlot.toString();
      this.sceneBuildIndex += 3;
      return;
    }

    this.sceneReady = true;
    this.startWaveAnimations();
  }

  clearOrderedSceneSprites() {
    if (spriteManager.getSprite('skillSprintBlueBackground')) {
      spriteManager.removeSprite('skillSprintBlueBackground');
    }

    for (let playerSlot = 1; playerSlot <= 8; playerSlot++) {
      const boatId = 'skillSprintBoat' + playerSlot.toString();
      const wave2Id = 'skillSprintWave2_' + playerSlot.toString();
      const wave1Id = 'skillSprintWave1_' + playerSlot.toString();

      if (spriteManager.getSprite(boatId)) {
        spriteManager.removeSprite(boatId);
      }
      if (spriteManager.getSprite(wave2Id)) {
        spriteManager.removeSprite(wave2Id);
      }
      if (spriteManager.getSprite(wave1Id)) {
        spriteManager.removeSprite(wave1Id);
      }
    }
  }

  orderedSceneIsCleared(): boolean {
    if (this.sceneBuildIndex > 0) return true;
    if (spriteManager.getSprite('skillSprintBlueBackground')) return false;

    for (let playerSlot = 1; playerSlot <= 8; playerSlot++) {
      if (
        spriteManager.getSprite(
          'skillSprintBoat' + playerSlot.toString(),
        )
      ) {
        return false;
      }
      if (
        spriteManager.getSprite(
          'skillSprintWave2_' + playerSlot.toString(),
        )
      ) {
        return false;
      }
      if (
        spriteManager.getSprite(
          'skillSprintWave1_' + playerSlot.toString(),
        )
      ) {
        return false;
      }
    }

    return true;
  }

  addOrderedBackground(): PseudoSprite {
    return spriteManager.addSprite('blue', {
      uniqueId: 'skillSprintBlueBackground',
      positionX: 0,
      positionY: 75,
      width: this.experienceWidth,
      height: 800,
      displayLayer: 'bottom',
      bottomAdjust: 'BRING_TO_BACK',
    });
  }

  startWaveAnimations() {
    if (this.waveAnimationsStarted) return;
    this.waveAnimationsStarted = true;

    this.waveAnimation = timerManager.animate({
      targets: this.waves1.toArray(), 
      keyframes: {
        0: { positionX: "+=0", positionY: "+=0" },
        100: { positionX: "+=15", positionY: "+=2" },
        200: { positionX: "+=15", positionY: "+=-2" },
        300: { positionX: "+=-15", positionY: "+=-2" },
        400: { positionX: "+=-15", positionY: "+=2" },
      },
      duration: 1000,
      loop: true,
      alternate: false,
      playbackEase: "Linear",
      onBegin: () => {
        console.log("hello world - begin waveAnimation - from arrow fn");
      },
    });

    this.waveAnimation2 = timerManager.animate({
      targets: this.waves2.toArray(), 
      keyframes: {
        0: { positionX: "+=0", positionY: "+=0" },
        100: { positionX: "+=15", positionY: "+=5" },
        200: { positionX: "+=15", positionY: "+=-5" },
        300: { positionX: "+=-15", positionY: "+=-5" },
        400: { positionX: "+=-15", positionY: "+=5" },
      },
      duration: 500,
      loop: true,
      alternate: false,
      playbackEase: "Linear",
      onBegin: () => {
        console.log("hello world - begin waveAnimation2 - from arrow fn");
      },
    });
  }

  addOrderedBoat(playerSlot: number, positionX: number): PseudoSprite {
    const uniqueId = 'skillSprintBoat' + playerSlot.toString();
    return spriteManager.addSprite(this.getBoatSpriteId(playerSlot), {
      uniqueId: uniqueId,
      positionX: positionX,
      positionY: -10 + ((playerSlot - 1) * 100),
      displayLayer: 'bottom',
      bottomAdjust: 'BRING_TO_FRONT',
    });
  }

  addOrderedWave(
    spriteId: string,
    uniqueId: string,
    positionY: number,
  ): PseudoSprite {
    return spriteManager.addSprite(spriteId as any, {
      uniqueId: uniqueId,
      positionX: 150,
      positionY: positionY,
      displayLayer: 'bottom',
      bottomAdjust: 'BRING_TO_FRONT',
    });
  }

  getBoatSpriteId(playerSlot: number): any {
    switch (playerSlot) {
      case 1:
        return 'boat1';
      case 2:
        return 'boat2';
      case 3:
        return 'boat3';
      case 4:
        return 'boat4';
      case 5:
        return 'boat5';
      case 6:
        return 'boat6';
      case 7:
        return 'boat7';
      case 8:
        return 'boat8';
      default:
        return 'boat1';
    }
  }


  onVariableChanged_closeIframeEvent({ newValue }) {
    if (newValue === true) {
      console.log("[Skill Sprint] game over: destroying iframe and removing local player from the game");
      integrationsManager.destroyIframeById({ iframeId: 'myIframe' });
      playerManager.leaveGame();
    }
  }


  onEvent_restartCountdown() {
    if (!playerManager.isHost) return;
    // Rounds now wait for the host-only start button.
  }

  // for correctly setting local state on gameStarted
  onVariableChanged_gameStarted({ newValue }) {
    this.gameStarted = newValue;
  }
 
  onEvent_playerCompleted() {
    if (!playerManager.isHost || this.firstFinish) return;
    spriteManager.updateSprite(this.finishText.uniqueId, {opacity: 1} );
    this.firstFinish = true
  }
  
  onEvent_movingForward({ playerId }) {
    if (!playerManager.isHost) return;
    const utils: any = scriptManager.getSystem({ systemName: 'utils' });
    const playerAssignment = utils.findPlayerAssignment(playerId);
    const playerData: Record<string, any> = utils.getPlayerData(playerAssignment);
    const boatId = playerData[playerId]?.boatId;
    if (boatId === undefined) {
      console.log("error getting the boat assignment of " + playerId);
      return;
    }
    const boat = spriteManager.getSprite(boatId);
    
    this.boatIntervalAnimation = timerManager.animate({
      targets: [boat],
      keyframes: {
        0: { positionX: "+=0" },
        100: { positionX: this.animationIntervalString },
      },
      duration: 1000,
      loop: false,
      alternate: false,
      playbackEase: "inOut(3)",
      onBegin: () => {
        console.log("hello world - begin animation1 - from arrow fn");
      },
      // onLoop: this.onLoop,
    });
  }

	countTrailingPeriods(str: string): number {
		let count = 0;
		for (let i = str.length - 1; i >= 0; i--) {
			if (str[i] === ".") {
				count++;
			} else {
				break;
			}
		}
		return count;
	}




  // onLoop(animation) {
  //   console.log('Hello world on loop this.loop', animation);
  // }
}
