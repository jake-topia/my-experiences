"use strict";
class TimerManager extends ComponentScript {
    countdown;
    onInit() {
        this.countdown = 5; // Start from 5 seconds
    }
    /*
     *  Runs a countdown on every step (1 second each step)
     */
    onStep() {
        if (!playerManager.isHost || this.countdown < 0)
            return;
        // Run countdown only if still ticking
        if (this.countdown >= 0) {
            const spriteMessage = `Game starting in: ${this.countdown}`;
            this.sprite.text = spriteMessage;
        }
        this.countdown--;
        if (this.countdown < 0) {
            this.sprite.text = '';
            eventManager.emit("startGame", {}); // starts the game
            return;
        }
    }
}
