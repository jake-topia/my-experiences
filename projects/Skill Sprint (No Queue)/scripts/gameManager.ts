type QuizQuestion = {
  questionNumber: number;
  text: string;
  options: string[];
  correctIndex: number;
};

interface GameData {
  questions: Record<string, QuizQuestion>;
}

interface TypingGameData {
  words: string[];
}


class gameManager extends SystemScript {

  sprites: PseudoList;
  iframeLastHeartbeatByPlayer: Record<string, number>;
  lastIframeConnectionCheckAt: number;
  lobbyStatusBackgroundSprite: PseudoSprite;
  lobbyStatusTextSprite: PseudoSprite;
  waitingForIframeConnections: boolean;
  gameHasStarted: boolean;

  // Both start buttons are looked up by uniqueId rather than held as property
  // references, following Mind the Fruit. A stored PseudoSprite reference on a
  // synced system can hydrate as a non-null handle to a sprite that does not
  // exist on this machine, which silently breaks every later updateSprite.
  // Ids are inline literals below: 'skillSprintStartButtonText' (centre panel)
  // and 'skillSprintHostStartButton' (follows the host avatar).


  constructor(){
    // load state (no async!)
  };

  onInit(){
    this.sprites = [];
    this.iframeLastHeartbeatByPlayer = {};
    this.lastIframeConnectionCheckAt = 0;
    this.lobbyStatusBackgroundSprite = null;
    this.lobbyStatusTextSprite = null;
    this.waitingForIframeConnections = false;
    this.gameHasStarted = false;

    // The host is already a player when this system is attached, so it cannot
    // use onBeforeJoinGameAsPlayer. Create its persistent iframe now instead.
    if (playerManager.isHost) this.openIframeSilently();
    this.refreshLobbyUI();
  };

  async onBeforeJoinGameAsPlayer() {
    // Keep this iframe alive while its drawer is hidden. This establishes the
    // data channel before the player joins, so opening the game later does not
    // require another WebRTC handshake.
    await this.openIframeSilently();
  }

  async openIframeSilently() {
    console.log("[Skill Sprint] establishing persistent iframe connection");
    await integrationsManager.openIframe({
      interactivePublicKey: stateManager.getVariable('interactivePublicKey'),
      hasDataChannel: 'true',
      iframeId: 'myIframe',
      isOpenLinkInDrawer: false,
      link: stateManager.getVariable('iframeUrl'),
      linkSamlQueryParams: undefined,
      title: 'game iframe',
    });
    console.log("[Skill Sprint] persistent iframe connection established");
  }

  onEvent_buttonClicked({ button, playerId }) {
    if (!playerManager.isHost) return;

    if (button === 'start') {
      if (Number(playerId) !== playerManager.getMyPlayerId()) return;
      this.tryStartGame();
      return;
    }

    if (button === 'iframeHeartbeat') {
      this.iframeLastHeartbeatByPlayer[playerId.toString()] = Date.now();
      this.refreshLobbyUI();
      return;
    }

    if (button === 'iframeConnectionClosed') {
      const disconnectedPlayerId = Number(playerId);
      console.log("[Skill Sprint] iframe reported that its connection is closing for player " + disconnectedPlayerId);

      // Game-over already removes every player locally after destroying the
      // iframe, so do not race that teardown with an extra host-side kick.
      if (stateManager.getVariable("closeIframeEvent") === true) return;

      delete this.iframeLastHeartbeatByPlayer[playerId.toString()];
      this.refreshLobbyUI();
      if (disconnectedPlayerId === playerManager.getMyPlayerId()) {
        playerManager.leaveGame();
      } else {
        playerManager.kickFromGame(disconnectedPlayerId);
      }
    }
  }

