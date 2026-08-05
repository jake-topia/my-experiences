class PongViewManager extends SystemScript {
  systemName: string;
  myPlayerId: number;

  onInit() {
    this.systemName = 'PongViewManager';
    this.myPlayerId = playerManager.getMyPlayerId();
  }

  /**
   * Handle sprite clicks
   */
  onSpriteClicked({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || !sprite.uniqueId) return;

    const spriteId = sprite.uniqueId;
    
    // Always get fresh player ID - it can change between sessions
    const currentPlayerId = playerManager.getMyPlayerId();

    // Start game button (host only)
    if (spriteId === 'pong_lobby_start' && playerManager.isHost) {
      this.requestStartGame();
      return;
    }

    // Debug: Force sudden death button (host only)
    if (spriteId === 'pong_lobby_debug' && playerManager.isHost) {
      this.requestDebugSuddenDeath();
      return;
    }

    // Restart button (game over screen, host only)
    if (spriteId === 'pong_gameover_restart' && playerManager.isHost) {
      this.requestStartGame();
      return;
    }

    // Paddle control buttons
    if (
      spriteId.indexOf('btn_left_') === 0 ||
      spriteId.indexOf('btn_right_') === 0
    ) {
      const direction = spriteId.indexOf('btn_left_') === 0 ? 'left' : 'right';
      const playerIdStr = spriteId
        .replace('btn_left_', '')
        .replace('btn_right_', '');
      const playerId = parseInt(playerIdStr, 10);

      console.log('[PongView] Button clicked - spriteId:', spriteId, 'myPlayerId:', currentPlayerId, 'buttonPlayerId:', playerId);

      if (playerId === currentPlayerId) {
        this.requestPaddlePress(direction);
      } else {
        console.warn('[PongView] Button player ID mismatch - button:', playerId, 'me:', currentPlayerId);
      }
      return;
    }
  }

  /**
   * Handle sprite release (for paddle controls)
   */
  onSpriteReleased({ sprite }: { sprite: PseudoSprite }) {
    if (!sprite || !sprite.uniqueId) return;

    const spriteId = sprite.uniqueId;
    
    // Always get fresh player ID
    const currentPlayerId = playerManager.getMyPlayerId();

    // Paddle control button releases
    if (
      spriteId.indexOf('btn_left_') === 0 ||
      spriteId.indexOf('btn_right_') === 0
    ) {
      const direction = spriteId.indexOf('btn_left_') === 0 ? 'left' : 'right';
      const playerIdStr = spriteId
        .replace('btn_left_', '')
        .replace('btn_right_', '');
      const playerId = parseInt(playerIdStr, 10);

      if (playerId === currentPlayerId) {
        this.requestPaddleRelease(direction);
      }
      return;
    }
  }

  /**
   * Request to start game (host only)
   */
  requestStartGame() {
    const currentPlayerId = playerManager.getMyPlayerId();
    console.log('[PongView] Requesting to start game');
    eventManager.emit('pong_startGame', {
      playerId: currentPlayerId,
    });
  }

  /**
   * Request to debug sudden death (host only) - skips to round 3 setup for sudden death
   */
  requestDebugSuddenDeath() {
    const currentPlayerId = playerManager.getMyPlayerId();
    console.log('[PongView] Requesting DEBUG: Force Sudden Death');
    eventManager.emit('pong_debugSuddenDeath', {
      playerId: currentPlayerId,
    });
  }

  /**
   * Request paddle button press
   */
  requestPaddlePress(direction: string) {
    const currentPlayerId = playerManager.getMyPlayerId();
    eventManager.emit('pong_paddlePress', {
      playerId: currentPlayerId,
      direction: direction,
    });
  }

  /**
   * Request paddle button release
   */
  requestPaddleRelease(direction: string) {
    const currentPlayerId = playerManager.getMyPlayerId();
    eventManager.emit('pong_paddleRelease', {
      playerId: currentPlayerId,
      direction: direction,
    });
  }
}
