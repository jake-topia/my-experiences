"use strict";
class gameManager extends SystemScript {
    sprites;
    constructor() {
        // load state (no async!)
    }
    ;
    onInit() {
        this.sprites = [];
        const utils = scriptManager.getSystem({ systemName: 'utils' });
        // this.sprites.push(
        //   utils.makeText({
        //     text: `Click to start the game early`,
        //     align: 'center',
        //     justify: 'end',
        //     onClick: () => {
        //       eventManager.emit('buttonClicked', {
        //         button: 'start',
        //         playerId: playerManager.getMyPlayerId(),
        //       });
        //     },
        //   }),
        // );
    }
    ;
    onEvent_buttonClicked({ button, playerId }) {
        if (button === 'start') {
            stateManager.setVariable("gameStarted", true);
        }
    }
    onVariableChanged_gameStarted() {
        // exit if we're not in the game
        const id = playerManager.getMyPlayerId();
        const ids = playerManager.getPlayerIds();
        if (ids.indexOf(id) === -1)
            return;
        // o/w open iframe
        integrationsManager.openIframe({
            interactivePublicKey: stateManager.getVariable('interactivePublicKey'),
            hasDataChannel: 'true',
            iframeId: 'myIframe',
            isOpenLinkInDrawer: true,
            link: stateManager.getVariable('iframeUrl'),
            linkSamlQueryParams: undefined,
            title: 'game iframe',
        });
        const iframeManager = scriptManager.getSystem({ systemName: 'iframeManager', });
        if (!iframeManager) {
            scriptManager.attachSystem({ scriptId: 'iframeManager' });
        }
        ;
    }
    onEvent_gameStarted() {
        if (!playerManager.isHost)
            return;
        // @TODO: gameStateManager.setIsAcceptingPlayers(false);
    }
}
;
