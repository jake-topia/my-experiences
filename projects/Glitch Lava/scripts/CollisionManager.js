"use strict";
class CollisionManager extends SystemScript {
    // --- Config / IDs ---
    colliderAssetKey;
    colliderComponentScriptId;
    colliderUniqueId;
    // --- Tracking ---
    players; // playerIds with colliders
    colliders; // collider uniqueIds aligned with players[]
    buffer;
    constructor() {
        this.colliderAssetKey = 'collider';
        this.colliderComponentScriptId = 'Collider';
        this.colliderUniqueId = 'collider_';
        this.players = [];
        this.colliders = [];
        this.buffer = 0;
    }
    onInit() {
        // No-op; kept for parity with other systems.
    }
    /**
     * Public entry: ensure a collider exists for the given player.
     */
    addPlayer(playerId) {
        console.log('[Collide] INFO add player=' + playerId);
        this.spawnCollider(playerId);
    }
    /**
     * Creates a collider sprite at the player's current location and attaches the Collider component.
     * Keeps internal mappings so we can follow the player each physics tick.
     */
    spawnCollider(playerId) {
        console.log('[Collide] INFO spawn collider for player=' + playerId);
        var tempId = this.colliderUniqueId + playerId;
        var details = playerManager.getPlayerDetails(playerId);
        var spawnX = details.x;
        var spawnY = details.y;
        try {
            var colliderSprite = spriteManager.addSprite(this.colliderAssetKey, {
                uniqueId: tempId,
                positionX: spawnX,
                positionY: spawnY,
                checkCollisions: true,
            });
            if (colliderSprite) {
                var comp = colliderSprite.attachComponent({
                    scriptId: this.colliderComponentScriptId,
                    props: { uniqueId: tempId, playerId: playerId },
                });
                this.players.push(playerId);
                this.colliders.push(tempId);
                console.log('[Collide] INFO collider ready id=' + tempId);
            }
            else {
                console.log('[Collide] ERROR addSprite returned null for player=' + playerId);
            }
        }
        catch (error) {
            console.log('[Collide] ERROR spawnCollider failed for player=' + playerId, error);
        }
    }
    /**
     * Physics throttle loop: updates collider positions to match their players.
     * Runs host-side only.
     */
    onPhysicsStep() {
        if (!playerManager.isHost)
            return;
        this.buffer++;
        if (this.buffer % 3 === 0) {
            for (let i = 0; i < this.players.length; i++) {
                // If the player has left, stop updating (early return matches existing behavior)
                var currentIds = playerManager.getPlayerIds();
                if (currentIds.indexOf(this.players[i]) === -1)
                    continue;
                var pid = this.players[i];
                var cid = this.colliders[i];
                var p = playerManager.getPlayerDetails(pid);
                spriteManager.updateSprite(cid, {
                    positionX: p.x,
                    positionY: p.y + 30, // small offset so collider sits just below the player sprite
                });
            }
        }
    }
}
