class main extends SystemScript {
  experienceHeight: number;
  experienceWidth: number;
  walls: any = [];
  goalScale: number;
  borderWidth: number;
  resettingSprite: PseudoSprite;
  //haven't dealt with walls yet

  onInit() {
    this.setParams();
    // these assets will be placed for the first time, as isPlayerControlled
    // be onInit will run as a spectator
    this.placeAssets(true);
  }
  onStep(deltaTime: number) {
  }

  // Brute-force goal wall containment — catches pucks that phase through
  // the thin top/bottom net collision rects due to engine collision misses.
  onPhysicsStep(deltaTime: number) {
    if (!playerManager.isHost) return;

    var puckW = 69;
    var puckH = 69;

    // Goal wall rects: [x, y, w, h, pushY]
    // pushY = -1 means "top wall, push puck above", +1 means "bottom wall, push puck below"
    var walls = [
      [55, 726, 226, 62, -1],   // ih_goal_top_left
      [68, 1025, 218, 77, 1],   // ih_goal_bottom_left
      [2603, 724, 223, 49, -1], // ih_goal_top_right
      [2588, 1037, 229, 56, 1], // ih_goal_bottom_right
    ];

    var puckIds = ["SoccerBall", "ih_demo_puck_0", "ih_demo_puck_1", "ih_demo_puck_2", "ih_demo_puck_3"];

    for (var p = 0; p < puckIds.length; p++) {
      var puck = spriteManager.getSprite(puckIds[p]);
      if (!puck) continue;

      var px = puck.position ? puck.position.x : 0;
      var py = puck.position ? puck.position.y : 0;
      if (px === 0 && py === 0) continue;

      for (var w = 0; w < walls.length; w++) {
        var wx = walls[w][0];
        var wy = walls[w][1];
        var ww = walls[w][2];
        var wh = walls[w][3];
        var pushDir = walls[w][4];

        // AABB overlap check
        if (px < wx + ww && px + puckW > wx && py < wy + wh && py + puckH > wy) {
          var vy = puck.velocity ? puck.velocity.y : 0;
          if (pushDir < 0) {
            // Top wall — push puck above the wall
            spriteManager.updateSprite(puckIds[p], {
              positionY: wy - puckH,
            });
            if (vy > 0) {
              puck.velocity.y = -vy;
            }
          } else {
            // Bottom wall — push puck below the wall
            spriteManager.updateSprite(puckIds[p], {
              positionY: wy + wh,
            });
            if (vy < 0) {
              puck.velocity.y = -vy;
            }
          }
        }
      }
    }
  }

  onSpectatorStart() {
  }
  onPlayerStart() {
    this.setParams();
    // Attach the player-following menu panel system for all clients
    if (!scriptManager.getSystem({ systemName: "PlayerMenuPanel" })) {
      scriptManager.attachSystem({
        scriptId: "PlayerMenuPanel",
        isPlayerControlled: true,
      });
    }
  }

