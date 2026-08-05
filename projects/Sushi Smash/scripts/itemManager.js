"use strict";
class itemManager extends ComponentScript {
    itemTimer;
    itemId;
    itemPosition;
    playerId;
    isBad;
    isPlayer1;
    constructor(props) {
        if (!playerManager.isHost && props.isHydration)
            return;
        this.itemTimer = 0;
    }
    onClicked() {
        const item = scriptManager.getComponent({
            objectUniqueId: this.sprite.uniqueId,
            componentName: 'itemManager',
        });
        const { itemPosition, isBad, isPlayer1, playerId } = item;
        if (playerId !== playerManager.getMyPlayerId())
            return;
        this.itemTimer = 0;
        eventManager.emit('itemClicked', {
            isBad,
            isPlayer1,
            itemId: this.sprite.uniqueId,
            itemPosition,
            playerId,
        });
    }
    onStep() {
        let itemTimer = this.itemTimer;
        if (!itemTimer || itemTimer < 0)
            itemTimer = 0;
        const gameTimer = stateManager.getVariable('gameTimer');
        const item = scriptManager.getComponent({
            objectUniqueId: this.sprite.uniqueId,
            componentName: 'itemManager',
        });
        const { itemPosition, isBad, isPlayer1, playerId } = item;
        let shouldAdd = false;
        let shouldRemove = false;
        if (gameTimer <= 0) {
            shouldRemove = true;
        }
        else if (isBad && itemTimer === 1) {
            shouldAdd = true;
        }
        else if (isBad && itemTimer === 2) {
            shouldRemove = true;
        }
        else if (gameTimer < 20) {
            if (itemTimer === 2)
                shouldAdd = true;
            else if (itemTimer >= 3)
                shouldRemove = true;
        }
        else {
            if (itemTimer === 3)
                shouldAdd = true;
            else if (itemTimer >= 4)
                shouldRemove = true;
        }
        if (shouldAdd) {
            eventManager.emit('addItem', {
                isPlayer1,
                playerId,
                lastItemIsBad: isBad,
            });
        }
        if (shouldRemove) {
            eventManager.emit('removeItem', {
                itemId: this.sprite.uniqueId,
                itemPosition,
                isPlayer1,
                playerId,
            });
            return;
        }
        this.itemTimer = itemTimer + 1;
    }
}
