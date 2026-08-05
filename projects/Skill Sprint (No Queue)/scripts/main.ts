interface PlayerInfo {
  position: number;
  hasLoaded: boolean;
  boatId: string;
}

class main extends SystemScript {
  experienceWidth: number;
  experienceHeight: number;
  raceOffsetX: number;
  boatX: number;
  playerIds: PseudoList;
  sprites: PseudoList;
  availableSlots: PseudoList;
  gameStarted: boolean;

  boat1: PseudoSprite;
  boat2: PseudoSprite;
  boat3: PseudoSprite;
  boat4: PseudoSprite;
  boat5: PseudoSprite;
  boat6: PseudoSprite;
  boat7: PseudoSprite;
  boat8: PseudoSprite;

  textBg: PseudoSprite;

  onHostStart() {
    // Match RLGL's faster host synchronization cadence so ordered scene
    // construction can advance through its one-row-per-step sequence quickly.
    gameLoopManager.setSyncParameters({
      syncsPerSecond: 30,
      fullUpdatePerSecond: 10,
    });

    // A live script sync can preserve the previous auto-ID boat instances.
    // Remove any boat references retained by this system before rebuilding the
    // scene with the animator's stable IDs.
    this.removePreviousBoatReferences();
    this.removePreviousPlayerTextSprites();

    // @TODO lock players from joining until after this executes
    //gameStateManager.setIsAcceptingPlayers(false);
    this.experienceWidth = 1650;
    this.experienceHeight = 875;
    this.raceOffsetX = 150;
    this.boatX = this.raceOffsetX + 50;
    this.playerIds = [];
    this.sprites = [];
    this.gameStarted = false;
    
    for (let i = 0; i < 8; i++) {
      this.playerIds.push(-1);
    }
    
    scriptManager.attachSystem({ scriptId: 'utils' });
    const utils: any = scriptManager.getSystem({ systemName: 'utils' });
    this.removeLegacyAssignedBoats(utils);
    scriptManager.attachSystem({ scriptId: 'animator' });

    scriptManager.attachSystem({ scriptId: 'gameManager' });
    scriptManager.attachSystem({ scriptId: 'iframeManager' });

    // The finish line remains flush against the right-hand edge after the
    // original 1500px race is translated 150px to the right. Unlike the other
    // scene sprites, both race lines keep their existing vertical geometry.
    //
    // Both race lines use the bottom layer's front adjustment so they stay
    // ahead of the deliberately ordered background, boats, and waves.
    //
    // opacity, checkCollisions and isImpassable are deliberately left unset:
    // touching any of them in code is what breaks same-layer draw ordering.
    const finishLineWidth: number = 150;
    const finishLineOptions: any = {
      uniqueId: 'skillSprintFinishLine',
      positionX: this.experienceWidth - finishLineWidth,
      positionY: 0,
      width: finishLineWidth,
      height: 875,
      fill: '#FFFFFF',
      displayLayer: 'bottom',
      bottomAdjust: "BRING_TO_FRONT",
      // topAdjust: -30,
    };
    if (!spriteManager.getSprite('skillSprintFinishLine')) {
      spriteManager.addSprite('baseRect', finishLineOptions);
    } else {
      spriteManager.updateSprite('skillSprintFinishLine', finishLineOptions);
    }

    // The newly-created left gutter is the starting line. Match the finish
    // line's layering so both lines render in front of the waves.
    const startingLineOptions: any = {
      uniqueId: 'skillSprintStartingLine',
      positionX: 0,
      positionY: 0,
      width: this.boatX,
      height: 875,
      fill: '#FFFFFF',
      displayLayer: 'bottom',
      bottomAdjust: 'BRING_TO_FRONT',
      // topAdjust: -30,
    };
    if (!spriteManager.getSprite('skillSprintStartingLine')) {
      spriteManager.addSprite('baseRect', startingLineOptions);
    } else {
      spriteManager.updateSprite('skillSprintStartingLine', startingLineOptions);
    }

    if (!playerManager.isHost) return;

    console.log("Host assigned to player 1. hostid: " + playerManager.getMyPlayerId());
    stateManager.setVariable("playerAssignment", 1);
    eventManager.emit("updateTextSpritesAndPlayerData", { playerId: playerManager.getMyPlayerId(), playerSlot: 1 } );

    //gameStateManager.setIsAcceptingPlayers(true);
  }

