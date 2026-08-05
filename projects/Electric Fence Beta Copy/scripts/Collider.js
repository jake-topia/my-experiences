"use strict";
class Collider extends ComponentScript {
    uniqueId;
    playerId;
    constructor() {
        // load state (no async!)
    }
    onInit(props) {
        this.uniqueId = props.uniqueId;
        this.playerId = props.playerId;
    }
    testFunction() {
        return this.playerId;
    }
}