  onVariableChanged_gameStarted({ newValue }) {
    if (newValue !== true) return;
    this.gameHasStarted = true;

    if (playerManager.isHost) {
      this.hideStartButtons();
      this.clearLobbyText();
    }

    // exit if we're not in the game
    const id = playerManager.getMyPlayerId();
    const ids = playerManager.getPlayerIds();
    if (ids.indexOf(id) === -1) return;

    // The iframe and its data channel were created once before joining. This
    // only reopens its drawer and preserves that existing connection.
    integrationsManager.forceOpenIframeById({
      iframeId: 'myIframe',
      title: 'game iframe',
    });
  }

  // Track the host avatar on the physics step so the trailing button keeps up
  // with movement. Avatar positions are advanced by physics, so reading them
  // here avoids the button lagging a frame behind the host. This is a no-op
  // when the host has not moved.
  onPhysicsStep() {
    if (!playerManager.isHost) return;
    if (this.gameHasStarted) return;

    this.refreshHostFollowButton();
  }

  onStep() {
    if (!playerManager.isHost) return;
    if (this.gameHasStarted) return;

    const now = Date.now();
    if (now - this.lastIframeConnectionCheckAt < 1000) return;
    this.lastIframeConnectionCheckAt = now;

    const playerIds = playerManager.getPlayerIds();
    const trackedPlayerIds = Object.keys(this.iframeLastHeartbeatByPlayer);
    for (let i = 0; i < trackedPlayerIds.length; i++) {
      const trackedPlayerId = trackedPlayerIds[i];
      const playerId = Number(trackedPlayerId);
      if (playerIds.indexOf(playerId) === -1) {
        delete this.iframeLastHeartbeatByPlayer[trackedPlayerId];
        continue;
      }

      if (now - this.iframeLastHeartbeatByPlayer[trackedPlayerId] <= 10000) continue;

      console.log("[Skill Sprint] iframe connection closed or timed out for player " + playerId + "; removing player from the game");
      delete this.iframeLastHeartbeatByPlayer[trackedPlayerId];
      if (playerId === playerManager.getMyPlayerId()) {
        playerManager.leaveGame();
      } else {
        playerManager.kickFromGame(playerId);
      }
    }

    this.refreshLobbyUI();
  }

  onPlayerLeft({ playerId }: { playerId: number; }) {
    if (!playerManager.isHost) return;
    delete this.iframeLastHeartbeatByPlayer[playerId.toString()];
    this.refreshLobbyUI();
  }

  onSpriteClicked(params: { event: PseudoAny; sprite: PseudoSprite }) {
    if (!playerManager.isHost) return;
    if (!params || !params.sprite) return;
    const clickedId = params.sprite.uniqueId;
    if (clickedId !== 'skillSprintStartButtonText' && clickedId !== 'skillSprintHostStartButton') return;
    this.tryStartGame();
  }

  tryStartGame() {
    if (!playerManager.isHost || this.gameHasStarted) return;

    const animatorSystem: any = scriptManager.getSystem({ systemName: 'animator' });
    if (!animatorSystem || animatorSystem.sceneReady !== true) {
      console.log("[Skill Sprint] host tried to start before ordered scene creation completed");
      return;
    }

    if (!this.haveAllAssignedPlayersEstablishedIframeConnections()) {
      console.log("[Skill Sprint] host tried to start before every assigned player established an iframe connection");
      this.waitingForIframeConnections = true;
      this.refreshLobbyUI();
      return;
    }

    // Latch synchronously. gameHasStarted is otherwise only set once the
    // gameStarted variable change round-trips, so a double click would pass the
    // guard above twice and write the variable twice.
    this.gameHasStarted = true;

    console.log("[Skill Sprint] host started the game after every assigned player established an iframe connection");
    stateManager.setVariable("gameStarted", true);
    this.hideStartButtons();
  }

  haveAllAssignedPlayersEstablishedIframeConnections(): boolean {
    const utils: any = scriptManager.getSystem({ systemName: 'utils' });
    const playerIds = playerManager.getPlayerIds();
    let assignedPlayerCount = 0;

    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      if (utils.findExistingSlotOnly(playerId) === null) continue;

      assignedPlayerCount += 1;
      if (!this.iframeLastHeartbeatByPlayer[playerId.toString()]) return false;
    }

