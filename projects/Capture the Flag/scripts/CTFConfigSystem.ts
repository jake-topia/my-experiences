class CTFConfigSystem extends SystemScript {
  _config: any;
  onInit() {
    // Central gameplay tunables for easy tweaking
    this._config = {
      stageWidth: 2880,
      stageHeight: 1620,
      minPlayersPerTeam: 1, // minimum to consider a team active (for start button eligibility we need one on each team)
      maxPlayersPerTeam: 5,
      captureScoreToWin: 3,
      countdownSeconds: 3,
      zoneAlpha: 0.65,
      neutralZoneAlpha: 0.4,
      redSpawnXFactor: 0.125, // fraction of width from left
      blueSpawnXFactor: 0.875, // fraction of width from left
      spawnYFactor: 0.5, // middle height
      flagStartOnDefenderSide: true, // if true, flag's owning team is 'red' and spawns near blue side initially
      playerTrackerSize: 24, // square size (width=height) of collision tracker; raise for more generous tagging
      useCellTrackers: false, // set true to spawn trackers as 'cell' instead of 'rectangle' if rectangle collisions underperform
      trackerCollisionGroup: 'player', // collisionGroup applied to trackers (and compared in GameManager)
      flagWidth: 40, // base flag sprite width
      flagHeight: 40, // base flag sprite height
      dualFlagMode: true, // future: if true, spawn one flag per team base (classic dual-flag CTF)
      allowTeamSwitchDuringCountdown: true, // if false, lock teams once countdown starts
      collisionDebug: true, // if true, trackers rendered semi‑transparent for visual debugging
    };
  }
  getConfig() {
    return this._config;
  }
}
