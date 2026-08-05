"use strict";
class startController extends ComponentScript {
    constructor() {
        // load state (no async!)
    }
    ;
    onInit() {
        // hello world
    }
    ;
    onClicked() {
        if (!playerManager.isHost)
            return;
        console.log('clicked');
        this.sprite.text = ' ';
        this.sprite.isInteractive = true;
        console.log(this.sprite.text);
        console.log(this.sprite.isInteractive);
        eventManager.emit("startBtnClicked");
    }
}
;
