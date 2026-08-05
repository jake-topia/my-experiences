"use strict";
class SideWall extends ComponentScript {
    constructor() { }
    onInit() { }
    onSpriteCollisionStart(collisionData) {
        const otherSprite = collisionData.sprite;
        if (!otherSprite)
            return;
        if (otherSprite.playerId !== undefined) {
            eventManager.emit('playerHitWall', { playerId: otherSprite.playerId });
        }
    }
}