  removePreviousBoatReferences() {
    const previousBoats: PseudoSprite[] = [
      this.boat1,
      this.boat2,
      this.boat3,
      this.boat4,
      this.boat5,
      this.boat6,
      this.boat7,
      this.boat8,
    ];

    for (let i = 0; i < previousBoats.length; i++) {
      const previousBoat = previousBoats[i];
      if (!previousBoat || !previousBoat.uniqueId) continue;
      if (spriteManager.getSprite(previousBoat.uniqueId)) {
        spriteManager.removeSprite(previousBoat.uniqueId);
      }
    }
  }

  removePreviousPlayerTextSprites() {
    const retainedTextSprites: any =
      stateManager.getVariable("playerTextSprites");

    if (retainedTextSprites) {
      const textSprites: PseudoSprite[] =
        typeof retainedTextSprites.toArray === 'function'
          ? retainedTextSprites.toArray()
          : retainedTextSprites;

      for (let i = 0; i < textSprites.length; i++) {
        const textSprite = textSprites[i];
        if (!textSprite || !textSprite.uniqueId) continue;
        if (spriteManager.getSprite(textSprite.uniqueId)) {
          spriteManager.removeSprite(textSprite.uniqueId);
        }
      }
    }

    stateManager.setVariable("playerTextSprites", []);
  }

  removeLegacyAssignedBoats(utils: any) {
    for (let playerSlot = 1; playerSlot <= 8; playerSlot++) {
      const playerData: Record<string, any> = utils.getPlayerData(playerSlot);
      const playerIds = Object.keys(playerData);
      if (playerIds.length === 0) continue;

      const playerRecord = playerData[playerIds[0]];
      const previousBoatId = playerRecord ? playerRecord.boatId : null;
      if (!previousBoatId) continue;
      if (previousBoatId.indexOf('skillSprintBoat') === 0) continue;

      if (spriteManager.getSprite(previousBoatId)) {
        spriteManager.removeSprite(previousBoatId);
      }
    }
  }

  onPlayerStart() {
    if (playerManager.isHost) return;
    if (this.gameStarted) eventManager.emit("joinedLate");
    const playerId : number = playerManager.getMyPlayerId();
    const { username } = playerManager.getPlayerDetails(playerId);
    console.log("Running onPlayerStart() for pId " + playerId + " and name " + username);

    // Slot assignment is host-authoritative. Picking a slot here would read this
    // client's replica of playerXData, so two players joining in the same sync
    // window would both claim the same open slot and the second write would
    // clobber the first. Ask the host to assign instead; playerSlot 0 means
    // "assign me". We learn our own slot from onVariableChanged_playerXData.
    eventManager.emit("updateTextSpritesAndPlayerData", { playerId, playerSlot: 0 } );
    //eventManager.emit("restartCountdown");

  }

  // @TODO: move the findslot methods into utils.

  findSlot(playerId: number) : number | null {
    const player1Data: Record<string, any> = stateManager.getVariable("player1Data");
    if (Object.keys(player1Data).length > 0 === false || Object.keys(player1Data)[0] === playerId.toString()) return 1;
    const player2Data: Record<string, any> = stateManager.getVariable("player2Data");
    if (Object.keys(player2Data).length > 0 === false || Object.keys(player2Data)[0] === playerId.toString()) return 2;
    const player3Data: Record<string, any> = stateManager.getVariable("player3Data");
    if (Object.keys(player3Data).length > 0 === false || Object.keys(player3Data)[0] === playerId.toString()) return 3;
    const player4Data: Record<string, any> = stateManager.getVariable("player4Data");
    if (Object.keys(player4Data).length > 0 === false || Object.keys(player4Data)[0] === playerId.toString()) return 4;
    const player5Data: Record<string, any> = stateManager.getVariable("player5Data");
    if (Object.keys(player5Data).length > 0 === false || Object.keys(player5Data)[0] === playerId.toString()) return 5;
    const player6Data: Record<string, any> = stateManager.getVariable("player6Data");
    if (Object.keys(player6Data).length > 0 === false || Object.keys(player6Data)[0] === playerId.toString()) return 6;
    const player7Data: Record<string, any> = stateManager.getVariable("player7Data");
    if (Object.keys(player7Data).length > 0 === false || Object.keys(player7Data)[0] === playerId.toString()) return 7;
    const player8Data: Record<string, any> = stateManager.getVariable("player8Data");
    if (Object.keys(player8Data).length > 0 === false || Object.keys(player8Data)[0] === playerId.toString()) return 8;
    return null;
  }