  onHostStart() {
    // Swap to rink without logo (host present)
    stageManager.setCurrentStage("rinkNoLogo");

    // Attach the player-following menu panel system for all clients
    if (!scriptManager.getSystem({ systemName: "PlayerMenuPanel" })) {
      scriptManager.attachSystem({
        scriptId: "PlayerMenuPanel",
        isPlayerControlled: true,
      });
    }
    // Attach stick collider manager (host-only)
    if (!scriptManager.getSystem({ systemName: "StickManager" })) {
      scriptManager.attachSystem({
        scriptId: "StickManager",
        isPlayerControlled: false,
      });
    }
    this.placeAssets();

    // Init goalie holding state
    stateManager.setVariable("GoalieHolding_0", "");
    stateManager.setVariable("GoalieHolding_1", "");

    // Set initial menu state based on player count
    const numPlayers = playerManager.getPlayerIds().length;
    if (numPlayers >= 2) {
      this._setMenuState(
        "READY_TO_START",
        "Click here to Start Game",
        "\uD83C\uDFD2 Free Skate\nYou can shoot pucks and practice.\nWe recommend using a mouse.",
      );
      this.addScoreSprites();
    } else {
      this._setMenuState(
        "WAITING_FOR_PLAYERS",
        "\uD83C\uDFD2 Free Skate",
        "This is ice hockey! You can shoot pucks and practice.\nWe recommend using a mouse.\nWhen another person joins, you can start a match!",
      );
      // Activity log: looking for players
      if (numPlayers >= 1) {
        this._setWorldActivity("GAME_WAITING");
      }
    }

    // Show free skate label at the timer position
    this._updateFreeSkateLabel();

    // Spawn goalies for demo mode and demo pucks if players present
    this._updateGoalies();
    if (numPlayers >= 1) {
      this._spawnDemoPucks();
    }
  }
  setParams() {
    gameLoopManager.setGameLoopParameters({
      physicsTicksPerSecond: 30,
      throttledStepsPerSecond: 1,
    });
    gameLoopManager.setSyncParameters({
      inputUpdatesPerSecond: 1,
      syncsPerSecond: 15,
      fullUpdatePerSecond: 0.5,
    });
  }
  placeAssets(isInit?: boolean) {
    try {
      this.experienceWidth = 2880;
      this.experienceHeight = 1620;
      this.goalScale = 1;
      this.borderWidth = 0;

      if (isInit) {
        // First-time creation (runs as spectator — sprites are isPlayerControlled)

        spriteManager.addSprite("hockeyBoardFront", {
          uniqueId: "hockeyBoardFront",
          checkCollisions: false,
          applyPhysics: false,
          positionX: 0,
          positionY: 140,
          opacity: .7
        });

        spriteManager.addSprite("hockeyBoardBack", {
          uniqueId: "hockeyBoardBack",
          checkCollisions: false,
          applyPhysics: false,
          positionX: 9,
          positionY: -120,
        });

        // Right goal image (visual only — no collision) — scaled 1.3x vertically
        const goal1ImageSprite = spriteManager.addSprite("Goal1Image", {
          uniqueId: "Goal1Image",
          checkCollisions: false,
          applyPhysics: false,
          positionX: this.experienceWidth - 40 - 255,
          positionY: 474,
          scaleY: 1.3,
          isImpassable: false,
        });

        spriteManager.addSprite("GoalLine1", {
          uniqueId: "GoalLine1",
          checkCollisions: true,
          applyPhysics: true,
          positionX: 2615,
          positionY: 782,
          width: 30,
          height: 244,
          isImpassable: true,
        });

        // Left goal image (visual only — no collision) — scaled 1.3x vertically
        const goal2ImageSprite = spriteManager.addSprite("Goal2Image", {
          uniqueId: "Goal2Image",
          checkCollisions: false,
          applyPhysics: false,
          positionX: 35,
          positionY: 471,
          scaleY: 1.3,
          isImpassable: false,
        });

        spriteManager.addSprite("GoalLine2", {
          uniqueId: "GoalLine2",
          checkCollisions: true,
          applyPhysics: true,
          positionX: 224,
          positionY: 804,
          width: 38,
          height: 217,
          isImpassable: true,
        });

        // Scoreboard underpin — invisible collision rect so puck bounces off scoreboard area
        spriteManager.addSprite("HorizontalWall", {
          uniqueId: "ih_scoreboard_wall",
          checkCollisions: true,
          applyPhysics: true,
          positionX: 1207,
          positionY: 189,
          width: 459,
          height: 48,
          isImpassable: true,
          opacity: 0,
        });

        // Goal post deflectors — invisible rects at top/bottom of each goal opening
        spriteManager.addSprite("HorizontalWall", {
          uniqueId: "ih_goal_bottom_left",
          checkCollisions: true,
          applyPhysics: true,
          positionX: 68,
          positionY: 1025,
          width: 218,
          height: 77,
          isImpassable: true,
          opacity: 0,
        });
        spriteManager.addSprite("HorizontalWall", {
          uniqueId: "ih_goal_top_left",
          checkCollisions: true,
          applyPhysics: true,
          positionX: 55,
          positionY: 726,
          width: 226,
          height: 62,
          isImpassable: true,
          opacity: 0,
        });
        spriteManager.addSprite("HorizontalWall", {
          uniqueId: "ih_goal_bottom_right",
          checkCollisions: true,
          applyPhysics: true,
          positionX: 2588,
          positionY: 1037,
          width: 229,
          height: 56,
          isImpassable: true,
          opacity: 0,
        });
        spriteManager.addSprite("HorizontalWall", {
          uniqueId: "ih_goal_top_right",
          checkCollisions: true,
          applyPhysics: true,
          positionX: 2603,
          positionY: 724,
          width: 223,
          height: 49,
          isImpassable: true,
          opacity: 0,
        });
      } else {
        // Host takeover — claim existing spectator-placed sprites
        var assetIds = [
          "hockeyBoardFront",
          "hockeyBoardBack",
          "Goal1Image",
          "GoalLine1",
          "Goal2Image",
          "GoalLine2",
          "ih_scoreboard_wall",
          "ih_goal_bottom_left",
          "ih_goal_top_left",
          "ih_goal_bottom_right",
          "ih_goal_top_right",
        ];
        for (var i = 0; i < assetIds.length; i++) {
          if (spriteManager.getSprite(assetIds[i])) {
            spriteManager.updateSprite(assetIds[i], {
              isPlayerControlled: false,
            });
          }
        }
      }
    } catch (error) {
      console.log("Main script onHostStart failed");
    }
  }

  onPlayerLeft({ playerId }) {
    if (
      playerId === playerManager.getMyPlayerId() &&
      scriptManager.getSystem({ systemName: "PlayerMenuPanel" })
    ) {
      // Remove all sprites created by PlayerMenuPanel
      spriteManager.removeSprite("ih_panel_bg");
      spriteManager.removeSprite("ih_action_bg");
      spriteManager.removeSprite("ih_action_text");
      spriteManager.removeSprite("ih_toggle_bg");
      spriteManager.removeSprite("ih_toggle_text");
      spriteManager.removeSprite("ih_detail_bg");
      spriteManager.removeSprite("ih_detail_text");
      spriteManager.removeSprite("ih_mode_bg");
      spriteManager.removeSprite("ih_mode_text");
      spriteManager.removeSprite("ih_stick_visual");

      scriptManager.detachSystem({
        systemName: "PlayerMenuPanel",
      });
    }
    const numPlayers = playerManager.getPlayerIds().length;
    if (stateManager.getVariable("GameStarted") === true) {
      var _pid = Number(playerId);
      var team2 = (stateManager.getVariable("Team2") || []).map(Number);
      var team1 = (stateManager.getVariable("Team1") || []).map(Number);

      if (team2.indexOf(_pid) !== -1) {
        if (team2.length - 1 < 1) {
          stateManager.setVariable("Team1", []);
          stateManager.setVariable("Team2", []);
          eventManager.emit("GameOver", {});
          return;
        }
        var index2 = team2.indexOf(_pid);
        team2.splice(index2, 1);
        stateManager.setVariable("Team2", team2);

        // Check if goalie needs to come back
        this._updateGoalies();
      } else if (team1.indexOf(_pid) !== -1) {
        if (team1.length - 1 < 1) {
          stateManager.setVariable("Team1", []);
          stateManager.setVariable("Team2", []);
          eventManager.emit("GameOver", {});
          return;
        }
        var index1 = team1.indexOf(_pid);
        team1.splice(index1, 1);
        stateManager.setVariable("Team1", team1);

        this._updateGoalies();
      }
      // Clean player from goals mapping
      var mapping = stateManager.getVariable("playerToGoalsMapping") || {};
      if (mapping[playerId] !== undefined) {
        delete mapping[playerId];
        stateManager.setVariable("playerToGoalsMapping", mapping);
      }
    }

    if (numPlayers < 2 && stateManager.getVariable("GameStarted") === false) {
      this._setMenuState(
        "WAITING_FOR_PLAYERS",
        "\uD83C\uDFD2 Free Skate",
        "This is ice hockey! You can shoot pucks and practice.\nWe recommend using a mouse.\nWhen another person joins, you can start a match!",
      );
    }

    // Demo mode: adjust puck count, goalies, and free skate label
    if (stateManager.getVariable("GameStarted") === false) {
      this._updateFreeSkateLabel();
      if (numPlayers < 1) {
        this._clearDemoPucks();
        this._removeGoalie(0);
        this._removeGoalie(1);
        // No players left — swap back to logo rink
        stageManager.setCurrentStage("rinkWithLogo");
      } else {
        this._spawnDemoPucks();
      }
    }
  }

