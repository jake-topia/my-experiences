class TimerManager extends SystemScript {
  countdownSprite: PseudoSprite | null;
  countdownBackgroundSprite: PseudoSprite | null;
  currentStep: number;
  countdownTargetStep: number;
  countdownValue: number;
  roundFinishDeadlineMs: number;
  roundFinishLastDisplayedSeconds: number;
  worldWidth: number;
  worldHeight: number;
  isClearing: boolean;

  constructor() {
    if (!playerManager.isHost) return;
    this.countdownSprite = null;
    this.countdownBackgroundSprite = null;
    this.currentStep = 0;
    this.countdownTargetStep = 0;
    this.countdownValue = 0;
    this.roundFinishDeadlineMs = 0;
    this.roundFinishLastDisplayedSeconds = -1;
    this.worldWidth = 1500;
    this.worldHeight = 1500;
    this.isClearing = false;
  }

  onInit() {
    if (!playerManager.isHost) return;
    this.countdownSprite = spriteManager.addSprite('countdownText', {
      uniqueId: 'countdownText',
      positionX: 0,
      positionY: this.worldHeight / 2,
      containerWidth: this.worldWidth,
      width: this.worldWidth,
      text: '',
      fontSize: 80,
      align: 'center',
      topAdjust: 2000,
    });
  }

  onStep() {
    if (!playerManager.isHost) return;
    this.currentStep++;

    if (this.countdownTargetStep > 0 && this.currentStep >= this.countdownTargetStep) {
      this.countdownTargetStep = 0;
      this.processCountdownTick();
    }

    this.updateRoundFinishCountdownDisplay();
  }

  startCountdown(seconds: number) {
    this.roundFinishDeadlineMs = 0;
    this.roundFinishLastDisplayedSeconds = -1;
    this.countdownValue = seconds;
    this.isClearing = false;
    this.ensureCountdownBackground();
    this.scheduleNextTick();
  }

  startRoundFinishCountdown(seconds: number) {
    this.removeCountdownBackground();
    this.countdownTargetStep = 0;
    this.countdownValue = 0;
    this.isClearing = false;
    this.roundFinishDeadlineMs = Date.now() + (seconds * 1000);
    this.roundFinishLastDisplayedSeconds = -1;
    this.updateRoundFinishCountdownDisplay();
  }

  isRoundFinishCountdownActive(): boolean {
    return this.roundFinishDeadlineMs > 0;
  }

  hasRoundFinishCountdownExpired(): boolean {
    if (this.roundFinishDeadlineMs <= 0) return false;
    return Date.now() >= this.roundFinishDeadlineMs;
  }

  scheduleNextTick() {
    this.countdownTargetStep = this.currentStep + 1;
  }

  processCountdownTick() {
    if (this.isClearing) {
      this.updateDisplay('');
      this.removeCountdownBackground();
      eventManager.emit('allowMovement', {});
      this.isClearing = false;
      this.countdownValue = -999;
      return;
    }

    if (this.countdownValue > 0) {
      this.updateDisplay(`${this.countdownValue}`);
      eventManager.emit('countdownTick', { countdownValue: this.countdownValue });
      this.countdownValue--;
      this.scheduleNextTick();
    } else if (this.countdownValue === 0) {
      this.updateDisplay('GO!');
      this.isClearing = true;
      this.countdownValue = -1;
      this.scheduleNextTick();
    }
  }

  updateDisplay(text: string) {
    if (!this.countdownSprite) return;
    this.updateCountdownBackground(text);
    spriteManager.updateSprite(this.countdownSprite.uniqueId, { text: text });
  }

  updateRoundFinishCountdownDisplay() {
    if (this.roundFinishDeadlineMs <= 0) return;

    const remainingMs = this.roundFinishDeadlineMs - Date.now();
    let remainingSeconds = 0;

    if (remainingMs > 0) {
      remainingSeconds = Math.ceil(remainingMs / 1000);
    }

    if (remainingSeconds === this.roundFinishLastDisplayedSeconds) return;

    this.roundFinishLastDisplayedSeconds = remainingSeconds;
    this.updateDisplay(remainingSeconds.toString() + 's remaining!');
  }

  clearTimer() {
    this.countdownTargetStep = 0;
    this.countdownValue = 0;
    this.roundFinishDeadlineMs = 0;
    this.roundFinishLastDisplayedSeconds = -1;
    this.isClearing = false;
    this.removeCountdownBackground();
    this.updateDisplay('');
  }

  ensureCountdownBackground() {
    if (this.countdownBackgroundSprite) return;

    this.countdownBackgroundSprite = spriteManager.addSprite('baseRect', {
      uniqueId: 'countdownTextBackground',
      positionX: this.worldWidth / 2 - 50,
      positionY: this.worldHeight / 2 - 20,
      width: 100,
      height: 110,
      fill: "rgba(18, 22, 14, 1)",
      borderRadius: 22,
      topAdjust: 1000,
    });
  }

  updateCountdownBackground(text: string) {
    if (!this.countdownBackgroundSprite) return;

    let width = text.length * 56 + 40;
    if (width < 100) width = 100;

    spriteManager.updateSprite(this.countdownBackgroundSprite.uniqueId, {
      positionX: (this.worldWidth - width) / 2,
      positionY: this.worldHeight / 2 - 20,
      width: width,
      height: 110,
    });
  }

  removeCountdownBackground() {
    if (!this.countdownBackgroundSprite) return;

    spriteManager.removeSprite(this.countdownBackgroundSprite.uniqueId);
    this.countdownBackgroundSprite = null;
  }
}