  onEvent_updateTextSpritesAndPlayerData( { playerId, playerSlot } ) {
    if (!playerManager.isHost) return;

    const utils: any = scriptManager.getSystem({ systemName: 'utils' });

    // The player may have left between emitting this request and the host
    // handling it. Assigning them now would leak a slot to a phantom.
    const currentPlayerIds: number[] = playerManager.getPlayerIds();
    if (currentPlayerIds.indexOf(playerId) === -1) {
      console.log("Ignoring slot request for player who already left: " + playerId);
      return;
    }

    // Refuse to seat anyone once the round is underway. Their boat would start
    // at the previous occupant's position and they would be counted by the
    // start gate and the DNF sweep.
    if (stateManager.getVariable("gameStarted") === true) {
      console.log("Ignoring slot request from late joiner: " + playerId);
      return;
    }

    // playerSlot 0 means the requester wants the host to pick. findSlot returns
    // the slot this player already owns if it has one, so retries are safe.
    var slotToUse: number = playerSlot;
    if (!slotToUse) {
      const foundSlot: number | null = this.findSlot(playerId);
      if (foundSlot === null) {
        console.log("No room in experience for player: " + playerId);
        return;
      }
      slotToUse = foundSlot;
    }

    // Reserve the slot BEFORE any await. Awaiting first would let a second
    // invocation of this handler interleave here, read the same open slot, and
    // overwrite this reservation.
    utils.setPlayerData(slotToUse, playerId, this.getBoatId(slotToUse));
    this.addPlayerStartBox(slotToUse);
    this.teleportPlayerToStart(playerId, slotToUse);

    const { username } = playerManager.getPlayerDetails(playerId);
    console.log("Assigned slot " + slotToUse + " to " + username + " (" + playerId + ")");
  }

  remedyGhostHost() {
    if (!playerManager.isHost) return;
    const hostId : number = playerManager.getMyPlayerId();
    const { username } = playerManager.getPlayerDetails(hostId);
    const player1Data = stateManager.getVariable("player1Data");
    if (Object.keys(player1Data)[0] !== hostId.toString()) {
      const newHostSlot : number | null = this.findSlot(hostId);
      if (newHostSlot === null) {
        console.log("No room in experience for player: " + hostId);
        return;
      }

      stateManager.setVariable("playerAssignment", newHostSlot);
      eventManager.emit("updateTextSpritesAndPlayerData", { hostId, newHostSlot } );
    }
  }


  // lookForGhostPlayers(playerId: number, playerSlot: number) : number[] {
  //   var ghosts : number[] = [];
  //   var playerSlotRep : number[] = [null, null, null, null, null, null, null, null];
  //   const pIds : number[] = playerManager.getPlayerIds();
  //   for (let id of pIds) {
  //     const playerSlotFound : number | null = this.findExistingSlotOnly(id)
  //     if (playerSlotFound === null) {
  //       console.log(" ghost with playerId: " + id + " found.");
  //       ghosts.push(id);
  //     } else {
  //       playerSlotRep[playerSlotFound - 1] = id;
  //     }
  //   }

  //   for (let ghost of ghosts) {
  //     if (playerManager.isHost) return;
  //     const playerId : number = playerManager.getMyPlayerId();
  //     const { username } = playerManager.getPlayerDetails(playerId);
  //     console.log("Running onPlayerStart() for pId " + playerId + " and name " + username);
  //     // go through each playerXData
  //     // upon finding Data with no keys (a.k.a. an open slot [Object.keys(obj).length > 0 === false]), emit an input event for host to updateTextSprites
  //     const playerSlot = this.findSlot(playerId);
  //     if (playerSlot === null) {
  //       console.log("No room in experience for player: " + playerId);
  //       return;
  //     }

  //     stateManager.setVariable("playerAssignment", playerSlot);
  //     eventManager.emit("updateTextSpritesAndPlayerData", { playerId, playerSlot } );
  //   }
  // }