  onPlayerJoined({ playerId }) {
    if (!playerManager.isHost) return;
    const numPlayers = playerManager.getPlayerIds().length;

    // Analytics: track joins
    this._sendAnalytics([
      { analyticName: "ihJoins", profileId: playerId },
      {
        analyticName: "ihUniqueJoins",
        profileId: playerId,
        uniqueKey: playerId,
      },
    ]);

    if (stateManager.getVariable("GameStarted") === true) {
      // Mid-game join: immediately assign to a team
      var team1 = (stateManager.getVariable("Team1") || []).map(Number);
      var team2 = (stateManager.getVariable("Team2") || []).map(Number);

      var assignTeam: number;
      if (team1.length < team2.length) {
        assignTeam = 1;
      } else if (team2.length < team1.length) {
        assignTeam = 2;
      } else {
        // Equal size — assign to team with lower score
        var scores = stateManager.getVariable("Scores") || [0, 0];
        if (scores[0] <= scores[1]) {
          assignTeam = 1;
        } else {
          assignTeam = 2;
        }
      }

      if (assignTeam === 1) {
        team1.push(Number(playerId));
        stateManager.setVariable("Team1", team1);
        playerManager.tintPlayer(playerId, "#0000FF");
        playerManager.setNameplate(
          playerId,
          "\uD83C\uDFD2 " +
            playerManager.getPlayerDetails(playerId).username +
            " \uD83C\uDFD2",
        );
        // Teleport to next open Team1 formation position
        var t1Formations = this._getFormationPositions(0, team1.length);
        var fp = t1Formations[team1.length - 1] || { x: 1515, y: 830 };
        playerManager.teleportPlayers([playerId], {
          distributionType: "area" as const,
          positionX: fp.x,
          positionY: fp.y,
          height: 0,
          width: 0,
        });
      } else {
        team2.push(Number(playerId));
        stateManager.setVariable("Team2", team2);
        playerManager.tintPlayer(playerId, "#FF0000");
        playerManager.setNameplate(
          playerId,
          "\uD83C\uDFD2 " +
            playerManager.getPlayerDetails(playerId).username +
            " \uD83C\uDFD2",
        );
        var t2Formations = this._getFormationPositions(1, team2.length);
        var fp2 = t2Formations[team2.length - 1] || { x: 1365, y: 830 };
        playerManager.teleportPlayers([playerId], {
          distributionType: "area" as const,
          positionX: fp2.x,
          positionY: fp2.y,
          height: 0,
          width: 0,
        });
      }

      // Add to goal tracking
      var goalMapping = stateManager.getVariable("playerToGoalsMapping") || {};
      goalMapping[playerId] = 0;
      stateManager.setVariable("playerToGoalsMapping", goalMapping);

      // May need to remove AI goalie if team now has enough players
      this._updateGoalies();
      return;
    }
    if (numPlayers >= 2 && stateManager.getVariable("GameStarted") === false) {
      try {
        this._setMenuState(
          "READY_TO_START",
          "Click here to Start Game",
          "\uD83C\uDFD2 Free Skate\nYou can shoot pucks and practice.\nWe recommend using a mouse.",
        );
        this.addScoreSprites();
      } catch (error) {
        console.log(
          "Main script failed in Getting num players and gamestarted variable for queue operations",
        );
      }
    } else if (
      numPlayers < 2 &&
      stateManager.getVariable("GameStarted") === false
    ) {
      this._setMenuState(
        "WAITING_FOR_PLAYERS",
        "\uD83C\uDFD2 Free Skate",
        "This is ice hockey! You can shoot pucks and practice.\nWe recommend using a mouse.\nWhen another person joins, you can start a match!",
      );
      // Activity log: looking for players
      this._setWorldActivity("GAME_WAITING");
    }

    // Demo mode: spawn pucks and ensure goalies are present
    if (stateManager.getVariable("GameStarted") === false) {
      this._updateFreeSkateLabel();
      this._updateGoalies();
      this._spawnDemoPucks();
    }
  }

  //add the ball sprites then attach collision logic
  onEvent_playerStartInput() {
    if (!playerManager.isHost) return;
    // A player fired the start input — relay as the authoritative game event
    eventManager.emit("playerStarted", {});
  }

