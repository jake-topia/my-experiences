class ResetManager extends ComponentScript {
  countdown: number;

  constructor() {}

  onInit() {
    this.countdown = 7;
  }

  onStep() {
    if (!playerManager.isHost || this.countdown < 0) return;

    if (this.countdown >= 0) {
      this.sprite.text = `Game Resetting in: ${this.countdown}`;
    }

    this.countdown--;

    if (this.countdown < 0) {
      this.sprite.text = '';
      eventManager.emit('resetGame', {});
    }
  }
}
