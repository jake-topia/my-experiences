"use strict";
class utils_text extends SystemScript {
    addPlayerText({ isPlayer1, playerId, }) {
        console.log("utils_text playerId", playerId);
        console.log("utils_text playerManager.getPlayerDetails(playerId)", playerManager.getPlayerDetails(playerId));
        spriteManager.addSprite('text', {
            uniqueId: `${playerId}_name`,
            text: playerManager.getPlayerDetails(playerId).nameplate,
            positionX: isPlayer1 ? 300 : 800,
            positionY: 650,
        });
        spriteManager.addSprite('text', {
            uniqueId: `${playerId}_score`,
            text: 'Score: 0',
            positionX: isPlayer1 ? 300 : 800,
            positionY: 300,
        });
    }
    removePlayerText({ playerId }) {
        spriteManager.removeSprite(`${playerId}_name`);
        spriteManager.removeSprite(`${playerId}_score`);
    }
    updateScore({ playerId, score }) {
        spriteManager.updateSprite(`${playerId}_score`, {
            text: `Score: ${score}`,
        });
    }
}