  async onEvent_playerStarted() {
    // Clear demo pucks, goalies, and free skate label before starting official game
    this._clearDemoPucks();
    this._removeGoalie(0);
    this._removeGoalie(1);
    this._removeFreeSkateLabel();

    // Transition menu to game-active state
    this._setMenuState(
      "GAME_ACTIVE",
      "",
      "Score 5 goals first to win or have more goals than the other team before the timer runs out!",
    );

    const playerIds = playerManager.getPlayerIds();
    const numPlayers = playerIds.length;

    this.addBorders();
    this.addGoalHitBoxes(474 * this.goalScale);

    const playersLength = playerIds.length;
    let team1 = [];
    let team2 = [];
    let playerToGoalsMapping = {};
    const color1 = "#0000FF";
    const color2 = "#FF0000";

    // Divide players into teams (odd indices → team1, even → team2)
    for (let i = 0; i < playersLength; i++) {
      playerToGoalsMapping[playerIds[i]] = 0;
      if ((i + 1) % 2 !== 0) {
        playerManager.tintPlayer(playerIds[i], color1);
        team1.push(playerIds[i]);
        playerManager.setNameplate(
          playerIds[i],
          "\uD83C\uDFD2 " +
            playerManager.getPlayerDetails(playerIds[i]).username +
            " \uD83C\uDFD2",
        );
      } else {
        playerManager.tintPlayer(playerIds[i], color2);
        team2.push(playerIds[i]);
        playerManager.setNameplate(
          playerIds[i],
          "\uD83C\uDFD2 " +
            playerManager.getPlayerDetails(playerIds[i]).username +
            " \uD83C\uDFD2",
        );
      }
    }

    // Teleport teams to hockey formation positions
    var t1Formations = this._shuffleArray(this._getFormationPositions(0, team1.length));
    for (let ti = 0; ti < team1.length; ti++) {
      var fp1 = t1Formations[ti] || { x: 1515, y: 830 };
      playerManager.teleportPlayers([team1[ti]], {
        distributionType: "area" as const,
        positionX: fp1.x,
        positionY: fp1.y,
        height: 0,
        width: 0,
      });
    }
    var t2Formations = this._shuffleArray(this._getFormationPositions(1, team2.length));
    for (let ti = 0; ti < team2.length; ti++) {
      var fp2 = t2Formations[ti] || { x: 1365, y: 830 };
      playerManager.teleportPlayers([team2[ti]], {
        distributionType: "area" as const,
        positionX: fp2.x,
        positionY: fp2.y,
        height: 0,
        width: 0,
      });
    }
    stateManager.setVariable("Team1", team1);
    stateManager.setVariable("Team2", team2);
    stateManager.setVariable("playerToGoalsMapping", playerToGoalsMapping);

    // Analytics: track starts and game size
    var startAnalytics = [];
    for (let si = 0; si < playerIds.length; si++) {
      startAnalytics.push({
        analyticName: "ihStarts",
        profileId: playerIds[si],
      });
      startAnalytics.push({
        analyticName: "ihUniqueStarts",
        profileId: playerIds[si],
        uniqueKey: playerIds[si],
      });
    }
    startAnalytics.push({ analyticName: "ihGamesOf" + numPlayers });
    this._sendAnalytics(startAnalytics);

    stateManager.setVariable("GameStarted", true);

    // Spawn goalies based on team sizes (< 3 players per team)
    this._updateGoalies();

    // const soccerBallSprite = spriteManager.addSprite("SoccerBall", { uniqueId: "SoccerBall", checkCollisions: false, applyPhysics: true, positionX: this.experienceWidth/2, positionY: this.experienceHeight/2, scaleX: .3, scaleY: .3});
    // const soccerBallSprite = spriteManager.addSprite("SoccerBall", { uniqueId: "SoccerBall", checkCollisions: false, applyPhysics: true, positionX: this.experienceWidth/2, positionY: this.experienceHeight/2, scaleX: 0.98039215686, scaleY: .3});

    const soccerBallId = "SoccerBall";
    const soccerBallSprite = spriteManager.getSprite(soccerBallId) || spriteManager.addSprite("hockeyPuck", {
      uniqueId: soccerBallId,
      isPlayerControlled: false,
      checkCollisions: false,
      applyPhysics: true,
      positionX: this.experienceWidth / 2 - 35,
      positionY: this.experienceHeight / 2 - 35,
      scaleX: 0.6863,
      scaleY: 0.6931,
    });

    // spriteManager.updateSprite('SoccerBall',{positionX: (this.experienceWidth/2) - (spriteManager.getProperty('SoccerBall', 'width') / 2), positionY: (this.experienceHeight/2) - (spriteManager.getProperty('SoccerBall', 'height') / 2)});

    soccerBallSprite.attachComponent({ scriptId: "BallManager", props: {} });
    spriteManager.startBending("SoccerBall", {
      position: {
        factor: 0.15,
        duration: 60,
        deadzone: 0.5,
        snapThreshold: 200,
        interpolation: "ease-out",
      },
      velocity: {
        factor: 0.15,
        duration: 60,
        deadzone: 0.5,
        snapThreshold: 200,
        interpolation: "ease-out",
      },
    });
    this.addTimerSprite();

    // Activity log: game in progress
    this._setWorldActivity("GAME_ON");
  }

