class GoalieManager extends ComponentScript {
  _teamIndex: number;
  _boxX: number;
  _boxY: number;
  _boxW: number;
  _boxH: number;
  _targetX: number;
  _targetY: number;
  _patrolSpeed: number;
  _isActive: number;

  onInit() {
    var id = this.sprite.uniqueId;
    if (id.indexOf("ih_goalie_team1") !== -1) {
      this._teamIndex = 0;
      // Right goalie patrol box
      this._boxX = 2276;
      this._boxY = 589;
      this._boxW = 304;
      this._boxH = 508;
    } else {
      this._teamIndex = 1;
      // Left goalie patrol box
      this._boxX = 296;
      this._boxY = 586;
      this._boxW = 298;
      this._boxH = 528;
    }

    this._patrolSpeed = 2.5;
    this._isActive = 1;

    // Pick initial random target within box
    this._targetX = this._boxX + Math.random() * this._boxW;
    this._targetY = this._boxY + Math.random() * this._boxH;

    // Start at center of box
    spriteManager.updateSprite(this.sprite.uniqueId, {
      positionX: this._boxX + this._boxW / 2,
      positionY: this._boxY + this._boxH / 2,
    });
  }

  onPhysicsStep(deltaTime: number) {
    if (!playerManager.isHost) return;
    if (this._isActive !== 1) return;

    var cx = this.sprite.position?.x ?? this.sprite.x ?? 0;
    var cy = this.sprite.position?.y ?? this.sprite.y ?? 0;

    var dx = this._targetX - cx;
    var dy = this._targetY - cy;
    var dist = Math.sqrt(dx * dx + dy * dy);

    // Close enough to target — pick a new random point in the box
    if (dist < 10) {
      this._targetX = this._boxX + Math.random() * this._boxW;
      this._targetY = this._boxY + Math.random() * this._boxH;
      return;
    }

    // Move toward target
    var moveX = (dx / dist) * this._patrolSpeed;
    var moveY = (dy / dist) * this._patrolSpeed;

    spriteManager.updateSprite(this.sprite.uniqueId, {
      positionX: cx + moveX,
      positionY: cy + moveY,
    });
  }
}
