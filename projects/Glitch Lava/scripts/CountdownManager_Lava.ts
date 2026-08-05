class CountdownManager_Lava extends SystemScript {
  countdownTextSprite: PseudoSprite;
  timerManager: PseudoAny;
  eventToEmitOnFinish: string;

  worldCenterX: number;
  worldCenterY: number;

  onInit() {
    this.timerManager = scriptManager.getSystem({ systemName: 'TimerManager' });

    const worldWidth = 1000;
    const worldHeight = 1000;
    this.worldCenterX = worldWidth / 2;
    this.worldCenterY = worldHeight / 2;

    // Keep the vertical bounding box, as justify: 'center' works.
    const countdownBoxHeight = 300;
    const centeredY = this.worldCenterY - countdownBoxHeight / 2;

    const countdownSpriteOptions = {
      uniqueId: 'countdownSprite',
      // positionX will be set dynamically in updateDisplay
      positionY: centeredY,
      // Remove width, as align: 'center' is not working reliably.
      height: countdownBoxHeight,
      fontSize: 250,
      fontColor: '#FFFFFF',
      containerWidth: 1000,
      // We can leave align, it's just being ignored.
      align: 'center' as const,
      justify: 'center' as const,
      text: '',
      opacity: 0,
    };
    this.countdownTextSprite = spriteManager.addSprite(
      'text',
      countdownSpriteOptions,
    );
  }

  startCountdown(durationSeconds: number, eventName: string) {
    //if (!playerManager.isHost) return;
    this.eventToEmitOnFinish = eventName;
    this.updateDisplay(durationSeconds);
    this.scheduleTick(durationSeconds - 1);
  }

  scheduleTick(nextValue: number) {
    //if (!playerManager.isHost) return;
    this.timerManager.setTimer('lavaGameCountdownTick', 1, {
      value: nextValue,
    });
  }

  onEvent_lavaGameCountdownTick(payload: { value: number }) {
    //if (!playerManager.isHost) return;
    if (payload.value > 0) {
      this.updateDisplay(payload.value);
      this.scheduleTick(payload.value - 1);
    } else {
      this.updateDisplay('GO!');
      this.timerManager.setTimer('finishMainCountdown', 1);
    }
  }

  onEvent_finishMainCountdownNow() {
    //if (!playerManager.isHost) return;
    spriteManager.updateSprite(this.countdownTextSprite.uniqueId, {
      opacity: 0,
    });
    if (this.eventToEmitOnFinish) {
      eventManager.emit(this.eventToEmitOnFinish, {});
      this.eventToEmitOnFinish = null;
    }
  }

  updateDisplay(text: string | number) {
    const textStr = String(text);
    let offsetX = 0;

    // Manually estimate the half-width of each text string for centering.
    // These "magic numbers" can be tweaked if the centering is still slightly off.
    if (textStr === 'GO!') {
      offsetX = 220; // Half-width for the word "GO!"
    } else if (textStr === '1') {
      offsetX = 70; // Half-width for the narrow "1"
    } else {
      offsetX = 85; // Half-width for "2", "3", etc.
    }

    const centeredX = this.worldCenterX - offsetX;

    spriteManager.updateSprite(this.countdownTextSprite.uniqueId, {
      text: textStr,
      opacity: 1,
    });
    console.log(`[Countdown] ${text}`);
  }
}
