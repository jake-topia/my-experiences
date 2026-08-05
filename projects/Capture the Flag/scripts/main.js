"use strict";
class main extends SystemScript {
    onInit() {
        gameLoopManager.setGameLoopParameters({
            physicsTicksPerSecond: 15
        });
        console.log('CTF Main script onInit.');
        // Attach view manager for ALL clients and host (handles click → event)
        try {
            scriptManager.attachSystem({ scriptId: 'CTFViewManager' });
            console.log('CTF Main: CTFViewManager attached');
        }
        catch (e) {
            console.log('CTF Main: failed to attach CTFViewManager', e);
        }
    }
    onHostStart() {
        // Main entry point for the host/server.
        console.log('CTF Main script onHostStart: Attaching CTFGameManager...');
        try {
            scriptManager.attachSystem({ scriptId: 'CTFGameManager' });
            console.log('CTF Main script onHostStart: CTFGameManager attached successfully.');
            // Throttle world syncs so we are not over-broadcasting replicated state.
            // (The engine already auto-syncs sprite diffs.)
            gameLoopManager.setSyncParameters({
                syncsPerSecond: 1,
                fullUpdatePerSecond: 0.1,
            }); // NOTE: keep throttled
        }
        catch (error) {
            console.log('!!! CTF Main script CRITICAL ERROR: Failed to attach CTFGameManager:', error);
        }
    }
}
