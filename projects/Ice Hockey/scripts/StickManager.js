"use strict";
class StickManager extends SystemScript {
    _trackedPlayerIds;
    _lastPlayerX;
    _playerFacingRight;
    onInit() {
        this._trackedPlayerIds = [];
        this._lastPlayerX = [];
        this._playerFacingRight = [];
        stateManager.setVariable("ControlSchemes", {});
    }
    onEvent_controlSchemeChanged({ playerId, scheme }) {
        if (!playerManager.isHost)
            return;
        var schemes = stateManager.getVariable("ControlSchemes") || {};
        schemes[playerId] = scheme;
        stateManager.setVariable("ControlSchemes", schemes);
    }
    onHostStart() {
        var playerIds = playerManager.getPlayerIds();
        var myId = playerManager.getMyPlayerId();
        // Ensure host's own stick is created even if not yet in playerIds
        if (playerIds.indexOf(myId) === -1) {
            this._createStick(myId);
        }
        for (var i = 0; i < playerIds.length; i++) {
            this._createStick(playerIds[i]);
        }
    }
    onStep(deltaTime) {
        if (!playerManager.isHost)
            return;
        // Safety net: ensure every player has a stick AND is tracked (runs at 1/s)
        var playerIds = playerManager.getPlayerIds();
        for (var i = 0; i < playerIds.length; i++) {
            this._createStick(playerIds[i]);
        }
    }
    onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        this._createStick(playerId);
    }
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        this._removeStick(playerId);
    }
    onPhysicsStep(deltaTime) {
        if (playerManager.isHost) {
            for (var i = 0; i < this._trackedPlayerIds.length; i++) {
                var pid = this._trackedPlayerIds[i];
                var details = playerManager.getPlayerDetails(pid);
                if (!details)
                    continue;
                var playerX = details.x;
                var playerY = details.y;
                var playerWidth = details.width;
                var playerHeight = details.height;
                // Determine facing direction from movement delta
                var prevX = this._lastPlayerX[i];
                if (prevX !== undefined) {
                    var deltaX = playerX - prevX;
                    if (deltaX > 0.5) {
                        this._playerFacingRight[i] = 1;
                    }
                    else if (deltaX < -0.5) {
                        this._playerFacingRight[i] = 0;
                    }
                }
                this._lastPlayerX[i] = playerX;
                var facingRight = this._playerFacingRight[i] !== undefined ? this._playerFacingRight[i] : 1;
                // Read actual sprite dimensions for positioning
                var stickId = "ih_stick_" + pid;
                var stickSprite = spriteManager.getSprite(stickId);
                var stickW = stickSprite ? stickSprite.width : 50;
                var stickH = stickSprite ? stickSprite.height : 50;
                var stickX = 0;
                if (facingRight === 1) {
                    // scaleX -1 flips around origin, offset by stickW so left edge is flush
                    stickX = playerX + playerWidth + stickW;
                }
                else {
                    // Stick right edge = player left edge
                    stickX = playerX - stickW;
                }
                var stickY = playerY + playerHeight - stickH;
                spriteManager.updateSprite(stickId, {
                    positionX: stickX,
                    positionY: stickY,
                    scaleX: facingRight === 1 ? -1 : 1,
                });
            }
        }
    }
    _createStick(playerId) {
        var stickId = "ih_stick_" + playerId;
        if (spriteManager.getSprite(stickId)) {
            // Sprite exists (e.g. after host transfer) — ensure tracking arrays are populated
            if (this._trackedPlayerIds.indexOf(Number(playerId)) === -1) {
                this._trackedPlayerIds.push(Number(playerId));
                this._lastPlayerX.push(-9999);
                this._playerFacingRight.push(1);
            }
            return;
        }
        spriteManager.addSprite("hockeyStick", {
            uniqueId: stickId,
            checkCollisions: true,
            applyPhysics: true,
            isImpassable: false,
            isPlayerControlled: false,
            opacity: 1,
            positionX: -500,
            positionY: -500,
            displayLayer: "TOP",
            topAdjust: 50,
        });
        this._trackedPlayerIds.push(Number(playerId));
        this._lastPlayerX.push(-9999);
        this._playerFacingRight.push(1);
    }
    _removeStick(playerId) {
        var stickId = "ih_stick_" + playerId;
        spriteManager.removeSprite(stickId);
        var idx = this._trackedPlayerIds.indexOf(Number(playerId));
        if (idx !== -1) {
            this._trackedPlayerIds.splice(idx, 1);
            this._lastPlayerX.splice(idx, 1);
            this._playerFacingRight.splice(idx, 1);
        }
    }
}
