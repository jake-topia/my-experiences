"use strict";
class hitboxManager extends SystemScript {
    buffer;
    playerList;
    // canCollide: any;
    tilesPerRow;
    rows;
    // list of pseudosprites
    tSprites;
    main;
    GREEN;
    BLUE;
    START_BOX_Y;
    TILE_SIZE;
    respawnX;
    respawnY;
    respawnW;
    respawnH;
    hitboxes;
    onTeleportCooldown;
    teleportCall;
    onInit(props) {
        this.main = scriptManager.getSystem({ systemName: "main" });
        // this.grid = this.main.getGrid();
        // console.log("got grid: ", this.grid);
        this.tSprites = this.main.getTSprites();
        this.tilesPerRow = props.tilesPerRow;
        this.rows = props.rows;
        // console.log("PROPS tpr: ", this.tilesPerRow);
        // console.log("PROPS rows: ", this.rows);
        this.GREEN = "00FF00";
        this.BLUE = "4a69c4";
        this.START_BOX_Y = 1300;
        this.TILE_SIZE = 150;
        this.respawnX = 50;
        this.respawnY = 1425;
        this.respawnW = 1400;
        this.respawnH = 50;
        this.hitboxes = [];
        this.buffer = 0;
        this.playerList = [];
        // this.canCollide = {};
        this.teleportCall = (playerId) => {
            // console.log("teleporting: ", this.respawnX, this.respawnY);
            playerManager.teleportPlayers([playerId], {
                distributionType: "area",
                positionX: this.respawnX,
                positionY: this.respawnY,
                width: this.respawnW,
                height: this.respawnH,
            });
        };
        stateManager.setVariable("firstTileRevealed", false);
    }
    externalTeleportCall(playerId) {
        this.teleportCall(playerId);
    }
    onSpriteCollisionStart({ collisionX, collisionY, sprite1, sprite2, }) {
        // console.log("hitboxManager collision");
        // decode the collision, is it valid?
        const { tile, playerHitbox } = this.decodeCollision({ sprite1, sprite2 });
        if (tile == null || playerHitbox == null)
            return;
        this.newOnHitboxOverlap(stateManager.getVariable("playerHitboxesReverse")[playerHitbox.uniqueId], tile.uniqueId);
    }
    decodeCollision({ sprite1, sprite2 }) {
        // TODO: worth pruning early here if either sprite1 or 2 is player?
        const isSpriteTile1 = this.isTile(sprite1.uniqueId);
        const isSpriteTile2 = this.isTile(sprite2.uniqueId);
        if (!isSpriteTile1 && !isSpriteTile2)
            return { tile: null, playerHitbox: null };
        if (isSpriteTile1 && !isSpriteTile2) {
            if (this.hitboxes.includes(sprite2.uniqueId)) {
                return { tile: sprite1, playerHitbox: sprite2 };
            }
        }
        else if (!isSpriteTile1 && isSpriteTile2) {
            if (this.hitboxes.includes(sprite1.uniqueId)) {
                return { tile: sprite2, playerHitbox: sprite1 };
            }
        }
        return { tile: null, playerHitbox: null };
    }
    isTile(tileId) {
        if (tileId.length > 3 || tileId.charCodeAt(0) !== 116 || tileId.length < 2)
            return false;
        return true;
    }
    newOnHitboxOverlap(playerId, tile) {
        // console.log("onHitboxOverlap called with: ", { playerId, tile });
        // console.log("hitbox overlap, cancollide is: ", stateManager.getVariable("canCollide")[playerId.toString()]);
        if (!stateManager.getVariable("canCollide")[playerId.toString()])
            return;
        const result = this.main.getValueAtId(tile);
        let fadedResult = false;
        if (result) {
            const tileFadedMap = stateManager.getVariable("tileFadedMap"); // tileId string to bool
            fadedResult = tileFadedMap[tile];
        }
        // PARSE CHECK RESULT (value at Id check and faded check)
        if (fadedResult) {
            this.removeGoodCollisions(playerId);
            this.teleportCall(playerId);
            // gameLoopManager.requestSync();
            return;
        }
        if (result) {
            // turn tile green
            spriteManager.updateSprite(tile, { fill: this.GREEN });
            this.addGoodCollision(playerId);
            // do the teleports now to the first tile revealed
            if (stateManager.getVariable("firstTileRevealed") === false) {
                stateManager.setVariable("firstTileRevealed", true);
                this.firstTileRevealedTpCallFix(tile);
            }
            // gameLoopManager.requestSync();
            return;
        }
        // turn tile transparent & teleport player
        spriteManager.updateSprite(tile, { opacity: 0 });
        this.removeGoodCollisions(playerId);
        this.teleportCall(playerId);
        // gameLoopManager.requestSync();
    }
    // --- canCollide map helpers
    fixMap(playerId, canCollide) {
        const cc = stateManager.getVariable("canCollide");
        cc[playerId.toString()] = canCollide;
        stateManager.setVariable("canCollide", cc);
    }
    removeFromMap(playerId) {
        const cc = stateManager.getVariable("canCollide");
        delete cc[playerId.toString()];
        stateManager.setVariable("canCollide", cc);
    }
    // --- numGoodCollides map helpers
    addGoodCollision(playerId) {
        const ngc = stateManager.getVariable("numGoodCollides");
        ngc[playerId.toString()] += 1;
        stateManager.setVariable("numGoodCollides", ngc);
    }
    removeGoodCollisions(playerId) {
        const ngc = stateManager.getVariable("numGoodCollides");
        ngc[playerId.toString()] = 0;
        stateManager.setVariable("numGoodCollides", ngc);
    }
    removeFromCollisionsMap(playerId) {
        const ngc = stateManager.getVariable("numGoodCollides");
        delete ngc[playerId.toString()];
        stateManager.setVariable("numGoodCollides", ngc);
    }
    onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        this.playerList.push(playerId);
        // this.canCollide[playerId] = false;
        // console.log("can " + playerId + " collide?: " + JSON.stringify(this.canCollide));
        this.fixMap(playerId, false);
        this.removeGoodCollisions(playerId);
        const uid = getRandomUUID();
        spriteManager.addSprite("hitbox", {
            checkCollisions: true,
            positionX: 0,
            positionY: 0,
            uniqueId: uid,
        });
        let hitboxes = stateManager.getVariable("playerHitboxes");
        let hitboxesReverse = stateManager.getVariable("playerHitboxesReverse");
        hitboxes[playerId] = uid;
        hitboxesReverse[uid] = playerId;
        stateManager.setVariable("playerHitboxes", hitboxes);
        stateManager.setVariable("playerHitboxesReverse", hitboxesReverse);
        this.hitboxes.push(uid);
        // console.log("hitboxes: ", hitboxes);
    }
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        // @TODO: FIX BUG-- if a player leaves the "tileStanders" on the tile they left on will remain +1 of what it should be
        let hitboxes = stateManager.getVariable("playerHitboxes");
        let hitboxesReverse = stateManager.getVariable("playerHitboxesReverse");
        const uid = hitboxes[playerId];
        spriteManager.removeSprite(uid);
        delete hitboxes[playerId];
        delete hitboxesReverse[uid];
        stateManager.setVariable("playerHitboxes", hitboxes);
        stateManager.setVariable("playerHitboxesReverse", hitboxesReverse);
        this.playerList = this.playerList.filter((p) => p !== playerId);
        // delete this.canCollide[playerId];
        this.removeFromMap(playerId);
        this.removeFromCollisionsMap(playerId);
    }
    onVariableChanged_firstTileRevealed({ newValue }) {
        if (!playerManager.isHost)
            return;
        if (newValue === false) {
            this.respawnX = 50;
            this.respawnY = 1425;
            this.respawnW = 1400;
            this.respawnH = 50;
        }
    }
    firstTileRevealedTpCallFix(tile) {
        const tileSprite = spriteManager.getSprite(tile);
        // update persistent respawn zone to that tile's area
        this.respawnX = tileSprite.position.x;
        this.respawnY = tileSprite.position.y + this.TILE_SIZE * 2;
        this.respawnW = this.TILE_SIZE;
        this.respawnH = this.TILE_SIZE;
    }
    // onHitboxOverlap(playerId: number, tile: string) {
    //   // console.log("hitbox overlap, cancollide is: ", stateManager.getVariable("canCollide")[playerId.toString()]);
    //   console.log("onHitboxOverlap called with: ", {playerId, tile});
    //   // TODO: try removing canCollide logic now that we have new collision system...
    //   if (stateManager.getVariable("canCollide")[playerId.toString()] === false) return;
    //   const result = this.getValueAtId(tile);
    //   let fadedResult = false;
    //   if (result) {
    //     const tileFadedMap = stateManager.getVariable("tileFadedMap"); // tileId string to bool
    //     fadedResult = tileFadedMap[tile];
    //   }
    //   // PARSE CHECK RESULT (value at Id check and faded check)
    //   if (fadedResult) {
    //     // fadedResult must be checked first b/c a tile can be green (result=true) but also faded (fadedResult=true)
    //     // teleport player
    //     this.fixMap(playerId, false);
    //     this.removeGoodCollisions(playerId);
    //     this.teleportCall(playerId);
    //     // gameLoopManager.requestSync();
    //     return;
    //   }
    //   if (result) {
    //     // turn tile green
    //     // playerManager.tintPlayer(pSprite.uniqueId, "FFFFFF");
    //     spriteManager.updateSprite(tile, { fill: this.GREEN });
    //     this.addGoodCollision(playerId);
    //     // do the teleports now to the first tile revealed
    //     if (stateManager.getVariable("firstTileRevealed") === false) {
    //       stateManager.setVariable("firstTileRevealed", true);
    //       this.firstTileRevealedTpCallFix(tile);
    //     }
    //     // gameLoopManager.requestSync();
    //     return;
    //   }
    //   // turn tile transparent & teleport player
    //   spriteManager.updateSprite(tile, { opacity: 0 });
    //   // set players canCollide to false
    //   // this.canCollide[playerId] = false;
    //   this.fixMap(playerId, false);
    //   this.removeGoodCollisions(playerId);
    //   this.teleportCall(playerId);
    //   // gameLoopManager.requestSync();
    // }
    // getValueAtId(id: string): boolean {
    //   console.log("getting value in grid for id: ", id);
    //   let tileNum: number | null = this.idToNumber(id);
    //   if (tileNum == null) return false;
    //   let rowNum: number = Math.floor(tileNum / this.tilesPerRow);
    //   let colNum: number = tileNum % this.tilesPerRow;
    //   console.log("rowNum ", rowNum);
    //   console.log("colNum ", colNum);
    //   console.log("this grid: ", this.grid);
    //   return this.grid[rowNum][colNum];
    // }
    idToNumber(id) {
        if (id.length < 2 || id.length > 3 || id.charCodeAt(0) !== 116)
            return null; // 't'
        return Number(id.slice(1));
    }
    // we need the new tile hitbox info
    onEvent_reset() {
        this.main.generatePath(this.tilesPerRow, this.rows);
        for (const playerId of this.playerList) {
            const d = playerManager.getPlayerDetails(playerId);
            if (!d)
                continue;
            // this.fixMap(playerId, true);
        }
        // console.log("numGreens: ", this.main.getNumGreenTiles());
    }
    // NEW VERSION:
    onPhysicsStep(deltaTime) {
        if (!playerManager.isHost)
            return;
        for (const playerId of this.playerList) {
            const d = playerManager.getPlayerDetails(playerId);
            if (!d)
                continue;
            // get their hitbox sprite & update position
            // @TODO: fix position based on engine position change.
            const spriteId = stateManager.getVariable("playerHitboxes")[playerId];
            spriteManager.updateSprite(spriteId, { positionX: d.x + 24, positionY: d.y + 55 });
        }
    }
}
// onSpriteCollisionStart({ collisionX, collisionY, sprite1, sprite2 }) {
//   // determine if we're in the correct collision scenario
//   let pSprite : PseudoSprite;
//   let tSprite : PseudoSprite;
//   if (sprite1.isPlayerSprite && sprite2.isPlayerSprite) {
//     return;
//   } else if (sprite1.isPlayerSprite) {
//     pSprite = sprite1;
//     tSprite = sprite2;
//   } else if (sprite2.isPlayerSprite) {
//     pSprite = sprite2;
//     tSprite = sprite1;
//   } else {
//     return;
//   }
//   // stepping on OK/BAD tile logic
//   if (tSprite.uniqueId === "win") {
//     console.log(" here! ");
//     // @TODO: make sure that the user actually collided with green tiles in case there's laggy people who can cheat.
//     // block other winners
//     if (stateManager.getVariable("winnerAnnounced") === true) {
//       console.log("there's already a winner...");
//       return;
//     }
//     // do win logic
//     // start timer anim
//     stateManager.setVariable("winnerAnnounced", true);
//     this.addWinnerAndReset(pSprite.uniqueId);
//     return;
//   }
//   const result = this.getValueAtId(tSprite.uniqueId);
//   if (result) { // turn tile green
//     // playerManager.tintPlayer(pSprite.uniqueId, "FFFFFF");
//     spriteManager.updateSprite(tSprite.uniqueId, {fill: this.GREEN});
//   } else { // turn tile transparent & teleport player
//     spriteManager.updateSprite(tSprite.uniqueId, {opacity: 0 });
//     // playerManager.teleportPlayers([pSprite.uniqueId], {distributionType: "area", positionX: 50, positionY: 1425, width: 1400, height: 50});
//   }
// }
