class main extends SystemScript {
  joinRectSize: number;

  onInit() {
    this.joinRectSize = 150;
  }

  getJoinRectId(playerId: number): string {
    return "joinRect_" + playerId.toString();
  }

  placePlayerInsideJoinRect(playerId: number) {
    if (!playerManager.isHost) return;

    const playerDetails = playerManager.getPlayerDetails(playerId);
    const rectId = this.getJoinRectId(playerId);
    const rectHalfSize = this.joinRectSize / 2;
    const playerCenterX = playerDetails.x + playerDetails.width / 2;
    const playerCenterY = playerDetails.y + playerDetails.height / 2;
    const rectX = playerCenterX - rectHalfSize;
    const rectY = playerCenterY - rectHalfSize;

    if (spriteManager.getSprite(rectId)) {
      spriteManager.removeSprite(rectId);
    }

    spriteManager.addSprite("baseRect", {
      uniqueId: rectId,
      positionX: rectX,
      positionY: rectY,
      width: this.joinRectSize,
      height: this.joinRectSize,
      checkCollisions: true,
      isImpassable: true,
      isImmovable: true,
      opacity: 0.5,
    });

    playerManager.teleportPlayers([playerId], {
      distributionType: "area",
      positionX: playerCenterX,
      positionY: playerCenterY,
      width: 0,
      height: 0,
    });
  }

  onPlayerJoined({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;

    this.placePlayerInsideJoinRect(playerId);
  }

  onPlayerLeft({ playerId }: { playerId: number }) {
    if (!playerManager.isHost) return;

    const rectId = this.getJoinRectId(playerId);
    if (!spriteManager.getSprite(rectId)) return;

    spriteManager.removeSprite(rectId);
  }
}
