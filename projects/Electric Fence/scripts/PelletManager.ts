class PelletManager extends SystemScript {
  // --- Properties  ---
  pelletAssetKey: string;
  pelletComponentScriptId: string;
  pelletUniqueId: string;
  activePelletSprite: PseudoSprite;
  worldWidth: number;
  worldHeight: number;

  /** Constructor */
  constructor() {
    this.pelletUniqueId = 'the_pellet';
    this.activePelletSprite = null;
    console.log('PelletManager Constructor: Initializing...');
    this.pelletAssetKey = 'goldsphere';
    this.pelletComponentScriptId = 'Pellet';
    this.worldWidth = 1000;
    this.worldHeight = 1000;
    console.log('PelletManager Constructor: Initialized.');
  }
  /** onInit */
  onInit() {
    console.log('PelletManager onInit.');
  }
  /** spawnPellet Method */
  spawnPellet(x: number, y: number) {
    // --- Log Entry Point ---
    console.log(
      `PelletManager: ----- ENTERED spawnPellet(x=${x}, y=${y}) -----`,
    );
    // --- End Log ---

    console.log(`PelletManager: Attempting to despawn existing pellet first.`);
    this.despawnPellet(); // Despawn first

    // Validate position
    const spawnX = typeof x === 'number' ? x : this.worldWidth / 2;
    const spawnY = typeof y === 'number' ? y : this.worldHeight / 2;
    if (spawnX !== x || spawnY !== y) {
      console.log(
        `PelletManager WARNING: Invalid coordinates provided. Spawning at fallback (${spawnX}, ${spawnY})`,
      );
    }

    console.log(
      `PelletManager: Preparing to spawn '${this.pelletAssetKey}' at (${spawnX}, ${spawnY}).`,
    );
    try {
      console.log(`PelletManager: Calling addSprite...`);
      const pelletSprite = spriteManager.addSprite(this.pelletAssetKey, {
        uniqueId: this.pelletUniqueId,
        positionX: spawnX,
        positionY: spawnY,
        checkCollisions: true,
      });

      if (pelletSprite) {
        console.log(
          'PelletManager: addSprite successful. Attaching component...',
        );
        pelletSprite.attachComponent({
          scriptId: this.pelletComponentScriptId,
        });
        this.activePelletSprite = pelletSprite;
        console.log('PelletManager: Component attached and reference stored.');
      } else {
        console.log(`!!! PelletManager FAILURE: addSprite returned null.`);
        this.activePelletSprite = null;
      }
    } catch (error) {
      console.log(
        `!!! PelletManager CRITICAL ERROR during pellet creation:`,
        error,
      );
      this.activePelletSprite = null;
    }
    console.log('PelletManager: ----- EXITING spawnPellet -----');
  }

  /** despawnPellet Method */
  despawnPellet() {
    if (this.activePelletSprite && this.activePelletSprite.uniqueId) {
      const pelletIdToRemove = this.activePelletSprite.uniqueId;
      console.log(`PelletManager: Despawning pellet '${pelletIdToRemove}'.`);
      try {
        spriteManager.removeSprite(pelletIdToRemove);
      } catch (error) {
        console.log(`!!! PelletManager ERROR during removeSprite:`, error);
      }
      this.activePelletSprite = null;
    }
  }

  // --- EVENT LISTENER for spawn request ---
  /**
   * Listens for the "requestSpawnPellet" event emitted by GameManager.
   * @param eventData Payload containing { positionX, positionY, levelIndex? }
   */
  onEvent_requestSpawnPellet(eventData: {
    positionX: number;
    positionY: number;
    levelIndex?: number;
  }) {
    console.log(
      `PelletManager received event: requestSpawnPellet for level ${eventData?.levelIndex}`,
      eventData,
    );

    if (
      eventData &&
      eventData.positionX !== undefined &&
      eventData.positionY !== undefined &&
      typeof eventData.positionX === 'number' &&
      typeof eventData.positionY === 'number'
    ) {
      this.spawnPellet(eventData.positionX, eventData.positionY);
    } else {
      console.log(
        '!!! PelletManager ERROR: Invalid or missing coordinates in requestSpawnPellet event. Spawning at default.',
      );
      this.spawnPellet(this.worldWidth / 2, this.worldHeight / 2);
    }
  }
} // End class PelletManager