  onEvent_teamWon({}) {
    // Mark game as ended immediately so player-leave during reset countdown
    // doesn't trigger a second GameOver
    stateManager.setVariable("GameStarted", false);

    // Analytics: track completions for all remaining players
    this._sendCompletionAnalytics();

    // Activity log: game finished with a winner
    this._setWorldActivity("GAME_HIGH_SCORE");

    // Remove puck and timer (may already be gone if timerEndGame fired first)
    this._safeRemoveSprite("SoccerBall");
    this._safeRemoveSprite("timerSprite");

    // Fire win/loss particle effects
    this._fireWinParticles();

    // Create invisible host-side sprite for ResetManager countdown
    const resetSprite = spriteManager.getSprite("resettingSprite") || spriteManager.addSprite("ResettingSprite", {
      uniqueId: "resettingSprite",
      isPlayerControlled: false,
      positionX: -500,
      positionY: -500,
      text: "",
      opacity: 0,
    });
    resetSprite.attachComponent({ scriptId: "ResetManager", props: {} });
  }

  onEvent_GameOver({}) {

    // Remove all game sprites (safe — no-op if already removed by timerEndGame/teamWon)
    this._safeRemoveSprite("timerSprite");
    this._safeRemoveSprite("resettingSprite");
    this._safeRemoveSprite("SoccerBall");
    this._safeRemoveSprite("team1Score");
    this._safeRemoveSprite("team2Score");
    this._safeRemoveSprite("team1Text");
    this._safeRemoveSprite("team2Text");
    this._safeRemoveSprite("LeftWall");
    this._safeRemoveSprite("RightWall");
    this._safeRemoveSprite("TopLeftWall");
    this._safeRemoveSprite("TopRightWall");
    this._safeRemoveSprite("BottomLeftWall");
    this._safeRemoveSprite("BottomRightWall");
    this._safeRemoveSprite("goal1TopSideHitBox");
    this._safeRemoveSprite("goal2TopSideHitBox");

    // Remove game-mode goalies
    this._removeGoalie(0);
    this._removeGoalie(1);

    // Reset player tints and nameplates back to defaults
    var playerIds = playerManager.getPlayerIds();
    for (var i = 0; i < playerIds.length; i++) {
      try {
        playerManager.tintPlayer(playerIds[i],  "" );
        var details = playerManager.getPlayerDetails(playerIds[i]);
        if (details) {
          playerManager.setNameplate(playerIds[i], details.username);
        }
      } catch (e) {
        /* never break cleanup */
      }
    }

    // Clear all game state
    stateManager.setVariable("Scores", []);
    stateManager.setVariable("GameStarted", false);
    stateManager.setVariable("playerToGoalsMapping", {});
    stateManager.setVariable("Team1", []);
    stateManager.setVariable("Team2", []);

    // Reset world activity back to waiting
    var remainingPlayers = playerIds.length;
    if (remainingPlayers >= 1) {
      this._setWorldActivity("GAME_WAITING");
    }

    if (remainingPlayers >= 2) {
      try {
        this._setMenuState(
          "READY_TO_START",
          "Click here to Start Game",
          "\uD83C\uDFD2 Free Skate\nYou can shoot pucks and practice.\nWe recommend using a mouse.",
        );
        this.addScoreSprites();
      } catch (error) {
        console.log("Main script failed");
      }
    } else {
      this._setMenuState(
        "WAITING_FOR_PLAYERS",
        "\uD83C\uDFD2 Free Skate",
        "This is ice hockey! You can shoot pucks and practice.\nWe recommend using a mouse.\nWhen another person joins, you can start a match!",
      );
    }

    // Re-spawn goalies, demo pucks, and free skate label for lobby
    this._updateFreeSkateLabel();
    if (remainingPlayers >= 1) {
      this._updateGoalies();
      this._spawnDemoPucks();
    }
  }

  addBorders() {
    // Left wall: 100px wide, flush with left edge
    spriteManager.addSprite("LeftWall", {
      uniqueId: "LeftWall",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 0,
      positionY: 3,
      width: 100,
      height: 1617,
      isImpassable: true,
    });
    // Right wall: 100px wide, flush with right edge
    spriteManager.addSprite("LeftWall", {
      uniqueId: "RightWall",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 2780,
      positionY: 3,
      width: 100,
      height: 1622,
      isImpassable: true,
    });

    // Top wall: rink top border {positionX:1, positionY:11, width:2873, height:178}
    spriteManager.addSprite("HorizontalWall", {
      uniqueId: "TopLeftWall",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 1,
      positionY: 11,
      width: 1436,
      height: 178,
      isImpassable: true,
    });

    spriteManager.addSprite("HorizontalWall", {
      uniqueId: "TopRightWall",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 1437,
      positionY: 11,
      width: 1437,
      height: 178,
      isImpassable: true,
    });

    // Bottom walls split with passageway gap at x:1210-1670
    // Height increased by 50px (25→75), moved up to y:1570 to prevent phasing
    const BottomLeftWallSprite = spriteManager.addSprite("HorizontalWall", {
      uniqueId: "BottomLeftWall",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 0,
      positionY: this.experienceHeight - 50,
      width: 1210,
      height: 75,
      isImpassable: true,
    });

    const BottomRightWallSprite = spriteManager.addSprite("HorizontalWall", {
      uniqueId: "BottomRightWall",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 1670,
      positionY: this.experienceHeight - 50,
      width: 1210,
      height: 75,
      isImpassable: true,
    });
  }

