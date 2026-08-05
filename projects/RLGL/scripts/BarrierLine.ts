class BarrierLine extends ComponentScript {
  constructor() {}

  onInit() {}

  onSpriteCollisionStart(collisionData: { collisionX: number; collisionY: number; sprite: PseudoSprite }) {
    const otherSprite = collisionData.sprite;
    if (!otherSprite) return;

    if (otherSprite.playerId !== undefined) {
      eventManager.emit('playerTouchedBarrier', { playerId: otherSprite.playerId });
    }
  }
}