  async onPlayerJoined({ playerId }: { playerId: number }): Promise<void> {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("gameStarted") === true) return;
    console.log("emitting restart countdown event");
    eventManager.emit("restartCountdown");
    // // @TODO lock players from joining until after this executes for the host?
    // const utils: any = scriptManager.getSystem({ systemName: 'utils' });

    // const { username } = playerManager.getPlayerDetails(playerId);
    // console.log("USERNAME: " + username);

    // var pSpritesArray: PseudoSprite[] = stateManager.getVariable("playerTextSprites");
    // pSpritesArray.reverse();
    // // return if this player already has a slot
    // if (pSpritesArray.some(ps => ps.text === username)) return;

    // const labels = pSpritesArray.map(ps => ps.text);
    // const slotIndex = labels.lastIndexOf('a');
    // if (slotIndex === -1) {  // a.k.a. no slots left
    //   // @TODO? there's no slots left so kick them from the experience?
    //   return;
    // }
    // const pSpriteToUse = pSpritesArray[slotIndex];
    // const boatAssignment = 8 - slotIndex;
    // console.log("playerIds (" + playerId + ") slot index: " + slotIndex + " bassignment: " + boatAssignment);
    // if (playerManager.getMyPlayerId() === playerId) {
    //   stateManager.setVariable("playerAssignment", boatAssignment);
    //   console.log("stateManager.getVariable(playerAssignment); " + stateManager.getVariable("playerAssignment"));
    // }

    // if (!playerManager.isHost) return; //////// Only the host should run the below /////////
    
    // await spriteManager.updateSprite(pSpriteToUse.uniqueId, { positionX: pSpriteToUse.position.x, positionY: pSpriteToUse.position.y, text: username });
    // await utils.setPlayerData(boatAssignment, playerId, this.getBoatId(boatAssignment));
    
    
    // // var playerData : Record<string, any> = stateManager.getVariable("playerData");
    // // playerData[playerId] = { position: 0, hasLoaded: false, boatId: this.getBoatId(boatAssignment), };
    // // stateManager.setVariable("playerData", playerData);

