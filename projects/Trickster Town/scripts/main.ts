class main extends SystemScript {
  onInit() {
    gameLoopManager.setSyncParameters({
      syncsPerSecond: 8,
      fullUpdatePerSecond: 2,
    });

    this.ensureClientUIManager();

    if (playerManager.isHost) {
      this.ensureHostSystems();
    }
  }

  onPlayerStart() {
    this.ensureClientUIManager();
  }

  onSpectatorStart() {
    this.ensureClientUIManager();
  }

  onHostStart() {
    this.ensureHostSystems();
  }

  ensureClientUIManager() {
    if (scriptManager.getSystem({ systemName: "clientUIManager" })) return;

    scriptManager.attachSystem({
      scriptId: "clientUIManager",
      isPlayerControlled: true,
    });
  }

  ensureHostSystems() {
    if (!scriptManager.getSystem({ systemName: "arenaManager" })) {
      scriptManager.attachSystem({ scriptId: "arenaManager" });
    }

    if (!scriptManager.getSystem({ systemName: "gameManager" })) {
      scriptManager.attachSystem({ scriptId: "gameManager" });
    }
  }
}
