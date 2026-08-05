"use strict";
class main extends SystemScript {
    onInit() {
        gameLoopManager.setSyncParameters({
            syncsPerSecond: 8,
            fullUpdatePerSecond: 2,
        });
        this.ensureClientUiManager();
    }
    onPlayerStart() {
        this.ensureClientUiManager();
    }
    onSpectatorStart() {
        this.ensureClientUiManager();
    }
    ensureClientUiManager() {
        if (scriptManager.getSystem({ systemName: "clientUiManager" }))
            return;
        scriptManager.attachSystem({
            scriptId: "clientUiManager",
            isPlayerControlled: true,
        });
    }
    onHostStart() {
        if (!scriptManager.getSystem({ systemName: "arenaManager" })) {
            scriptManager.attachSystem({ scriptId: "arenaManager" });
        }
        if (!scriptManager.getSystem({ systemName: "tileManager" })) {
            scriptManager.attachSystem({ scriptId: "tileManager" });
        }
        if (!scriptManager.getSystem({ systemName: "gameManager" })) {
            scriptManager.attachSystem({ scriptId: "gameManager" });
        }
    }
}
