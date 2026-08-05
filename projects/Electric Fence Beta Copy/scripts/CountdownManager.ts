class CountdownManager extends SystemScript {
  // Declare properties
  countdownText: PseudoSprite | null;
  worldWidth: number;
  worldHeight: number;

  /** Constructor: Init primitives */
  constructor() {
    console.log('CountdownManager Constructor: Initializing...');
    this.worldWidth = 1000;
    this.worldHeight = 1000;

    console.log('CountdownManager Constructor: Initialized.');
  }

  /** onInit: Create sprite and THEN initialize reference */
  onInit() {
    console.log(
      'CountdownManager onInit: Attempting to create countdown text sprite...',
    );
    this.countdownText = null; // Init ref here
    try {
      const countdownSpriteOptions = {
        uniqueId: 'countdownText',
        positionX: this.worldWidth / 2,
        positionY: this.worldHeight / 2,
        text: 'Initializing...',
        fontSize: 80,
        align: 'center',
        anchor: { x: 0, y: 0 },
      };
      const sprite = spriteManager.addSprite(
        'countdownText',
        countdownSpriteOptions,
      );
      if (sprite) {
        console.log('CountdownManager SUCCESS: Score text sprite created.');
        this.countdownText = sprite; // Assign AFTER creation
        this.displayMessage('');
      } else {
        console.log(
          '!!! CountdownManager FAILURE: Failed to create score text sprite!',
        );
      }
    } catch (e) {
      console.log(
        '!!! CountdownManager CRITICAL ERROR during score text creation:',
        e,
      );
    }
    console.log('CountdownManager onInit completed.');
  }

  // --- Methods Called by GameManager ---
  displayMessage(message: string) {
    if (!this.countdownText) return;
    console.log(`CountdownManager: Displaying message - "${message}"`);
    try {
      spriteManager.updateSprite(this.countdownText.uniqueId, {
        text: message,
      });
    } catch (e) {
      console.log(
        '!!! CountdownManager ERROR updating sprite text (message):',
        e,
      );
    }
  }
}