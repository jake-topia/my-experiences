"use strict";
class main extends SystemScript {
    onInit() {
        console.log('[T-Pong] Main script onInit - attaching view manager');
        // Attach view manager for ALL clients and host (handles UI clicks)
        try {
            scriptManager.attachSystem({ scriptId: 'PongViewManager' });
            console.log('[T-Pong] PongViewManager attached');
        }
        catch (e) {
            console.error('[T-Pong] Failed to attach PongViewManager:', e);
        }
    }
    onHostStart() {
        console.log('[T-Pong] Main script onHostStart - initializing game systems');
        // Set physics rate
        // TODO: TypeScript definition issue - method exists at runtime
        gameLoopManager.setGameLoopParameters({
            physicsTicksPerSecond: 30, // Higher rate for smoother ball physics
        });
        // Attach all game systems (host only)
        // IMPORTANT: Attach in order - config first, then subsystems, then game manager last
        try {
            scriptManager.attachSystem({ scriptId: 'PongConfigSystem' });
            scriptManager.attachSystem({ scriptId: 'PongAnalyticsManager' });
            scriptManager.attachSystem({ scriptId: 'PongPaddleManager' });
            scriptManager.attachSystem({ scriptId: 'PongBallManager' });
            scriptManager.attachSystem({ scriptId: 'PongUIManager' });
            scriptManager.attachSystem({ scriptId: 'PongGameManager' });
            console.log('[T-Pong] All game systems attached successfully');
            // Throttle world syncs
            gameLoopManager.setSyncParameters({
                syncsPerSecond: 10,
                fullUpdatePerSecond: 1,
            });
        }
        catch (error) {
            console.error('[T-Pong] CRITICAL ERROR: Failed to attach game systems:', error);
        }
    }
}