    return assignedPlayerCount > 0;
  }

  getHostName(): string {
    const hostDetails = playerManager.getPlayerDetails(playerManager.getMyPlayerId());
    if (hostDetails && hostDetails.username) return hostDetails.username;
    return 'Host';
  }

  getLobbyText(): string {
    // The blocked state used to be shown on the button itself. Now that both
    // buttons keep a fixed label, this line carries the status instead.
    if (this.waitingForIframeConnections) return 'Waiting for all players to finish loading...';
    return 'Waiting for ' + this.getHostName() + ' to start the game.';
  }

  getStartButtonText(): string {
    return 'Click here to start!';
  }

  getStartButtonColor(): string {
    // Text stays fixed on both buttons; the blocked state is shown by colour and
    // by the lobby status line, not by relabelling the button.
    if (this.waitingForIframeConnections) return '#808080';
    return '#FFFFFF';
  }

  ensureStartButtonSprites() {
    if (!playerManager.isHost) return;

    if (!spriteManager.getSprite('skillSprintStartButtonText')) {
      spriteManager.addSprite('text', {
        uniqueId: 'skillSprintStartButtonText',
        positionX: 675,
        positionY: 470,
        containerWidth: 600,
        align: 'center',
        text: this.getStartButtonText(),
        fontSize: 28,
        fontColor: this.getStartButtonColor(),
        isInteractive: true,
        isPlayerControlled: true,
        displayLayer: 'top',
        topAdjust: 1999,
      });
    }

    if (!spriteManager.getSprite('skillSprintHostStartButton')) {
      // Created with empty text so it renders nothing until refreshHostFollowButton
      // has a real avatar position, otherwise it flashes at its fallback
      // position for a frame.
      // Mind the Fruit hides it with opacity: 0 instead, but an explicit opacity
      // would break same-layer draw ordering elsewhere in the scene.
      const initialPosition = this.getHostStartButtonPosition();
      spriteManager.addSprite('text', {
        uniqueId: 'skillSprintHostStartButton',
        positionX: initialPosition ? initialPosition.positionX : 150,
        positionY: initialPosition ? initialPosition.positionY : 75,
        containerWidth: 320,
        align: 'center',
        text: '',
        fontSize: 24,
        fontColor: this.getStartButtonColor(),
        isInteractive: true,
        isPlayerControlled: true,
        displayLayer: 'top',
        topAdjust: 1999,
      });
    }
  }

  getHostStartButtonPosition(): { positionX: number; positionY: number } | null {
    const hostDetails = playerManager.getPlayerDetails(playerManager.getMyPlayerId());
    if (!hostDetails) return null;
    return { positionX: hostDetails.x + 45, positionY: hostDetails.y + 90 };
  }

  // Refreshes the button that trails the host avatar. Called every step, so it
  // compares current sprite state first and skips the update when nothing moved.
  refreshHostFollowButton() {
    if (!playerManager.isHost || this.gameHasStarted) return;

    const sprite = spriteManager.getSprite('skillSprintHostStartButton');
    if (!sprite) return;

    const position = this.getHostStartButtonPosition();
    if (!position) return;

    const buttonText = this.getStartButtonText();
    const buttonColor = this.getStartButtonColor();
    const buttonIsInteractive = this.waitingForIframeConnections === false;

    if (
      sprite.position.x === position.positionX &&
      sprite.position.y === position.positionY &&
      sprite.text === buttonText &&
      sprite.fontColor === buttonColor &&
      !!sprite.isInteractive === buttonIsInteractive
    ) {
      return;
    }

    spriteManager.updateSprite('skillSprintHostStartButton', {
      positionX: position.positionX,
      positionY: position.positionY,
      text: buttonText,
      fontColor: buttonColor,
      isInteractive: buttonIsInteractive,
    });
  }

  hideStartButtons() {
    if (!playerManager.isHost) return;

    // Removed rather than hidden with opacity: an explicit opacity on these
    // sprites would break same-layer draw ordering for the rest of the scene.
    if (spriteManager.getSprite('skillSprintStartButtonText')) {
      spriteManager.removeSprite('skillSprintStartButtonText');
    }
    if (spriteManager.getSprite('skillSprintHostStartButton')) {
      spriteManager.removeSprite('skillSprintHostStartButton');
    }
  }

  refreshLobbyUI() {
    if (!playerManager.isHost || this.gameHasStarted) return;

    const lobbyText = this.getLobbyText();
    if (!this.lobbyStatusBackgroundSprite) {
      this.lobbyStatusBackgroundSprite = spriteManager.addSprite('blue', {
        uniqueId: 'skillSprintLobbyStatusBackground',
        positionX: 550,
        positionY: 360,
        width: 850,
        height: 200,
        fill: '#12160E',
        displayLayer: 'top',
        // Authoritative rect/text ordering needs a wide topAdjust gap.
        topAdjust: 1001,
        borderRadius: 20,
      });
    } else if (
      this.lobbyStatusBackgroundSprite.position.x !== 550 ||
      this.lobbyStatusBackgroundSprite.position.y !== 360
    ) {
      spriteManager.updateSprite(
        this.lobbyStatusBackgroundSprite.uniqueId,
        {
          positionX: 550,
          positionY: 360,
        },
      );
    }

    if (!this.lobbyStatusTextSprite) {
      this.lobbyStatusTextSprite = spriteManager.addSprite('text', {
        uniqueId: 'skillSprintLobbyStatusText',
        positionX: 550,
        positionY: 377,
        containerWidth: 850,
        align: 'center',
        text: lobbyText,
        fontSize: 28,
        fontColor: '#FFFFFF',
        displayLayer: 'top',
        topAdjust: 1999,
      });
    } else {
      spriteManager.updateSprite(this.lobbyStatusTextSprite.uniqueId, {
        positionX: 550,
        positionY: 377,
        text: lobbyText,
        fontColor: '#FFFFFF',
        displayLayer: 'top',
        topAdjust: 1999,
      });
    }

    if (this.waitingForIframeConnections && this.haveAllAssignedPlayersEstablishedIframeConnections()) {
      this.waitingForIframeConnections = false;
    }

    this.ensureStartButtonSprites();

    const buttonText = this.getStartButtonText();
    const buttonColor = this.getStartButtonColor();
    const buttonIsInteractive = this.waitingForIframeConnections === false;

    const centerButton = spriteManager.getSprite('skillSprintStartButtonText');
    if (
      centerButton &&
      (centerButton.position.x !== 675 ||
        centerButton.position.y !== 470 ||
        centerButton.text !== buttonText ||
        centerButton.fontColor !== buttonColor ||
        !!centerButton.isInteractive !== buttonIsInteractive)
    ) {
      spriteManager.updateSprite('skillSprintStartButtonText', {
        positionX: 675,
        positionY: 470,
        text: buttonText,
        fontColor: buttonColor,
        isInteractive: buttonIsInteractive,
      });
    }

    this.refreshHostFollowButton();
  }

  clearLobbyText() {
    if (this.lobbyStatusTextSprite) {
      spriteManager.removeSprite(this.lobbyStatusTextSprite.uniqueId);
      this.lobbyStatusTextSprite = null;
    }
    if (this.lobbyStatusBackgroundSprite) {
      spriteManager.removeSprite(this.lobbyStatusBackgroundSprite.uniqueId);
      this.lobbyStatusBackgroundSprite = null;
    }
  }


  onEvent_gameStarted() {
    if (!playerManager.isHost) return;
    // @TODO: gameStateManager.setIsAcceptingPlayers(false);
  }


  
};
