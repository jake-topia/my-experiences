class main extends SystemScript {
  experienceWidth: number;
  experienceHeight: number;

  buffer: number;
  grid: any;
  tilesPerRow: number;
  rows: number;
  tileW: number;
  tileH: number;
  gap: number;
  totalTiles: number;
  numGreenTiles: number;

  // list of pseudosprites
  tSprites: any;

  winnerText: PseudoSprite;

  GREEN: string;
  BLUE: string;
  COLLISION_SKIPS_ALLOWED: number;

  utils: PseudoAny;
  tileManager: PseudoAny;
  hitboxManager: PseudoAny;
  gameManager: PseudoAny;

  onInit() {
    // Do initial view pre-host here
    // 1: init tiles with no purpose and top and bottom zones or init one large title screen sprite
    // const tile = spriteManager.addSprite("tile", {positionX: 100, positionY: 100});
    gameLoopManager.setSyncParameters({ syncsPerSecond: 6, fullUpdatePerSecond: 1, inputUpdatesPerSecond: 4 });
    gameLoopManager.setGameLoopParameters({ physicsTicksPerSecond: 30, throttledStepsPerSecond: 1 });
    this.experienceHeight = 1500;
    this.experienceWidth = 1500;
    this.buffer = 150;

    this.tileW = 150;
    this.tileH = 150;
    this.gap = 5;

    // How many tiles per row (answer to your question):
    const tilesPerRow = this.itemsThatFit(this.experienceWidth, this.tileW, this.gap);
    this.tilesPerRow = tilesPerRow;
    // tilesPerRow === 9 for 1500/150/5

    const rows = this.itemsThatFit(this.experienceHeight - 2 * this.buffer, this.tileH, this.gap);
    console.log("Rows: ", rows);
    this.rows = rows;
    this.totalTiles = this.tilesPerRow * this.rows;

    this.GREEN = "00FF00";
    this.BLUE = "4a69c4";
    this.COLLISION_SKIPS_ALLOWED = 1;

    this.numGreenTiles = 0;

    scriptManager.attachSystem({ scriptId: "gameManager" });
    this.gameManager = scriptManager.getSystem({ systemName: "gameManager" });
    scriptManager.attachSystem({ scriptId: "utils" });
    this.utils = scriptManager.getSystem({ systemName: "utils" });

    // attach at the very end of setup to make sure everything is in place for hitbox to run
    scriptManager.attachSystem({
      scriptId: "hitboxManager",
      props: { tilesPerRow: this.tilesPerRow, rows: this.rows },
    });
    this.hitboxManager = scriptManager.getSystem({ systemName: "hitboxManager" });

    // attach tileManager last bc it needs hitbox manager.
    scriptManager.attachSystem({ scriptId: "tileManager" });
    this.tileManager = scriptManager.getSystem({ systemName: "tileManager" });
  }

  onPlayerJoined({ playerId }): void {
    if (!playerManager.isHost) return;
    // @TODO: ensure players are teleported before allowing tiles to be revealable or game to be winnable.
    console.log("onPlayerJoined main teleport");
    playerManager.teleportPlayers([playerId], {
      distributionType: "area",
      positionX: 50,
      positionY: 1425,
      width: 1400,
      height: 50,
    });
    this.setWorldActivity("GAME_ON");
  }

  onHostStart() {
    const tileSprites: PseudoSprite[] = [];

    // going to hold id of respective tile position
    const ids: string[][] = [];
    for (let r = 0; r < this.rows; r++) {
      ids[r] = [];
    }

    const spots = this.layoutGrid(
      this.experienceWidth,
      this.experienceHeight,
      this.tileW,
      this.tileH,
      this.gap,
      this.totalTiles,
      this.rows,
      this.tilesPerRow,
    );
    let it = 0;
    for (const { x, y } of spots) {
      let idString = "t" + it.toString();
      let rowNum: number = Math.floor(it / this.tilesPerRow);
      let colNum: number = it % this.tilesPerRow;
      const tile = spriteManager.addSprite("tile", {
        checkCollisions: true,
        positionX: x,
        positionY: y,
        collisionGroup: "tiles",
        uniqueId: idString,
      });
      tileSprites.push(tile);
      ids[rowNum][colNum] = idString;
      it += 1;
    }
    console.log(ids);
    console.log("tileSprites: ", tileSprites);
    this.tSprites = tileSprites;

    this.grid = this.generatePath(this.tilesPerRow, this.rows);
    console.log("GRID: ", this.grid);

    spriteManager.addSprite("invisibleWall", {
      checkCollisions: true,
      positionX: -100 + 60,
      positionY: 0,
      collisionGroup: "tiles",
      uniqueId: "i0",
      isImpassable: true,
    });

    spriteManager.addSprite("invisibleWall", {
      checkCollisions: true,
      positionX: this.experienceWidth - 60,
      positionY: 0,
      collisionGroup: "tiles",
      uniqueId: "i1",
      isImpassable: true,
    });

    spriteManager.addSprite("background", {
      positionX: 0,
      positionY: 0,
    });

    spriteManager.addSprite("finishLine", {
      checkCollisions: true,
      positionX: 0,
      positionY: 0,
      collisionGroup: "tiles",
      uniqueId: "win",
    });

    spriteManager.addSprite("startingLine", {
      checkCollisions: true,
      positionX: 0,
      positionY: 1300,
      collisionGroup: "tiles",
      uniqueId: "start",
    });

    spriteManager.addSprite("frameTop", {
      positionX: -149,
      positionY: -90,
    });

    spriteManager.addSprite("frameBottom", {
      positionX: -149,
      positionY: 580,
    });

    // @TODO: use utils->maketext->updateText() instead to keep good formatting for varying player names
    this.winnerText = this.utils.makeText({ text: "                    ", align: "center", justify: "start" });
    spriteManager.updateSprite(this.winnerText.uniqueId, {
      positionX: this.experienceWidth / 2 - 230,
      positionY: this.experienceHeight / 2 - 125,
      text: "                    ",
      fontSize: 50,
      fontWeight: "bold",
    });
    // this.winnerText = spriteManager.addSprite("basicText", {positionX: this.experienceWidth/2 - 200,
    //   positionY: this.experienceHeight/2 - 100, text: ""});

    stateManager.setVariable("gameStarted", true);
  }

  idToNumber(id: string): number | null {
    if (id.length < 2 || id.length > 3 || id.charCodeAt(0) !== 116) return null; // 't'
    return Number(id.slice(1));
  }

  getValueAtId(id: string): boolean {
    let tileNum: number | null = this.idToNumber(id);
    if (tileNum == null) return false;
    let rowNum: number = Math.floor(tileNum / this.tilesPerRow);
    let colNum: number = tileNum % this.tilesPerRow;
    return this.grid[rowNum][colNum];
  }

  getGrid(): any {
    return this.grid;
  }

  getTSprites(): any {
    return this.tSprites;
  }

  // deal wiht JUST the player win and player out of bounds collisions.
  onSpriteCollisionStart({ collisionX, collisionY, sprite1, sprite2 }) {
    // determine if we're in the correct collision scenario
    let pSprite: PseudoSprite;
    let tSprite: PseudoSprite;
    // console.log("sprite1: ", sprite1);
    // console.log("sprite2: ", sprite2);
    if (sprite1.isPlayerSprite && sprite2.isPlayerSprite) {
      return;
    } else if (sprite1.isPlayerSprite) {
      pSprite = sprite1;
      tSprite = sprite2;
    } else if (sprite2.isPlayerSprite) {
      pSprite = sprite2;
      tSprite = sprite1;
    } else {
      return;
    }

    const tId = tSprite.uniqueId;
    const pId = pSprite.uniqueId;

    // colliding with start, allow hitbox collisions now:
    if (tId === "start") {
      this.fixMap(Number(pId), true);
      return;
    }

    // stepping on win tile
    if (tId === "win") {
      console.log(" win! ");

      // @TODO: make sure that the user actually collided with green tiles in case there's laggy people who can cheat.
      const ngc: Record<string, any> = stateManager.getVariable("numGoodCollides");
      if (ngc[pId.toString()] < this.numGreenTiles - this.COLLISION_SKIPS_ALLOWED) {
        console.log("player missed a collision somewhere and cannot win");
        playerManager.teleportPlayers([pId], {
          distributionType: "area",
          positionX: 50,
          positionY: 1425,
          width: 1400,
          height: 50,
        });
        return;
      }

      // block other winners
      if (stateManager.getVariable("winnerAnnounced") === true) {
        console.log("there's already a winner...");
        return;
      }
      // stop colliding:

      // do win logic
      // start timer anim
      stateManager.setVariable("winnerAnnounced", true);
      this.addWinnerAndReset(pId);
      return;
    }

    if (tId === "i0" || tId === "i1") {
      // chalk this functionality for now
      return;
      console.log("onSpriteCollisionStart main teleport");
      playerManager.teleportPlayers([pId], {
        distributionType: "area",
        positionX: 50,
        positionY: 1425,
        width: 1400,
        height: 50,
      });
    } else {
      this.tileManager.addTileStander(tId);
    }
  }

  onSpriteCollisionStop({
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
    // determine if we're in the correct collision scenario
    let pSprite: PseudoSprite;
    let tSprite: PseudoSprite;
    if (sprite1.isPlayerSprite && sprite2.isPlayerSprite) {
      return;
    } else if (sprite1.isPlayerSprite) {
      pSprite = sprite1;
      tSprite = sprite2;
    } else if (sprite2.isPlayerSprite) {
      pSprite = sprite2;
      tSprite = sprite1;
    } else {
      return;
    }

    const tId = tSprite.uniqueId;
    const pId = pSprite.uniqueId;

    this.tileManager.removeTileStander(tId);
  }

  addWinnerAndReset(playerId: number) {
    // @TODO: increase playerId wins by 1

    // call gameManager to start countdown text
    this.gameManager.animateFinalCountdown();

    // winner text
    const details = playerManager.getPlayerDetails(playerId);
    const name = details.username;
    // console.log(name + " is winner, emitting winner event");
    // eventManager.emit("winner", {playerName: name});
    spriteManager.updateSprite(this.winnerText.uniqueId, { text: name + " wins!" });
  }

  onEvent_reset() {
    // clear winner text
    spriteManager.updateSprite(this.winnerText.uniqueId, { text: "" });
    // state

    // reset tiles
    for (let tile of this.tSprites) {
      spriteManager.updateSprite(tile.uniqueId, { opacity: 1, fill: this.BLUE });
    }
  }

  randomFromArray(arr: number[]): number {
    if (arr.length === 0) throw new Error("Array is empty");
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
  }

  generatePath(tilesPerRow: number, rows: number): boolean[][] {
    this.numGreenTiles = 0;

    // 0 represent a bad tile, 1 good tile
    let grid: boolean[][] = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < tilesPerRow; c++) grid[r][c] = false;
    }

    // make sure only 1 starting tile
    let startTile = Math.floor(Math.random() * tilesPerRow); // [0, tilerperrow)
    grid[rows - 1][startTile] = true;
    grid[rows - 2][startTile] = true;

    let goodCount: number = 2;
    let idealGoodCount: number = 3;
    let currentRow: number = rows - 2;
    let currentCol: number = startTile;
    let previousCol: number = startTile;

    while (1) {
      if (currentRow === 0) break;

      let included: number[] = [];
      if (
        previousCol !== currentCol - 1 &&
        currentCol !== 0 && // "if we didnt just come from left and we're not at the left edge, we can go left"
        grid[currentRow + 1][currentCol - 1] !== true
      )
        included.push(0); // if row +1, col-1 is taken dont go left
      if (
        previousCol !== currentCol + 1 &&
        currentCol !== tilesPerRow - 1 && // "if we didnt just come from right and we're not at the right edge, we can go right"
        grid[currentRow + 1][currentCol + 1] !== true
      )
        included.push(2); // if row +1, col+1 is taken dont go right

      if (goodCount % idealGoodCount !== 0) {
        included.push(1);
      } else if (Math.random() < 0.25) {
        included.push(1);
      }
      if (included.length === 0) {
        included.push(1);
      }

      let ran = this.randomFromArray(included);
      // console.log("chose: " + ran.toString() + " with ", grid[currentRow - 1][currentCol - 1]);
      // console.log("AND with: ", grid[currentRow - 1][currentCol - 1]);
      switch (ran) {
        case 0:
          grid[currentRow][currentCol - 1] = true; // tile left
          previousCol = currentCol;
          currentCol -= 1;
          break;
        case 1:
          grid[currentRow - 1][currentCol] = true; // tile ahead
          previousCol = currentCol;
          currentRow -= 1;
          goodCount += 1;
          break;
        case 2:
          grid[currentRow][currentCol + 1] = true; // tile right
          previousCol = currentCol;
          currentCol += 1;
          break;
      }
      this.numGreenTiles += 1;
    }
    console.log("generated grid: ", grid);
    this.grid = grid;
    return grid;
  }

  getNumGreenTiles() {
    return this.numGreenTiles;
  }

  // How many items of size `tile` fit in `size` with `gap` between items
  itemsThatFit(size: number, tile: number, gap: number, buffer: number = 0): number {
    if (tile <= 0) return 0;
    if (size < tile) return 0;
    return Math.floor((size + gap) / (tile + gap));
  }

  // Compute (x, y) positions in row-major order, centered in the area
  layoutGrid(
    areaW: number,
    areaH: number,
    tileW: number,
    tileH: number,
    gap: number,
    count: number, // total tiles to place
    rows: number,
    cols: number,
  ): Array<{ x: number; y: number }> {
    const perRow = cols;
    const perCol = rows;

    // We'll place up to the smaller of count or area capacity
    const capacity = perRow * perCol;
    const n = Math.min(count, capacity);

    // Used width/height of the fully-populated grid area
    const usedW = perRow * tileW + (perRow - 1) * gap;
    const usedH = Math.ceil(n / perRow) * tileH + (Math.ceil(n / perRow) - 1) * gap;

    // Center offsets
    const offsetX = Math.floor((areaW - usedW) / 2);
    const offsetY = Math.floor((areaH - usedH) / 2);

    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = offsetX + col * (tileW + gap);
      const y = offsetY + row * (tileH + gap);
      positions.push({ x, y });
    }
    return positions;
  }

  // canCollide fixmap brought over from hitboxManager for a quick test...
  // --- canCollide map helpers
  fixMap(playerId: number, canCollide: boolean) {
    const cc: Record<string, any> = stateManager.getVariable("canCollide");
    cc[playerId.toString()] = canCollide;
    stateManager.setVariable("canCollide", cc);
  }

  getActivityPublicKey(): string {
    return stateManager.getVariable("publicKey");
  }

  setWorldActivity(type: string) {
    try {
      if (!playerManager.isHost) return;
      const publicKey = this.getActivityPublicKey();
      if (!publicKey) return;
      integrationsManager.setWorldActivity({
        type: type,
        interactivePublicKey: publicKey,
      });
    } catch (e) {}
  }
}
