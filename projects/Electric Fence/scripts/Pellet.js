"use strict";
class Pellet extends ComponentScript {
    constructor() { }
    onInit() { }
    /** Called on collision start */
    onSpriteCollisionStart(collisionData) {
        const otherSprite = collisionData.sprite;
        if (!otherSprite)
            return;
        // Check if it's a player
        if (otherSprite.playerId !== undefined) {
            console.log(`Pellet ${this.sprite?.uniqueId} collided with Player ${otherSprite.playerId}`);
            // 1. Emit event ONLY
            try {
                const eventPayload = {
                    playerId: otherSprite.playerId,
                    pelletId: this.sprite?.uniqueId,
                };
                console.log('Pellet emitting event: playerGotPellet', eventPayload);
                eventManager.emit('playerGotPellet', eventPayload);
            }
            catch (error) {
                console.log(`!!! Pellet ${this.sprite?.uniqueId} ERROR emitting playerGotPellet event:`, error);
            }
            // 2. DO NOT destroy self here anymore
            // console.log(`Pellet: Self-destruction REMOVED from component.`);
        }
    }
}
