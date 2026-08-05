"use strict";
class buttonController extends ComponentScript {
    onInit() {
    }
    ;
    onClicked() {
        eventManager.emit("playerStartInput", {});
    }
}
