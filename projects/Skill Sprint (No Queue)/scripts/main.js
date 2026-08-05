"use strict";
class main extends SystemScript {
    experienceWidth;
    experienceHeight;
    boatX;
    playerIds;
    sprites;
    playerSprites;
    availableSlots;
    gameStarted;
    boat1;
    boat2;
    boat3;
    boat4;
    boat5;
    boat6;
    boat7;
    boat8;
    textBg;
    onHostStart() {
        // @TODO lock players from joining until after this executes
        //gameStateManager.setIsAcceptingPlayers(false);
        this.experienceWidth = 1500;
        this.experienceHeight = 800;
        this.boatX = 0; // this.experienceWidth - 400
        this.playerIds = [];
        this.sprites = [];
        this.playerSprites = [];
        this.gameStarted = false;
        for (let i = 0; i < 8; i++) {
            this.playerIds.push(-1);
        }
        scriptManager.attachSystem({ scriptId: 'utils' });
        const utils = scriptManager.getSystem({ systemName: 'utils' });
        scriptManager.attachSystem({ scriptId: 'animator' });
        scriptManager.attachSystem({ scriptId: 'gameManager' });
        scriptManager.attachSystem({ scriptId: 'iframeManager' });
        this.boat1 = spriteManager.addSprite("boat1", {
            positionY: -85,
            positionX: this.boatX,
            topAdjust: 30
        });
        this.boat2 = spriteManager.addSprite("boat2", {
            positionY: 15,
            positionX: this.boatX,
            topAdjust: 30
        });
        this.boat3 = spriteManager.addSprite("boat3", {
            positionY: 115,
            positionX: this.boatX,
            topAdjust: 30
        });
        this.boat4 = spriteManager.addSprite("boat4", {
            positionY: 215,
            positionX: this.boatX,
            topAdjust: 30
        });
        this.boat5 = spriteManager.addSprite("boat5", {
            positionY: 315,
            positionX: this.boatX,
            topAdjust: 30
        });
        this.boat6 = spriteManager.addSprite("boat6", {
            positionY: 415,
            positionX: this.boatX,
            topAdjust: 30
        });
        this.boat7 = spriteManager.addSprite("boat7", {
            positionY: 515,
            positionX: this.boatX,
            topAdjust: 30
        });
        this.boat8 = spriteManager.addSprite("boat8", {
            positionY: 615,
            positionX: this.boatX,
            topAdjust: 30
        });
        for (let i = 0; i < 8; i++) {
            let playerTextSprite = utils.makeText({ text: '', align: 'start', justify: 'start' });
            playerTextSprite.position.x = -100;
            playerTextSprite.position.y = (i * 100) + 40;
            this.playerSprites.push(playerTextSprite);
        }
        stateManager.setVariable("playerTextSprites", this.playerSprites.toArray());
        if (!playerManager.isHost)
            return;
        console.log("Host assigned to player 1. hostid: " + playerManager.getMyPlayerId());
        stateManager.setVariable("playerAssignment", 1);
        eventManager.emit("updateTextSpritesAndPlayerData", { playerId: playerManager.getMyPlayerId(), playerSlot: 1 });
        //gameStateManager.setIsAcceptingPlayers(true);
    }
    onPlayerStart() {
        if (playerManager.isHost)
            return;
        if (this.gameStarted)
            eventManager.emit("joinedLate");
        const playerId = playerManager.getMyPlayerId();
        const { username } = playerManager.getPlayerDetails(playerId);
        console.log("Running onPlayerStart() for pId " + playerId + " and name " + username);
        // go through each playerXData
        // upon finding Data with no keys (a.k.a. an open slot [Object.keys(obj).length > 0 === false]), emit an input event for host to updateTextSprites
        const playerSlot = this.findSlot(playerId);
        if (playerSlot === null) {
            console.log("No room in experience for player: " + playerId);
            return;
        }
        stateManager.setVariable("playerAssignment", playerSlot);
        eventManager.emit("updateTextSpritesAndPlayerData", { playerId, playerSlot });
        //eventManager.emit("restartCountdown");
    }
    // @TODO: move the findslot methods into utils.
    findSlot(playerId) {
        const player1Data = stateManager.getVariable("player1Data");
        if (Object.keys(player1Data).length > 0 === false || Object.keys(player1Data)[0] === playerId.toString())
            return 1;
        const player2Data = stateManager.getVariable("player2Data");
        if (Object.keys(player2Data).length > 0 === false || Object.keys(player2Data)[0] === playerId.toString())
            return 2;
        const player3Data = stateManager.getVariable("player3Data");
        if (Object.keys(player3Data).length > 0 === false || Object.keys(player3Data)[0] === playerId.toString())
            return 3;
        const player4Data = stateManager.getVariable("player4Data");
        if (Object.keys(player4Data).length > 0 === false || Object.keys(player4Data)[0] === playerId.toString())
            return 4;
        const player5Data = stateManager.getVariable("player5Data");
        if (Object.keys(player5Data).length > 0 === false || Object.keys(player5Data)[0] === playerId.toString())
            return 5;
        const player6Data = stateManager.getVariable("player6Data");
        if (Object.keys(player6Data).length > 0 === false || Object.keys(player6Data)[0] === playerId.toString())
            return 6;
        const player7Data = stateManager.getVariable("player7Data");
        if (Object.keys(player7Data).length > 0 === false || Object.keys(player7Data)[0] === playerId.toString())
            return 7;
        const player8Data = stateManager.getVariable("player8Data");
        if (Object.keys(player8Data).length > 0 === false || Object.keys(player8Data)[0] === playerId.toString())
            return 8;
        return null;
    }
    // @TODO lock players from joining while this executes
    async onEvent_updateTextSpritesAndPlayerData({ playerId, playerSlot }) {
        if (!playerManager.isHost)
            return;
        // await spriteManager.updateSprite(pSpriteToUse.uniqueId, { positionX: pSpriteToUse.position.x, positionY: pSpriteToUse.position.y, text: username });
        // await utils.setPlayerData(boatAssignment, playerId, this.getBoatId(boatAssignment));
        // @TODO lock players from joining until after this executes
        const utils = scriptManager.getSystem({ systemName: 'utils' });
        const { username } = playerManager.getPlayerDetails(playerId);
        console.log("USERNAME: " + username);
        const pSpritesArray = stateManager.getVariable("playerTextSprites");
        const pSpriteToUse = pSpritesArray[playerSlot - 1];
        // await this.remedyGhostHost();
        await spriteManager.updateSprite(pSpriteToUse.uniqueId, { positionX: pSpriteToUse.position.x, positionY: pSpriteToUse.position.y, text: username });
        await utils.setPlayerData(playerSlot, playerId, this.getBoatId(playerSlot));
    }
    remedyGhostHost() {
        if (!playerManager.isHost)
            return;
        const hostId = playerManager.getMyPlayerId();
        const { username } = playerManager.getPlayerDetails(hostId);
        const player1Data = stateManager.getVariable("player1Data");
        if (Object.keys(player1Data)[0] !== hostId.toString()) {
            const newHostSlot = this.findSlot(hostId);
            if (newHostSlot === null) {
                console.log("No room in experience for player: " + hostId);
                return;
            }
            stateManager.setVariable("playerAssignment", newHostSlot);
            eventManager.emit("updateTextSpritesAndPlayerData", { hostId, newHostSlot });
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
    async onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        if (stateManager.getVariable("gameStarted") === true)
            return;
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
    onPlayerLeft({ playerId }) {
        // @TODO: make sure player also leaves when they close the iframe if possible ,also make iframe close if the player left if possible
        if (playerManager.getMyPlayerId() === playerId)
            integrationsManager.closeIframe();
        if (!playerManager.isHost)
            return;
        const utils = scriptManager.getSystem({ systemName: 'utils' });
        // Delete the player data from the server state
        const playerSlot = utils.findPlayerAssignment(playerId);
        utils.deletePlayerData(playerSlot);
        // Reset the text sprite that was representing the player
        const pSpritesArray = stateManager.getVariable("playerTextSprites");
        const pSpriteToUse = pSpritesArray[playerSlot - 1];
        spriteManager.updateSprite(pSpriteToUse.uniqueId, { positionX: pSpriteToUse.position.x, positionY: pSpriteToUse.position.y, text: "" });
    }
    getBoatId(boatAssignment) {
        switch (boatAssignment) {
            case 1:
                return this.boat1.uniqueId.toString();
            case 2:
                return this.boat2.uniqueId.toString();
            case 3:
                return this.boat3.uniqueId.toString();
            case 4:
                return this.boat4.uniqueId.toString();
            case 5:
                return this.boat5.uniqueId.toString();
            case 6:
                return this.boat6.uniqueId.toString();
            case 7:
                return this.boat7.uniqueId.toString();
            case 8:
                return this.boat8.uniqueId.toString();
            default:
                // @TODO handle unexpected assignments?
                return "";
        }
    }
    onVariableChanged_gameStarted() {
        this.gameStarted = true;
    }
}
