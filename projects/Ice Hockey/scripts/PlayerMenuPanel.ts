class PlayerMenuPanel extends SystemScript {
  _expanded: boolean;
  _lastMenuState: string;
  _lastActionText: string;
  _lastDetailText: string;
  _lastPlayerX: number;
  _lastPlayerY: number;
  _anchorX: number;
  _anchorY: number;
  _panelCreated: boolean;
  _panelPositioned: boolean;
  _settledFrames: number;

  // Control scheme
  _controlScheme: string;

  // Panel dimensions
  _panelWidth: number;
  _rowHeight: number;
  _toggleWidth: number;
  _detailHeight: number;
  _panelGap: number;

  // Centralized copy
  _copy: Record<string, Record<string, string>>;

  onInit() {
    this._expanded = false;
    this._lastMenuState = "";
    this._lastActionText = "";
    this._lastDetailText = "";
    this._lastPlayerX = -9999;
    this._lastPlayerY = -9999;
    this._anchorX = -9999;
    this._anchorY = -9999;
    this._panelCreated = false;
    this._panelPositioned = false;
    this._settledFrames = 0;

    this._controlScheme = "mouse";

    this._panelWidth = 320;
    this._rowHeight = 42;
    this._toggleWidth = 60;
    this._detailHeight = 120;
    this._panelGap = 20;

    this._copy = {
      toggle: {
        collapsed: "\uD83C\uDFAE ?",
        expanded: "\uD83C\uDFAE \u2715",
      },
      mode: {
        mouse: "Control: Carry — pick up & carry the puck",
        keyboard: "Control: Slap Shot — skate into the puck to hit it",
      },
      explainer: {
        readyToStart: "Click the button to start the game!",
      },
      waitingForPlayers: {
        action: "\uD83C\uDFD2 Free Skate",
        detail: "This is ice hockey! You can shoot pucks and practice.\nWe recommend using a mouse.\nWhen another person joins, you can start a match!",
      },
      readyToStart: {
        action: "Click here to Start Game",
        detail: "\uD83C\uDFD2 Free Skate\nYou can shoot pucks and practice.\nWe recommend using a mouse.",
      },
      gameActive: {
        action: "",
        detail: "Score 5 goals first to win or have more goals than the other team before the timer runs out!",
      },
      gameEnding: {
        action: "GAME ENDING",
      },
      gameOver: {
        winBlue: "Team 1 (Blue team) has won hockey!",
        winRed: "Team 2 (Red team) has won hockey!",
        tie: "Team 1 (Blue team) and Team 2 (Red team) have tied!",
        resetCountdown: "Game Resetting in: ",
      },
    };

    // Tell the host our default control scheme
    var myId = playerManager.getMyPlayerId();
    if (myId) {
      eventManager.emit("controlSchemeChanged", {
        playerId: myId,
        scheme: "mouse",
      });
    }

    this._createPanelSprites();
  }

  onPlayerStart() {
    if (!this._panelCreated) this._createPanelSprites();
  }

  onHostStart() {
    if (!this._panelCreated) this._createPanelSprites();
  }

  _createPanelSprites() {
    if (this._panelCreated) return;
    this._panelCreated = true;

    // Panel background (single row: action text + toggle side-by-side)
    spriteManager.addSprite("LeftWall", {
      uniqueId: "ih_panel_bg",
      isPlayerControlled: true,
      isInteractive: true,
      allowSpectatorInteraction: true,
      width: this._panelWidth,
      height: this._rowHeight,
      fill: "#1a1a2e",
      opacity: 0,
      borderRadius: 8,
      positionX: -500,
      positionY: -500,
      topAdjust: 1,
      displayLayer: "TOP",
    });

    // Action button background (rect with border radius for pill shape)
    spriteManager.addSprite("LeftWall", {
      uniqueId: "ih_action_bg",
      isPlayerControlled: true,
      width: this._panelWidth - this._toggleWidth - 15,
      height: 34,
      fill: "#4CAF50",
      opacity: 0,
      borderRadius: 17,
      positionX: -500,
      positionY: -500,
      topAdjust: 50,
      displayLayer: "TOP",
    });

    // Action button text
    spriteManager.addSprite("startGame", {
      uniqueId: "ih_action_text",
      isPlayerControlled: true,
      isInteractive: true,
      allowSpectatorInteraction: true,
      text: "",
      fontSize: 16,
      fontColor: "#FFFFFF",
      containerWidth: this._panelWidth - this._toggleWidth - 35,
      opacity: 0,
      positionX: -500,
      positionY: -500,
      topAdjust: 100,
      displayLayer: "TOP",
    });

    // Toggle background (rounded rect — larger click target)
    spriteManager.addSprite("LeftWall", {
      uniqueId: "ih_toggle_bg",
      isPlayerControlled: true,
      isInteractive: true,
      allowSpectatorInteraction: true,
      width: 55,
      height: 36,
      fill: "#1a1a2e",
      borderRadius: 8,
      opacity: 0,
      positionX: -500,
      positionY: -500,
      topAdjust: 50,
      displayLayer: "TOP",
    });

    // Expand/collapse toggle text (sits on top of ellipse)
    spriteManager.addSprite("IntroText", {
      uniqueId: "ih_toggle_text",
      isPlayerControlled: true,
      text: this._copy.toggle.collapsed,
      fontSize: 22,
      fontColor: "#FFFFFF",
      containerWidth: 55,
      opacity: 0,
      positionX: -500,
      positionY: -500,
      topAdjust: 100,
      displayLayer: "TOP",
    });

    // Detail area background (expanded section below the row)
    spriteManager.addSprite("LeftWall", {
      uniqueId: "ih_detail_bg",
      isPlayerControlled: true,
      width: this._panelWidth,
      height: this._detailHeight,
      fill: "#1a1a2e",
      opacity: 0,
      borderRadius: 8,
      positionX: -500,
      positionY: -500,
      topAdjust: 1,
      displayLayer: "TOP",
    });

    // Detail text (instructions / countdown)
    spriteManager.addSprite("IntroText", {
      uniqueId: "ih_detail_text",
      isPlayerControlled: true,
      text: "",
      fontSize: 18,
      fontColor: "#CCCCCC",
      containerWidth: this._panelWidth - 20,
      opacity: 0,
      positionX: -500,
      positionY: -500,
      topAdjust: 100,
      displayLayer: "TOP",
    });

    // Control scheme toggle button background
    spriteManager.addSprite("LeftWall", {
      uniqueId: "ih_mode_bg",
      isPlayerControlled: true,
      isInteractive: true,
      allowSpectatorInteraction: true,
      width: this._panelWidth,
      height: 34,
      fill: "#2a2a4e",
      opacity: 0,
      borderRadius: 17,
      positionX: -500,
      positionY: -500,
      topAdjust: 50,
      displayLayer: "TOP",
    });

    // Control scheme toggle text
    spriteManager.addSprite("IntroText", {
      uniqueId: "ih_mode_text",
      isPlayerControlled: true,
      isInteractive: true,
      allowSpectatorInteraction: true,
      text: this._copy.mode.mouse,
      fontSize: 14,
      fontColor: "#FFFFFF",
      containerWidth: this._panelWidth - 20,
      opacity: 0,
      positionX: -500,
      positionY: -500,
      topAdjust: 100,
      displayLayer: "TOP",
    });

  }

  onPhysicsStep(deltaTime: number) {
    var myId = playerManager.getMyPlayerId();
    if (!myId) return;

    var details = playerManager.getPlayerDetails(myId);
    if (!details) return;

    var menuState = stateManager.getVariable("MenuState") || "";
    var actionText = stateManager.getVariable("MenuActionText") || "";
    var detailText = stateManager.getVariable("MenuDetailText") || "";

    // Detect state/content changes
    var stateChanged =
      menuState !== this._lastMenuState ||
      actionText !== this._lastActionText ||
      detailText !== this._lastDetailText;

    if (stateChanged) {
      // Auto-expand only for host start button and game over; collapse otherwise
      if (menuState !== this._lastMenuState) {
        if (menuState === "READY_TO_START") {
          this._expanded = true;
        } else if (menuState === "GAME_ENDING") {
          this._expanded = true;
        } else if (menuState === "GAME_OVER") {
          this._expanded = true;
        } else {
          this._expanded = false;
        }
      }
      this._lastMenuState = menuState;
      this._lastActionText = actionText;
      this._lastDetailText = detailText;
    }

    // Movement detection using anchor-based dead zone + settled timer
    var px = details.x;
    var py = details.y;
    var dxFrame = px - this._lastPlayerX;
    var dyFrame = py - this._lastPlayerY;
    var frameDist = dxFrame * dxFrame + dyFrame * dyFrame;

    // Check if player drifted outside the anchor band
    var dxAnchor = px - this._anchorX;
    var dyAnchor = py - this._anchorY;
    if (
      this._panelPositioned &&
      dxAnchor * dxAnchor + dyAnchor * dyAnchor > 100
    ) {
      // Player walked away from anchor — collapse and hide panel
      this._expanded = false;
      this._panelPositioned = false;
      this._settledFrames = 0;
      this._hideAllSprites();
    }

    // Count consecutive "still" frames (frame-to-frame jitter within threshold)
    if (frameDist <= 10) {
      this._settledFrames++;
    } else {
      this._settledFrames = 0;
      // If panel was showing but big frame jump, collapse and hide
      if (this._panelPositioned) {
        this._expanded = false;
        this._panelPositioned = false;
        this._hideAllSprites();
      }
    }

    // Show panel after ~15 settled frames (~500ms at 30fps)
    if (!this._panelPositioned && this._settledFrames >= 15) {
      // Re-apply auto-expand for states that warrant it (in case movement reset it)
      if (menuState === "READY_TO_START") {
        this._expanded = true;
      } else if (menuState === "GAME_ENDING") {
        this._expanded = true;
      } else if (menuState === "GAME_OVER") {
        this._expanded = true;
      }

      this._anchorX = px;
      this._anchorY = py;
      this._panelPositioned = true;
      this._updateContent(menuState, actionText, detailText);
      this._updatePositions(px - this._panelGap, py - 20);
    } else if (this._panelPositioned && stateChanged) {
      // Panel already visible but state changed — refresh content only
      this._updateContent(menuState, actionText, detailText);
    }

    this._lastPlayerX = px;
    this._lastPlayerY = py;
  }

  _buildDetailText(
    menuState: string,
    actionText: string,
    detailText: string,
  ): string {
    var explainer = "";

    if (menuState === "READY_TO_START") {
      explainer = this._copy.explainer.readyToStart + "\n\n";
    }

    if (explainer && detailText) {
      return explainer + detailText;
    }
    return explainer || detailText;
  }

  _updateContent(menuState: string, actionText: string, detailText: string) {
    var toggleLabel = this._expanded ? this._copy.toggle.expanded : this._copy.toggle.collapsed;
    var fullDetailText = this._buildDetailText(
      menuState,
      actionText,
      detailText,
    );

    if (menuState === "GAME_ACTIVE") {
      // Collapse to just the toggle
      this._hideSprite("ih_panel_bg");
      this._hideSprite("ih_action_bg");
      this._hideSprite("ih_action_text");
      this._showSprite("ih_toggle_bg");
      this._showSprite("ih_toggle_text");
      spriteManager.updateSprite("ih_toggle_text", { text: toggleLabel });

      if (this._expanded) {
        if (detailText) {
          this._showSprite("ih_detail_bg");
          this._showSprite("ih_detail_text");
          spriteManager.updateSprite("ih_detail_text", { text: detailText });
        } else {
          this._hideSprite("ih_detail_bg");
          this._hideSprite("ih_detail_text");
        }
        this._showModeToggle();
      } else {
        this._hideSprite("ih_detail_bg");
        this._hideSprite("ih_detail_text");
        this._hideSprite("ih_mode_bg");
        this._hideSprite("ih_mode_text");
      }
      return;
    }

    if (menuState === "WAITING_FOR_PLAYERS") {
      // Collapsed: just the toggle icon
      this._hideSprite("ih_panel_bg");
      this._hideSprite("ih_action_bg");
      this._hideSprite("ih_action_text");
      this._showSprite("ih_toggle_bg");
      this._showSprite("ih_toggle_text");
      spriteManager.updateSprite("ih_toggle_text", { text: toggleLabel });

      if (this._expanded) {
        this._showSprite("ih_detail_bg");
        this._showSprite("ih_detail_text");
        spriteManager.updateSprite("ih_detail_text", { text: fullDetailText });
        this._showModeToggle();
      } else {
        this._hideSprite("ih_detail_bg");
        this._hideSprite("ih_detail_text");
        this._hideSprite("ih_mode_bg");
        this._hideSprite("ih_mode_text");
      }
      return;
    }

    if (menuState === "READY_TO_START") {
      this._showSprite("ih_toggle_bg");
      this._showSprite("ih_toggle_text");
      spriteManager.updateSprite("ih_toggle_text", { text: toggleLabel });

      if (this._expanded) {
        // Expanded: show start button for any player
        this._showSprite("ih_panel_bg", 0.85);
        this._showSprite("ih_action_bg");
        this._showSprite("ih_action_text");
        spriteManager.updateSprite("ih_action_text", {
          text: actionText,
          fontColor: "#FFFFFF",
        });
        this._showSprite("ih_detail_bg");
        this._showSprite("ih_detail_text");
        spriteManager.updateSprite("ih_detail_text", { text: fullDetailText });
        this._showModeToggle();
      } else {
        // Collapsed: just the toggle icon
        this._hideSprite("ih_panel_bg");
        this._hideSprite("ih_action_bg");
        this._hideSprite("ih_action_text");
        this._hideSprite("ih_detail_bg");
        this._hideSprite("ih_detail_text");
        this._hideSprite("ih_mode_bg");
        this._hideSprite("ih_mode_text");
      }
      return;
    }

    if (menuState === "GAME_ENDING") {
      // Final countdown — prominent display with red warning
      this._showSprite("ih_panel_bg", 0.9);
      this._showSprite("ih_action_bg");
      this._showSprite("ih_action_text");
      this._showSprite("ih_toggle_bg");
      this._showSprite("ih_toggle_text");
      spriteManager.updateSprite("ih_action_bg", { fill: "#CC0000" });
      spriteManager.updateSprite("ih_action_text", {
        text: this._copy.gameEnding.action,
        fontColor: "#FFFFFF",
      });
      spriteManager.updateSprite("ih_toggle_text", { text: toggleLabel });

      if (detailText) {
        this._showSprite("ih_detail_bg");
        this._showSprite("ih_detail_text");
        spriteManager.updateSprite("ih_detail_text", {
          text: detailText,
          fontColor: "#FF4444",
          fontSize: 28,
        });
      }
      this._hideSprite("ih_mode_bg");
      this._hideSprite("ih_mode_text");
      return;
    }

    if (menuState === "GAME_OVER") {
      // Show winner text + reset countdown
      this._showSprite("ih_panel_bg", 0.85);
      this._hideSprite("ih_action_bg");
      this._showSprite("ih_action_text");
      this._showSprite("ih_toggle_bg");
      this._showSprite("ih_toggle_text");
      // Restore action bg color for future states
      spriteManager.updateSprite("ih_action_bg", { fill: "#4CAF50" });
      spriteManager.updateSprite("ih_action_text", {
        text: actionText,
        fontColor: "#FFD700",
      });
      spriteManager.updateSprite("ih_toggle_text", { text: toggleLabel });

      // Always show the countdown detail in GAME_OVER
      if (detailText) {
        this._showSprite("ih_detail_bg");
        this._showSprite("ih_detail_text");
        spriteManager.updateSprite("ih_detail_text", {
          text: detailText,
          fontColor: "#CCCCCC",
          fontSize: 18,
        });
      }
      this._showModeToggle();
      return;
    }

    // No valid state — hide everything
    this._hideAllSprites();
  }

  // panelX = right edge anchor (just left of player), content grows leftward
  _updatePositions(panelX: number, panelY: number) {
    var menuState = this._lastMenuState;
    var tw = this._toggleWidth; // 60
    var pw = this._panelWidth; // 320
    var offscreen = -500;

    // Toggle position (rightmost element, closest to player)
    var toggleX = panelX - tw;
    var toggleY = panelY + 10;

    // Collapsed states: just the toggle icon
    if (!this._expanded && menuState !== "GAME_OVER" && menuState !== "GAME_ENDING") {
      spriteManager.updateSprite("ih_toggle_bg", {
        positionX: toggleX,
        positionY: toggleY,
      });
      spriteManager.updateSprite("ih_toggle_text", {
        positionX: toggleX + 3,
        positionY: toggleY + 3,
      });
      spriteManager.updateSprite("ih_panel_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_action_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_action_text", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_detail_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_detail_text", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_mode_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_mode_text", {
        positionX: offscreen,
        positionY: offscreen,
      });
      return;
    }

    // Expanded: toggle + detail only (no action row) — GAME_ACTIVE
    if (this._expanded && menuState === "GAME_ACTIVE") {
      spriteManager.updateSprite("ih_toggle_bg", {
        positionX: toggleX,
        positionY: toggleY,
      });
      spriteManager.updateSprite("ih_toggle_text", {
        positionX: toggleX + 3,
        positionY: toggleY + 3,
      });
      var detTopY = toggleY + 36 + 4;
      spriteManager.updateSprite("ih_detail_bg", {
        positionX: panelX - pw,
        positionY: detTopY,
      });
      spriteManager.updateSprite("ih_detail_text", {
        positionX: panelX - pw + 10,
        positionY: detTopY + 8,
      });
      // Mode toggle below detail area
      var modeY = detTopY + this._detailHeight + 4;
      spriteManager.updateSprite("ih_mode_bg", {
        positionX: panelX - pw,
        positionY: modeY,
      });
      spriteManager.updateSprite("ih_mode_text", {
        positionX: panelX - pw + 10,
        positionY: modeY + 8,
      });
      spriteManager.updateSprite("ih_panel_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_action_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_action_text", {
        positionX: offscreen,
        positionY: offscreen,
      });
      return;
    }

    // Full row layout: [ action_text | toggle ] growing leftward
    // Row left edge = panelX - panelWidth
    var rowLeft = panelX - pw;

    spriteManager.updateSprite("ih_panel_bg", {
      positionX: rowLeft,
      positionY: panelY,
    });
    spriteManager.updateSprite("ih_toggle_bg", {
      positionX: toggleX,
      positionY: panelY + 3,
    });
    spriteManager.updateSprite("ih_toggle_text", {
      positionX: toggleX + 3,
      positionY: panelY + 6,
    });
    spriteManager.updateSprite("ih_action_bg", {
      positionX: rowLeft + 5,
      positionY: panelY + 4,
    });
    spriteManager.updateSprite("ih_action_text", {
      positionX: rowLeft + 15,
      positionY: panelY + 10,
    });

    // Detail area below the row
    var showDetail = this._expanded || menuState === "GAME_OVER" || menuState === "GAME_ENDING";
    if (showDetail) {
      var detailY = panelY + this._rowHeight + 4;
      spriteManager.updateSprite("ih_detail_bg", {
        positionX: rowLeft,
        positionY: detailY,
      });
      spriteManager.updateSprite("ih_detail_text", {
        positionX: rowLeft + 10,
        positionY: detailY + 8,
      });
      // Mode toggle below detail area
      var modeY = detailY + this._detailHeight + 4;
      spriteManager.updateSprite("ih_mode_bg", {
        positionX: rowLeft,
        positionY: modeY,
      });
      spriteManager.updateSprite("ih_mode_text", {
        positionX: rowLeft + 10,
        positionY: modeY + 8,
      });
    } else {
      spriteManager.updateSprite("ih_detail_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_detail_text", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_mode_bg", {
        positionX: offscreen,
        positionY: offscreen,
      });
      spriteManager.updateSprite("ih_mode_text", {
        positionX: offscreen,
        positionY: offscreen,
      });
    }
  }

  _showSprite(uniqueId: string, opacityVal?: number) {
    if (spriteManager.getSprite(uniqueId)) {
      spriteManager.updateSprite(uniqueId, {
        opacity: opacityVal !== undefined ? opacityVal : 1,
      });
    }
  }

  _hideSprite(uniqueId: string) {
    if (spriteManager.getSprite(uniqueId)) {
      spriteManager.updateSprite(uniqueId, { opacity: 0 });
    }
  }

  _hideAllSprites() {
    this._hideSprite("ih_panel_bg");
    this._hideSprite("ih_action_bg");
    this._hideSprite("ih_action_text");
    this._hideSprite("ih_toggle_bg");
    this._hideSprite("ih_toggle_text");
    this._hideSprite("ih_detail_bg");
    this._hideSprite("ih_detail_text");
    this._hideSprite("ih_mode_bg");
    this._hideSprite("ih_mode_text");
  }

  _toggleExpand() {
    this._expanded = !this._expanded;
    this._updateContent(
      this._lastMenuState,
      this._lastActionText,
      this._lastDetailText,
    );
    var myId = playerManager.getMyPlayerId();
    if (myId) {
      var details = playerManager.getPlayerDetails(myId);
      if (details) {
        this._updatePositions(details.x - this._panelGap, details.y - 20);
      }
    }
  }

  _showModeToggle() {
    var label =
      this._controlScheme === "mouse" ? this._copy.mode.mouse : this._copy.mode.keyboard;
    this._showSprite("ih_mode_bg");
    this._showSprite("ih_mode_text");
    spriteManager.updateSprite("ih_mode_text", { text: label });
  }

  _toggleControlScheme() {
    this._controlScheme =
      this._controlScheme === "mouse" ? "keyboard" : "mouse";
    var myId = playerManager.getMyPlayerId();
    if (myId) {
      eventManager.emit("controlSchemeChanged", {
        playerId: myId,
        scheme: this._controlScheme,
      });
    }
    var label =
      this._controlScheme === "mouse" ? this._copy.mode.mouse : this._copy.mode.keyboard;
    spriteManager.updateSprite("ih_mode_text", { text: label });
  }

  onSpriteClicked({ event, sprite }) {
    if (!sprite) return;

    // Control scheme toggle
    if (
      sprite.uniqueId === "ih_mode_bg" ||
      sprite.uniqueId === "ih_mode_text"
    ) {
      this._toggleControlScheme();
      return;
    }

    // Toggle expand/collapse — toggle bg click
    if (sprite.uniqueId === "ih_toggle_bg") {
      this._toggleExpand();
      return;
    }

    // Start button — any player can click to start the game
    if (
      sprite.uniqueId === "ih_action_bg" ||
      sprite.uniqueId === "ih_action_text"
    ) {
      if (this._lastMenuState === "READY_TO_START") {
        eventManager.emit("playerStartInput", {});
        return;
      }
    }

    // Whole panel bar + action text + action bg — toggle expand
    if (
      sprite.uniqueId === "ih_panel_bg" ||
      sprite.uniqueId === "ih_action_text" ||
      sprite.uniqueId === "ih_action_bg"
    ) {
      this._toggleExpand();
      return;
    }
  }
}
