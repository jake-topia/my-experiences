class BallManager extends ComponentScript {
  experienceWidth: number;
  experienceHeight: number;
  team1: any = [];
  team2: any = [];
  walls: any = [];
  scores: any = [];
  lastPlayerTouch: number;
  hitBoxes: any = [];
  isBetweenPlays: boolean = false;
  hockeyPuckWidth: number;
  hockeyPuckHeight: number;

  // Puck possession state
  _possessingPlayerId: string;
  _possessingPlayerLookupId: string;
  _possessingStickId: string;
  _possessionStartMs: number;
  _possessionDurationMs: number;
  _initialSyncMovedOn: string;
  _initialMoveToX: number;
  _initialMoveToY: number;
  _possessionOffsetX: number;
  _possessionOffsetY: number;

  // Kick cooldown — prevents kicker from re-catching immediately
  _lastFiredPlayerId: string;
  _lastFiredMs: number;
  _fireCooldownMs: number;

  // Wall boundary settings
  _wallTop: number;
  _wallBottom: number;
  _cornerInset: number;

  highSpeed: number;
  lowSpeed: number;

  // Demo mode
  _isDemoMode: number;
  _demoRespawnX: number;
  _demoRespawnY: number;

  // Goal celebration delay
  _goalScored: number;
  _goalScoredMs: number;
  _goalScoredTeamIndex: number;
  _goalDelayMs: number;

  // Goalie possession state
  _goalieHolding: number;
  _goalieTeamIndex: number;
  _goalieCaughtMs: number;
  _goalieHoldMs: number;
  _goalieUniqueId: string;
  _goalieOffsetX: number;
  _goalieOffsetY: number;
  _goalieShootMs: number;
  _goalieShootCooldownMs: number;

  // Slap shot wind-up state
  _carryDirX: number;
  _carryDirY: number;
  _carryFrames: number;
  _windUpActive: number;
  _windUpStartMs: number;
  _windUpDirX: number;
  _windUpDirY: number;
  _windUpWindowMs: number;
  _slapShotSpeed: number;

  // Discrete input direction for slapshot detection
  _lastInputDirX: number;
  _lastInputDirY: number;
  _lastInputMs: number;

  // Stick collision immunity after firing
  _immuneStickId: string;
  _immuneStickEndMs: number;

  onInit() {
    this.isBetweenPlays = false;
    // hello world
    this.experienceWidth = 2880;
    this.experienceHeight = 1620;
    this.hockeyPuckHeight = 69;
    this.hockeyPuckWidth = 69;
    this.team1 = (stateManager.getVariable("Team1") || []).map(Number);
    this.team2 = (stateManager.getVariable("Team2") || []).map(Number);
    this.walls = [
      "RightWall",
      "LeftWall",
      "BottomRightWall",
      "BottomLeftWall",
      "TopLeftWall",
      "TopRightWall",
    ];
    this.hitBoxes = [
      "goal1TopSideHitBox",
      "goal2TopSideHitBox",
      "ih_goal_bottom_left",
      "ih_goal_top_left",
      "ih_goal_bottom_right",
      "ih_goal_top_right",
    ];
    this.scores = [0, 0];
    this.lastPlayerTouch = -1;
    this.sprite.checkCollisions = true;

    // Demo mode detection
    this._isDemoMode =
      this.sprite.uniqueId.indexOf("ih_demo_puck") !== -1 ? 1 : 0;

    // Only reset global scores for the real game puck
    if (this._isDemoMode === 0) {
      var scores = [0, 0];
      stateManager.setVariable("Scores", scores);
    }

    // Possession state init
    this._possessingPlayerId = "";
    this._possessingPlayerLookupId = "";
    this._possessingStickId = "";
    this._possessionStartMs = 0;
    this._possessionDurationMs = 10000;
    this._initialSyncMovedOn = "";
    this._initialMoveToX = 0;
    this._initialMoveToY = 0;
    this._possessionOffsetX = 0;
    this._possessionOffsetY = 0;

    // Kick cooldown
    this._lastFiredPlayerId = "";
    this._lastFiredMs = 0;
    this._fireCooldownMs = 500;

    // Wall boundaries — top of rink rect is at y=11 h=178, bottom edge at y=189
    this._wallTop = 189;
    this._wallBottom = this.experienceHeight - this.hockeyPuckHeight;
    this._cornerInset = 150;

    if (this._isDemoMode === 0) {
      stateManager.setVariable("PuckCanCollide", true);
    }

    this.highSpeed = 18;
    this.lowSpeed = 8;

    // Goal celebration delay init
    this._goalScored = 0;
    this._goalScoredMs = 0;
    this._goalScoredTeamIndex = -1;
    this._goalDelayMs = 1200;

    // Goalie possession init
    this._goalieHolding = 0;
    this._goalieTeamIndex = -1;
    this._goalieCaughtMs = 0;
    this._goalieHoldMs = 1000;
    this._goalieUniqueId = "";
    this._goalieOffsetX = 0;
    this._goalieOffsetY = 0;
    this._goalieShootMs = 0;
    this._goalieShootCooldownMs = 600;

    // Slap shot wind-up init
    this._carryDirX = 0;
    this._carryDirY = 0;
    this._carryFrames = 0;
    this._windUpActive = 0;
    this._windUpStartMs = 0;
    this._windUpDirX = 0;
    this._windUpDirY = 0;
    this._windUpWindowMs = 1200;
    this._slapShotSpeed = 24;

    // Stick collision immunity init
    this._immuneStickId = "";
    this._immuneStickEndMs = 0;

    // Discrete input direction init
    this._lastInputDirX = 0;
    this._lastInputDirY = 0;
    this._lastInputMs = 0;

    // Demo puck respawn — read initial position from sprite (set by proximity sort in _spawnDemoPucks)
    this._demoRespawnX = this.experienceWidth / 2 - this.hockeyPuckWidth / 2;
    this._demoRespawnY = this.experienceHeight / 2 - this.hockeyPuckHeight / 2;
    if (this._isDemoMode === 1) {
      var spawnX = this.sprite.position?.x ?? this.sprite.x ?? 0;
      var spawnY = this.sprite.position?.y ?? this.sprite.y ?? 0;
      if (spawnX > 0 && spawnY > 0) {
        this._demoRespawnX = spawnX;
        this._demoRespawnY = spawnY;
      }
    }
  }

  _firePuck(angle: number, speed: number) {
    var firedStickId = this._possessingStickId;

    this._lastFiredPlayerId = this._possessingPlayerId;
    this._lastFiredMs = Date.now();
    this.sprite.velocity.x = Math.cos(angle) * speed;
    this.sprite.velocity.y = Math.sin(angle) * speed;
    this.sprite.friction.x = 0.96;
    this.sprite.friction.y = 0.96;

    // Teleport puck past the stick so it doesn't re-collide
    var stickSp = spriteManager.getSprite(firedStickId);
    var nudge = stickSp ? Math.max(stickSp.width, stickSp.height) + 20 : 80;
    this.sprite.position.x = this.sprite.position.x + Math.cos(angle) * nudge;
    this.sprite.position.y = this.sprite.position.y + Math.sin(angle) * nudge;

    // Grant immunity — ignore collisions with this stick for 1 second
    this._immuneStickId = firedStickId;
    this._immuneStickEndMs = Date.now() + 1000;

    // Flash the stick opacity while immune
    if (stickSp) {
      timerManager.animate({
        targets: [stickSp],
        keyframes: {
          0: { opacity: 0.3 },
          25: { opacity: 0.8 },
          50: { opacity: 0.3 },
          75: { opacity: 0.8 },
          100: { opacity: 1 },
        },
        duration: 1000,
        loop: false,
        alternate: false,
        playbackEase: "Linear",
      });
    }

    this._possessingPlayerId = "";
    this._possessingPlayerLookupId = "";
    this._possessingStickId = "";
    this._possessionStartMs = 0;

    // Reset carry/wind-up state
    this._carryDirX = 0;
    this._carryDirY = 0;
    this._carryFrames = 0;
    this._windUpActive = 0;
    this._windUpStartMs = 0;
    this._windUpDirX = 0;
    this._windUpDirY = 0;
    this._lastInputDirX = 0;
    this._lastInputDirY = 0;
    this._lastInputMs = 0;
  }

  _clampToRink(px: number, py: number): { x: number; y: number } {
    var clamped_x = px;
    var clamped_y = py;
    if (clamped_x < 100) clamped_x = 100;
    if (clamped_x > 2780 - this.hockeyPuckWidth) clamped_x = 2780 - this.hockeyPuckWidth;
    if (clamped_y < this._wallTop) clamped_y = this._wallTop;
    if (clamped_y > this._wallBottom) clamped_y = this._wallBottom;
    return { x: clamped_x, y: clamped_y };
  }

  onPhysicsStep(deltaTime: 70) {
    // --- Clients: trust host-synced puck position during possession ---
    // The host updates _possessionOffsetX/Y dynamically as the carry direction
    // changes, but those offsets are local state (not synced). Client prediction
    // with stale offsets fights with the host's synced position, causing jitter.
    // Let the sync + bending manager handle interpolation instead.
    if (!playerManager.isHost) {
      return;
    }

    // --- Goalie possession check ---
    if (this._goalieHolding === 1) {
      var goalieSp = spriteManager.getSprite(this._goalieUniqueId);
      if (!goalieSp) {
        // Goalie removed — release puck
        stateManager.setVariable("GoalieHolding_" + this._goalieTeamIndex, "");
        this._goalieHolding = 0;
        this._goalieUniqueId = "";
        this._firePuck(0, this.lowSpeed);
        return;
      }

      // Check hold timer
      if (Date.now() - this._goalieCaughtMs >= this._goalieHoldMs) {
        this._goalieShoot();
        return;
      }

      // Follow goalie position
      var gx = goalieSp.position?.x ?? goalieSp.x ?? 0;
      var gy = goalieSp.position?.y ?? goalieSp.y ?? 0;
      spriteManager.updateSprite(this.sprite.uniqueId, {
        positionX: gx + this._goalieOffsetX,
        positionY: gy + this._goalieOffsetY,
        velocityX: 0,
        velocityY: 0,
      });
      return;
    }

    // --- Goal celebration: puck clatters inside the net ---
    if (this._goalScored === 1) {
      // Apply heavy friction so puck slows quickly
      this.sprite.friction.x = 0.85;
      this.sprite.friction.y = 0.85;

      if (Date.now() - this._goalScoredMs >= this._goalDelayMs) {
        var scoredTeam = this._goalScoredTeamIndex;
        this._goalScored = 0;
        this._goalScoredTeamIndex = -1;
        this._goalScoredMs = 0;
        eventManager.emit("playerScored", {
          teamIndex: scoredTeam,
          playerId: this.lastPlayerTouch,
        });
      }
      return;
    }

    // --- Possession check (mouse mode only) ---
    if (this._possessingPlayerId !== "") {
      var playerSprite = spriteManager.getSprite(
        String(this._possessingPlayerLookupId),
      );

      if (!playerSprite) {
        this._firePuck(0, this.lowSpeed);
        return;
      }

      // Wind-up timeout
      if (this._windUpActive === 1 && Date.now() - this._windUpStartMs > this._windUpWindowMs) {
        this._windUpActive = 0;
      }

      // Check if player has issued a new moveTo since possession started
      var hasMoved =
        playerSprite._syncMovedOn !== this._initialSyncMovedOn ||
        (playerSprite.moveTo?.x ?? 0) !== this._initialMoveToX ||
        (playerSprite.moveTo?.y ?? 0) !== this._initialMoveToY;

      if (hasMoved) {
        // Original direction logic: moveTo - moveFrom (the "flick" direction)
        var moveToX = playerSprite.moveTo?.x ?? 0;
        var moveToY = playerSprite.moveTo?.y ?? 0;
        var moveFromX = playerSprite.moveFrom?.x ?? 0;
        var moveFromY = playerSprite.moveFrom?.y ?? 0;
        var dx = moveToX - moveFromX;
        var dy = moveToY - moveFromY;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var angle = Math.atan2(dy, dx);

        // Lower the shoot threshold when player is actively moving —
        // moveFrom is already offset so the flick distance reads shorter
        var playerVx = playerSprite.velocity?.x ?? 0;
        var playerVy = playerSprite.velocity?.y ?? 0;
        var playerSpeed = Math.sqrt(playerVx * playerVx + playerVy * playerVy);
        var shootThreshold = playerSpeed > 1 ? 420 : 250;

        // Diagonal movements naturally produce longer distances (hypotenuse),
        // so scale the threshold up based on how diagonal the flick is.
        // Pure cardinal: min(|dx|,|dy|)/dist ≈ 0 → multiplier 1.0
        // Pure diagonal:  min(|dx|,|dy|)/dist ≈ 0.707 → multiplier ~1.4
        var absDx = dx < 0 ? -dx : dx;
        var absDy = dy < 0 ? -dy : dy;
        var diag = dist > 1 ? (absDx < absDy ? absDx : absDy) / dist : 0;
        shootThreshold = shootThreshold * (1 + diag * 0.6);

        if (dist >= shootThreshold) {
          // Far click = shoot
          this._firePuck(angle, this.highSpeed);
          return;
        } else {
          if (dist > 1) {
            var rawDirX = dx / dist;
            var rawDirY = dy / dist;

            // Snap to nearest cardinal/diagonal (8 directions) so repeated
            // similar inputs collapse into the same bucket
            var snapAngle = Math.atan2(rawDirY, rawDirX);
            var snapIndex = Math.round(snapAngle / (Math.PI / 4));
            var snappedAngle = snapIndex * (Math.PI / 4);
            var newDirX = Math.round(Math.cos(snappedAngle) * 1000) / 1000;
            var newDirY = Math.round(Math.sin(snappedAngle) * 1000) / 1000;

            if (this._windUpActive === 1) {
              // Phase 3: swing-back — input returns toward wind-up direction
              var wdMag = Math.sqrt(this._windUpDirX * this._windUpDirX + this._windUpDirY * this._windUpDirY);
              if (wdMag > 0.1) {
                var dot = newDirX * (this._windUpDirX / wdMag) + newDirY * (this._windUpDirY / wdMag);
                if (dot > 0.3) {
                  // SLAP SHOT in wind-up direction
                  var slapAngle = Math.atan2(this._windUpDirY, this._windUpDirX);
                  this._firePuck(slapAngle, this._slapShotSpeed);
                  return;
                }
                // If input is still in the reversal direction (opposing wind-up),
                // keep wind-up alive — keyboard sends repeated same-direction inputs
                if (dot < -0.3) {
                  // Still reversing, just wait for swing-back
                } else {
                  // Unrelated direction — cancel wind-up
                  this._windUpActive = 0;
                }
              } else {
                this._windUpActive = 0;
              }
            } else {
              // Phase 2: reversal check — new input opposes last discrete input
              var hasInput = this._lastInputMs > 0;
              if (hasInput) {
                var liMag = Math.sqrt(this._lastInputDirX * this._lastInputDirX + this._lastInputDirY * this._lastInputDirY);
                if (liMag > 0.1) {
                  var normLIX = this._lastInputDirX / liMag;
                  var normLIY = this._lastInputDirY / liMag;
                  var dot = newDirX * normLIX + newDirY * normLIY;
                  if (dot < -0.1) {
                    // Reversed — enter wind-up, fire direction = last input
                    this._windUpActive = 1;
                    this._windUpStartMs = Date.now();
                    this._windUpDirX = this._lastInputDirX;
                    this._windUpDirY = this._lastInputDirY;
                  }
                }
              }
            }

            // Store this as the last discrete input direction
            this._lastInputDirX = newDirX;
            this._lastInputDirY = newDirY;
            this._lastInputMs = Date.now();
          }
          // Update snapshot for next hasMoved detection
          this._initialSyncMovedOn = playerSprite._syncMovedOn ?? "";
          this._initialMoveToX = moveToX;
          this._initialMoveToY = moveToY;
        }
      }

      // Possession timer expired — fire in player's facing direction
      if (Date.now() - this._possessionStartMs >= this._possessionDurationMs) {
        var fireAngle = (playerSprite.angle ?? 0) + Math.PI;
        this._firePuck(fireAngle, this.highSpeed);
        return;
      }

      // Still in possession — dynamically reposition puck in movement direction
      var mfx = playerSprite.moveFrom?.x ?? 0;
      var mfy = playerSprite.moveFrom?.y ?? 0;
      var mtx = playerSprite.moveTo?.x ?? 0;
      var mty = playerSprite.moveTo?.y ?? 0;
      var ddx = mtx - mfx;
      var ddy = mty - mfy;
      var mag = Math.sqrt(ddx * ddx + ddy * ddy);
      if (mag > 1) {
        var dirX = ddx / mag;
        var dirY = ddy / mag;
        var carryDist = 25;
        var targetOffX = dirX * carryDist;
        var targetOffY = dirY * carryDist;
        this._possessionOffsetX += (targetOffX - this._possessionOffsetX) * 0.15;
        this._possessionOffsetY += (targetOffY - this._possessionOffsetY) * 0.15;

        // Track carry direction for slap shot wind-up
        this._carryDirX += (dirX - this._carryDirX) * 0.2;
        this._carryDirY += (dirY - this._carryDirY) * 0.2;
        this._carryFrames++;
      }

      var stickSp = spriteManager.getSprite(this._possessingStickId);
      if (stickSp) {
        var stickX = stickSp.position?.x ?? stickSp.x ?? 0;
        var stickY = stickSp.position?.y ?? stickSp.y ?? 0;
        var rawPx = stickX + this._possessionOffsetX;
        var rawPy = stickY + this._possessionOffsetY;
        var clampedPos = this._clampToRink(rawPx, rawPy);
        spriteManager.updateSprite(this.sprite.uniqueId, {
          positionX: clampedPos.x,
          positionY: clampedPos.y,
          velocityX: 0,
          velocityY: 0,
        });
      } else {
        // Fallback to player sprite if stick missing
        var ppx = playerSprite.position?.x ?? playerSprite.x ?? 0;
        var ppy = playerSprite.position?.y ?? playerSprite.y ?? 0;
        var rawFx = ppx + this._possessionOffsetX;
        var rawFy = ppy + this._possessionOffsetY;
        var clampedFb = this._clampToRink(rawFx, rawFy);
        spriteManager.updateSprite(this.sprite.uniqueId, {
          positionX: clampedFb.x,
          positionY: clampedFb.y,
          velocityX: 0,
          velocityY: 0,
        });
      }
      return;
    }

    // --- Boundary wall reflection ---
    const wallTop = this._wallTop;
    const wallBottom = this._wallBottom;
    // Left wall right edge: 0 + 100 = 100; Right wall left edge: 2780
    const edgeLeft = 100;
    const edgeRight = 2780 - this.hockeyPuckWidth;
    const ci = this._cornerInset;

    const vx = this.sprite.velocity.x;
    const vy = this.sprite.velocity.y;
    const px = this.sprite.position.x;
    const py = this.sprite.position.y;

    if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) {
      let newVx = vx;
      let newVy = vy;
      let bounced = false;

      // Corner chamfers — 45-degree diagonal reflection for rounded corners
      // Top-left corner
      if (
        px - edgeLeft + (py - wallTop) < ci &&
        px < edgeLeft + ci &&
        py < wallTop + ci &&
        vx + vy < 0
      ) {
        newVx = -vy;
        newVy = -vx;
        bounced = true;
      }
      // Top-right corner
      else if (
        edgeRight - px + (py - wallTop) < ci &&
        px > edgeRight - ci &&
        py < wallTop + ci &&
        vy - vx < 0
      ) {
        newVx = vy;
        newVy = vx;
        bounced = true;
      }
      // Bottom-left corner
      else if (
        px - edgeLeft + (wallBottom - py) < ci &&
        px < edgeLeft + ci &&
        py > wallBottom - ci &&
        vx - vy < 0
      ) {
        newVx = vy;
        newVy = vx;
        bounced = true;
      }
      // Bottom-right corner
      else if (
        edgeRight - px + (wallBottom - py) < ci &&
        px > edgeRight - ci &&
        py > wallBottom - ci &&
        -vx - vy < 0
      ) {
        newVx = -vy;
        newVy = -vx;
        bounced = true;
      }
      // Regular walls (not in a corner)
      else {
        // Left/right walls
        if (px <= edgeLeft && vx < 0) {
          newVx = -vx;
          bounced = true;
        }
        if (px >= edgeRight && vx > 0) {
          newVx = -vx;
          bounced = true;
        }
        // Top/bottom walls
        if (py <= wallTop && vy < 0) {
          newVy = -vy;
          bounced = true;
        }
        if (py >= wallBottom && vy > 0) {
          newVy = -vy;
          bounced = true;
        }
      }

      if (bounced) {
        this.sprite.velocity.x = newVx;
        this.sprite.velocity.y = newVy;
        // Clamp position inside bounds
        if (this.sprite.position.y < wallTop) this.sprite.position.y = wallTop;
        if (this.sprite.position.y > wallBottom)
          this.sprite.position.y = wallBottom;
        if (this.sprite.position.x < edgeLeft)
          this.sprite.position.x = edgeLeft;
        if (this.sprite.position.x > edgeRight)
          this.sprite.position.x = edgeRight;
      }
    }

    // --- Safety teleports (puck escaped far out of bounds) ---
    // Teleport to nearest artwork face-off circle based on quadrant
    const rightSideX = this.sprite.position.x + this.hockeyPuckWidth;
    const bottomSideY = this.sprite.position.y + this.hockeyPuckHeight;
    const halfW = this.experienceWidth / 2; // 1440
    const halfH = this.experienceHeight / 2; // 810

    const isTooFarLeft =
      this.sprite.position.x <= 0 - this.hockeyPuckWidth + 10;
    const isTooFarRight =
      rightSideX >= this.experienceWidth + this.hockeyPuckWidth - 10;
    const isTooFarUp = this.sprite.position.y <= 0 - this.hockeyPuckHeight + 10;
    const isTooFarDown =
      bottomSideY >= this.experienceHeight + this.hockeyPuckHeight - 10;

    if (isTooFarLeft || isTooFarRight || isTooFarUp || isTooFarDown) {
      // For demo pucks, use their dedicated respawn position
      if (this._isDemoMode === 1) {
        this._resetDemoPuck();
        return;
      }

      // Determine respawn position by quadrant
      var respawnX: number;
      var respawnY: number;
      var isCenter =
        this.sprite.position.x >= halfW * 0.75 &&
        this.sprite.position.x <= halfW * 1.25;

      if (isCenter && (isTooFarUp || isTooFarDown)) {
        // Near center-x: respawn at center ice
        respawnX = halfW - this.hockeyPuckWidth / 2;
        respawnY = halfH - this.hockeyPuckHeight / 2;
      } else if (this.sprite.position.x < halfW) {
        // Left half (offset -35 for puck top-left anchor)
        if (this.sprite.position.y <= halfH) {
          respawnX = 564;
          respawnY = 387; // top left face-off
        } else {
          respawnX = 564;
          respawnY = 1238; // bottom left face-off
        }
      } else {
        // Right half (offset -35 for puck top-left anchor)
        if (this.sprite.position.y <= halfH) {
          respawnX = 2245;
          respawnY = 384; // top right face-off
        } else {
          respawnX = 2247;
          respawnY = 1237; // bottom right face-off
        }
      }

      spriteManager.updateSprite(this.sprite.uniqueId, {
        positionX: respawnX,
        positionY: respawnY,
        velocityX: 0,
        velocityY: 0,
      });
      return;
    }
  }

  onSpriteCollisionStart({ collisionX, collisionY, sprite }) {
    if (!playerManager.isHost) return;

    //   if (this.isBetweenPlays) {
    //   return;
    // }

    if (
      this._isDemoMode !== 1 &&
      stateManager.getVariable("PuckCanCollide") === false &&
      !this.walls.includes(sprite.uniqueId) &&
      !this.hitBoxes.includes(sprite.uniqueId)
    ) {
      return;
    }

    const ball = spriteManager.getSprite(this.sprite.uniqueId);
    if (!ball.checkCollisions) {
      return;
    }
    if (sprite.uniqueId === "GoalLine1") {
      if (this._isDemoMode === 1) {
        this._resetDemoPuck();
        return;
      }
      if (this._goalScored === 1) return; // already celebrating
      this._startGoalCelebration(1);
      return;
    }
    if (sprite.uniqueId === "GoalLine2") {
      if (this._isDemoMode === 1) {
        this._resetDemoPuck();
        return;
      }
      if (this._goalScored === 1) return;
      this._startGoalCelebration(0);
      return;
    }

    // --- Goalie collision ---
    if (sprite.uniqueId.indexOf("ih_goalie_") !== -1) {
      // Cooldown after goalie just shot — prevent immediate re-catch
      if (
        this._goalieShootMs > 0 &&
        Date.now() - this._goalieShootMs < this._goalieShootCooldownMs
      ) {
        return;
      }

      var goalieTeamIdx = sprite.uniqueId.indexOf("team1") !== -1 ? 0 : 1;
      var holdingVar =
        stateManager.getVariable("GoalieHolding_" + goalieTeamIdx) || "";

      // If goalie already holding another puck, bounce off
      if (holdingVar !== "" && holdingVar !== this.sprite.uniqueId) {
        var gnx = collisionX;
        var gny = collisionY;
        var gnLen = Math.sqrt(gnx * gnx + gny * gny);
        if (gnLen > 0.001) {
          var gnnx = gnx / gnLen;
          var gnny = gny / gnLen;
          var gdot =
            this.sprite.velocity.x * gnnx + this.sprite.velocity.y * gnny;
          if (gdot < 0) {
            this.sprite.velocity.x = this.sprite.velocity.x - 2 * gdot * gnnx;
            this.sprite.velocity.y = this.sprite.velocity.y - 2 * gdot * gnny;
          }
        }
        return;
      }

      // 25% catch, 40% bounce, 35% pass through with fail animation
      var saveRoll = Math.random();
      if (saveRoll >= 0.25) {
        if (saveRoll < 0.65) {
          // Bounce off goalie
          var bnx = collisionX;
          var bny = collisionY;
          var bnLen = Math.sqrt(bnx * bnx + bny * bny);
          if (bnLen > 0.001) {
            var bnnx = bnx / bnLen;
            var bnny = bny / bnLen;
            var bdot =
              this.sprite.velocity.x * bnnx + this.sprite.velocity.y * bnny;
            if (bdot < 0) {
              this.sprite.velocity.x =
                this.sprite.velocity.x - 2 * bdot * bnnx;
              this.sprite.velocity.y =
                this.sprite.velocity.y - 2 * bdot * bnny;
            }
          }
        } else {
          // Pass through — goalie fail animation
          var failId = sprite.uniqueId;
          timerManager.animate({
            targets: [sprite],
            keyframes: {
              0: { opacity: 1, angle: 0 },
              15: { opacity: 0.3, angle: 0.4 },
              30: { opacity: 1, angle: -0.4 },
              50: { opacity: 0.2, angle: 0.6 },
              70: { opacity: 1, angle: -0.3 },
              85: { opacity: 0.5, angle: 0.1 },
              100: { opacity: 1, angle: 0 },
            },
            duration: 600,
            loop: false,
            alternate: false,
            playbackEase: "Linear",
          });
        }
        return;
      }

      // Catch the puck
      this._goalieHolding = 1;
      this._goalieTeamIndex = goalieTeamIdx;
      this._goalieCaughtMs = Date.now();
      this._goalieUniqueId = sprite.uniqueId;

      var ggx = sprite.position?.x ?? sprite.x ?? 0;
      var ggy = sprite.position?.y ?? sprite.y ?? 0;
      var gbx = this.sprite.position?.x ?? this.sprite.x ?? 0;
      var gby = this.sprite.position?.y ?? this.sprite.y ?? 0;
      this._goalieOffsetX = gbx - ggx;
      this._goalieOffsetY = gby - ggy;

      this.sprite.velocity.x = 0;
      this.sprite.velocity.y = 0;

      stateManager.setVariable(
        "GoalieHolding_" + goalieTeamIdx,
        this.sprite.uniqueId,
      );
      return;
    }
    // During goal celebration, ignore player collisions (puck still bounces off walls/hitboxes)
    if (this._goalScored === 1) return;

    // --- Stick collider collision (replaces direct player collision) ---
    if (sprite.uniqueId.indexOf("ih_stick_") !== -1) {
      // Skip if this stick has fire immunity
      if (
        sprite.uniqueId === this._immuneStickId &&
        Date.now() < this._immuneStickEndMs
      ) {
        return;
      }

      var stickPlayerIdStr = sprite.uniqueId.substring(9); // length of "ih_stick_"
      var stickPlayerId = Number(stickPlayerIdStr);

      // Validate team membership (or allow anyone in demo mode)
      var canPossess = false;
      if (this._isDemoMode === 1) {
        canPossess = true;
      } else {
        var t1 = (stateManager.getVariable("Team1") || []).map(Number);
        var t2 = (stateManager.getVariable("Team2") || []).map(Number);
        canPossess =
          t1.indexOf(stickPlayerId) !== -1 || t2.indexOf(stickPlayerId) !== -1;
      }

      if (!canPossess) {
        console.log("PUCK: canPossess FAILED for stick player", stickPlayerId, "t1:", t1, "t2:", t2);
        return;
      }

      // If goalie is holding puck, no player can steal it
      if (this._goalieHolding === 1) return;

      // Same player already possessing — ignore
      if (this._possessingPlayerId === stickPlayerIdStr) return;

      // Cooldown — kicker can't re-catch their own shot
      if (
        stickPlayerIdStr === this._lastFiredPlayerId &&
        Date.now() - this._lastFiredMs < this._fireCooldownMs
      ) {
        return;
      }

      // Read control scheme for this player
      var allSchemes = stateManager.getVariable("ControlSchemes") || {};
      var controlScheme = allSchemes[stickPlayerId] || "mouse";

      // Stick collider center
      var stickX = sprite.position?.x ?? sprite.x ?? 0;
      var stickY = sprite.position?.y ?? sprite.y ?? 0;
      var stickW = sprite.width ?? 40;
      var stickH = sprite.height ?? 30;
      var stickCenterX = stickX + stickW / 2;
      var stickCenterY = stickY + stickH / 2;

      // Puck center
      var puckX = this.sprite.position?.x ?? this.sprite.x ?? 0;
      var puckY = this.sprite.position?.y ?? this.sprite.y ?? 0;
      var puckCenterX = puckX + this.hockeyPuckWidth / 2;
      var puckCenterY = puckY + this.hockeyPuckHeight / 2;

      if (controlScheme === "keyboard") {
        // Break existing possession so the bounce takes effect (steal)
        if (this._possessingPlayerId !== "" && this._possessingPlayerId !== stickPlayerIdStr) {
          this._possessingPlayerId = "";
          this._possessingPlayerLookupId = "";
          this._possessingStickId = "";
          this._possessionStartMs = 0;
          this._carryDirX = 0;
          this._carryDirY = 0;
          this._carryFrames = 0;
          this._windUpActive = 0;
          this._windUpStartMs = 0;
          this._windUpDirX = 0;
          this._windUpDirY = 0;
        }

        // Keyboard mode: bounce puck based on center-to-center direction (no possession)
        var bounceAngle = Math.atan2(puckCenterY - stickCenterY, puckCenterX - stickCenterX);
        this.sprite.velocity.x = Math.cos(bounceAngle) * this.highSpeed;
        this.sprite.velocity.y = Math.sin(bounceAngle) * this.highSpeed;
        this.sprite.friction.x = 0.96;
        this.sprite.friction.y = 0.96;

        // Teleport puck past the stick
        var kbNudge = Math.max(stickW, stickH) + 20;
        this.sprite.position.x = this.sprite.position.x + Math.cos(bounceAngle) * kbNudge;
        this.sprite.position.y = this.sprite.position.y + Math.sin(bounceAngle) * kbNudge;

        // Immunity + flash for this stick
        this._immuneStickId = sprite.uniqueId;
        this._immuneStickEndMs = Date.now() + 1000;
        timerManager.animate({
          targets: [sprite],
          keyframes: {
            0: { opacity: 0.3 },
            25: { opacity: 0.8 },
            50: { opacity: 0.3 },
            75: { opacity: 0.8 },
            100: { opacity: 1 },
          },
          duration: 1000,
          loop: false,
          alternate: false,
          playbackEase: "Linear",
        });

        this.lastPlayerTouch = stickPlayerId;
        this._lastFiredPlayerId = stickPlayerIdStr;
        this._lastFiredMs = Date.now();
        return;
      }

      // Mouse mode: gain possession
      var playerSprite = spriteManager.getSprite(String(stickPlayerId));

      this._possessingPlayerId = stickPlayerIdStr;
      this._possessingPlayerLookupId = String(stickPlayerId);
      this._possessingStickId = sprite.uniqueId;
      this._possessionStartMs = Date.now();
      this._initialSyncMovedOn = playerSprite?._syncMovedOn ?? "";
      this._initialMoveToX = playerSprite?.moveTo?.x ?? 0;
      this._initialMoveToY = playerSprite?.moveTo?.y ?? 0;
      this._possessionOffsetX = puckX - stickX;
      this._possessionOffsetY = puckY - stickY;

      // Reset carry/wind-up state for new possession
      this._carryDirX = 0;
      this._carryDirY = 0;
      this._carryFrames = 0;
      this._windUpActive = 0;
      this._windUpStartMs = 0;
      this._windUpDirX = 0;
      this._windUpDirY = 0;

      this.sprite.velocity.x = 0;
      this.sprite.velocity.y = 0;

      this.lastPlayerTouch = stickPlayerId;
      return;
    }
    if (
      this.walls.includes(sprite.uniqueId) ||
      this.hitBoxes.includes(sprite.uniqueId)
    ) {
      // Proper vector reflection — preserves incoming speed
      const nx = collisionX;
      const ny = collisionY;
      const nLen = Math.sqrt(nx * nx + ny * ny);
      if (nLen > 0.001) {
        const nnx = nx / nLen;
        const nny = ny / nLen;
        const cvx = this.sprite.velocity.x;
        const cvy = this.sprite.velocity.y;
        const dot = cvx * nnx + cvy * nny;
        if (dot < 0) {
          // Reflect: v' = v - 2(v·n)n
          this.sprite.velocity.x = cvx - 2 * dot * nnx;
          this.sprite.velocity.y = cvy - 2 * dot * nny;
        }
      }
      this.sprite.friction.x = 0.98;
      this.sprite.friction.y = 0.98;
    }
  }

  async onEvent_playerScored({ teamIndex, playerId }) {
    // Demo pucks don't participate in scoring events
    if (this._isDemoMode === 1) return;

    // Clear goal celebration state
    this._goalScored = 0;
    this._goalScoredMs = 0;
    this._goalScoredTeamIndex = -1;

    // Clear player possession
    this._possessingPlayerId = "";
    this._possessingPlayerLookupId = "";
    this._possessingStickId = "";
    this._possessionStartMs = 0;

    // Clear goalie possession
    if (this._goalieHolding === 1) {
      stateManager.setVariable("GoalieHolding_" + this._goalieTeamIndex, "");
      this._goalieHolding = 0;
      this._goalieUniqueId = "";
    }

    stateManager.setVariable("PuckCanCollide", false);
    // async function updateCollisions(){
    //   await spriteManager.updateSprite(this.sprite.uniqueId, {checkCollisions: false});
    // }

    //await spriteManager.updateSprite(this.sprite.uniqueId, {checkCollisions: false});
    //this.sprite.checkCollisions = false;
    // this.sprite.velocity.x = 0;
    // this.sprite.velocity.y = 0;
    // this.sprite.friction.x = 1;
    // this.sprite.friction.y = 1;
    const scores = stateManager.getVariable("Scores");
    const team1 = (stateManager.getVariable("Team1") || []).map(Number);
    const team2 = (stateManager.getVariable("Team2") || []).map(Number);
    let goalMapping = stateManager.getVariable("playerToGoalsMapping");
    //team 1 scored
    if (teamIndex === 0) {
      scores[0]++;
      spriteManager.updateSprite("team1Score", { text: `${scores[0]}` });
      if (team1.indexOf(Number(playerId)) !== -1) {
        goalMapping[playerId]
          ? goalMapping[playerId]++
          : (goalMapping[playerId] = 1);
        stateManager.setVariable("playerToGoalsMapping", goalMapping);
      }
    }
    //team 2 scored
    else if (teamIndex === 1) {
      scores[1]++;
      spriteManager.updateSprite("team2Score", { text: `${scores[1]}` });
      if (team2.indexOf(Number(playerId)) !== -1) {
        goalMapping[playerId]
          ? goalMapping[playerId]++
          : (goalMapping[playerId] = 1);
        stateManager.setVariable("playerToGoalsMapping", goalMapping);
      }
    }

    stateManager.setVariable("Scores", scores);

    // --- Score threshold analytics ---
    var thresholds = [1, 5, 10, 15, 20, 25];
    var newScore = scores[teamIndex];
    for (var ti = 0; ti < thresholds.length; ti++) {
      if (newScore === thresholds[ti]) {
        try {
          var analyticsKey = stateManager.getVariable("PublicKey");
          if (analyticsKey) {
            integrationsManager.putPublicKeyAnalytics({
              interactivePublicKey: analyticsKey,
              analytics: [
                { analyticName: "ihScoredThreshold" + thresholds[ti] },
              ],
            });
          }
        } catch (e) {
          /* never break gameplay */
        }
        break;
      }
    }

    // Particle effects already fired immediately in _startGoalCelebration

    if (stateManager.getVariable("Scores")[teamIndex] >= 5) {
      const color = teamIndex === 0 ? "Blue" : "Red";
      const winningText = `Team ${teamIndex + 1} (${color} team)  has won Hockey!`;
      // Show winner in player-following panel
      stateManager.setVariable("MenuState", "GAME_OVER");
      stateManager.setVariable("MenuActionText", winningText);
      stateManager.setVariable("MenuDetailText", "Game Resetting in: 7");

      eventManager.emit("teamWon", {});
      return;
    }


    timerManager.createTimer({
      //delay: 1.0,
      duration: 350,
      autoplay: true,
      loop: false,

      onBegin: (timer) => {},

      onUpdate: (timer) => {
        // optional
      },

      onComplete: (timer) => {
        // Guard: puck sprite may have been destroyed if game ended during this timer
        if (!spriteManager.getSprite(this.sprite.uniqueId)) {
          return;
        }
        this.handleTimerComplete(timer);
      },
    });

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

  teleportTeams() {
    const team1 = (stateManager.getVariable("Team1") || []).map(Number);
    var t1Pos = this._shuffleArray(this._getFormationPositions(0, team1.length));
    for (let i = 0; i < team1.length; i++) {
      var pos1 = t1Pos[i] || { x: 1515, y: 830 };
      playerManager.teleportPlayers([team1[i]], {
        distributionType: "area" as const,
        positionX: pos1.x,
        positionY: pos1.y,
        height: 0,
        width: 0,
      });
    }

    const team2 = (stateManager.getVariable("Team2") || []).map(Number);
    var t2Pos = this._shuffleArray(this._getFormationPositions(1, team2.length));
    for (let i = 0; i < team2.length; i++) {
      var pos2 = t2Pos[i] || { x: 1365, y: 830 };
      playerManager.teleportPlayers([team2[i]], {
        distributionType: "area" as const,
        positionX: pos2.x,
        positionY: pos2.y,
        height: 0,
        width: 0,
      });
    }
  }

  async animateWaitingBall() {
    //const keyFrame0 = (teamIndex === 0) ? {}
    await timerManager.animate({
      targets: [this.sprite],
      keyframes: {
        // 0: { positionX: this.experienceWidth/2 - this.hockeyPuckWidth/2, positionY: this.experienceHeight / 2 - (this.hockeyPuckHeight/2), frictionX: 1, frictionY: 1, velocityX:0, velocityY:0 },
        // 50: {positionX: + 0, positionY: + 0},
        100: {
          positionX: this.experienceWidth / 2 - this.hockeyPuckWidth / 2,
          positionY: this.experienceHeight / 2 - this.hockeyPuckHeight / 2,
          frictionX: 1,
          frictionY: 1,
          velocityX: 0,
          velocityY: 0,
        },
      },
      duration: 100,
      loop: false,
      alternate: false,
      playbackEase: "Linear",
      onUpdate: () => {
        if (!playerManager.isHost) return;
      },
      onComplete: () => {
        if (!playerManager.isHost) return;
        // this.sprite.position.x = 0;
        // this.sprite.position.y = 0;
        // this.sprite.velocity.y = 0;
        // this.sprite.velocity.x = 0;
        this.teleportTeams();
        // async function moveSpriteToMidline(){
        //   await spriteManager.updateSprite(this.sprite.uniqueId, {positionX: this.experienceWidth/2 - this.hockeyPuckWidth/2, positionY: this.experienceHeight / 2 - (this.hockeyPuckHeight/2)/*, velocityX:0, velocityY:0*/});
        //moveSpriteToMidline();
        spriteManager.updateSprite(this.sprite.uniqueId, {
          positionX: this.experienceWidth / 2 - this.hockeyPuckWidth / 2,
          positionY: this.experienceHeight / 2 - this.hockeyPuckHeight / 2,
        });
      },
      then: () => {
        spriteManager.updateSprite(this.sprite.uniqueId, {
          checkCollisions: true,
          positionX: this.experienceWidth / 2 - this.hockeyPuckWidth / 2,
          positionY: this.experienceHeight / 2 - this.hockeyPuckHeight / 2,
        });
        stateManager.setVariable("PuckCanCollide", true);
      },
      onBegin: () => {},
    });
  }

  async handleTimerComplete(timer) {
    if (!playerManager.isHost) return;

    // Guard: puck sprite may have been destroyed if game ended
    if (!spriteManager.getSprite(this.sprite.uniqueId)) {
      return;
    }

    // Clear player possession for fresh face-off
    this._possessingPlayerId = "";
    this._possessingPlayerLookupId = "";
    this._possessingStickId = "";
    this._possessionStartMs = 0;

    this.teleportTeams();

    await spriteManager.updateSprite(this.sprite.uniqueId, {
      positionX: this.experienceWidth / 2 - this.hockeyPuckWidth / 2,
      positionY: this.experienceHeight / 2 - this.hockeyPuckHeight / 2,
      velocityX: 0,
      velocityY: 0,
      frictionX: 0,
      frictionY: 0,
    });

    const ball = spriteManager.getSprite(this.sprite.uniqueId);
    if (!ball) return;
    await stateManager.setVariable("PuckCanCollide", true);
  }

  _startGoalCelebration(teamIndex: number) {
    this._goalScored = 1;
    this._goalScoredMs = Date.now();
    this._goalScoredTeamIndex = teamIndex;

    // Clear player possession
    this._possessingPlayerId = "";
    this._possessingPlayerLookupId = "";
    this._possessingStickId = "";
    this._possessionStartMs = 0;

    // Clear goalie hold
    if (this._goalieHolding === 1) {
      stateManager.setVariable("GoalieHolding_" + this._goalieTeamIndex, "");
      this._goalieHolding = 0;
      this._goalieUniqueId = "";
    }

    // Dramatically reduce puck velocity so it clatters inside the net
    this.sprite.velocity.x = this.sprite.velocity.x * 0.15;
    this.sprite.velocity.y = this.sprite.velocity.y * 0.15;
    this.sprite.friction.x = 0.85;
    this.sprite.friction.y = 0.85;

    // Fire particle effects immediately so the goal feels impactful
    this._fireGoalParticles(teamIndex);
  }

  _fireGoalParticles(teamIndex: number) {
    var publicKey = stateManager.getVariable("PublicKey");

    // Burst confetti on the goal that was scored on
    // Team 0 scores → puck entered left goal (GoalLine2), Team 1 scores → right goal (GoalLine1)
    var goalX = teamIndex === 0 ? 243 : 2630;
    var goalY = teamIndex === 0 ? 912 : 904;
    try {
      integrationsManager.triggerParticleEffect({
        particleName: "classicConfetti_explosion",
        position: { x: goalX, y: goalY },
        duration: 2.0,
        interactivePublicKey: publicKey,
      });
    } catch (e) {
      /* ignore */
    }

    var scoringTeamVar = teamIndex === 0 ? "Team1" : "Team2";
    var concedingTeamVar = teamIndex === 0 ? "Team2" : "Team1";
    var scoringPlayers = stateManager.getVariable(scoringTeamVar) || [];
    var concedingPlayers = stateManager.getVariable(concedingTeamVar) || [];
    if (scoringPlayers.toArray) scoringPlayers = scoringPlayers.toArray();
    if (concedingPlayers.toArray) concedingPlayers = concedingPlayers.toArray();

    for (var si = 0; si < scoringPlayers.length; si++) {
      try {
        var sDet = playerManager.getPlayerDetails(scoringPlayers[si]);
        if (sDet) {
          integrationsManager.triggerParticleEffect({
            particleName: "classicConfetti_explosion",
            position: { x: sDet.x, y: sDet.y },
            duration: 1.5,
            followPlayerId: scoringPlayers[si],
            interactivePublicKey: publicKey,
          });
        }
      } catch (e) {
        /* ignore */
      }
    }
    for (var ci = 0; ci < concedingPlayers.length; ci++) {
      try {
        var cDet = playerManager.getPlayerDetails(concedingPlayers[ci]);
        if (cDet) {
          integrationsManager.triggerParticleEffect({
            particleName: "blackSmoke_puff",
            position: { x: cDet.x, y: cDet.y },
            duration: 1.5,
            followPlayerId: concedingPlayers[ci],
            interactivePublicKey: publicKey,
          });
        }
      } catch (e) {
        /* ignore */
      }
    }
  }

  _goalieShoot() {
    var gameStarted = stateManager.getVariable("GameStarted") === true;
    var spx = this.sprite.position?.x ?? this.sprite.x ?? 0;
    var spy = this.sprite.position?.y ?? this.sprite.y ?? 0;

    var bestAngle: number;
    var speed: number;

    if (!gameStarted) {
      // Free skate: pass toward the nearest player
      var playerIds = playerManager.getPlayerIds();
      if (playerIds && playerIds.toArray) playerIds = playerIds.toArray();
      var nearestDist = 999999;
      var nearestAngle = this._goalieTeamIndex === 0 ? Math.PI : 0;

      for (var pi = 0; pi < playerIds.length; pi++) {
        var pDet = playerManager.getPlayerDetails(playerIds[pi]);
        if (!pDet) continue;
        var pdx = pDet.x - spx;
        var pdy = pDet.y - spy;
        var pDist = pdx * pdx + pdy * pdy;
        if (pDist < nearestDist) {
          nearestDist = pDist;
          nearestAngle = Math.atan2(pdy, pdx);
        }
      }

      // Gentle pass speed
      bestAngle = nearestAngle;
      speed = this.highSpeed * 0.6;
    } else {
      // Game mode: shoot away from opponents
      var baseAngle = this._goalieTeamIndex === 0 ? Math.PI : 0;
      speed = this.highSpeed;

      var opponentTeamVar = this._goalieTeamIndex === 0 ? "Team2" : "Team1";
      var opponents = stateManager.getVariable(opponentTeamVar) || [];
      if (opponents.toArray) opponents = opponents.toArray();
      bestAngle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.6;

      for (var attempt = 0; attempt < 3; attempt++) {
        var candidateAngle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.6;
        var blocked = false;

        for (var oi = 0; oi < opponents.length; oi++) {
          var oppSprite = spriteManager.getSprite(String(opponents[oi]));
          if (!oppSprite) continue;
          var ox = oppSprite.position?.x ?? oppSprite.x ?? 0;
          var oy = oppSprite.position?.y ?? oppSprite.y ?? 0;

          var projX = spx + Math.cos(candidateAngle) * 500;
          var projY = spy + Math.sin(candidateAngle) * 500;
          var dxOpp = ox - projX;
          var dyOpp = oy - projY;
          if (Math.sqrt(dxOpp * dxOpp + dyOpp * dyOpp) < 200) {
            blocked = true;
            break;
          }
        }

        if (!blocked) {
          bestAngle = candidateAngle;
          break;
        }
      }
    }

    // Release goalie hold
    stateManager.setVariable("GoalieHolding_" + this._goalieTeamIndex, "");
    this._goalieHolding = 0;
    this._goalieUniqueId = "";

    // Clear player possession
    this._possessingPlayerId = "";
    this._possessingPlayerLookupId = "";
    this._possessingStickId = "";
    this._possessionStartMs = 0;

    // Fire puck — set goalie shoot cooldown so puck isn't re-caught immediately
    this._goalieShootMs = Date.now();
    this._lastFiredPlayerId = "";
    this._lastFiredMs = Date.now();
    this.sprite.velocity.x = Math.cos(bestAngle) * speed;
    this.sprite.velocity.y = Math.sin(bestAngle) * speed;
    this.sprite.friction.x = 0.96;
    this.sprite.friction.y = 0.96;

  }

  _resetDemoPuck() {
    // Clear player possession
    this._possessingPlayerId = "";
    this._possessingPlayerLookupId = "";
    this._possessingStickId = "";
    this._possessionStartMs = 0;

    if (this._goalieHolding === 1) {
      stateManager.setVariable("GoalieHolding_" + this._goalieTeamIndex, "");
      this._goalieHolding = 0;
      this._goalieUniqueId = "";
    }

    // Find closest face-off circle to nearest player
    var faceOff = [
      { x: 564, y: 387 },
      { x: 564, y: 1238 },
      { x: 2245, y: 384 },
      { x: 2247, y: 1237 },
    ];
    var respawnX = this._demoRespawnX;
    var respawnY = this._demoRespawnY;

    var playerIds = playerManager.getPlayerIds();
    if (playerIds && playerIds.toArray) playerIds = playerIds.toArray();
    if (playerIds.length > 0) {
      var bestDist = 999999999;
      for (var fi = 0; fi < faceOff.length; fi++) {
        for (var pi = 0; pi < playerIds.length; pi++) {
          var det = playerManager.getPlayerDetails(playerIds[pi]);
          if (!det) continue;
          var dx = faceOff[fi].x - det.x;
          var dy = faceOff[fi].y - det.y;
          var dist = dx * dx + dy * dy;
          if (dist < bestDist) {
            bestDist = dist;
            respawnX = faceOff[fi].x;
            respawnY = faceOff[fi].y;
          }
        }
      }
    }

    this._demoRespawnX = respawnX;
    this._demoRespawnY = respawnY;

    spriteManager.updateSprite(this.sprite.uniqueId, {
      positionX: respawnX,
      positionY: respawnY,
      velocityX: 0,
      velocityY: 0,
    });
  }

  private sleepSeconds(sec: number): Promise<void> {
    return new Promise((resolve) => {
      timerManager.createTimer({
        delay: sec,
        duration: 0,
        autoplay: true,
        loop: false,
        onComplete: () => {
          resolve();
        },
      });
    });
  }
}
