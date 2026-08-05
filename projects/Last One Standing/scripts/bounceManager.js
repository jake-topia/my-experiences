"use strict";
class bounceManager extends ComponentScript {
    experienceWidth;
    experienceHeight;
    hasInit;
    allPlayers; // stores total amount of players when the game starts
    playersOut; // stores all the players that are out of the game (not including queued)
    speed; // speed of the threat 
    lastCollided; // holds the id of the last collided eliminated player, or -1 if a wall was hit 
    winnerDeclared; // blocks duplicate winner events once the game is over
    constructor() {
        this.playersOut = [];
        this.allPlayers = playerManager.getPlayerIds();
        this.speed = 4;
        this.lastCollided = -1;
        this.winnerDeclared = false;
    }
    // Initializing variables 
    onInit() {
        if (!playerManager.isHost)
            return;
        this.experienceWidth = 1500;
        this.experienceHeight = 1265; // setting this to the height of the gamezone so the threat does not move in the safe zone 
        this.sprite.applyPhysics = true;
        this.sprite.friction.x = 1;
        this.sprite.friction.y = 1;
        this.hasInit = true;
    }
    /*
     *  The physics step runs between 15 and 30 times a second. During the physics step the threat will move throughout the gamezone in the dvd logo fashion
     *  This function was mainly adapted from the experience engine tutorial
     */
    onPhysicsStep() {
        // exit if we havent finished the init process yet or if the client is running the physics step
        if (!this.hasInit)
            return;
        if (!playerManager.isHost)
            return;
        if (this.winnerDeclared)
            return;
        const rightSideX = this.sprite.position.x + this.sprite.width;
        const bottomSideY = this.sprite.position.y + this.sprite.height;
        const isTooFarLeft = this.sprite.position.x <= 0;
        const isTooFarRight = rightSideX >= this.experienceWidth;
        const isTooFarUp = this.sprite.position.y <= 0;
        const isTooFarDown = bottomSideY >= this.experienceHeight;
        const isWithinBounds = !isTooFarLeft && !isTooFarRight && !isTooFarUp && !isTooFarDown;
        // if the sprite is within bounds, we don't need to make a change.
        if (isWithinBounds)
            return;
        // calculate new velocity depending on which border was crossed
        const isTooFarX = isTooFarLeft || isTooFarRight;
        const isTooFarY = isTooFarUp || isTooFarDown;
        if (isTooFarX)
            this.sprite.velocity.x = this.getNewVelocity(isTooFarRight);
        if (isTooFarY)
            this.sprite.velocity.y = this.getNewVelocity(isTooFarDown);
        console.log("x vel: ", this.sprite.velocity.x);
        console.log("y vel: ", this.sprite.velocity.y);
    }
    /*
     *  Runs once a second and makes sure the host ends the round whenever there is one or zero players still in the game.
     */
    onStep() {
        if (!playerManager.isHost)
            return;
        if (!this.hasInit)
            return;
        if (this.winnerDeclared)
            return;
        this.emitWinnerIfGameOver();
    }
    /*
     *  Helper function to get a new velocity after a bounce. It also increases the speed by 0.2 until a max speed of 15 is reached
     */
    getNewVelocity(isNegative) {
        if (!playerManager.isHost)
            return;
        this.lastCollided = -1;
        this.speed = this.speed + 0.2;
        if (this.speed > 15) {
            this.speed = 15;
        }
        console.log(this.speed);
        if (isNegative)
            return -this.speed;
        return this.speed;
    }
    /*
     *  Triggers when the player collides with the threat. This handles most of the logic of the game. If the player is in the game,
     *  they will be teleported to the safe zone and eliminated. If it is an eliminated player, the threat will move and nothing will
     *  happen to the player. However, if an eliminated player makes a direct hit to a player in the game, they will be put back in the game
     */
    onSpriteCollisionStart({ collisionX, collisionY, sprite }) {
        // exits if the player is in queue or if a client is running this function
        if (sprite.playerId === undefined)
            return;
        if (!playerManager.isHost)
            return;
        if (!this.allPlayers.includes(sprite.playerId) && !(this.checkInList(sprite.playerId)))
            return;
        // Math to make the threat move at the correct angle when the collision occurs
        const px = sprite.position?.x ?? sprite.x;
        const py = sprite.position?.y ?? sprite.y;
        const bx = this.sprite.position?.x ?? this.sprite.x;
        const by = this.sprite.position?.y ?? this.sprite.y;
        let dx = bx - px;
        let dy = by - py;
        let len = Math.sqrt((dx * dx) + (dy * dy));
        if (!len || len === 0)
            len = 1;
        const speed = this.speed;
        dx /= len;
        dy /= len;
        this.sprite.velocity.x = dx * speed;
        this.sprite.velocity.y = dy * speed;
        // Logic to add an eliminated player to the game if they make a direct hit
        const id = sprite.playerId;
        if (!(this.allPlayers.includes(id))) {
            if (this.checkInList(id)) {
                this.lastCollided = id; // sets the last collided to the id of the eliminated player that hit it 
            }
            return;
        }
        else if (this.lastCollided !== -1) {
            // If the last collided player is an eliminated player's id, add them back to the game
            playerManager.setNameplate(this.lastCollided, '\u26a1' + playerManager.getPlayerDetails(this.lastCollided).username + '\u26a1');
            playerManager.tintPlayer(this.lastCollided, null);
            this.removeFromList(this.lastCollided);
            if (this.allPlayers.indexOf(this.lastCollided) === -1) {
                this.allPlayers.push(this.lastCollided);
            }
            eventManager.emit("removeFromCollidedPlayers", { playerID: this.lastCollided });
            eventManager.emit("playerAdded", {});
            this.lastCollided = -1;
        }
        // Teleports player to the safezone and emits the changePlayerProperties event in the safezonemanager script
        eventManager.emit("changePlayerProperties", { playerID: id });
        const teleportOptions = {
            distributionType: 'area',
            positionX: 740,
            positionY: 1400,
            height: 0,
            width: 0,
        };
        playerManager.teleportPlayers([id], teleportOptions);
        console.log("collision start x vel: ", this.sprite.velocity.x);
        console.log("collision start y vel: ", this.sprite.velocity.y);
    }
    /*
     *  Triggered from the checkPlayerInGame event or from the safezoneManager. This event does cleanup when a player is taken out or leaves the game.
     *  Their id will be either removed completely from the list of ids in this script, or transferred to the playersOut list if the stillJoined parameter
     *  is true.
     */
    onEvent_playerOut({ playerID, stillJoined }) {
        if (!playerManager.isHost)
            return;
        if (this.winnerDeclared)
            return;
        if (!this.allPlayers.includes(playerID)) {
            return;
        }
        playerManager.setNameplate(playerID, playerManager.getPlayerDetails(playerID).username);
        eventManager.emit("playerRemoved", {});
        this.allPlayers = this.allPlayers.filter(playerId => playerId !== playerID);
        if (stillJoined) {
            this.playersOut.push(playerID); // pushes player to the playersOut list if they are still present in the game
        }
        else {
            if (this.lastCollided === playerID)
                this.lastCollided = -1;
            this.removeFromList(playerID); // in case a player was out, left the game, then rejoined
        }
        this.emitWinnerIfGameOver();
    }
    /*
     *  This event is triggered when a player leaves the game from the main script. It checks if a player is in the game, and emits
     *  the playerOut event if they are in the allPlayers
     */
    onEvent_checkPlayerInGame({ playerID }) {
        if (!playerManager.isHost)
            return;
        console.log("in checkplayeringame");
        console.log(this.allPlayers);
        console.log(playerID);
        if (this.allPlayers.includes(playerID)) {
            console.log('going to playerRemoved');
            eventManager.emit("playerOut", { playerID: playerID, stillJoined: false });
        }
    }
    /*
     *  Function to check if a playerId is in the allPlayers list
     */
    checkInList(playerID) {
        if (!playerManager.isHost)
            return;
        for (const id in this.playersOut) {
            console.log(`id: ${id} playerID: ${playerID}`);
            if (playerID === this.playersOut[id]) {
                console.log('ID IN THE LIST');
                return true;
            }
        }
        return false;
    }
    /*
     *  Returns the unique set of active players that are still connected. This keeps winner detection resilient to stale or duplicate ids.
     */
    getRemainingPlayerIds() {
        if (!playerManager.isHost)
            return [];
        const connectedPlayerIds = playerManager.getPlayerIds();
        const remainingPlayerIds = [];
        for (const playerID of this.allPlayers) {
            if (connectedPlayerIds.indexOf(playerID) === -1)
                continue;
            if (remainingPlayerIds.indexOf(playerID) !== -1)
                continue;
            remainingPlayerIds.push(playerID);
        }
        return remainingPlayerIds;
    }
    /*
     *  Emits the winner event once the game has one or zero active players left.
     */
    emitWinnerIfGameOver() {
        if (!playerManager.isHost)
            return;
        if (this.winnerDeclared)
            return;
        const remainingPlayerIds = this.getRemainingPlayerIds();
        this.allPlayers = remainingPlayerIds;
        if (remainingPlayerIds.length > 1)
            return;
        this.winnerDeclared = true;
        const winnerId = remainingPlayerIds.length === 1 ? remainingPlayerIds[0] : '';
        eventManager.emit("playerWins", { playerID: winnerId, spriteID: this.sprite.uniqueId });
    }
    /*
     *  Removes a playerId from the playersOut list
     */
    removeFromList(playerID) {
        if (!playerManager.isHost)
            return;
        const newPlayersOut = [];
        for (const id in this.playersOut) {
            const currID = this.playersOut[id];
            if (currID !== playerID) {
                newPlayersOut.push(currID);
            }
        }
        this.playersOut = newPlayersOut; // reassign the filtered list
    }
}
