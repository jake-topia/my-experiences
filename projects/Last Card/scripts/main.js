"use strict";
class main extends SystemScript {
    onInit() {
        console.log('Main script onInit.');
        scriptManager.attachSystem({
            scriptId: 'CardViewManager',
            isPlayerControlled: true,
        });
    }
    onHostStart() {
        // Main entry point for the host/server.
        console.log('Main script onHostStart: Attaching GameManager...');
        // Attach the analytics system first
        try {
            scriptManager.attachSystem({ scriptId: 'CrazyEightsAnalyticsManager' });
            console.log('Main script onHostStart: CrazyEightsAnalyticsManager attached successfully.');
        }
        catch (error) {
            console.log('!!! Main script WARNING: Failed to attach CrazyEightsAnalyticsManager:', error);
        }
        // Attach the core GameManager system script
        try {
            scriptManager.attachSystem({ scriptId: 'GameManager' });
            console.log('Main script onHostStart: GameManager attached successfully.');
        }
        catch (error) {
            console.log('!!! Main script CRITICAL ERROR: Failed to attach GameManager:', error);
        }
    }
} // End class main
