"use strict";
class CollisionManager extends SystemScript {
    // --- Properties  ---
    colliderAssetKey;
    colliderComponentScriptId;
    colliderUniqueId;
    players;
    colliders;
    buffer;
    constructor() {
        // load state (no async!)
        this.colliderAssetKey = 'collider';
        this.colliderComponentScriptId = 'Collider';
        this.colliderUniqueId = 'collider_';
        this.players = [];
        this.colliders = [];
        this.buffer = 0;
    }
    onInit() {
        // hello world
    }
    addPlayer(playerId) {
        console.log('!!!!!!!!!!!!!!!!!! Adding a collider to player number: ' + playerId);
        this.spawnCollider(playerId);
    }
    /** spawnPellet Method */
    spawnCollider(playerId) {
        console.log(`CollisionManager: Attempting to add collider for player: ` + playerId);
        const tempId = this.colliderUniqueId + playerId;
        const spawnX = playerManager.getPlayerDetails(playerId).x;
        const spawnY = playerManager.getPlayerDetails(playerId).y;
        try {
            console.log(`CollisionManager: Calling addSprite...`);
            const colliderSprite = spriteManager.addSprite(this.colliderAssetKey, {
                uniqueId: tempId,
                positionX: spawnX,
                positionY: spawnY,
                checkCollisions: true,
            });
            if (colliderSprite) {
                console.log('CollisionManager: addSprite successful. Attaching component...');
                let temp = colliderSprite.attachComponent({
                    scriptId: this.colliderComponentScriptId,
                    props: {
                        uniqueId: tempId,
                        playerId: playerId,
                    },
                });
                this.players.push(playerId);
                this.colliders.push(tempId);
                console.log('CollisionManager: Component attached and reference stored.');
            }
            else {
                console.log(`!!! CollisionManager FAILURE: addSprite returned null.`);
            }
        }
        catch (error) {
            console.log(`!!! CollisionManager CRITICAL ERROR during collider creation:`, error);
        }
        console.log('CollisionManager: ----- EXITING spawnCollider -----');
    }
    onPhysicsStep() {
        if (!playerManager.isHost)
            return;
        this.buffer++;
        if (this.buffer % 3 === 0) {
            for (let i = 0; i < this.players.length; i++) {
                const playerCheck = playerManager.getPlayerIds();
                if (!playerCheck.includes(this.players[i]))
                    return;
                let colliderSprite = spriteManager.updateSprite(this.colliders[i], {
                    positionX: playerManager.getPlayerDetails(this.players[i]).x,
                    positionY: playerManager.getPlayerDetails(this.players[i]).y + 30,
                });
            }
        }
    }
}
