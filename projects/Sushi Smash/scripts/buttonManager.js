"use strict";
class buttonManager extends ComponentScript {
    onClicked() {
        const theme = this.sprite.uniqueId;
        const main = scriptManager
            .getSystem({ systemName: 'main' })
            .startGame({ theme });
    }
}
