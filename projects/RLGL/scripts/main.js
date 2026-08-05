"use strict";
class main extends SystemScript {
    onInit() { }
    onHostStart() {
        scriptManager.attachSystem({ scriptId: 'TimerManager' });
        scriptManager.attachSystem({ scriptId: 'StoplightManager' });
        scriptManager.attachSystem({ scriptId: 'MovementDetector' });
        scriptManager.attachSystem({ scriptId: 'WallManager' });
        scriptManager.attachSystem({ scriptId: 'RoundResultsManager' });
        scriptManager.attachSystem({ scriptId: 'GameManager' });
    }
}