  // Score display sprites only (menu/panel sprites handled by PlayerMenuPanel)
  addScoreSprites() {
    // Team 1 score region: x=1452, y=-39, w=182, h=177
    spriteManager.addSprite("teamText", {
      uniqueId: "team1Text",
      isInteractive: true,
      isPlayerControlled: false,
      text: "Team 1",
      positionX: 1452,
      positionY: 0,
      containerWidth: 182,
      align: "center",
    });

    spriteManager.addSprite("team1Score", {
      uniqueId: "team1Score",
      isInteractive: true,
      isPlayerControlled: false,
      text: "0",
      positionX: 1452,
      positionY: 55,
      containerWidth: 182,
      align: "center",
    });

    // Team 2 score region: x=1240, y=-37, w=177, h=177
    spriteManager.addSprite("teamText", {
      uniqueId: "team2Text",
      isInteractive: true,
      isPlayerControlled: false,
      text: "Team 2",
      positionX: 1240,
      positionY: 0,
      containerWidth: 177,
      align: "center",
    });

    spriteManager.addSprite("team2Score", {
      uniqueId: "team2Score",
      isInteractive: true,
      isPlayerControlled: false,
      text: "0",
      positionX: 1240,
      positionY: 55,
      containerWidth: 177,
      align: "center",
    });
  }

  addGoalHitBoxes(goalHeight: number) {
    // Right goal hitbox — scaled 1.3x vertically from GoalLine1 center (904)
    spriteManager.addSprite("GoalSideHitBox", {
      uniqueId: "goal1TopSideHitBox",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 2602,
      positionY: 744,
      width: 200,
      height: 332,
      isImpassable: true,
    });

    // Left goal hitbox — scaled 1.3x vertically from GoalLine2 center (912.5)
    spriteManager.addSprite("GoalSideHitBox", {
      uniqueId: "goal2TopSideHitBox",
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: 64,
      positionY: 734,
      width: 214,
      height: 347,
      isImpassable: true,
    });
  }

  addTimerSprite() {
    // Prompt text region: x=1205, y=142, w=460, h=90
    const timerSprite = spriteManager.getSprite("timerSprite") || spriteManager.addSprite("timerSprite", {
      uniqueId: "timerSprite",
      isPlayerControlled: false,
      positionX: 1205,
      positionY: 142,
      containerWidth: 460,
      align: "center",
    });
    timerSprite.attachComponent({ scriptId: "TimerManager", props: {} });
  }

  //when the timer ends the game
  onEvent_timerEndGame() {
    const scores = stateManager.getVariable("Scores");
    let winningText = "";
    if (scores[0] === scores[1]) {
      winningText = "Team 1 (Blue Team) and Team 2 (Red Team) have tied";
    } else {
      winningText =
        scores[0] > scores[1]
          ? `Team 1 (blue team) has won hockey!`
          : `Team 2 (red team) has won hockey!`;
    }

    // Show winner in player-following panel
    this._setMenuState("GAME_OVER", winningText, "Game Resetting in: 7");

    // Remove puck and timer — teamWon/GameOver will skip these since they're already gone
    this._safeRemoveSprite("SoccerBall");
    this._safeRemoveSprite("timerSprite");
    eventManager.emit("teamWon", {});
  }

  // --- Goalie helpers ---

  _spawnGoalie(teamIndex: number) {
    var spriteType = teamIndex === 0 ? "Team1Goalie" : "Team2Goalie";
    var uniqueId = teamIndex === 0 ? "ih_goalie_team1" : "ih_goalie_team2";

    // Don't double-spawn
    if (spriteManager.getSprite(uniqueId)) return;

    // Spawn at center of patrol box
    // Right goalie box: {x:2276, y:589, w:304, h:508}  → center (2428, 843)
    // Left goalie box:  {x:296,  y:586, w:298, h:528}  → center (445, 850)
    var patrolX = teamIndex === 0 ? 2428 : 445;
    var patrolY = teamIndex === 0 ? 843 : 850;

    var goalieSp = spriteManager.getSprite(uniqueId) || spriteManager.addSprite(spriteType, {
      uniqueId: uniqueId,
      isPlayerControlled: false,
      checkCollisions: true,
      applyPhysics: true,
      positionX: patrolX,
      positionY: patrolY,
      scaleX: 0.7,
      scaleY: 0.7,
    });
    goalieSp.attachComponent({ scriptId: "GoalieManager", props: {} });
    spriteManager.startBending(uniqueId, {
      position: {
        factor: 0.15,
        duration: 60,
        deadzone: 0.5,
        snapThreshold: 200,
        interpolation: "ease-out",
      },
    });
  }

  _removeGoalie(teamIndex: number) {
    var uniqueId = teamIndex === 0 ? "ih_goalie_team1" : "ih_goalie_team2";
    spriteManager.removeSprite(uniqueId);
    stateManager.setVariable("GoalieHolding_" + teamIndex, "");
  }

  _updateGoalies() {
    if (!playerManager.isHost) return;

    var gameStarted = stateManager.getVariable("GameStarted") === true;

    if (!gameStarted) {
      // Demo mode: both goalies always present
      this._spawnGoalie(0);
      this._spawnGoalie(1);
      return;
    }

    // During game: goalie present only if team has < 3 players
    var team1 = (stateManager.getVariable("Team1") || []).map(Number);
    var team2 = (stateManager.getVariable("Team2") || []).map(Number);

    if (team1.length < 3) {
      this._spawnGoalie(0);
    } else {
      this._removeGoalie(0);
    }

    if (team2.length < 3) {
      this._spawnGoalie(1);
    } else {
      this._removeGoalie(1);
    }
  }

  // --- Demo puck helpers ---

