class main extends SystemScript {
  onInit() {
    gameLoopManager.setSyncParameters({
      syncsPerSecond: 8,
      fullUpdatePerSecond: 2,
    });

    this.ensureClientSystems();
    if (playerManager.isHost) this.ensureHostSystems();
  }

  onPlayerStart() {
    this.ensureClientSystems();
  }

  onSpectatorStart() {
    this.ensureClientSystems();
  }

  onHostStart() {
    this.ensureHostSystems();
  }

  ensureClientSystems() {
    this.attachLocalSystemIfMissing("uiSpriteManager");
    this.attachLocalSystemIfMissing("roleUIManager");
    this.attachLocalSystemIfMissing("nightUIManager");
    this.attachLocalSystemIfMissing("trialUIManager");
    this.attachLocalSystemIfMissing("clientUIManager");
  }

  attachLocalSystemIfMissing(systemName: string) {
    if (this.isSystemAttached(systemName)) return;
    scriptManager.attachSystem({
      scriptId: systemName,
      isPlayerControlled: true,
    });
  }

  ensureHostSystems() {
    this.attachHostSystemIfMissing("arenaManager");
    this.attachHostSystemIfMissing("roleManager");
    this.attachHostSystemIfMissing("winConditionManager");
    this.attachHostSystemIfMissing("nightActionManager");
    this.attachHostSystemIfMissing("nightResolutionManager");
    this.attachHostSystemIfMissing("trialManager");
    this.attachHostSystemIfMissing("gameManager");
  }

  attachHostSystemIfMissing(systemName: string) {
    if (this.isSystemAttached(systemName)) return;
    scriptManager.attachSystem({ scriptId: systemName });
  }

  isSystemAttached(systemName: string): boolean {
    try {
      return !!scriptManager.getSystem({ systemName: systemName });
    } catch (e) {
      // Some clients throw instead of returning null before a local system
      // has been attached. Treat that state as missing, then attach it below.
      return false;
    }
  }
}
