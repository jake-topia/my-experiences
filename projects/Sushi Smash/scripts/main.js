"use strict";
class main extends SystemScript {
    onHostStart() {
        stateManager.setVariable('playerQueue', []);
        stateManager.setVariable('gameTimer', 10);
        scriptManager.attachSystem({ scriptId: 'gameManager' });
        stageManager.setCurrentStage('sushi');
        spriteManager.addSprite('sushiLayer1', {
            uniqueId: 'sushiLayer1',
            positionX: 0,
            positionY: 0,
            height: 800,
            width: 1200
            // checkCollisions: true,
        });
        // scriptManager.attachComponent({
        //   objectUniqueId: 'sushiLayer1',
        //   componentName: 'boardManager',
        //   scriptId: 'boardManager',
        // });
        spriteManager.addSprite('text', {
            uniqueId: 'gameText',
            text: ' ',
            fontSize: 28,
            positionX: 500,
            positionY: 250,
        });
        spriteManager.addSprite('text', {
            uniqueId: 'queue',
            text: ' ',
            width: 100,
            positionX: 760,
            positionY: 25,
            isInteractive: true,
        });
        spriteManager.addSprite('text', {
            uniqueId: 'timer',
            text: 'Waiting for other players to join',
            positionX: 500,
            positionY: 210,
        });
        spriteManager.updateSprite('timer', {
            text: 'Waiting for other players to join',
        });
        spriteManager.addSprite('text', {
            uniqueId: 'playerPositionInQueue',
            text: ' ',
            width: 100,
            positionX: 760,
            positionY: 70,
            isPlayerControlled: true,
        });
        spriteManager.addSprite('text', {
            uniqueId: 'player1_name',
            text: `${playerManager.getPlayerDetails(playerManager.getMyPlayerId()).nameplate}`,
            positionX: 300,
            positionY: 650,
        });
        spriteManager.updateSprite('player1_name', {
            text: `${playerManager.getPlayerDetails(playerManager.getMyPlayerId()).nameplate}`,
        });
        spriteManager.addSprite('text', {
            uniqueId: 'player1_score',
            text: 'Score: 0',
            positionX: 300,
            positionY: 300,
        });
        spriteManager.addSprite('text', {
            uniqueId: 'player2_name',
            text: ' ',
            positionX: 800,
            positionY: 650,
        });
        spriteManager.addSprite('text', {
            uniqueId: 'player2_score',
            text: ' ',
            positionX: 800,
            positionY: 300,
        });
    }
    onVariableChanged_playerQueue({ newValue }) {
        let text = ' ';
        if (newValue.length > 1 && newValue[0]) {
            text = `Next up: ${playerManager.getPlayerDetails(newValue[0]).nameplate}`;
        }
        spriteManager.updateSprite('queue', { text });
        const spot = newValue.indexOf(playerManager.getMyPlayerId());
        if (spot > 0) {
            spriteManager.updateSprite('playerPositionInQueue', {
                text: `Position in queue: ${spot}`,
            });
        }
        else {
            spriteManager.updateSprite('playerPositionInQueue', {
                text: ' ',
            });
        }
    }
    // *** Event Handlers
    onEvent_itemClicked({ itemId, isBad, isPlayer1, playerId, itemPosition, }) {
        if (!playerManager.isHost)
            return;
        scriptManager
            .getSystem({
            systemName: 'gameManager',
        })
            .itemClicked({
            itemId,
            isBad,
            isPlayer1,
            playerId,
            itemPosition,
        });
    }
    onEvent_addItem({ isPlayer1, playerId, lastItemIsBad, }) {
        if (!playerManager.isHost)
            return;
        scriptManager
            .getSystem({
            systemName: 'gameManager',
        })
            .addItem({ isPlayer1, playerId, lastItemIsBad });
    }
    onEvent_removeItem({ itemId, itemPosition, isPlayer1, playerId, }) {
        if (!playerManager.isHost)
            return;
        scriptManager
            .getSystem({
            systemName: 'gameManager',
        })
            .removeItem({ itemId, itemPosition, isPlayer1, playerId });
    }
}