  _spawnDemoPucks() {
    if (!playerManager.isHost) return;
    if (stateManager.getVariable("GameStarted") === true) return;

    var playerIds = playerManager.getPlayerIds();
    if (playerIds && playerIds.toArray) playerIds = playerIds.toArray();
    var numPlayers = playerIds.length;
    if (numPlayers < 1) {
      this._clearDemoPucks();
      return;
    }

    var numPucks = 4;
    // Face-off circle positions
    var faceOff = [
      { x: 549, y: 372 }, // TL
      { x: 549, y: 1223 }, // BL
      { x: 2230, y: 369 }, // TR
      { x: 2232, y: 1222 }, // BR
    ];

    // Get player positions
    var playerPos = [];
    for (var pi = 0; pi < playerIds.length; pi++) {
      var det = playerManager.getPlayerDetails(playerIds[pi]);
      if (det) playerPos.push({ x: det.x, y: det.y });
    }

    // Score each face-off by distance to nearest player
    var scored = [];
    for (var fi = 0; fi < faceOff.length; fi++) {
      var minDist = 999999999;
      for (var pj = 0; pj < playerPos.length; pj++) {
        var dx = faceOff[fi].x - playerPos[pj].x;
        var dy = faceOff[fi].y - playerPos[pj].y;
        var d = dx * dx + dy * dy;
        if (d < minDist) minDist = d;
      }
      scored.push({ idx: fi, dist: minDist });
    }

    // Selection sort by distance ascending (closest first)
    for (var si = 0; si < scored.length - 1; si++) {
      var minIdx = si;
      for (var sj = si + 1; sj < scored.length; sj++) {
        if (scored[sj].dist < scored[minIdx].dist) minIdx = sj;
      }
      if (minIdx !== si) {
        var tmp = scored[si];
        scored[si] = scored[minIdx];
        scored[minIdx] = tmp;
      }
    }

    for (var i = 0; i < 4; i++) {
      var puckId = "ih_demo_puck_" + i;
      if (i < numPucks) {
        var pos = faceOff[scored[i].idx];
        if (!spriteManager.getSprite(puckId)) {
          var puckSp = spriteManager.getSprite(puckId) ||  spriteManager.addSprite("hockeyPuck", {
            uniqueId: puckId,
            isPlayerControlled: false,
            checkCollisions: true,
            applyPhysics: true,
            positionX: pos.x,
            positionY: pos.y,
            scaleX: 0.6863,
            scaleY: 0.6931,
          });
          puckSp.attachComponent({ scriptId: "BallManager", props: {} });
          spriteManager.startBending(puckId, {
            position: {
              factor: 0.15,
              duration: 60,
              deadzone: 0.5,
              snapThreshold: 200,
              interpolation: "ease-out",
            },
            velocity: {
              factor: 0.15,
              duration: 60,
              deadzone: 0.5,
              snapThreshold: 200,
              interpolation: "ease-out",
            },
          });
        }
      } else {
        spriteManager.removeSprite(puckId);
      }
    }
  }

  _clearDemoPucks() {
    for (var i = 0; i < 4; i++) {
      spriteManager.removeSprite("ih_demo_puck_" + i);
    }
    stateManager.setVariable("GoalieHolding_0", "");
    stateManager.setVariable("GoalieHolding_1", "");
  }

  // Free Skate label displayed where the timer goes during non-game states
  // Prompt text region: x=1205, y=142, w=460, h=90
  _updateFreeSkateLabel() {
    if (!playerManager.isHost) return;
    var numPlayers = playerManager.getPlayerIds().length;

    var title = numPlayers >= 2 ? "Ready to Start!" : "Free Skate!";
    var subtitle =
      numPlayers >= 2
        ? "Any player can start a match."
        : "Waiting for players...";

    if (spriteManager.getSprite("ih_freeSkateTitle")) {
      spriteManager.updateSprite("ih_freeSkateTitle", { text: title });
    } else {
      spriteManager.addSprite("timerSprite", {
        uniqueId: "ih_freeSkateTitle",
        isPlayerControlled: false,
        text: title,
        positionX: 1205,
        positionY: 142,
        containerWidth: 460,
        align: "center",
      });
    }

    if (spriteManager.getSprite("ih_freeSkateSubtitle")) {
      spriteManager.updateSprite("ih_freeSkateSubtitle", { text: subtitle });
    } else {
      spriteManager.addSprite("timerSprite", {
        uniqueId: "ih_freeSkateSubtitle",
        isPlayerControlled: false,
        text: subtitle,
        fontSize: 28,
        positionX: 1205,
        positionY: 192,
        containerWidth: 460,
        align: "center",
      });
    }
  }

  _removeFreeSkateLabel() {
    spriteManager.removeSprite("ih_freeSkateTitle");
    spriteManager.removeSprite("ih_freeSkateSubtitle");
  }

  _shuffleArray(arr: { x: number; y: number }[]): { x: number; y: number }[] {
    var shuffled: { x: number; y: number }[] = [];
    for (var i = 0; i < arr.length; i++) {
      shuffled.push(arr[i]);
    }
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = mathRandomInt(0, i);
      var temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    return shuffled;
  }

  // Hockey formation positions for each team (up to 6 per side)
  // Positions derived from artwork face-off dots, center circle, and goalie patrol spots
  _getFormationPositions(
    teamIndex: number,
    count: number,
  ): { x: number; y: number }[] {
    // Team 1 (Blue): right side, defends right goal
    var t1Positions = [
      { x: 1650, y: 830 }, // Center — spaced right of center circle
      { x: 1759, y: 391 }, // Top Wing — art middle right top
      { x: 1763, y: 1345 }, // Bottom Wing — art middle right bottom
      { x: 2402, y: 909 }, // Goalie — in front of right goal
      { x: 2280, y: 419 }, // Top Defense — art top right respawn
      { x: 2282, y: 1272 }, // Bottom Defense — art bottom right respawn
    ];
    // Team 2 (Red): left side, defends left goal
    var t2Positions = [
      { x: 1230, y: 830 }, // Center — spaced left of center circle
      { x: 1124, y: 390 }, // Top Wing — art middle left top
      { x: 1119, y: 1341 }, // Bottom Wing — art middle left bottom
      { x: 478, y: 909 }, // Goalie — in front of left goal
      { x: 599, y: 422 }, // Top Defense — art top left respawn
      { x: 599, y: 1273 }, // Bottom Defense — art bottom left respawn
    ];
    var positions = teamIndex === 0 ? t1Positions : t2Positions;
    var result: { x: number; y: number }[] = [];
    for (var i = 0; i < count && i < positions.length; i++) {
      result.push(positions[i]);
    }
    return result;
  }

