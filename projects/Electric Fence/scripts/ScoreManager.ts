class ScoreManager extends SystemScript {
  // Declare properties
  scoreTextSprite: PseudoSprite | null;
  worldWidth: number;
  positionX: number;

  /** Constructor: Init primitives */
  constructor() {
    console.log("ScoreManager Constructor: Initializing...");
    this.worldWidth = 1000;
    console.log("ScoreManager Constructor: Initialized.");
  }

  /** onInit: Create sprite and THEN initialize reference */
  onInit() {
    console.log(
      "ScoreManager onInit: Attempting to create score text sprite...",
    );
    this.positionX = this.worldWidth / 2 - 80;
    this.scoreTextSprite = null; // Init ref here
    try {
      const scoreSpriteOptions = {
        uniqueId: "scoreTextSprite",
        positionX: 0,
        positionY: 100,
        fontSize: 30,
        align: "center",
        text: "Initializing...",
        containerWidth: 1000,
        width: 10,
        height: 10,
        isInteractive: true,
      };
      const sprite = spriteManager.addSprite("scoreText", scoreSpriteOptions);
      sprite.width = 1000;
      console.log("SETTING WIDTH", sprite);
      sprite.height = 1000;
      if (sprite) {
        console.log("ScoreManager SUCCESS: Score text sprite created.");
        this.scoreTextSprite = sprite; // Assign AFTER creation
        this.displayMessage("Choose a Level");
      } else {
        console.log(
          "!!! ScoreManager FAILURE: Failed to create score text sprite!",
        );
      }
    } catch (e) {
      console.log(
        "!!! ScoreManager CRITICAL ERROR during score text creation:",
        e,
      );
    }
    console.log("ScoreManager onInit completed.");
  }

  // --- Methods Called by GameManager ---
  displayMessage(message: string, xPos: number = this.positionX) {
    if (!this.scoreTextSprite) return;
    console.log(`ScoreManager: Displaying message - "${message}"`);
    try {
      spriteManager.updateSprite(this.scoreTextSprite.uniqueId, {
        text: message,
        // positionX: xPos,
      });
    } catch (e) {
      console.log("!!! ScoreManager ERROR updating sprite text (message):", e);
    }
  }
  updateScoreDisplay(timeInSeconds: number) {
    if (!this.scoreTextSprite) return;
    let displayText = `Time: ${timeInSeconds.toFixed(2)}s`;

    try {
      spriteManager.updateSprite(this.scoreTextSprite.uniqueId, {
        text: displayText,
      });
    } catch (e) {
      console.log("!!! ScoreManager ERROR updating sprite text (time):", e);
    }
  }
  recordFinalScore(playerId: number, finalTime: number) {
    console.log(`ScoreManager: Player ${playerId} final score: ${finalTime}s`);
    //this.displayMessage(`Finished!\nTime: ${finalTime.toFixed(2)}s`);
  }
}
