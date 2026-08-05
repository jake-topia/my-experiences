class tileManager extends SystemScript {
  worldWidth: number;
  worldHeight: number;
  playAreaWidth: number;
  arenaStartX: number;
  arenaTop: number;
  tileSize: number;
  gap: number;
  rows: number;
  cols: number;
  fruitSpriteSize: number;
  tileIds: string[];
  tileDataById: Record<string, any>;
  tileBlue: string;
  coreFruits: string[];
  extraFruits: string[];
  fruitSpriteAvailability: Record<string, any>;

  onInit() {
    if (!playerManager.isHost) return;

    this.worldWidth = 1500;
    this.worldHeight = 1500;
    this.playAreaWidth = 1296;
    this.arenaStartX = 76;
    this.tileSize = 160;
    this.gap = 4;
    this.rows = 8;
    this.cols = 6;
    this.arenaTop = Math.floor(
      (this.worldHeight -
        (this.rows * this.tileSize + (this.rows - 1) * this.gap)) / 2,
    );
    this.fruitSpriteSize = 160;
    this.tileIds = [];
    this.tileDataById = {};
    this.tileBlue = "#4a69c4";
    this.fruitSpriteAvailability = {};
    this.coreFruits = ["strawberry", "banana", "grape", "apple"];
    this.extraFruits = [
      "blueberry",
      "pineapple",
      "guava",
      "orange",
      "watermelon",
      "pear",
      "kiwi",
      "mango",
    ];

    this.buildTiles();
    this.clearAll();
  }

  buildTiles() {
    const offsetX = this.arenaStartX;
    const offsetY = this.arenaTop;

    let tileIndex = 0;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!this.shouldCreateTile(row, col)) continue;

        const positionX = offsetX + col * (this.tileSize + this.gap);
        const positionY = offsetY + row * (this.tileSize + this.gap);
        const tileId = "t" + tileIndex.toString();
        const fruitSpriteId = tileId + "_fruit";
        const labelId = tileId + "_label";

        spriteManager.addSprite("tile", {
          uniqueId: tileId,
          positionX: positionX,
          positionY: positionY,
          width: this.tileSize,
          height: this.tileSize,
          checkCollisions: false,
          opacity: 0,
        });

        spriteManager.addSprite("basicText", {
          uniqueId: labelId,
          positionX: positionX,
          positionY: positionY,
          containerWidth: this.tileSize,
          align: "center",
          text: "",
          fontSize: 28,
          fontWeight: "bold",
          fontColor: "#ffffff",
          topAdjust: this.getTileLabelTopAdjust(),
          opacity: 0,
        });

        this.tileIds.push(tileId);
        this.tileDataById[tileId] = {
          positionX: positionX,
          positionY: positionY,
          row: row,
          col: col,
          fruitSpriteId: fruitSpriteId,
          activeFruitSpriteId: "",
          currentFruitSpriteName: "",
          labelId: labelId,
        };

        tileIndex += 1;
      }
    }
  }

  shouldCreateTile(row: number, col: number): boolean {
    const centerCutoutStartRow = Math.floor((this.rows - 2) / 2);
    const centerCutoutStartCol = Math.floor((this.cols - 2) / 2);
    const inCenterCutout = row >= centerCutoutStartRow &&
      row < centerCutoutStartRow + 2 &&
      col >= centerCutoutStartCol &&
      col < centerCutoutStartCol + 2;

    return !inCenterCutout;
  }

  prepareRound(roundNumber: number) {
    if (!playerManager.isHost) return;

    const fruitOptions = this.buildRoundFruitOptions(roundNumber);
    this.prepareRoundFromFruitOptions(fruitOptions);
  }

  prepareReplayRound(roundNumber: number) {
    if (!playerManager.isHost) return;

    const savedFruitOptions = this.getRoundFruitOptionsFromState();
    if (savedFruitOptions.length > 0) {
      this.prepareRoundFromFruitOptions(savedFruitOptions);
      return;
    }

    this.prepareRound(roundNumber);
  }

  prepareRoundFromFruitOptions(fruitOptions: string[]) {
    if (!playerManager.isHost) return;

    this.restoreAllTiles();

    const shuffledTileIds = this.shuffleList(this.tileIds);
    const tileFruitMap: Record<string, any> = {};

    for (let i = 0; i < shuffledTileIds.length; i++) {
      tileFruitMap[shuffledTileIds[i]] = fruitOptions[i % fruitOptions.length];
    }

    const safeFruitName =
      fruitOptions[Math.floor(Math.random() * fruitOptions.length)];
    const safeTileMap: Record<string, any> = {};

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileId = this.tileIds[i];
      if (tileFruitMap[tileId] === safeFruitName) {
        safeTileMap[tileId] = true;
      }
    }

    stateManager.setVariable(
      "roundFruitOptionsMap",
      this.arrayToIndexedMap(fruitOptions),
    );
    stateManager.setVariable("tileFruitMap", tileFruitMap);
    stateManager.setVariable("safeFruitName", safeFruitName);
    stateManager.setVariable("safeTileMap", safeTileMap);
  }

  buildRoundFruitOptions(roundNumber: number): string[] {
    const options: string[] = [];
    const poolSize = this.getRoundFruitPoolSize(roundNumber);

    if (roundNumber <= 1) {
      options.push(this.coreFruits[0]);
      options.push(this.coreFruits[1]);
      options.push(this.coreFruits[2]);
    } else {
      for (let i = 0; i < this.coreFruits.length; i++) {
        options.push(this.coreFruits[i]);
      }
    }

    const extrasNeeded = poolSize - options.length;
    if (extrasNeeded <= 0) {
      return options.slice(0, poolSize);
    }

    const shuffledExtras = this.shuffleList(this.extraFruits);
    for (let i = 0; i < extrasNeeded && i < shuffledExtras.length; i++) {
      options.push(shuffledExtras[i]);
    }

    return options;
  }

  getRoundFruitPoolSize(roundNumber: number): number {
    if (roundNumber <= 1) return 3;
    if (roundNumber <= 3) return 4;
    if (roundNumber === 4) return 5;
    if (roundNumber === 5) return 6;
    if (roundNumber === 6) return 7;
    return 8;
  }

  showAllFruitLabels() {
    if (!playerManager.isHost) return;

    const tileFruitMap = stateManager.getVariable("tileFruitMap");
    for (let i = 0; i < this.tileIds.length; i++) {
      const tileId = this.tileIds[i];
      const fruitName = tileFruitMap[tileId] || "";
      this.setTileFruitDisplay(tileId, fruitName, true);
    }
  }

  hideAllFruitLabels() {
    if (!playerManager.isHost) return;

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileData = this.tileDataById[this.tileIds[i]];
      this.hideTileFruitDisplay(tileData);
    }
  }

  showSafeResults() {
    if (!playerManager.isHost) return;

    const safeTileMap = stateManager.getVariable("safeTileMap");
    const tileFruitMap = stateManager.getVariable("tileFruitMap");

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileId = this.tileIds[i];
      const tileData = this.tileDataById[tileId];
      const isSafe = safeTileMap[tileId] === true;

      spriteManager.updateSprite(tileId, {
        opacity: isSafe ? 1 : 0,
        checkCollisions: isSafe,
        fill: this.tileBlue,
      });
      this.setTileFruitDisplay(tileId, tileFruitMap[tileId] || "", isSafe);
    }
  }

  restoreAllTiles() {
    if (!playerManager.isHost) return;

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileId = this.tileIds[i];
      const tileData = this.tileDataById[tileId];

      spriteManager.updateSprite(tileId, {
        opacity: 1,
        checkCollisions: true,
        fill: this.tileBlue,
      });
      this.hideTileFruitDisplay(tileData);
    }
  }

  hideAllTiles() {
    if (!playerManager.isHost) return;

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileId = this.tileIds[i];
      const tileData = this.tileDataById[tileId];

      spriteManager.updateSprite(tileId, {
        opacity: 0,
        checkCollisions: false,
      });
      this.hideTileFruitDisplay(tileData);
      spriteManager.updateSprite(tileData.labelId, {
        text: "",
        opacity: 0,
      });
    }
  }

  clearAll() {
    if (!playerManager.isHost) return;
    this.hideAllTiles();
    this.removeAllFruitSprites();
  }

  updateAllFruitLabelText() {
    if (!playerManager.isHost) return;

    const tileFruitMap = stateManager.getVariable("tileFruitMap");

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileId = this.tileIds[i];
      const tileData = this.tileDataById[tileId];

      spriteManager.updateSprite(tileData.labelId, {
        text: this.toDisplayFruitName(tileFruitMap[tileId] || ""),
      });
    }
  }

  setTileFruitDisplay(tileId: string, fruitName: string, shouldShow: boolean) {
    if (!playerManager.isHost) return;

    const tileData = this.tileDataById[tileId];
    if (!tileData) return;

    if (!shouldShow || !fruitName) {
      this.hideTileFruitDisplay(tileData);
      spriteManager.updateSprite(tileData.labelId, {
        text: "",
        opacity: 0,
      });
      return;
    }

    if (this.ensureFruitSprite(tileData, fruitName)) {
      spriteManager.updateSprite(tileData.activeFruitSpriteId, {
        positionX: this.getFruitSpritePositionX(tileData),
        positionY: this.getFruitSpritePositionY(tileData),
        opacity: 1,
      });
      spriteManager.updateSprite(tileData.labelId, {
        text: "",
        opacity: 0,
      });
      return;
    }

    this.hideTileFruitSprite(tileData);
    spriteManager.updateSprite(tileData.labelId, {
      text: this.toDisplayFruitName(fruitName),
      opacity: 1,
    });
  }

  hideTileFruitDisplay(tileData: Record<string, any>) {
    if (!playerManager.isHost) return;

    this.hideTileFruitSprite(tileData);
    spriteManager.updateSprite(tileData.labelId, {
      opacity: 0,
    });
  }

  hideTileFruitSprite(tileData: Record<string, any>) {
    if (!playerManager.isHost) return;

    const fruitSpriteId = this.getActiveFruitSpriteId(tileData);
    if (!fruitSpriteId) return;
    if (!spriteManager.getSprite(fruitSpriteId)) return;

    spriteManager.updateSprite(fruitSpriteId, {
      opacity: 0,
    });
  }

  ensureFruitSprite(tileData: Record<string, any>, fruitName: string): boolean {
    if (!playerManager.isHost) return false;

    const desiredFruitSpriteId = this.getFruitSpriteUniqueId(tileData, fruitName);
    const existingSprite = spriteManager.getSprite(desiredFruitSpriteId);
    if (
      existingSprite &&
      tileData.activeFruitSpriteId === desiredFruitSpriteId
    ) {
      return true;
    }

    this.removeTileFruitSprite(tileData, desiredFruitSpriteId);

    if (this.fruitSpriteAvailability[fruitName] === false) {
      return false;
    }

    if (existingSprite) {
      tileData.activeFruitSpriteId = desiredFruitSpriteId;
      tileData.currentFruitSpriteName = fruitName;
      return true;
    }

    let fruitSpriteId: any;
    fruitSpriteId = fruitName;

    try {
      spriteManager.addSprite(fruitSpriteId, {
        uniqueId: desiredFruitSpriteId,
        positionX: this.getFruitSpritePositionX(tileData),
        positionY: this.getFruitSpritePositionY(tileData),
        displayLayer: "top",
        opacity: 0,
        applyPhysics: false,
        checkCollisions: false,
      });
      tileData.activeFruitSpriteId = desiredFruitSpriteId;
      tileData.currentFruitSpriteName = fruitName;
      this.fruitSpriteAvailability[fruitName] = true;
      return true;
    } catch (error) {
      tileData.activeFruitSpriteId = "";
      tileData.currentFruitSpriteName = "";
      this.fruitSpriteAvailability[fruitName] = false;
      return false;
    }
  }

  removeAllFruitSprites() {
    if (!playerManager.isHost) return;

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileData = this.tileDataById[this.tileIds[i]];
      this.removeTileFruitSprite(tileData);
    }
  }

  removeTileFruitSprite(
    tileData: Record<string, any>,
    exceptSpriteId?: string,
  ) {
    if (!playerManager.isHost) return;

    const activeFruitSpriteId = this.getActiveFruitSpriteId(tileData);
    if (
      activeFruitSpriteId &&
      activeFruitSpriteId !== exceptSpriteId &&
      spriteManager.getSprite(activeFruitSpriteId)
    ) {
      spriteManager.removeSprite(activeFruitSpriteId);
    }

    if (
      tileData.fruitSpriteId &&
      tileData.fruitSpriteId !== activeFruitSpriteId &&
      tileData.fruitSpriteId !== exceptSpriteId &&
      spriteManager.getSprite(tileData.fruitSpriteId)
    ) {
      spriteManager.removeSprite(tileData.fruitSpriteId);
    }

    if (!exceptSpriteId) {
      tileData.activeFruitSpriteId = "";
      tileData.currentFruitSpriteName = "";
    }
  }

  getFruitSpriteUniqueId(tileData: Record<string, any>, fruitName: string): string {
    // Keep each fruit asset on its own synced uniqueId so clients never reinterpret a tile sprite in place.
    return tileData.fruitSpriteId + "_" + fruitName;
  }

  getActiveFruitSpriteId(tileData: Record<string, any>): string {
    if (tileData.activeFruitSpriteId) return tileData.activeFruitSpriteId;
    if (tileData.currentFruitSpriteName) {
      return this.getFruitSpriteUniqueId(
        tileData,
        tileData.currentFruitSpriteName,
      );
    }
    if (spriteManager.getSprite(tileData.fruitSpriteId)) {
      return tileData.fruitSpriteId;
    }
    return "";
  }

  refreshPlayerCurrentTileMap(playerIds?: number[]) {
    if (!playerManager.isHost) return;

    const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
    const ids = playerIds || playerManager.getPlayerIds();

    for (let i = 0; i < ids.length; i++) {
      const playerId = ids[i];
      const tileId = this.findTileUnderPlayer(playerId);

      if (tileId) {
        currentTileMap[playerId.toString()] = tileId;
      } else {
        delete currentTileMap[playerId.toString()];
      }
    }

    stateManager.setVariable("playerCurrentTileMap", currentTileMap);
  }

  findTileUnderPlayer(playerId: number): string {
    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (!playerDetails) return "";

    const footX = playerDetails.x + 50;
    const footY = playerDetails.y + 60;

    for (let i = 0; i < this.tileIds.length; i++) {
      const tileId = this.tileIds[i];
      const tileSprite = spriteManager.getSprite(tileId);
      if (!tileSprite || tileSprite.opacity <= 0) continue;

      if (
        footX >= tileSprite.position.x &&
        footX <= tileSprite.position.x + this.tileSize &&
        footY >= tileSprite.position.y &&
        footY <= tileSprite.position.y + this.tileSize
      ) {
        return tileId;
      }
    }

    return "";
  }

  isPlayerOnSafeTile(playerId: number): boolean {
    const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
    const safeTileMap = stateManager.getVariable("safeTileMap");
    const currentTileId = currentTileMap[playerId.toString()];

    if (!currentTileId) return false;
    return safeTileMap[currentTileId] === true;
  }

  onSpriteCollisionStart({
    sprite1,
    sprite2,
  }: {
    sprite1: PseudoSprite;
    sprite2: PseudoSprite;
  }) {
    if (!playerManager.isHost) return;
    if (!this.shouldTrackPlayerTiles()) return;

    const collision = this.decodePlayerTileCollision(sprite1, sprite2);
    if (!collision) return;

    const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
    currentTileMap[collision.playerId.toString()] = collision.tileId;
    stateManager.setVariable("playerCurrentTileMap", currentTileMap);
  }

  onSpriteCollisionStop({
    sprite1,
    sprite2,
  }: {
    sprite1: PseudoSprite;
    sprite2: PseudoSprite;
  }) {
    if (!playerManager.isHost) return;
    if (!this.shouldTrackPlayerTiles()) return;

    const collision = this.decodePlayerTileCollision(sprite1, sprite2);
    if (!collision) return;

    const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
    const currentTileId = currentTileMap[collision.playerId.toString()];

    if (currentTileId === collision.tileId) {
      delete currentTileMap[collision.playerId.toString()];
      stateManager.setVariable("playerCurrentTileMap", currentTileMap);
    }
  }

  decodePlayerTileCollision(
    sprite1: PseudoSprite,
    sprite2: PseudoSprite,
  ): { playerId: number; tileId: string } | null {
    let playerSprite: PseudoSprite | null = null;
    let tileSprite: PseudoSprite | null = null;

    if (sprite1.isPlayerSprite && this.isTile(sprite2.uniqueId)) {
      playerSprite = sprite1;
      tileSprite = sprite2;
    } else if (sprite2.isPlayerSprite && this.isTile(sprite1.uniqueId)) {
      playerSprite = sprite2;
      tileSprite = sprite1;
    }

    if (!playerSprite || !tileSprite) return null;

    return {
      playerId: Number(playerSprite.uniqueId),
      tileId: tileSprite.uniqueId,
    };
  }

  shouldTrackPlayerTiles(): boolean {
    const phase = stateManager.getVariable("gamePhase");
    return (
      phase === "MEMORIZE" ||
      phase === "MOVE" ||
      phase === "RESOLVE"
    );
  }

  isTile(uniqueId: string): boolean {
    return this.tileDataById[uniqueId] !== undefined;
  }

  onPlayerLeft({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;

    const currentTileMap = stateManager.getVariable("playerCurrentTileMap");
    delete currentTileMap[playerId.toString()];
    stateManager.setVariable("playerCurrentTileMap", currentTileMap);
  }

  shuffleList(list: any[]): any[] {
    const copy = list.slice();

    for (let i = copy.length - 1; i > 0; i--) {
      const swapIndex = Math.floor(Math.random() * (i + 1));
      const currentValue = copy[i];
      copy[i] = copy[swapIndex];
      copy[swapIndex] = currentValue;
    }

    return copy;
  }

  arrayToIndexedMap(list: string[]): Record<string, any> {
    const map: Record<string, any> = {};

    for (let i = 0; i < list.length; i++) {
      map[i.toString()] = list[i];
    }

    return map;
  }

  getRoundFruitOptionsFromState(): string[] {
    const roundFruitOptionsMap = stateManager.getVariable("roundFruitOptionsMap");
    const fruitOptions: string[] = [];

    for (let i = 0; roundFruitOptionsMap[i.toString()]; i++) {
      fruitOptions.push(roundFruitOptionsMap[i.toString()]);
    }

    return fruitOptions;
  }

  getFruitSpritePositionX(tileData: Record<string, any>): number {
    return tileData.positionX +
      Math.floor((this.tileSize - this.fruitSpriteSize) / 2);
  }

  getFruitSpritePositionY(tileData: Record<string, any>): number {
    return tileData.positionY +
      Math.floor((this.tileSize - this.fruitSpriteSize) / 2);
  }

  getTileLabelTopAdjust(): number {
    return Math.floor((this.tileSize - 44) / 2);
  }

  toDisplayFruitName(fruitName: string): string {
    if (!fruitName) return "";
    return fruitName.charAt(0).toUpperCase() + fruitName.slice(1);
  }
}
