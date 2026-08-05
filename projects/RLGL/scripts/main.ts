class main extends SystemScript {
  onInit() {}

  onHostStart() {
    gameLoopManager.setSyncParameters({
      syncsPerSecond: 30,
      fullUpdatePerSecond: 10,
    });

    scriptManager.attachSystem({ scriptId: 'TimerManager' });
    scriptManager.attachSystem({ scriptId: 'StoplightManager' });
    scriptManager.attachSystem({ scriptId: 'MovementDetector' });
    scriptManager.attachSystem({ scriptId: 'WallManager' });
    scriptManager.attachSystem({ scriptId: 'RoundResultsManager' });
    scriptManager.attachSystem({ scriptId: 'GameManager' });
  }
}
