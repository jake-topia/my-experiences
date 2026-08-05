"use strict";
class resetManager extends ComponentScript {
    countdown;
    onInit() {
        this.countdown = 7; // Start from 10 seconds
    }
    // Runs every frame (usually ~30fps)
    onStep() {
        if (!playerManager.isHost || this.countdown < 0)
            return;
        // Run countdown only if still ticking
        if (this.countdown >= 0) {
            var spriteMessage = 'Game Resetting in: ' + this.countdown;
            // Update the player-following panel via stateManager
            stateManager.setVariable('MenuDetailText', spriteMessage);
        }
        this.countdown--;
        if (this.countdown < 0) {
            eventManager.emit("GameOver", {});
            return;
        }
    }
}
