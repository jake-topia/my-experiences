class ScoreManagerLava extends SystemScript {
  // --- Sprite refs ---
  messageTextSprite: PseudoSprite; // lobby / status messages
  liveScoreTextSprite: PseudoSprite; // "SCORE: X"

  // --- Layout ---
  worldWidth: number;
  messagePositionX: number;
  messagePositionY: number;
  liveScorePositionX: number;
  liveScorePositionY: number;

  // --- External systems ---
  gameManager: any;
  timerManager: any;

  /** Constructor: init simple fields (no async) */
  onInit() {
    console.log('[Score] INFO onInit:start');

    // FIX: Define layout variables *before* they are used.
    this.worldWidth = 1000;
    // Anchor all UI to the top-left for a clean HUD.
    this.liveScorePositionX = 20;
    this.liveScorePositionY = 20;
    this.messagePositionX = 20;
    this.messagePositionY = 55; // Position below the score

    try {
      this.timerManager = scriptManager.getSystem({
        systemName: 'TimerManager',
      });
      if (!this.timerManager) {
        console.log('[Score] ERROR onInit: missing TimerManager');
      }

      this.gameManager = scriptManager.getSystem({
        systemName: 'GameManager_Lava',
      });
      if (!this.gameManager) {
        console.log('[Score] ERROR onInit: missing GameManager_Lava');
      }

      // --- Message banner sprite ---
      const messageSpriteOptions = {
        uniqueId: 'lavaMessageTextSprite',
        positionX: this.messagePositionX,
        positionY: this.messagePositionY,
        fontSize: 22, // Standardized font size
        width: 600,
        fontColor: '#FFFFFF',
        align: 'left' as const,
        text: this.getStartupInstructions(),
        opacity: 1, // Use opacity for visibility
      };
      const msgSprite = spriteManager.addSprite('text', messageSpriteOptions);
      if (msgSprite) {
        this.messageTextSprite = msgSprite;
        console.log('[Score] INFO message sprite: created');
      } else {
        console.log('[Score] ERROR message sprite: create failed');
      }

      // --- Live score sprite ---
      const liveScoreSpriteOptions = {
        uniqueId: 'lavaLiveScoreTextSprite',
        positionX: this.liveScorePositionX,
        positionY: this.liveScorePositionY,
        fontSize: 22, // Standardized font size
        width: 400,
        fontColor: '#FFFFFF',
        align: 'left' as const,
        text: 'SCORE: 0',
        opacity: 1, // Use opacity, will be toggled later
      };
      const scoreSprite = spriteManager.addSprite(
        'text',
        liveScoreSpriteOptions,
      );
      if (scoreSprite) {
        this.liveScoreTextSprite = scoreSprite;
        console.log('[Score] INFO live score sprite: created');
      } else {
        console.log('[Score] ERROR live score sprite: create failed');
      }
    } catch (e) {
      console.log('[Score] ERROR onInit:create sprites', e);
    }
    console.log('[Score] INFO onInit:done');
  }

  /**
   * Neat, left-aligned startup instructions shown on load
   */
  getStartupInstructions(): string {
    // UPDATE: New instructions as requested.
    return [
      'Glitch Lava',
      '',
      'Move to the center to start!',
      'Avoid lava to survive.',
      'Touch green zones for bonus points!',
    ].join('\n');
  }

  /**
   * Set the banner message and (optionally) override position.
   * Position defaults to configured anchors when not provided.
   */
  displayMessage(message: string, xPos?: number, yPos?: number) {
    if (!this.messageTextSprite) {
      console.log('[Score] WARN displayMessage: message sprite missing');
      return;
    }
    console.log('[Score] INFO message: ' + message);

    try {
      const updateOptions: any = { text: message };
      if (xPos !== undefined) {
        updateOptions.positionX = xPos;
      } else {
        updateOptions.positionX = this.messagePositionX;
      }

      if (yPos !== undefined) {
        updateOptions.positionY = yPos;
      } else {
        updateOptions.positionY = this.messagePositionY;
      }
      // Ensure message sprite is visible when text is set
      updateOptions.opacity = 1;

      spriteManager.updateSprite(
        this.messageTextSprite.uniqueId,
        updateOptions,
      );

      if (this.timerManager) {
        this.timerManager.clearTimer('messageClear');
      }
    } catch (e) {
      console.log('[Score] ERROR displayMessage:update', e);
    }
  }

  /**
   * Timer hook for clearing the message text (used if a 'messageClear' is scheduled).
   */
  onEvent_clearMessageNow(payload: { spriteId: string } | null) {
    if (
      payload?.spriteId &&
      this.messageTextSprite &&
      payload.spriteId === this.messageTextSprite.uniqueId
    ) {
      try {
        spriteManager.updateSprite(this.messageTextSprite.uniqueId, {
          text: '',
        });
        console.log('[Score] INFO message: cleared');
      } catch (e) {
        console.log(
          '[Score] ERROR message: clear failed for ' + payload.spriteId,
          e,
        );
      }
    } else if (
      this.messageTextSprite &&
      payload?.spriteId !== this.messageTextSprite.uniqueId
    ) {
      console.log(
        '[Score] WARN clearMessageNow: mismatched spriteId=' + payload.spriteId,
      );
    }
  }

  /**
   * Refresh the "SCORE: X" display.
   */
  updateLiveScore(cyclesCompleted: number, numPlayers: number) {
    if (!this.liveScoreTextSprite) {
      console.log('[Score] WARN updateLiveScore: score sprite missing');
      return;
    }
    const currentTotalScore = this.gameManager.totalScore;
    const displayText = 'SCORE: ' + currentTotalScore;

    try {
      spriteManager.updateSprite(this.liveScoreTextSprite.uniqueId, {
        text: displayText,
      });
    } catch (e) {
      console.log('[Score] ERROR updateLiveScore:update', e);
    }
  }

  /**
   * Toggle visibility of the live score text using opacity.
   */
  showScoreSprite(show: boolean) {
    if (!this.liveScoreTextSprite) {
      console.log('[Score] WARN showScoreSprite: score sprite missing');
      return;
    }
    try {
      // FIX: Implemented visibility toggle using opacity.
      spriteManager.updateSprite(this.liveScoreTextSprite.uniqueId, {
        opacity: show ? 1 : 0,
      });
    } catch (e) {
      console.log('[Score] ERROR showScoreSprite:update', e);
    }
  }

  /**
   * Optional log hook for final score (main game over UI handled in GameManager_Lava).
   */
  recordFinalScore(
    playerId: number,
    finalCycles: number,
    finalTotalScore: number,
  ) {
    console.log(
      '[Score] INFO final: playerId≈' +
        playerId +
        ' cycles=' +
        finalCycles +
        ' total=' +
        finalTotalScore,
    );
  }

  /**
   * Adds bonus points to GameManager’s running total and flashes a banner.
   */
  addBonusPoints(points: number) {
    if (!this.gameManager) {
      this.gameManager = scriptManager.getSystem({
        systemName: 'GameManager_Lava',
      });
    }
    if (!this.gameManager.bonusPoints) {
      this.gameManager.bonusPoints = 0;
    }

    this.gameManager.bonusPoints += points;
    console.log(
      '[Score] INFO bonus: +' +
        points +
        ' (total bonus=' +
        this.gameManager.bonusPoints +
        ')',
    );

    this.displayMessage('+' + points + ' BONUS!');
  }
}