    // console.log("Player1 Data after " + playerId + " joined: " + JSON.stringify(stateManager.getVariable("player1Data")));
    // console.log("Player2 Data after " + playerId + " joined: " + JSON.stringify(stateManager.getVariable("player2Data")));
    // console.log("After update, pSpriteToUse.text =", JSON.stringify(pSpriteToUse.text));
    
  }


  onPlayerLeft({ playerId }: { playerId: number; }) {
    if (playerManager.getMyPlayerId() === playerId) {
      console.log("[Skill Sprint] player left the game; destroying persistent iframe");
      integrationsManager.destroyIframeById({ iframeId: 'myIframe' });
    }
    if (!playerManager.isHost) return;
    
    const utils: any = scriptManager.getSystem({ systemName: 'utils' });
    this.teleportPlayerOutsideExperience(playerId);

    // Late joiners are deliberately left unassigned once a round starts, but
    // they still need the outside-bounds teleport above when they leave.
    const slotInfo: any = utils.findExistingSlotOnly(playerId);
    if (!slotInfo) return;

    // Delete the player data and booth from the server-authoritative world.
    const playerSlot : number = slotInfo.slot;
    this.removePlayerStartBox(playerSlot);
    utils.deletePlayerData(playerSlot);

  }

  getPlayerStartPosition(playerSlot: number): { positionX: number; positionY: number } {
    return {
      positionX: Math.floor(this.raceOffsetX / 2) + 10,
      // Move the collider walls and their matching player teleport point down
      // 75px with the race-line adjustment.
      positionY: ((playerSlot - 1) * 100) + 105,
    };
  }

  addPlayerStartBox(playerSlot: number) {
    if (!playerManager.isHost) return;

    this.removePlayerStartBox(playerSlot);

    const playerPosition = this.getPlayerStartPosition(playerSlot);
    // Five pixels per side smaller than the previous 120x82 booth.
    const boxWidth: number = 110;
    const boxHeight: number = 72;
    const bottomExpansion: number = 20;
    const wallThickness: number = 8;
    const halfWidth: number = Math.floor(boxWidth / 2);
    const halfHeight: number = Math.floor(boxHeight / 2);
    const halfWall: number = Math.floor(wallThickness / 2);
    const topX: number = playerPosition.positionX - halfWidth;
    const sideY: number = playerPosition.positionY - halfHeight;
    const wallFill: string = '#000000';

    this.addPlayerStartBoxWall(
      this.getPlayerStartBoxWallId(playerSlot, 'top'),
      topX,
      playerPosition.positionY - halfHeight - halfWall,
      boxWidth,
      wallThickness,
      wallFill,
    );
    this.addPlayerStartBoxWall(
      this.getPlayerStartBoxWallId(playerSlot, 'bottom'),
      topX,
      playerPosition.positionY + halfHeight - halfWall + bottomExpansion,
      boxWidth,
      wallThickness,
      wallFill,
    );
    this.addPlayerStartBoxWall(
      this.getPlayerStartBoxWallId(playerSlot, 'left'),
      playerPosition.positionX - halfWidth - halfWall,
      sideY,
      wallThickness,
      boxHeight + bottomExpansion,
      wallFill,
    );
    this.addPlayerStartBoxWall(
      this.getPlayerStartBoxWallId(playerSlot, 'right'),
      playerPosition.positionX + halfWidth - halfWall,
      sideY,
      wallThickness,
      boxHeight + bottomExpansion,
      wallFill,
    );
  }

  addPlayerStartBoxWall(
    uniqueId: string,
    positionX: number,
    positionY: number,
    width: number,
    height: number,
    fill: string,
  ) {
    const wallOptions: any = {
      uniqueId: uniqueId,
      positionX: Math.round(positionX),
      positionY: Math.round(positionY),
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      fill: fill,
      opacity: 0.8,
      isStatic: true,
      checkCollisions: true,
      isImpassable: true,
      displayLayer: 'top',
      topAdjust: 1000,
    };

    spriteManager.addSprite('baseRect', wallOptions);
  }

  removePlayerStartBox(playerSlot: number) {
    if (!playerManager.isHost) return;

    const wallNames: string[] = ['top', 'bottom', 'left', 'right'];
    for (let i = 0; i < wallNames.length; i++) {
      const wallId = this.getPlayerStartBoxWallId(playerSlot, wallNames[i]);
      if (spriteManager.getSprite(wallId)) {
        spriteManager.removeSprite(wallId);
      }
    }
  }

  getPlayerStartBoxWallId(playerSlot: number, wallName: string): string {
    return 'skillSprintPlayerBox_' + playerSlot.toString() + '_' + wallName;
  }

  teleportPlayerToStart(playerId: number, playerSlot: number) {
    if (!playerManager.isHost) return;

    const playerPosition = this.getPlayerStartPosition(playerSlot);
    playerManager.teleportPlayers([playerId], {
      distributionType: 'area',
      positionX: playerPosition.positionX - 2,
      positionY: playerPosition.positionY - 2,
      width: 4,
      height: 4,
    });
  }

  teleportPlayerOutsideExperience(playerId: number) {
    if (!playerManager.isHost) return;

    try {
      playerManager.teleportPlayers([playerId], {
        distributionType: 'area',
        positionX: -200,
        positionY: this.experienceHeight + 200,
        width: 1,
        height: 1,
      });
    } catch (e) {}
  }

  getBoatId(boatAssignment: number) : string {
		switch (boatAssignment) {
			case 1:
				return 'skillSprintBoat1';
			case 2:
				return 'skillSprintBoat2';
			case 3:
				return 'skillSprintBoat3';
			case 4:
				return 'skillSprintBoat4';
			case 5:
				return 'skillSprintBoat5';
			case 6:
				return 'skillSprintBoat6';
			case 7:
				return 'skillSprintBoat7';
			case 8:
				return 'skillSprintBoat8';
			default:
				// @TODO handle unexpected assignments?
				return "";
		}
  }

  onVariableChanged_gameStarted() {
    this.gameStarted = true;
  }



  // onBeforeDestroy() {
  //   // here we can iterate through our sprites to remove them.
  //   // one note - this.sprites is a PseudoList, and cannot be iterated natively.
  //   // you must call toArray() to access methods like filter, includes, etc.
  //   //
  //   // this is true for any object that's used as a module property - you'll
  //   // need to call toObject() to access js object methods or to iterate
  //   //
  //   this.sprites.toArray().forEach((sprite) => {
  //     if (!sprite) return;
  //     spriteManager.removeSprite(sprite.uniqueId);
  //   });
  // }
  
}
