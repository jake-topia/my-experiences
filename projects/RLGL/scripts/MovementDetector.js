"use strict";
class MovementDetector extends SystemScript {
    trackedPlayerIds;
    lastKnownX;
    lastKnownY;
    isMonitoring;
    stoplightManager;
    movementThreshold;
    safeZoneY;
    constructor() {
        if (!playerManager.isHost)
            return;
        this.trackedPlayerIds = [];
        this.lastKnownX = [];
        this.lastKnownY = [];
        this.isMonitoring = false;
        this.stoplightManager = null;
        this.movementThreshold = 5;
        this.safeZoneY = 1300;
    }
    onInit() { }
    onHostStart() {
        this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
    }
    startMonitoring() {
        this.isMonitoring = true;
        this.trackedPlayerIds = [];
        this.lastKnownX = [];
        this.lastKnownY = [];
        this.updateAllPlayerPositions();
    }
    stopMonitoring() {
        this.isMonitoring = false;
        this.trackedPlayerIds = [];
        this.lastKnownX = [];
        this.lastKnownY = [];
    }
    onEvent_lightTurnedRed() {
        this.updateAllPlayerPositions();
    }
    onEvent_lightTurnedGreen() {
        this.updateAllPlayerPositions();
    }
    onEvent_lightTurningRed() { }
    updateAllPlayerPositions() {
        const playerIds = playerManager.getPlayerIds();
        for (let i = 0; i < playerIds.length; i++) {
            const playerId = playerIds[i];
            const playerDetails = playerManager.getPlayerDetails(playerId);
            if (playerDetails) {
                let foundIndex = -1;
                for (let j = 0; j < this.trackedPlayerIds.length; j++) {
                    if (this.trackedPlayerIds[j] === playerId) {
                        foundIndex = j;
                        break;
                    }
                }
                if (foundIndex === -1) {
                    this.trackedPlayerIds.push(playerId);
                    this.lastKnownX.push(playerDetails.x);
                    this.lastKnownY.push(playerDetails.y);
                }
                else {
                    this.lastKnownX[foundIndex] = playerDetails.x;
                    this.lastKnownY[foundIndex] = playerDetails.y;
                }
            }
        }
    }
    onStep() {
        if (!playerManager.isHost)
            return;
        if (!this.isMonitoring)
            return;
        if (!this.stoplightManager) {
            this.stoplightManager = scriptManager.getSystem({ systemName: 'StoplightManager' });
            if (!this.stoplightManager)
                return;
        }
        if (!this.stoplightManager.isRedLightActive())
            return;
        const playerIds = playerManager.getPlayerIds();
        for (let i = 0; i < playerIds.length; i++) {
            const playerId = playerIds[i];
            const playerDetails = playerManager.getPlayerDetails(playerId);
            if (!playerDetails)
                continue;
            const currentX = playerDetails.x;
            const currentY = playerDetails.y;
            const playerBottomY = currentY + (playerDetails.height || 0);
            const isInSafeZone = playerBottomY >= this.safeZoneY;
            if (isInSafeZone) {
                for (let j = 0; j < this.trackedPlayerIds.length; j++) {
                    if (this.trackedPlayerIds[j] === playerId) {
                        this.lastKnownX[j] = currentX;
                        this.lastKnownY[j] = currentY;
                        break;
                    }
                }
                continue;
            }
            let trackedIndex = -1;
            for (let j = 0; j < this.trackedPlayerIds.length; j++) {
                if (this.trackedPlayerIds[j] === playerId) {
                    trackedIndex = j;
                    break;
                }
            }
            if (trackedIndex === -1) {
                this.trackedPlayerIds.push(playerId);
                this.lastKnownX.push(currentX);
                this.lastKnownY.push(currentY);
                continue;
            }
            const previousX = this.lastKnownX[trackedIndex];
            const previousY = this.lastKnownY[trackedIndex];
            const deltaX = currentX - previousX;
            const deltaY = currentY - previousY;
            const distanceSquared = (deltaX * deltaX) + (deltaY * deltaY);
            const thresholdSquared = this.movementThreshold * this.movementThreshold;
            if (distanceSquared > thresholdSquared) {
                eventManager.emit('playerMovedDuringRed', { playerId: playerId });
                this.lastKnownX[trackedIndex] = currentX;
                this.lastKnownY[trackedIndex] = currentY;
            }
        }
    }
    onPlayerJoined({ playerId }) {
        const playerDetails = playerManager.getPlayerDetails(playerId);
        if (playerDetails) {
            this.trackedPlayerIds.push(playerId);
            this.lastKnownX.push(playerDetails.x);
            this.lastKnownY.push(playerDetails.y);
        }
    }
    onPlayerLeft({ playerId }) {
        for (let i = 0; i < this.trackedPlayerIds.length; i++) {
            if (this.trackedPlayerIds[i] === playerId) {
                this.trackedPlayerIds.splice(i, 1);
                this.lastKnownX.splice(i, 1);
                this.lastKnownY.splice(i, 1);
                break;
            }
        }
    }
}
