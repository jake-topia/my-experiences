class hitboxManager extends SystemScript {
  buffer: number;
  playerList: number[];
  // canCollide: any;

  tilesPerRow: number;
  rows: number;
  // list of pseudosprites
  tSprites: any;

  main: PseudoAny;

  GREEN: string;
  BLUE: string;
  START_BOX_Y: number;
  TILE_SIZE: number;

  respawnX: number;
  respawnY: number;
  respawnW: number;
  respawnH: number;

  hitboxes: string[];

  onTeleportCooldown: any;
  teleportCall: any;

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

    this.teleportCall = (playerId: number) => {
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

  externalTeleportCall(playerId: number) {
    this.teleportCall(playerId);
  }

  onSpriteCollisionStart({
    collisionX,
    collisionY,
    sprite1,
    sprite2,
  }: {
    collisionX: number;
    collisionY: number;
    sprite1: PseudoSprite;
    sprite2: PseudoSprite;
  }): void {
    // console.log("hitboxManager collision");
    // decode the collision, is it valid?
    const { tile, playerHitbox } = this.decodeCollision({ sprite1, sprite2 });
    if (tile == null || playerHitbox == null) return;

    this.newOnHitboxOverlap(stateManager.getVariable("playerHitboxesReverse")[playerHitbox.uniqueId], tile.uniqueId);
  }

  decodeCollision({ sprite1, sprite2 }: { sprite1: PseudoSprite; sprite2: PseudoSprite }): {
    tile: PseudoSprite | null;
    playerHitbox: PseudoSprite | null;
  } {
    // TODO: worth pruning early here if either sprite1 or 2 is player?
    const isSpriteTile1 = this.isTile(sprite1.uniqueId);
    const isSpriteTile2 = this.isTile(sprite2.uniqueId);
    if (!isSpriteTile1 && !isSpriteTile2) return { tile: null, playerHitbox: null };
    if (isSpriteTile1 && !isSpriteTile2) {
      if (this.hitboxes.includes(sprite2.uniqueId)) {
        return { tile: sprite1, playerHitbox: sprite2 };
      }
    } else if (!isSpriteTile1 && isSpriteTile2) {
      if (this.hitboxes.includes(sprite1.uniqueId)) {
        return { tile: sprite2, playerHitbox: sprite1 };
      }
    }
    return { tile: null, playerHitbox: null };
  }

  isTile(tileId: string): boolean {
    if (tileId.length > 3 || tileId.charCodeAt(0) !== 116 || tileId.length < 2) return false;
    return true;
  }

  newOnHitboxOverlap(playerId: number, tile: string) {
    // console.log("onHitboxOverlap called with: ", { playerId, tile });
    // console.log("hitbox overlap, cancollide is: ", stateManager.getVariable("canCollide")[playerId.toString()]);

    if (!stateManager.getVariable("canCollide")[playerId.toString()]) return;

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
  fixMap(playerId: number, canCollide: boolean) {
    const cc: Record<string, any> = stateManager.getVariable("canCollide");
    cc[playerId.toString()] = canCollide;
    stateManager.setVariable("canCollide", cc);
  }

  removeFromMap(playerId: number) {
    const cc: Record<string, any> = stateManager.getVariable("canCollide");
    delete cc[playerId.toString()];
    stateManager.setVariable("canCollide", cc);
  }

  // --- numGoodCollides map helpers
  addGoodCollision(playerId: number) {
    const ngc: Record<string, any> = stateManager.getVariable("numGoodCollides");
    ngc[playerId.toString()] += 1;
    stateManager.setVariable("numGoodCollides", ngc);
  }

  removeGoodCollisions(playerId: number) {
    const ngc: Record<string, any> = stateManager.getVariable("numGoodCollides");
    ngc[playerId.toString()] = 0;
    stateManager.setVariable("numGoodCollides", ngc);
  }

  removeFromCollisionsMap(playerId: number) {
    const ngc: Record<string, any> = stateManager.getVariable("numGoodCollides");
    delete ngc[playerId.toString()];
    stateManager.setVariable("numGoodCollides", ngc);
  }

  onPlayerJoined({ playerId }) {
    if (!playerManager.isHost) return;
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

  onPlayerLeft({ playerId }: { playerId: number }): void {
    if (!playerManager.isHost) return;
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
    if (!playerManager.isHost) return;

    if (newValue === false) {
      this.respawnX = 50;
      this.respawnY = 1425;
      this.respawnW = 1400;
      this.respawnH = 50;
    }
  }

  firstTileRevealedTpCallFix(tile: string) {
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

  idToNumber(id: string): number | null {
    if (id.length < 2 || id.length > 3 || id.charCodeAt(0) !== 116) return null; // 't'
    return Number(id.slice(1));
  }

  // we need the new tile hitbox info
  onEvent_reset() {
    this.main.generatePath(this.tilesPerRow, this.rows);
    for (const playerId of this.playerList) {
      const d = playerManager.getPlayerDetails(playerId);
      if (!d) continue;

      // this.fixMap(playerId, true);
    }
    // console.log("numGreens: ", this.main.getNumGreenTiles());
  }

  // NEW VERSION:
  onPhysicsStep(deltaTime: number): void {
    if(!playerManager.isHost)return;

    for (const playerId of this.playerList) {
      const d = playerManager.getPlayerDetails(playerId);
      if (!d) continue;

      // get their hitbox sprite & update position
      // @TODO: fix position based on engine position change.
      const spriteId = stateManager.getVariable("playerHitboxes")[playerId];
      spriteManager.updateSprite(spriteId, { positionX: d.x + 24, positionY: d.y + 55 });
    }
  }

  // @TODO: optimize by making these tiles fully noncollidible b/c we're manually doing collisions now

  // OPTIMIZED OG VERSION:
  // onPhysicsStep(deltaTime: number): void {
  // for (const playerId of this.playerList) {
  //   const d = playerManager.getPlayerDetails(playerId);
  //   // if (!d) console.log(playerId);
  //   if (!d) continue;

  //   const yPos = d.y + 30;
  //   if (yPos > this.START_BOX_Y) {
  //     // this.canCollide[playerId] = true;
  //     this.fixMap(playerId, true);
  //     continue;
  //   }
  //   const xPos = d.x;

  //   // new player hitbox 1px width, 20 px height
  //   const aLeft = xPos + 49,
  //     aRight = xPos + 51;
  //   const aBottom = yPos + 20,
  //     aTop = yPos + 30;

  //   for (const tile of stateManager.getVariable("currentPlayerTiles")[playerId]) {
  //     let tPosX = tile.position.x;
  //     let tPosY = tile.position.y;
  //     if (Math.abs(tPosX - xPos) > 200) continue;
  //     if (Math.abs(tPosY - yPos) > 200) continue;

  //     // Tile rect: [tile.x, tile.x+150] by [tile.y, tile.y+150]
  //     const bLeft = tPosX,
  //       bRight = tPosX + 150;
  //     const bBottom = tPosY,
  //       bTop = tPosY + 150;

  //     const overlaps = aLeft < bRight && aRight > bLeft && aTop > bBottom && aBottom < bTop;

  //     if (overlaps) {
  //       // handle collision
  //       // eventManager.emit("hitboxOverlap", { playerId: playerId, tile: tile.uniqueId });
  //       // stateManager.setVariable("collideEvent", [playerId, tile.uniqueId]);
  //       this.onHitboxOverlap(playerId, tile.uniqueId);
  //     }
  //   }
  // }
  // }

  // ORIGINAL VERSION:
  // onPhysicsStep() {
  //   if (!playerManager.isHost) return;

  //   this.buffer++;
  //   if (this.buffer % 3 === 0) {
  //     for (const playerId of this.playerList) {
  //       // console.log(this.playerList);
  //       // console.log(playerId);
  //       const d = playerManager.getPlayerDetails(playerId);
  //       // if (!d) console.log(playerId);
  //       if (!d) continue;

  //       const yPos = d.y + 30;
  //       if (yPos > this.START_BOX_Y) {
  //         // this.canCollide[playerId] = true;
  //         this.fixMap(playerId, true);
  //         continue;
  //       }
  //       const xPos = d.x;

  //       // new player hitbox 1px width, 20 px height
  //       const aLeft = xPos + 49,
  //         aRight = xPos + 51;
  //       const aBottom = yPos + 20,
  //         aTop = yPos + 30;

  //       for (const tile of this.tSprites) {
  //         let tPosX = tile.position.x;
  //         let tPosY = tile.position.y;
  //         if (Math.abs(tPosX - xPos) > 200) continue;
  //         if (Math.abs(tPosY - yPos) > 200) continue;

  //         // Tile rect: [tile.x, tile.x+150] by [tile.y, tile.y+150]
  //         const bLeft = tPosX,
  //           bRight = tPosX + 150;
  //         const bBottom = tPosY,
  //           bTop = tPosY + 150;

  //         const overlaps = aLeft < bRight && aRight > bLeft && aTop > bBottom && aBottom < bTop;

  //         if (overlaps) {
  //           // handle collision
  //           // eventManager.emit("hitboxOverlap", { playerId: playerId, tile: tile.uniqueId });
  //           // stateManager.setVariable("collideEvent", [playerId, tile.uniqueId]);
  //           this.onHitboxOverlap(playerId, tile.uniqueId);
  //         }
  //       }
  //     }
  //   }
  // }
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
