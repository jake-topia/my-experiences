class Wall extends ComponentScript {
  // Properties like worldWidth/Height might be needed later
  // for calculating safe zone in the LISTENER, but not here.

  constructor() {
    // Constructor
    // console.log(`Wall component constructor for sprite: ${this.sprite?.uniqueId}`);
  }

  onInit() {
    // onInit
    // console.log(`Wall component onInit for sprite: ${this.sprite?.uniqueId}`);
  }

  /**
   * Called by the engine when this wall sprite STARTs colliding with another sprite.
   * @param collisionData An object containing details about the collision.
   * collisionData.sprite refers to the OTHER sprite involved.
   */
  onSpriteCollisionStart(collisionData: {
    collisionX: number;
    collisionY: number;
    sprite: PseudoSprite;
  }) {
    const otherSprite = collisionData.sprite;

    if (!otherSprite) {
      return;
    }
    
    if (otherSprite.uniqueId.indexOf('collider_') !== -1) {
      let tempComponent = otherSprite.getComponent('Collider');
      let tempNumber = tempComponent.playerId;
      console.log(
        '--------!!!!!!!!! COLLIDER FOUND!!!!!! -------' + tempNumber,
      );
    } else {
      return;
    }
    let tempComponent = otherSprite.getComponent('Collider');

    // Broadcast an event using eventManager.emit
    try {
      const eventPayload = {
        playerId: tempComponent.playerId, // Pass the ID of the player who hit the wall
        wallId: this.sprite?.uniqueId, // Optional: helpful for debugging
      };
      console.log('Wall using eventManager.emit: playerHitWall', eventPayload);

      // *** Use the correct event emission syntax ***
      eventManager.emit('playerHitWall', eventPayload);
      // *** ***
    } catch (error) {
      console.log(
        `!!! Wall ${this.sprite?.uniqueId} ERROR emitting playerHitWall event for player ${tempComponent.playerId}:`,
        error,
      );
    }
  }
} // End class Wall