  // Helper: fire particle effects for winning/losing teams
  _fireWinParticles() {
    var publicKey = stateManager.getVariable("PublicKey");
    var scores = stateManager.getVariable("Scores") || [0, 0];
    var winTeamVar = scores[0] >= scores[1] ? "Team1" : "Team2";
    var loseTeamVar = scores[0] >= scores[1] ? "Team2" : "Team1";

    var winners = stateManager.getVariable(winTeamVar) || [];
    if (winners.toArray) winners = winners.toArray();
    var losers = stateManager.getVariable(loseTeamVar) || [];
    if (losers.toArray) losers = losers.toArray();

    for (var wi = 0; wi < winners.length; wi++) {
      try {
        var wDet = playerManager.getPlayerDetails(winners[wi]);
        if (wDet) {
          integrationsManager.triggerParticleEffect({
            particleName: "trophyBalloon_float",
            position: { x: wDet.x, y: wDet.y },
            duration: 3.0,
            followPlayerId: winners[wi],
            interactivePublicKey: publicKey,
          });
        }
      } catch (e) {
        /* ignore */
      }
    }
    for (var li = 0; li < losers.length; li++) {
      try {
        var lDet = playerManager.getPlayerDetails(losers[li]);
        if (lDet) {
          integrationsManager.triggerParticleEffect({
            particleName: "blackSmoke_puff",
            position: { x: lDet.x, y: lDet.y },
            duration: 1.5,
            followPlayerId: losers[li],
            interactivePublicKey: publicKey,
          });
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  // Helper: set all three menu state variables at once
  _setMenuState(state: string, actionText: string, detailText: string) {
    stateManager.setVariable("MenuState", state);
    stateManager.setVariable("MenuActionText", actionText);
    stateManager.setVariable("MenuDetailText", detailText);

    // Show/hide world-space start button for all players
    if (state === "READY_TO_START") {
      this._showStartButton();
    } else {
      this._hideStartButton();
    }
  }

  // World-space START GAME button (host-only, overlays scoreboard area)
  _showStartButton() {
    if (!playerManager.isHost) return;
    if (spriteManager.getSprite("ih_start_btn_bg")) return;

    spriteManager.addSprite("LeftWall", {
      uniqueId: "ih_start_btn_bg",
      isPlayerControlled: false,
      isInteractive: true,
      width: 461,
      height: 87,
      fill: "#4CAF50",
      opacity: 0.95,
      borderRadius: 16,
      positionX: 1206,
      positionY: 147,
      displayLayer: "TOP",
    });

    spriteManager.addSprite("IntroText", {
      uniqueId: "ih_start_btn_text",
      isPlayerControlled: false,
      isInteractive: true,
      text: "START GAME",
      fontSize: 28,
      fontColor: "#FFFFFF",
      containerWidth: 461,
      align: "center",
      positionX: 1206,
      positionY: 172,
      displayLayer: "TOP",
    });
  }

  _hideStartButton() {
    if (!playerManager.isHost) return;
    spriteManager.removeSprite("ih_start_btn_bg");
    spriteManager.removeSprite("ih_start_btn_text");
  }

  onSpriteClicked({ event, sprite }) {
    if (!sprite) return;
    if (
      sprite.uniqueId === "ih_start_btn_bg" ||
      sprite.uniqueId === "ih_start_btn_text"
    ) {
      if (stateManager.getVariable("MenuState") === "READY_TO_START") {
        eventManager.emit("playerStartInput", {});
      }
    }
  }

  // Helper: fire completion analytics for all remaining players
  _sendCompletionAnalytics() {
    var allPlayers = playerManager.getPlayerIds();
    if (allPlayers && allPlayers.toArray) allPlayers = allPlayers.toArray();
    var completionAnalytics = [];
    for (var ci = 0; ci < allPlayers.length; ci++) {
      completionAnalytics.push({
        analyticName: "ihCompletions",
        profileId: allPlayers[ci],
      });
      completionAnalytics.push({
        analyticName: "ihUniqueCompletions",
        profileId: allPlayers[ci],
        uniqueKey: allPlayers[ci],
      });
    }
    this._sendAnalytics(completionAnalytics);
  }

  // Helper: fire a world activity log entry (no-op if PublicKey not configured)
  _setWorldActivity(type: string) {
    try {
      var publicKey = stateManager.getVariable("PublicKey");
      if (!publicKey) return;
      integrationsManager.setWorldActivity({
        type: type,
        interactivePublicKey: publicKey,
      });
    } catch (e) {
      // Never break gameplay over activity log
    }
  }

  // Helper: send analytics events (no-op if PublicKey not configured)
  _sendAnalytics(analytics: any[]) {
    try {
      var publicKey = stateManager.getVariable("PublicKey");
      if (!publicKey) return;
      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: publicKey,
        analytics: analytics,
      });
    } catch (e) {
      // Never break gameplay over analytics
    }
  }

  // Helper: remove a sprite only if it exists (prevents crash on double removal)
  _safeRemoveSprite(uniqueId: string) {
    if (spriteManager.getSprite(uniqueId)) {
      spriteManager.removeSprite(uniqueId);
    }
  }
}
