"use strict";
class TimerManager extends ComponentScript {
    countdownMinutes;
    countdownSeconds;
    _enteredFinalCountdown;
    onInit() {
        this.countdownMinutes = 3; // Start from 3 min
        this.countdownSeconds = 0;
        this._enteredFinalCountdown = false;
        this.sprite.text = `${this.countdownMinutes}: ${this.countdownSeconds}`;
    }
    // Runs every frame (usually ~30fps)
    onStep() {
        if (!playerManager.isHost || this.countdownMinutes < 0)
            return;
        // Run countdown only if still ticking
        if (this.countdownMinutes >= 0) {
            if (this.countdownSeconds < 0) {
                this.countdownSeconds += 60;
            }
            const secondsText = this.countdownSeconds < 10 && this.countdownSeconds >= 0
                ? "0" + this.countdownSeconds.toString()
                : this.countdownSeconds.toString();
            const spriteMessage = `${this.countdownMinutes}: ${secondsText}`;
            this.sprite.text = spriteMessage;
        }
        // Final 10-second countdown: show on player menu panel
        if (this.countdownMinutes === 0 && this.countdownSeconds <= 10 && this.countdownSeconds >= 0) {
            if (!this._enteredFinalCountdown) {
                this._enteredFinalCountdown = true;
                stateManager.setVariable("MenuState", "GAME_ENDING");
                stateManager.setVariable("MenuActionText", "");
            }
            stateManager.setVariable("MenuDetailText", "FINAL  " + this.countdownSeconds);
        }
        if (this.countdownSeconds === 0) {
            this.countdownMinutes--;
        }
        this.countdownSeconds--;
        if (this.countdownMinutes < 0) {
            this.sprite.text = "";
            eventManager.emit("timerEndGame", {});
            return;
        }
    }
}
