"use strict";
class resetManager extends ComponentScript {
    countdown;
    onInit() {
        this.countdown = 7; // Start from 7 seconds
    }
    /*
     *  Runs a countdown on every step (1 second each step)
     */
    onStep() {
        if (!playerManager.isHost || this.countdown < 0)
            return;
        // Run countdown only if still ticking
        if (this.countdown >= 0) {
            const spriteMessage = `Game Resetting in: ${this.countdown}`;
            this.sprite.text = spriteMessage;
        }
        this.countdown--;
        if (this.countdown < 0) {
            this.sprite.text = '';
            eventManager.emit("resetGame", {});
            return;
        }
    }
}
