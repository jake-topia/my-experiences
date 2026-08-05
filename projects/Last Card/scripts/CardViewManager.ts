interface CardData {
  suit: string;
  rank: string;
  assetId: string;
}

/**
 * CardViewManager (CVM)
 * Stateless client-side view + input.
 *
 * Reads the entire UI state from 'networkedGameState' (host-authored), then:
 * - Renders using "clear-then-draw" (ephemeral sprites) or "update-or-create" (persistent UI).
 * - Never stores canonical game data locally (only transient sprite ids + last stateVersion).
 * - Emits LOCAL events to request actions; host validates and rebroadcasts state.
 *
 * Key patterns:
 * - Priming gates (_handPrimed/_pilePrimed) avoid first-frame flicker.
 * - All engine calls use sanitized params (see _prune / _nz* helpers).
 */
class CardViewManager extends SystemScript {
  /**
   * Remove values that the engine treats as invalid sprite options.
   * Strips: null, undefined, false, empty string, 0.
   * Always pass only safe keys to spriteManager.
   */
  _prune(opts: any) {
    var out: any = {};
    for (var k in opts) {
      if (!opts.hasOwnProperty(k)) continue;
      var v = opts[k];
      if (v === null) continue;
      if (typeof v === 'boolean' && v === false) continue;
      if (typeof v === 'string' && v === '') continue;
      if (typeof v === 'number' && v === 0) continue;
      out[k] = v;
    }
    return out;
  }

  // ---------- Engine-safe null/number/bool helpers ----------
  _nzStr(v: any, fallback?: string) {
    if (fallback === undefined) fallback = '';
    return v === null || v === undefined ? fallback : '' + v;
  }
  _nzNum(v: any, fallback: number) {
    var n = +v;
    return v === null || v === undefined || isNaN(n) ? fallback : n;
  }
  _nzBool(v: any, fallback: boolean) {
    return v === null || v === undefined ? fallback : !!v;
  }

  /**
   * Estimate the rendered width of a text string.
   * Counts emojis separately since they render ~2x wider than regular chars.
   * @param text - The text string to measure
   * @param fontSize - Font size category: 'tiny', 'small', 'medium', 'large'
   * @returns Estimated pixel width of the text
   */
  _estimateTextWidth(text: string, fontSize: string): number {
    if (!text) return 0;

    // Count emojis using surrogate pair detection (ES5 compatible)
    // Emojis are typically represented as surrogate pairs (2 JS chars) or with variation selectors
    var emojiCount = 0;
    var regularCharCount = 0;

    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      // Check for high surrogate (emoji/special chars use surrogate pairs)
      if (code >= 0xd800 && code <= 0xdbff) {
        // This is a surrogate pair - count as one emoji, skip the low surrogate
        emojiCount++;
        i++; // Skip the low surrogate
      } else if (code >= 0x2600 && code <= 0x27bf) {
        // Misc symbols and dingbats (some emojis in BMP)
        emojiCount++;
      } else {
        regularCharCount++;
      }
    }

    // Get char width based on font size
    var charWidth: number;
    var emojiWidth: number;

    switch (fontSize) {
      case 'tiny':
        charWidth = this._layoutConfig.CHAR_WIDTH_TINY || 8;
        emojiWidth = charWidth * 2.5;
        break;
      case 'small':
        charWidth = this._layoutConfig.CHAR_WIDTH_SMALL || 10;
        emojiWidth = charWidth * 2.5;
        break;
      case 'large':
        charWidth = this._layoutConfig.CHAR_WIDTH_LARGE || 16;
        emojiWidth = charWidth * 2.8; // Increased for Start Game, Play Again, You Win
        break;
      case 'medium':
      default:
        charWidth = this._layoutConfig.CHAR_WIDTH_MEDIUM || 12;
        emojiWidth = charWidth * 3.0; // Increased - hourglass and target emojis are wide
        break;
    }

    // Add 15% safety buffer for font rendering variance
    var baseWidth = regularCharCount * charWidth + emojiCount * emojiWidth;
    return baseWidth * 1.15;
  }

  /** My local player id (for input routing and turn/UI checks). */
  myPlayerId: number;

  // ---------- Sprite id tracking (locals only; not game state) ----------
  myCardSpriteIds: PseudoList; // ids for my hand
  opponentCardSpriteIds: PseudoList; // (reserved) opponents if/when rendered
  persistentUiIds: PseudoList; // UI that survives updates (buttons, draw pile)
  _suitSelectorIds: PseudoList; // suit pick overlay sprites
  _playerStatusIds: PseudoList; // opponent status displays (name + card count)
  _textBgIds: PseudoList; // background rectangles for text elements
  _helpSpriteIds: PseudoList; // help overlay sprites
  _instructionSpriteIds: PseudoList; // lobby instruction sprites

  // ---------- Help drawer state ----------
  _helpDrawerOpen: boolean;

  // ---------- Camping Teleport Protection (TP) ----------
  _campingTpZoneId: string; // Sprite ID for camping TP zone
  _campingCheckCounter: number; // Frame counter for camping checks

  // ---------- Periodic sync verification ----------
  _syncCheckIntervalFrames: number;
  _framesSinceLastSync: number;
  _lastSyncRequestTime: number;
  _syncRequestCooldownMs: number;

  // ---------- Config provider for instructions ----------
  _configProvider: any;

  // ---------- Visual + local state mirrors ----------
  cardWidth: number;
  cardHeight: number;
  _localGameState: any; // last payload received (read-only usage)
  _lastStateVersion: number;

  // ---------- Stage dimensions (from LayoutConfig) ----------
  stageWidth: number;
  stageHeight: number;
  centerX: number;
  centerY: number;

  // ---------- Layout config reference ----------
  _layoutConfig: any; // Reference to LayoutConfig system

  // ---------- One-time gates to prevent first-frame glitches ----------
  _handPrimed: boolean;
  _pilePrimed: boolean;
  _lastPileTopAssetId: string;
  _lastPileActiveSuit: string;

  constructor() {
    // NO super() call - platform doesn't support it!
    // Initialize primitives only - don't reference LayoutConfig yet!
    this.myPlayerId = 0;
    this.cardWidth = 80; // Will be set from LayoutConfig in onInit
    this.cardHeight = 130; // Will be set from LayoutConfig in onInit
    this._localGameState = null;
    this._lastStateVersion = 0;
    this._handPrimed = false;
    this._pilePrimed = false;
    this._lastPileTopAssetId = '';
    this._lastPileActiveSuit = '';
    this._helpDrawerOpen = false;

    // Camping TP initialization
    this._campingTpZoneId = 'camping_tp_zone';
    this._campingCheckCounter = 0;

    // Winner celebration initialization
    this._confettiTriggered = false;

    // Default stage dimensions (will be loaded from LayoutConfig in onInit)
    this.stageWidth = 1000;
    this.stageHeight = 1000;
    this.centerX = 500;
    this.centerY = 500;

    // Periodic sync verification settings
    // Card games need faster sync than action games since state changes are discrete
    this._syncCheckIntervalFrames = 120; // ~2 seconds at 60fps
    this._framesSinceLastSync = 0;
    this._lastSyncRequestTime = 0;
    this._syncRequestCooldownMs = 3000; // Max one request per 3 seconds

    console.log('[CVM] init');
  }

  onInit() {
    console.log('[CVM] onInit START');

    // Attach and get LayoutConfig system (matching CrazyEights pattern)
    scriptManager.attachSystem({ scriptId: 'LayoutConfig' });
    var layoutConfigSystem = scriptManager.getSystem({
      systemName: 'LayoutConfig',
    });
    this._layoutConfig = layoutConfigSystem.getConfig();

    console.log('[CVM] LayoutConfig loaded:', this._layoutConfig);
    console.log(
      '[CVM] LayoutConfig.STAGE_WIDTH:',
      this._layoutConfig.STAGE_WIDTH,
    );
    console.log(
      '[CVM] LayoutConfig.STAGE_HEIGHT:',
      this._layoutConfig.STAGE_HEIGHT,
    );
    console.log('[CVM] LayoutConfig.centerX:', this._layoutConfig.centerX);
    console.log('[CVM] LayoutConfig.centerY:', this._layoutConfig.centerY);

    // Load all dimensions from LayoutConfig
    this.cardWidth = this._layoutConfig.CARD_WIDTH;
    this.cardHeight = this._layoutConfig.CARD_HEIGHT;
    this.stageWidth = this._layoutConfig.STAGE_WIDTH;
    this.stageHeight = this._layoutConfig.STAGE_HEIGHT;
    this.centerX = this._layoutConfig.centerX;
    this.centerY = this._layoutConfig.centerY;

    console.log(
      '[CVM] After assignment - cardWidth:',
      this.cardWidth,
      'cardHeight:',
      this.cardHeight,
    );
    console.log(
      '[CVM] After assignment - stageWidth:',
      this.stageWidth,
      'stageHeight:',
      this.stageHeight,
    );
    console.log(
      '[CVM] After assignment - centerX:',
      this.centerX,
      'centerY:',
      this.centerY,
    );

    // Initialize PseudoLists in onInit (not constructor)
    console.log('[CVM] init myCardSpriteIds');
    this.myCardSpriteIds = [] as any;
    console.log('[CVM] init opponentCardSpriteIds');
    this.opponentCardSpriteIds = [] as any;
    console.log('[CVM] init persistentUiIds');
    this.persistentUiIds = [] as any;
    console.log('[CVM] init _suitSelectorIds');
    this._suitSelectorIds = [] as any;
    console.log('[CVM] init _playerStatusIds');
    this._playerStatusIds = [] as any;
    console.log('[CVM] init _textBgIds');
    this._textBgIds = [] as any;
    this._helpSpriteIds = [] as any;
    this._instructionSpriteIds = [] as any;

    // Attach config system for instructions
    scriptManager.attachSystem({ scriptId: 'CrazyEightsConfigSystem' });
    this._configProvider = scriptManager.getSystem({
      systemName: 'CrazyEightsConfigSystem',
    });

    console.log('[CVM] get player ID');
    // Get player ID and set up initial state
    this.myPlayerId = playerManager.getMyPlayerId();

    console.log('[CVM] create table background');
    // Create the green table background (persistent).
    this.createTableBackground();

    console.log('[CVM] emit sync request');
    // Request a fresh snapshot in case we joined mid-game.
    eventManager.emit('playerRequestsFullSync', {
      fromPlayerId: this.myPlayerId,
    });
    console.log('[CVM] ready P' + this.myPlayerId);
  }

  /**
   * Periodic sync verification - runs every frame
   * Clients request sync if they haven't received updates in a while.
   * This is critical for recovering from missed state updates (e.g., during wild card suit selection).
   */
  onStep() {
    // Host doesn't need to request sync from itself
    if (playerManager.isHost) return;

    this._framesSinceLastSync++;

    // Check if it's time to verify sync (every ~3 seconds at 60fps)
    if (this._framesSinceLastSync >= this._syncCheckIntervalFrames) {
      this._framesSinceLastSync = 0;

      var now = Date.now();
      var timeSinceLastRequest = now - this._lastSyncRequestTime;

      // Only request if cooldown has elapsed (prevents spam)
      if (timeSinceLastRequest >= this._syncRequestCooldownMs) {
        // If we have no local state, always request sync
        if (!this._localGameState) {
          console.log('[CVM] Periodic sync: no state, requesting...');
          this._lastSyncRequestTime = now;
          eventManager.emit('playerRequestsFullSync', {
            fromPlayerId: this.myPlayerId,
          });
        }
        // During active game, also request periodic sync to recover from missed updates
        else if (this._localGameState.state === 'ACTIVE_GAME') {
          console.log(
            '[CVM] Periodic sync during active game v' + this._lastStateVersion,
          );
          this._lastSyncRequestTime = now;
          eventManager.emit('playerRequestsFullSync', {
            fromPlayerId: this.myPlayerId,
          });
        }
        // During suit selection, sync more aggressively to ensure clients stay in sync
        else if (this._localGameState.isAwaitingSuitChoice) {
          console.log(
            '[CVM] Periodic sync during suit choice v' + this._lastStateVersion,
          );
          this._lastSyncRequestTime = now;
          eventManager.emit('playerRequestsFullSync', {
            fromPlayerId: this.myPlayerId,
          });
        }
      }
    }
  }

  /**
   * Single entry point for host updates.
   * Ignores stale versions; processes only when stateVersion increases.
   */
  onVariableChanged_networkedGameState({
    newValue: newState,
  }: {
    newValue: any;
  }) {
    if (!newState || newState.stateVersion === undefined) return;
    if (newState.stateVersion > this._lastStateVersion) {
      this._lastStateVersion = newState.stateVersion;
      this._framesSinceLastSync = 0; // Reset sync counter on valid update

      var dpLen = newState.discardPile ? (newState.discardPile.length !== undefined ? newState.discardPile.length : '?') : 'MISSING';
      var hasHands = newState.playerHands ? 'yes' : 'MISSING';
      var pileSprite = spriteManager.getSprite('play_pile_top_card') ? 'EXISTS' : 'GONE';
      console.log('[PILE-DBG] onVarChanged v' + newState.stateVersion + ' state=' + newState.state + ' dpLen=' + dpLen + ' hands=' + hasHands + ' pileSprite=' + pileSprite);

      this.processStateUpdate(newState);

      var pileSpriteAfter = spriteManager.getSprite('play_pile_top_card') ? 'EXISTS' : 'GONE';
      console.log('[PILE-DBG] afterProcess pileSprite=' + pileSpriteAfter);
    }
  }

  /**
   * Main render pipeline:
   * - Clears transient overlays (suit selector) on every update.
   * - Chooses lobby vs active/game-over UI branches.
   * - Draws my hand first, then (once primed) the discard pile and draw pile.
   * - Shows suit selector only when it's my turn and host awaits a choice.
   * - Updates turn indicator each frame.
   */
  processStateUpdate(newState: any) {
    console.log(
      '[CVM] processStateUpdate - state:',
      newState ? newState.state : 'undefined',
      'version:',
      newState ? newState.stateVersion : 'undefined',
    );
    this._localGameState = newState;

    // Always remove any suit overlay before rebuilding UI for new state.
    this.clearSuitSelector();

    if (newState.feedback && newState.feedback.playerId === this.myPlayerId) {
      console.log('[CVM] msg host: ' + newState.feedback.message);
    }

    if (newState.state === 'WAITING') {
      // Lobby view - clear ALL game UI
      console.log('[CVM] Entering WAITING state - clearing all game UI');
      this.clearGameSprites();
      this.clearGameOverUI();
      this.clearAllGameUI();
      this.drawLobbyUI(newState);
      this._handPrimed = false;
      this._pilePrimed = false;
      this._confettiTriggered = false; // Reset for new game
      this._lastPileTopAssetId = '';
      this._lastPileActiveSuit = '';
    } else if (
      newState.state === 'ACTIVE_GAME' ||
      newState.state === 'GAME_OVER'
    ) {
      // Guard: skip hand/pile re-render if child world objects haven't synced yet.
      // stateManager.setVariable replaces all MapVariable children, and
      // clients may receive the parent update before the children arrive.
      // NOTE: only skip hand/pile rendering — turn indicator and other UI
      // that depend only on top-level fields must still update.
      var myHand = newState.playerHands
        ? newState.playerHands[this.myPlayerId + '']
        : undefined;
      console.log('[PILE-DBG] guard check: myHand=' + (myHand ? 'len=' + myHand.length : 'FALSY') + ' handPrimed=' + this._handPrimed + ' pilePrimed=' + this._pilePrimed);
      if (!myHand && this._handPrimed) {
        console.log('[PILE-DBG] SKIPPING hand/pile render — no hand data yet');
      } else {
        // In-game view
        this.clearLobbySprites();
        this.clearGameSprites();

        // Render my hand first (enables pile priming).
        this.drawMyHand(newState.playerHands);

        // Only enable pile after the hand is drawn once to avoid flicker.
        if (!this._pilePrimed && this._handPrimed) this._pilePrimed = true;

        if (this._pilePrimed) {
          // Normalize discard array (PseudoList -> Array).
          var pileArg = newState.discardPile
            ? newState.discardPile.toArray
              ? newState.discardPile.toArray()
              : newState.discardPile
            : [];
          // Host guarantees activeSuit is never null; still guard to undefined for art mapping.
          var activeSuitArg =
            newState.activeSuit === null ? undefined : newState.activeSuit;
          this.updatePlayPileView(pileArg, activeSuitArg);
        }

        // Draw pile (persistent).
        this.updateDrawPileView(newState.deckSize);

        // Other player status indicators (persistent).
        this.updatePlayerStatus(newState.playerHands);

        // Play Again button (only when game over, only for host).
        if (newState.state === 'GAME_OVER') {
          this.drawPlayAgainButton(newState);

          // Trigger confetti for winner (once per game)
          if (!this._confettiTriggered && newState.winnerId) {
            this._confettiTriggered = true;
            this.triggerWinnerConfetti(newState.winnerId);
          }
        } else {
          this.clearGameOverUI();
          this._confettiTriggered = false; // Reset for next game
        }
      }
    }

    // Suit selection overlay only when it's my turn AND host awaits choice.
    if (
      newState.isAwaitingSuitChoice &&
      newState.currentPlayerId === this.myPlayerId
    ) {
      this.drawSuitSelector();
    }

    // Turn banner (persistent).
    this.updateTurnIndicator(newState);

    // Last action indicator (only after first action)
    this.updateLastAction(newState);

    // Help button (always visible except in help drawer)
    if (!this._helpDrawerOpen) {
      this.renderHelpButton();
    }
  }

  /**
   * Click router:
   * - Help button -> toggle help drawer
   * - Suit buttons -> playerSelectsSuit
   * - Lobby start button (host only) -> hostStartsGame
   * - Hand cards (my turn only) -> playerWantsToPlayCard
   * - Draw pile (my turn only) -> playerWantsToDrawCard
   */
  onSpriteClicked({ sprite }: { sprite: any }) {
    console.log(
      '[CVM] onSpriteClicked - sprite:',
      sprite ? sprite.uniqueId : 'undefined',
      'state:',
      this._localGameState ? this._localGameState.state : 'no state',
    );
    if (sprite == undefined || !this._localGameState) return;

    // Help button toggle
    if (sprite.uniqueId === 'help_button') {
      if (this._helpDrawerOpen) {
        this.closeHelpDrawer();
      } else {
        this.showHelpDrawer();
      }
      return;
    }

    // Suit choice overlay
    if (sprite.uniqueId && sprite.uniqueId.indexOf('suit_selector_') !== -1) {
      var chosenSuit = sprite.uniqueId.split('_')[2];
      eventManager.emit('playerSelectsSuit', {
        fromPlayerId: this.myPlayerId,
        suit: chosenSuit,
      });
      eventManager.emit('playerWantsToPlayCard', {
        fromPlayerId: this.myPlayerId,
        cardData: { assetId: 'SUIT_CHOICE__' + chosenSuit }, // distinctive marker
      });
      console.log('[CVM] suit -> host: ' + chosenSuit + ' t=' + Date.now());

      this.clearSuitSelector();
      return;
    }

    // Lobby button (host only)
    if (this._localGameState.state === 'WAITING') {
      if (
        sprite.uniqueId === 'start_game_button' &&
        this.myPlayerId === this._localGameState.hostPlayerId
      ) {
        eventManager.emit('hostStartsGame', { fromPlayerId: this.myPlayerId });
      }
      return;
    }

    // Game Over: Play Again button (host only)
    if (this._localGameState.state === 'GAME_OVER') {
      console.log(
        '[CVM] Click in GAME_OVER state - sprite.uniqueId:',
        sprite.uniqueId,
      );
      if (
        sprite.uniqueId === 'play_again_button' &&
        this.myPlayerId === this._localGameState.hostPlayerId
      ) {
        console.log('[CVM] Play Again button clicked! Emitting hostStartsGame');
        eventManager.emit('hostStartsGame', { fromPlayerId: this.myPlayerId });
      } else {
        console.log(
          '[CVM] Play Again click check failed - uniqueId match:',
          sprite.uniqueId === 'play_again_button',
          'isHost:',
          this.myPlayerId === this._localGameState.hostPlayerId,
        );
      }
      return;
    }

    // In-game interactions
    if (this._localGameState.state === 'ACTIVE_GAME') {
      if (
        parseInt(this._localGameState.currentPlayerId) !== this.myPlayerId ||
        this._localGameState.isAwaitingSuitChoice
      ) {
        return;
      }

      // Attempt play if a card in my hand was clicked (match by assetId).
      if (sprite.uniqueId && sprite.uniqueId.indexOf('card_') != -1) {
        var myHand = this._localGameState.playerHands[this.myPlayerId + ''];
        for (var i = 0; i < myHand.length; i++) {
          if (myHand[i] && myHand[i].assetId === sprite.uniqueId) {
            eventManager.emit('playerWantsToPlayCard', {
              cardData: { assetId: sprite.uniqueId },
              fromPlayerId: this.myPlayerId,
            });
            return;
          }
        }
      }

      // Draw request
      if (sprite.uniqueId && (sprite.uniqueId === 'draw_pile' || sprite.uniqueId === "draw_pile_background")) {
        eventManager.emit('playerWantsToDrawCard', {
          fromPlayerId: this.myPlayerId,
        });
      }
    }
  }

  // ---------- Clear helpers (ephemeral sprites) ----------
  /**
   * Create the green table background sprite (persistent).
   * Called once from onInit.
   */
  createTableBackground() {
    console.log('[CVM] createTableBackground START');
    var tableId = 'table_background';
    console.log('[CVM] check if table exists');
    if (!spriteManager.getSprite(tableId)) {
      console.log('[CVM] adding table sprite');
      spriteManager.addSprite(
        'cell',
        this._prune({
          uniqueId: tableId,
          positionX: 0,
          positionY: 0,
          width: this.stageWidth,
          height: this.stageHeight,
          fill: this._layoutConfig.TABLE_COLOR,
          isInteractive: false,
        }),
      );
      console.log('[CVM] table background created');
    }
    console.log('[CVM] createTableBackground END');
  }

  clearGameSprites() {
    var allGameCards = this.myCardSpriteIds
      .toArray()
      .concat(this.opponentCardSpriteIds.toArray());
    for (var i = 0; i < allGameCards.length; i++) {
      var id = allGameCards[i];
      spriteManager.removeSprite(id);
      spriteManager.removeSprite(id + '_rank_top');
      spriteManager.removeSprite(id + '_suit_top');
      spriteManager.removeSprite(id + '_center');
      spriteManager.removeSprite(id + '_special_label'); // Clear special card labels
    }
    this.myCardSpriteIds = [] as any;
    this.opponentCardSpriteIds = [] as any;
  }

  clearLobbySprites() {
    var buttonId = 'start_game_button';
    var buttonBgId = buttonId + '_bg';
    var buttonIndex = this.persistentUiIds.toArray().indexOf(buttonId);
    if (buttonIndex !== -1) {
      spriteManager.removeSprite(buttonId);
      spriteManager.removeSprite(buttonBgId);
      var buf = this.persistentUiIds.toArray();
      buf.splice(buttonIndex, 1);
      // Also remove bg from persistentUiIds
      var bgIndex = buf.indexOf(buttonBgId);
      if (bgIndex !== -1) buf.splice(bgIndex, 1);
      this.persistentUiIds = buf as any;
    }

    // Clear player count display
    var countId = 'player_count_display';
    var countBgId = countId + '_bg';
    spriteManager.removeSprite(countId);
    spriteManager.removeSprite(countBgId);
    var arr = this.persistentUiIds.toArray();
    var cIdx = arr.indexOf(countId);
    if (cIdx !== -1) arr.splice(cIdx, 1);
    var cbIdx = arr.indexOf(countBgId);
    if (cbIdx !== -1) arr.splice(cbIdx, 1);
    this.persistentUiIds = arr as any;

    // Clear lobby instructions
    var instrIds = this._instructionSpriteIds.toArray();
    for (var i = 0; i < instrIds.length; i++) {
      spriteManager.removeSprite(instrIds[i]);
    }
    this._instructionSpriteIds = [] as any;
  }

  clearSuitSelector() {
    var selectorIds = this._suitSelectorIds.toArray();
    for (var i = 0; i < selectorIds.length; i++) {
      spriteManager.removeSprite(selectorIds[i]);
    }
    this._suitSelectorIds = [] as any;
  }

  clearGameOverUI() {
    var playAgainId = 'play_again_button';
    var playAgainBgId = playAgainId + '_bg';
    var buttonIndex = this.persistentUiIds.toArray().indexOf(playAgainId);
    if (buttonIndex !== -1) {
      spriteManager.removeSprite(playAgainId);
      spriteManager.removeSprite(playAgainBgId);
      var buf = this.persistentUiIds.toArray();
      buf.splice(buttonIndex, 1);
      var bgIndex = buf.indexOf(playAgainBgId);
      if (bgIndex !== -1) buf.splice(bgIndex, 1);
      this.persistentUiIds = buf as any;
    }
  }

  clearAllGameUI() {
    console.log('[PILE-DBG] clearAllGameUI CALLED — will remove pile sprites');
    // Clear all text backgrounds first
    var bgIds = this._textBgIds.toArray();
    for (var b = 0; b < bgIds.length; b++) {
      spriteManager.removeSprite(bgIds[b]);
    }
    this._textBgIds = [] as any;

    // Clear draw pile
    var pileId = 'draw_pile';
    var backgroundId = pileId + '_background';
    spriteManager.removeSprite(pileId);
    spriteManager.removeSprite(backgroundId);

    // Clear play pile (discard)
    var baseId = 'play_pile_top_card';
    spriteManager.removeSprite(baseId);
    spriteManager.removeSprite(baseId + '_rank_top');
    spriteManager.removeSprite(baseId + '_suit_top');
    spriteManager.removeSprite(baseId + '_center');

    // Clear player status
    var statusIds = this._playerStatusIds.toArray();
    for (var i = 0; i < statusIds.length; i++) {
      spriteManager.removeSprite(statusIds[i]);
    }
    this._playerStatusIds = [] as any;

    // Clear turn indicator and its background
    var turnId = 'turn_indicator_text_' + this.myPlayerId;
    var turnBgId = turnId + '_bg';
    spriteManager.removeSprite(turnId);
    spriteManager.removeSprite(turnBgId);

    // Clear last action indicator
    spriteManager.removeSprite('last_action_text');
    spriteManager.removeSprite('last_action_text_bg');

    // Clear player count display
    var countId = 'player_count_display';
    var countBgId = countId + '_bg';
    spriteManager.removeSprite(countId);
    spriteManager.removeSprite(countBgId);

    // Clear all persistent UI IDs except table background
    var cleaned = [];
    var allPersistent = this.persistentUiIds.toArray();
    for (var j = 0; j < allPersistent.length; j++) {
      var id = allPersistent[j];
      // Keep table_background, remove everything else
      if (id === 'table_background') {
        cleaned.push(id);
      } else {
        spriteManager.removeSprite(id);
      }
    }
    this.persistentUiIds = cleaned as any;

    // Clear help drawer if open
    this.closeHelpDrawer();

    // Clear help button
    spriteManager.removeSprite('help_button');
    spriteManager.removeSprite('help_button_bg');

    // Clear instruction sprites
    var instrIds = this._instructionSpriteIds.toArray();
    for (var k = 0; k < instrIds.length; k++) {
      spriteManager.removeSprite(instrIds[k]);
    }
    this._instructionSpriteIds = [] as any;

    // Clear camping TP zone
    this.removeCampingTpZone();
  }

  /**
   * Trigger confetti celebration for the winner
   * @param winnerId - Player ID of the winner
   */
  triggerWinnerConfetti(winnerId: number) {
    try {
      var publicKey = stateManager.getVariable('PublicKey');
      var winnerDetails = playerManager.getPlayerDetails(winnerId);

      if (winnerDetails && publicKey) {
        console.log('[CVM] Triggering confetti for winner:', winnerId);

        // Trigger pastel confetti explosion on the winner
        integrationsManager.triggerParticleEffect({
          particleName: 'pastelConfetti_explosion',
          position: { x: winnerDetails.x, y: winnerDetails.y },
          duration: 3.0,
          followPlayerId: winnerId,
          interactivePublicKey: publicKey,
        });

        // If I am the winner, trigger a second burst for extra celebration
        if (winnerId === this.myPlayerId) {
          timerManager.createTimer({
            duration: 500,
            onComplete: () => {
              try {
                var details = playerManager.getPlayerDetails(winnerId);
                if (details) {
                  integrationsManager.triggerParticleEffect({
                    particleName: 'classicConfetti_explosion',
                    position: { x: details.x, y: details.y },
                    duration: 2.5,
                    followPlayerId: winnerId,
                    interactivePublicKey: publicKey,
                  });
                }
              } catch (e) {
                console.warn('[CVM] Secondary confetti error:', e);
              }
            },
          });
        }
      }
    } catch (e) {
      console.warn('[CVM] Confetti trigger error:', e);
    }
  }

  // ---------- Drawing ----------
  /**
   * Draw my hand centered along the bottom.
   * Uses ephemeral sprites; ids collected into myCardSpriteIds each frame.
   * Cards overlap when hand is too wide to fit in stage boundaries.
   */
  drawMyHand(allPlayerHands: any) {
    var myHand = allPlayerHands[this.myPlayerId + ''];
    if (!myHand) return;

    this.myCardSpriteIds = [] as any;
    var createdCount = 0;

    var handSize = myHand.length;
    if (handSize === 0) return;

    var buffer = this._layoutConfig.HAND_CARD_BUFFER;
    var sideMargin = this._layoutConfig.HAND_SIDE_MARGIN;

    // Calculate available width for hand (stage width minus side margins)
    var availableWidth = this.stageWidth - 2 * sideMargin;

    // Calculate total width: first card + (n-1) * spacing
    // The last card takes up cardWidth, so total = cardWidth + (handSize-1) * (cardWidth + buffer)
    var idealHandWidth =
      this.cardWidth + (handSize - 1) * (this.cardWidth + buffer);

    // If hand is too wide, reduce spacing (overlap cards)
    var actualBuffer = buffer;
    if (idealHandWidth > availableWidth) {
      // Calculate spacing needed: availableWidth = cardWidth + (handSize-1) * (cardWidth + actualBuffer)
      // Solve for actualBuffer: actualBuffer = (availableWidth - cardWidth) / (handSize - 1) - cardWidth
      if (handSize > 1) {
        actualBuffer =
          (availableWidth - this.cardWidth) / (handSize - 1) - this.cardWidth;
        // Ensure buffer doesn't go too negative (limit overlap)
        if (actualBuffer < -this.cardWidth + 10) {
          actualBuffer = -this.cardWidth + 10; // Keep at least 10px visible
        }
      }
    }

    var totalHandWidth =
      this.cardWidth + (handSize - 1) * (this.cardWidth + actualBuffer);
    var startX = (this.stageWidth - totalHandWidth) / 2;

    for (var i = 0; i < handSize; i++) {
      var card = myHand[i];
      if (!card || !card.assetId) continue;
      var xPos = startX + i * (this.cardWidth + actualBuffer);
      var yPos =
        this.stageHeight -
        (this.cardHeight + this._layoutConfig.HAND_BOTTOM_MARGIN);

      var createdSpriteIds = this.drawCardFace({
        baseId: card.assetId,
        card: card,
        x: xPos,
        y: yPos,
        width: this.cardWidth,
        height: this.cardHeight,
        isPlayerControlled: true,
        isInteractive: true, // implied by isPlayerControlled in addSprite options
        overrideSuit: null,
      });
      if (createdSpriteIds && createdSpriteIds.length > 0) {
        createdCount += createdSpriteIds.length;
        this.myCardSpriteIds = this.myCardSpriteIds
          .toArray()
          .concat(createdSpriteIds) as any;
      }
    }
    if (createdCount > 0) this._handPrimed = true;
  }

  /**
   * Suit picker overlay (four clickable icons), centered.
   * Ephemeral; cleared on each update unless explicitly needed.
   * Positioned 20px above the player's hand row.
   *
   * NOTE: Asset sprites don't respond to clicks in Topia, so we layer
   * a transparent clickable rectangle over each suit icon.
   */
  drawSuitSelector() {
    var suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    var iconSize = 50;
    var totalWidth = suits.length * (iconSize + 10) - 10;
    var startX = (this.stageWidth - totalWidth) / 2;

    // Position 20px above the hand row
    var handY =
      this.stageHeight -
      (this.cardHeight + this._layoutConfig.HAND_BOTTOM_MARGIN);
    var yPos = handY - iconSize - 20;

    for (var i = 0; i < suits.length; i++) {
      var suit = suits[i];
      var xPos = startX + i * (iconSize + 10);
      var artDetails = this.getCardArtDetails({
        suit: suit,
        rank: 'A',
        assetId: '',
      });

      if (artDetails.suitIcon) {
        // 1. Create the visual asset sprite (non-interactive)
        var visualSprite = spriteManager.addSprite(
          artDetails.suitIcon,
          this._prune({
            uniqueId: 'suit_selector_visual_' + suit,
            positionX: xPos,
            positionY: yPos,
            width: iconSize,
            height: iconSize,
            isPlayerControlled: true,
          }),
        );
        if (visualSprite) this._suitSelectorIds.push(visualSprite.uniqueId);

        // 2. Create transparent clickable rectangle overlay
        var clickableOverlay = spriteManager.addSprite(
          'rect',
          this._prune({
            uniqueId: 'suit_selector_' + suit,
            positionX: xPos,
            positionY: yPos,
            width: iconSize,
            height: iconSize,
            fill: 'rgba(0,0,0,0.01)', // Nearly transparent
            isInteractive: true,
            isPlayerControlled: true,
          }),
        );
        if (clickableOverlay)
          this._suitSelectorIds.push(clickableOverlay.uniqueId);
      }
    }
  }

  /**
   * Create a text element with a semi-opaque background rectangle
   * Returns the created sprite IDs (background + text)
   */
  _createTextWithBackground(config: {
    uniqueId: string;
    text: string;
    positionX: number;
    positionY: number;
    fontSize: number;
    fontColor: string;
    isInteractive?: boolean;
    isPlayerControlled?: boolean;
    opacity?: number;
    centered?: boolean;
    fontSizeCategory?: string; // 'tiny', 'small', 'medium', 'large'
  }) {
    var createdIds = [];
    var bgId = config.uniqueId + '_bg';
    var textId = config.uniqueId;

    var fontSizeCat = config.fontSizeCategory || 'medium';
    var textWidth = this._estimateTextWidth(config.text, fontSizeCat);
    var textHeight = config.fontSize * 1.2;

    var bgPaddingX = this._layoutConfig.TEXT_BG_PADDING_X;
    var bgPaddingY = this._layoutConfig.TEXT_BG_PADDING_Y;

    var textX = config.positionX;
    var textY = config.positionY;

    // If centered, adjust positions
    if (config.centered) {
      textX = this.centerX - textWidth / 2;
    }

    var bgX = textX - bgPaddingX;
    var bgY = textY - bgPaddingY;
    var bgWidth = textWidth + bgPaddingX * 2;
    var bgHeight = textHeight + bgPaddingY * 2;

    // Create background rectangle
    var bg = spriteManager.addSprite(
      'rect',
      this._prune({
        uniqueId: bgId,
        positionX: bgX,
        positionY: bgY,
        width: bgWidth,
        height: bgHeight,
        fill: this._layoutConfig.TEXT_BG_COLOR,
        isInteractive: false,
        isPlayerControlled: config.isPlayerControlled,
      }),
    );
    if (bg) {
      createdIds.push(bg.uniqueId);
      this._textBgIds.push(bg.uniqueId);
    }

    // Create text on top
    var text = spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: textId,
        text: config.text,
        positionX: textX,
        positionY: textY,
        fontSize: config.fontSize,
        fontColor: config.fontColor,
        strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
        strokeWeight: this._layoutConfig.TEXT_STROKE_WEIGHT,
        isInteractive: config.isInteractive,
        isPlayerControlled: config.isPlayerControlled,
        opacity: config.opacity,
      }),
    );
    if (text) createdIds.push(text.uniqueId);

    return createdIds;
  }

  /**
   * Host-only button for starting the game.
   * "Update-or-create" so we avoid duplicate sprite errors.
   * Now includes player count display.
   */
  drawLobbyUI(gameState: any) {
    var numPlayers = Object.keys(gameState.playerHands).length;

    // Draw player count for all players (at top of screen)
    this._drawPlayerCount(numPlayers);

    if (this.myPlayerId === gameState.hostPlayerId) {
      var canStart = gameState.canStartGame;
      var buttonText = canStart ? '🎴 Start Game 🎴' : 'Waiting for players...';
      var buttonId = 'start_game_button';
      var buttonBgId = buttonId + '_bg';

      // Estimate text width for centering
      var estimatedWidth = this._estimateTextWidth(buttonText, 'large');

      var bgPaddingX = this._layoutConfig.TEXT_BG_PADDING_X;
      var bgPaddingY = this._layoutConfig.TEXT_BG_PADDING_Y;
      var bgWidth = estimatedWidth + bgPaddingX * 2;
      var bgHeight = this._layoutConfig.FONT_SIZE_LARGE * 1.2 + bgPaddingY * 2;
      // Center the box first, then position text inside with equal padding
      var bgX = this.centerX - bgWidth / 2;
      var bgY = this.centerY - bgPaddingY;
      var centeredX = bgX + bgPaddingX;

      if (this.persistentUiIds.toArray().indexOf(buttonId) !== -1) {
        spriteManager.updateSprite(buttonId, {
          text: buttonText,
          isInteractive: canStart,
          opacity: canStart ? 1.0 : 0.5,
          positionX: centeredX,
        });
        // Update background too
        if (spriteManager.getSprite(buttonBgId)) {
          spriteManager.updateSprite(buttonBgId, {
            positionX: bgX,
            width: bgWidth,
            opacity: canStart ? 0.7 : 0.4,
          });
        }
      } else {
        // Create background first
        var bg = spriteManager.addSprite(
          'rect',
          this._prune({
            uniqueId: buttonBgId,
            positionX: bgX,
            positionY: bgY,
            width: bgWidth,
            height: bgHeight,
            fill: this._layoutConfig.TEXT_BG_COLOR,
            opacity: canStart ? 0.7 : 0.4,
            isInteractive: false,
            isPlayerControlled: true,
          }),
        );
        if (bg) {
          this.persistentUiIds.push(bg.uniqueId);
          this._textBgIds.push(bg.uniqueId);
        }

        // Create button text
        var button = spriteManager.addSprite('text', {
          uniqueId: buttonId,
          text: buttonText,
          isInteractive: canStart,
          opacity: canStart ? 1.0 : 0.5,
          positionX: centeredX,
          positionY: this.centerY,
          fontSize: this._layoutConfig.FONT_SIZE_LARGE,
          fontColor: this._layoutConfig.TEXT_COLOR,
          strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
          strokeWeight: this._layoutConfig.TEXT_STROKE_WEIGHT,
        });
        if (button) this.persistentUiIds.push(button.uniqueId);
      }
    }

    // Draw instructions below the start button (visible to all players)
    this._drawLobbyInstructions();
  }

  /**
   * Draw game instructions in the lobby below the start button
   * Title is centered, rules are left-aligned but positioned toward center
   */
  _drawLobbyInstructions() {
    // Clear any existing instructions
    var instrIds = this._instructionSpriteIds.toArray();
    for (var i = 0; i < instrIds.length; i++) {
      spriteManager.removeSprite(instrIds[i]);
    }
    this._instructionSpriteIds = [] as any;

    // Get instructions from config
    var config = this._configProvider.getConfig();
    var instructions = config.instructions;

    var startY =
      this.centerY + (this._layoutConfig.INSTRUCTIONS_Y_OFFSET || 80);
    var lineHeight = this._layoutConfig.INSTRUCTIONS_LINE_HEIGHT || 45;
    var fontSize = this._layoutConfig.INSTRUCTIONS_FONT_SIZE || 35;

    // Calculate left edge for left-aligned text (offset from center)
    var leftAlignX = this.centerX - 280; // Left edge for rules, creates nice centered block

    // Draw title - CENTERED
    var titleId = 'instr_title';
    var titleText = instructions.title;
    var titleWidth = this._estimateTextWidth(titleText, 'large');
    var titleX = this.centerX - titleWidth / 2;

    var titleSprite = spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: titleId,
        text: titleText,
        positionX: titleX,
        positionY: startY,
        fontSize: fontSize + 10,
        fontColor: '#FFD700', // Gold for title
        strokeColor: '#000000',
        strokeWeight: 2,
        isPlayerControlled: true,
      }),
    );
    if (titleSprite) this._instructionSpriteIds.push(titleId);

    // Draw basic rules - LEFT ALIGNED from leftAlignX
    var currentY = startY + lineHeight;
    for (var r = 0; r < instructions.rules.length; r++) {
      var ruleId = 'instr_rule_' + r;
      var ruleText = '• ' + instructions.rules[r];

      var ruleSprite = spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: ruleId,
          text: ruleText,
          positionX: leftAlignX,
          positionY: currentY,
          fontSize: fontSize - 5,
          fontColor: this._layoutConfig.TEXT_COLOR,
          strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
          strokeWeight: 1,
          isPlayerControlled: true,
        }),
      );
      if (ruleSprite) this._instructionSpriteIds.push(ruleId);
      currentY += lineHeight - 5;
    }

    // Draw special card rules header - LEFT ALIGNED
    currentY += 10;
    var specialHeaderId = 'instr_special_header';
    var specialHeaderText = '⚡ Special Cards:';

    var headerSprite = spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: specialHeaderId,
        text: specialHeaderText,
        positionX: leftAlignX,
        positionY: currentY,
        fontSize: fontSize - 3,
        fontColor: '#FFD700',
        strokeColor: '#000000',
        strokeWeight: 1,
        isPlayerControlled: true,
      }),
    );
    if (headerSprite) this._instructionSpriteIds.push(specialHeaderId);
    currentY += lineHeight - 5;

    // Draw special card rules - LEFT ALIGNED with indent
    for (var s = 0; s < instructions.specialCardRules.length; s++) {
      var specialId = 'instr_special_' + s;
      var specialText = instructions.specialCardRules[s];
      var specialX = leftAlignX + 20; // Slight indent for special rules

      var specialSprite = spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: specialId,
          text: specialText,
          positionX: specialX,
          positionY: currentY,
          fontSize: fontSize - 8,
          fontColor: this._layoutConfig.TEXT_COLOR,
          strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
          strokeWeight: 1,
          isPlayerControlled: true,
        }),
      );
      if (specialSprite) this._instructionSpriteIds.push(specialId);
      currentY += lineHeight - 10;
    }
  }

  /**
   * Draw the player count display at the top of the screen
   */
  _drawPlayerCount(numPlayers: number) {
    var countId = 'player_count_display';
    var countBgId = countId + '_bg';
    var countText = '👥 Players: ' + numPlayers;

    var fontSize = this._layoutConfig.FONT_SIZE_TINY;
    var textWidth = this._estimateTextWidth(countText, 'tiny');
    var yPos =
      this.stageHeight * (this._layoutConfig.PLAYER_COUNT_Y_PERCENT || 0.03);

    var bgPaddingX = this._layoutConfig.TEXT_BG_PADDING_X;
    var bgPaddingY = this._layoutConfig.TEXT_BG_PADDING_Y;
    var bgWidth = textWidth + bgPaddingX * 2;
    // Center the box first, then position text inside with equal padding
    var bgX = this.centerX - bgWidth / 2;
    var centeredX = bgX + bgPaddingX;

    // Check if exists
    if (spriteManager.getSprite(countId)) {
      spriteManager.updateSprite(countId, {
        text: countText,
        positionX: centeredX,
      });
      if (spriteManager.getSprite(countBgId)) {
        spriteManager.updateSprite(countBgId, {
          positionX: bgX,
          width: bgWidth,
        });
      }
    } else {
      // Create background
      var bg = spriteManager.addSprite(
        'rect',
        this._prune({
          uniqueId: countBgId,
          positionX: bgX,
          positionY: yPos - bgPaddingY,
          width: bgWidth,
          height: fontSize * 1.2 + bgPaddingY * 2,
          fill: this._layoutConfig.TEXT_BG_COLOR,
          isInteractive: false,
          isPlayerControlled: true,
        }),
      );
      if (bg) {
        this.persistentUiIds.push(bg.uniqueId);
        this._textBgIds.push(bg.uniqueId);
      }

      // Create text
      var text = spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: countId,
          text: countText,
          positionX: centeredX,
          positionY: yPos,
          fontSize: fontSize,
          fontColor: this._layoutConfig.TEXT_COLOR,
          strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
          strokeWeight: this._layoutConfig.TEXT_STROKE_WEIGHT,
          isInteractive: false,
          isPlayerControlled: true,
        }),
      );
      if (text) this.persistentUiIds.push(text.uniqueId);
    }
  }

  /**
   * Host-only Play Again button shown after game over.
   * Resets the game to lobby state.
   */
  drawPlayAgainButton(gameState: any) {
    console.log(
      '[CVM] drawPlayAgainButton called - myPlayerId:',
      this.myPlayerId,
      'hostPlayerId:',
      gameState.hostPlayerId,
    );

    if (this.myPlayerId !== gameState.hostPlayerId) {
      console.log('[CVM] drawPlayAgainButton skipped - not host');
      return;
    }

    var buttonId = 'play_again_button';
    var buttonBgId = buttonId + '_bg';
    var buttonText = '🔄 Play Again 🔄';

    // Estimate text width for centering
    var estimatedWidth = this._estimateTextWidth(buttonText, 'large');
    var yPos = this.stageHeight * this._layoutConfig.PLAY_AGAIN_Y_PERCENT;

    var bgPaddingX = this._layoutConfig.TEXT_BG_PADDING_X;
    var bgPaddingY = this._layoutConfig.TEXT_BG_PADDING_Y;
    var bgWidth = estimatedWidth + bgPaddingX * 2;
    var bgHeight = this._layoutConfig.FONT_SIZE_LARGE * 1.2 + bgPaddingY * 2;
    // Center the box first, then position text inside with equal padding
    var bgX = this.centerX - bgWidth / 2;
    var centeredX = bgX + bgPaddingX;

    // Convert to array if needed for checking
    var uiArray = this.persistentUiIds.toArray
      ? this.persistentUiIds.toArray()
      : this.persistentUiIds;

    var buttonExists = false;
    for (var i = 0; i < uiArray.length; i++) {
      if (uiArray[i] === buttonId) {
        buttonExists = true;
        break;
      }
    }

    console.log('[CVM] Play Again button exists?', buttonExists);

    if (buttonExists) {
      // Button exists, just update position in case of resize
      console.log('[CVM] Updating existing Play Again button at x:', centeredX);
      spriteManager.updateSprite(buttonId, {
        positionX: centeredX,
      });
      if (spriteManager.getSprite(buttonBgId)) {
        spriteManager.updateSprite(buttonBgId, {
          positionX: bgX,
          width: bgWidth,
        });
      }
    } else {
      // Create background first
      console.log(
        '[CVM] Creating Play Again button at x:',
        centeredX,
        'y:',
        yPos,
      );
      var bg = spriteManager.addSprite(
        'rect',
        this._prune({
          uniqueId: buttonBgId,
          positionX: bgX,
          positionY: yPos - bgPaddingY,
          width: bgWidth,
          height: bgHeight,
          fill: this._layoutConfig.TEXT_BG_COLOR,
          isInteractive: false,
          isPlayerControlled: true,
        }),
      );
      if (bg) {
        this.persistentUiIds.push(bg.uniqueId);
        this._textBgIds.push(bg.uniqueId);
      }

      // Create new button
      var button = spriteManager.addSprite('text', {
        uniqueId: buttonId,
        text: buttonText,
        isInteractive: true,
        positionX: centeredX,
        positionY: yPos,
        fontSize: this._layoutConfig.FONT_SIZE_LARGE,
        fontColor: this._layoutConfig.TEXT_COLOR,
        strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
        strokeWeight: this._layoutConfig.TEXT_STROKE_WEIGHT,
      });
      if (button) {
        console.log(
          '[CVM] Play Again button created successfully:',
          button.uniqueId,
        );
        this.persistentUiIds.push(button.uniqueId);
      } else {
        console.log('[CVM] ERROR: Play Again button creation failed!');
      }
    }
  }

  /**
   * Discard pile top card (recreated each time to avoid partial leftovers).
   * If activeSuit is set (after a wild), we display that suit visually.
   */
  updatePlayPileView(playPile: any, activeSuit?: any) {
    if (activeSuit === null) activeSuit = undefined;

    var baseId = 'play_pile_top_card';
    var rankId = baseId + '_rank_top';
    var suitId = baseId + '_suit_top';
    var centerId = baseId + '_center';

    // If pile data is empty/missing, keep existing sprites on screen
    if (!playPile || playPile.length === 0) {
      console.log('[PILE-DBG] updatePile: EMPTY pile, keeping old sprites. spriteExists=' + !!spriteManager.getSprite(baseId));
      return;
    }

    var topCard = playPile[playPile.length - 1];
    if (!topCard) {
      console.log('[PILE-DBG] updatePile: topCard FALSY at index ' + (playPile.length - 1));
      return;
    }

    // Skip remove/recreate cycle if the top card hasn't changed.
    var currentAssetId = topCard.assetId || '';
    var currentSuit = activeSuit || '';
    if (
      currentAssetId === this._lastPileTopAssetId &&
      currentSuit === this._lastPileActiveSuit &&
      spriteManager.getSprite(baseId)
    ) {
      console.log('[PILE-DBG] updatePile: SKIP unchanged card=' + currentAssetId);
      return;
    }

    console.log('[PILE-DBG] updatePile: REDRAW old=' + this._lastPileTopAssetId + ' new=' + currentAssetId + ' suit=' + currentSuit + ' spriteExisted=' + !!spriteManager.getSprite(baseId));
    this._lastPileTopAssetId = currentAssetId;
    this._lastPileActiveSuit = currentSuit;

    if (spriteManager.getSprite(baseId)) spriteManager.removeSprite(baseId);
    if (spriteManager.getSprite(rankId)) spriteManager.removeSprite(rankId);
    if (spriteManager.getSprite(suitId)) spriteManager.removeSprite(suitId);
    if (spriteManager.getSprite(centerId)) spriteManager.removeSprite(centerId);

    var xPos = this.centerX - this.cardWidth;
    var yPos = this.centerY / 2;

    spriteManager.addSprite(
      'blank_card',
      this._prune({
        uniqueId: baseId,
        positionX: xPos,
        positionY: yPos,
        width: this.cardWidth,
        height: this.cardHeight,
        strokeColor: this._layoutConfig.CARD_STROKE_COLOR,
        strokeWeight: this._layoutConfig.CARD_STROKE_WEIGHT,
        isPlayerControlled: true,
      }),
    );
    console.log('[PILE-DBG] updatePile: addSprite done, spriteNowExists=' + !!spriteManager.getSprite(baseId));

    var displayCard = activeSuit
      ? { suit: activeSuit, rank: topCard.rank, assetId: '' }
      : topCard;
    var art = this.getCardArtDetails(displayCard);
    var textColor = this._nzStr(art.color).toLowerCase();

    spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: rankId,
        text: '' + topCard.rank,
        positionX: xPos + this._layoutConfig.CARD_LEFT_VALUE_X,
        positionY: yPos + this._layoutConfig.CARD_LEFT_VALUE_Y,
        fontSize: this._layoutConfig.FONT_SIZE_SMALL,
        fontColor: textColor,
        strokeColor: textColor === 'red' ? '#FFFFFF' : '#000000',
        strokeWeight: 1,
        isPlayerControlled: true,
      }),
    );

    var orig = this.getCardArtDetails(topCard);

    // Don't show suit icon for joker
    var isJoker = topCard && topCard.rank === 'joker';
    if (art && art.suitIcon && !isJoker) {
      spriteManager.addSprite(
        art.suitIcon,
        this._prune({
          uniqueId: suitId,
          positionX: xPos + this._layoutConfig.CARD_SUIT_LEFT_X,
          positionY: yPos + this._layoutConfig.CARD_SUIT_LEFT_Y_OFFSET,
          width: this._layoutConfig.CARD_SUIT_LEFT_SIZE,
          height: this._layoutConfig.CARD_SUIT_LEFT_SIZE,
          isPlayerControlled: true,
        }),
      );
    }

    var centerAsset = activeSuit
      ? art
        ? art.suitIcon
        : ''
      : orig
        ? orig.centerArt
        : '';
    if (centerAsset) {
      // Calculate center art size based on card type
      var baseSize = this._layoutConfig.CARD_CENTER_SUIT_SIZE;
      var centerSize = baseSize;

      const isFaceCard = (topCard.rank === 'J' || topCard.rank === 'Q' || topCard.rank === 'K')
      // When activeSuit is set (joker was played and suit chosen), always use suit size
      if (activeSuit) {
        centerSize = baseSize;
      } else if (isJoker) {
        centerSize = baseSize * this._layoutConfig.CARD_CENTER_JOKER_MULTIPLIER;
      } else if (
        topCard &&
          isFaceCard
      ) {
        centerSize = baseSize * this._layoutConfig.CARD_CENTER_FACE_MULTIPLIER;
      }

      spriteManager.addSprite(
        centerAsset,
        this._prune({
          uniqueId: centerId,
          positionX: xPos + this.cardWidth / 2 - centerSize / 2,
          positionY: yPos + this.cardHeight / 2 - centerSize / 2,
          width: centerSize,
          height: centerSize,
          // scaleX: isJoker? .5: isFaceCard ? .2 : .5,
          // scaleY: isJoker? .5: isFaceCard ? .2 : .5,
          isPlayerControlled: true,
        }),
      );
    }
  }

  /**
   * Display the last action taken (appears above turn indicator).
   * Only shows after the first action has been taken.
   */
  updateLastAction(gameState: any) {
    var uniqueId = 'last_action_text';
    var bgId = uniqueId + '_bg';

    // Remove if in lobby or no last action
    if (
      gameState.state === 'WAITING' ||
      !gameState.lastAction ||
      gameState.lastAction === ''
    ) {
      var existing = spriteManager.getSprite(uniqueId);
      if (existing) {
        spriteManager.removeSprite(uniqueId);
      }
      var existingBg = spriteManager.getSprite(bgId);
      if (existingBg) {
        spriteManager.removeSprite(bgId);
      }
      return;
    }

    var message = gameState.lastAction;
    var safeText = this._nzStr(message, '');
    if (!safeText) return;

    // Position below the turn indicator
    var turnIndicatorY =
      this.stageHeight * this._layoutConfig.TURN_INDICATOR_Y_PERCENT;
    var turnIndicatorHeight = 35; // Approximate height of turn indicator
    var yPos = turnIndicatorY + turnIndicatorHeight + 40; // 40 pixels below turn indicator

    var fontSize = 14; // Much smaller font
    var estimatedWidth = safeText.length * 7; // Rough estimate for small font

    var bgPaddingX = 8;
    var bgPaddingY = 4;
    var bgWidth = estimatedWidth + bgPaddingX * 2;
    var bgHeight = fontSize * 1.2 + bgPaddingY * 2;
    var bgX = this.centerX - bgWidth / 2;
    var centeredX = bgX + bgPaddingX;

    var existingSprite = spriteManager.getSprite(uniqueId);
    var existingBg = spriteManager.getSprite(bgId);

    if (existingSprite) {
      spriteManager.updateSprite(uniqueId, {
        text: safeText,
        positionX: centeredX,
      });
      if (existingBg) {
        spriteManager.updateSprite(bgId, {
          positionX: bgX,
          width: bgWidth,
        });
      }
    } else {
      // Create background first (slightly different style - more subtle)
      spriteManager.addSprite(
        'rect',
        this._prune({
          uniqueId: bgId,
          positionX: bgX,
          positionY: yPos - bgPaddingY,
          width: bgWidth,
          height: bgHeight,
          fill: 'rgba(0, 0, 0, 0.5)', // More transparent
          isPlayerControlled: true,
          isInteractive: false,
        }),
      );

      // Create text
      spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: uniqueId,
          text: safeText,
          positionX: centeredX,
          positionY: yPos,
          fontSize: fontSize,
          fontColor: '#AAAAAA', // Slightly dimmer than turn indicator
          strokeColor: '#000000',
          strokeWeight: 1,
          isPlayerControlled: true,
        }),
      );
    }
  }

  /**
   * Turn banner text (persistent). Uses "update-or-create" to avoid duplicates
   * and re-centers after each re-measure. Now with background for readability.
   */
  updateTurnIndicator(gameState: any) {
    var uniqueId = 'turn_indicator_text_' + this.myPlayerId;
    var bgId = uniqueId + '_bg';
    var message = '';

    // Don't show turn indicator in lobby - the Start Game button shows status
    if (gameState.state === 'WAITING') {
      // Remove the turn indicator and background if they exist
      var existing = spriteManager.getSprite(uniqueId);
      if (existing) {
        spriteManager.removeSprite(uniqueId);
      }
      var existingBg = spriteManager.getSprite(bgId);
      if (existingBg) {
        spriteManager.removeSprite(bgId);
      }
      // Also remove camping TP zone in lobby
      this.removeCampingTpZone();
      return;
    }

    if (gameState.isAwaitingSuitChoice) {
      if (gameState.currentPlayerId === this.myPlayerId) {
        message = '🎨 Choose a suit! 🎨';
      } else {
        var pd = playerManager.getPlayerDetails(gameState.currentPlayerId);
        var name = pd && pd.username ? pd.username : 'Player';
        message = '⏳ ' + name + ' is choosing a suit...';
      }
    } else if (gameState.state === 'ACTIVE_GAME') {
      var isMyTurn = this.myPlayerId === parseInt(gameState.currentPlayerId);
      var pd2 = playerManager.getPlayerDetails(gameState.currentPlayerId);
      var name2 = pd2 && pd2.username ? pd2.username : 'Player';
      message = isMyTurn ? '🎯 Your Turn! 🎯' : '⏳ ' + name2 + "'s Turn";
    } else if (gameState.state === 'GAME_OVER') {
      var wd = playerManager.getPlayerDetails(gameState.winnerId);
      var wname = wd && wd.username ? wd.username : 'Player';
      message =
        this.myPlayerId === parseInt(gameState.winnerId)
          ? '🏆 You Win! 🏆'
          : '🏆 ' + wname + ' Wins! 🏆';
    }

    var safeText = this._nzStr(message, ' ');

    // Estimate text width for centering
    var estimatedWidth = this._estimateTextWidth(safeText, 'medium');
    var yPos = this.stageHeight * this._layoutConfig.TURN_INDICATOR_Y_PERCENT;

    var bgPaddingX = this._layoutConfig.TEXT_BG_PADDING_X;
    var bgPaddingY = this._layoutConfig.TEXT_BG_PADDING_Y;
    var bgWidth = estimatedWidth + bgPaddingX * 2;
    var bgHeight = this._layoutConfig.FONT_SIZE_MEDIUM * 1.2 + bgPaddingY * 2;
    // Center the box first, then position text inside with equal padding
    var bgX = this.centerX - bgWidth / 2;
    var centeredX = bgX + bgPaddingX;

    var existingSprite = spriteManager.getSprite(uniqueId);
    var existingBg = spriteManager.getSprite(bgId);

    if (existingSprite) {
      spriteManager.updateSprite(uniqueId, {
        text: safeText,
        positionX: centeredX,
      });
      if (existingBg) {
        spriteManager.updateSprite(bgId, {
          positionX: bgX,
          width: bgWidth,
        });
      }
      // Also update camping TP zone position
      this.updateCampingTpZone(bgX, yPos - bgPaddingY, bgWidth, bgHeight);
    } else {
      // Create background first
      var bg = spriteManager.addSprite(
        'rect',
        this._prune({
          uniqueId: bgId,
          positionX: bgX,
          positionY: yPos - bgPaddingY,
          width: bgWidth,
          height: bgHeight,
          fill: this._layoutConfig.TEXT_BG_COLOR,
          isPlayerControlled: true,
          isInteractive: false,
        }),
      );
      if (bg) this._textBgIds.push(bg.uniqueId);

      // Create text
      spriteManager.addSprite('status_text', {
        uniqueId: uniqueId,
        text: safeText,
        isPlayerControlled: true,
        positionX: centeredX,
        positionY: yPos,
        fontSize: this._layoutConfig.FONT_SIZE_MEDIUM,
        fontColor: this._layoutConfig.TEXT_COLOR,
        strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
        strokeWeight: this._layoutConfig.TEXT_STROKE_WEIGHT,
      });
    }

    // Update camping TP zone to cover turn indicator area
    this.updateCampingTpZone(bgX, yPos - bgPaddingY, bgWidth, bgHeight);
  }

  /**
   * Create or update the camping TP zone.
   * This invisible zone teleports players who stand on critical UI areas.
   * Host creates/manages this zone; collision detection handles teleportation.
   */
  updateCampingTpZone(x: number, y: number, width: number, height: number) {
    if (!playerManager.isHost) return;
    if (!this._layoutConfig.CAMPING_TP_ENABLED) return;

    var padding = this._layoutConfig.CAMPING_TP_PADDING || 20;
    var zoneId = this._campingTpZoneId;

    // Expand zone by padding
    var zoneX = x - padding;
    var zoneY = y - padding;
    var zoneWidth = width + padding * 2;
    var zoneHeight = height + padding * 2;

    var existing = spriteManager.getSprite(zoneId);

    if (existing) {
      spriteManager.updateSprite(zoneId, {
        positionX: zoneX,
        positionY: zoneY,
        width: zoneWidth,
        height: zoneHeight,
      });
    } else {
      spriteManager.addSprite(
        'rect',
        this._prune({
          uniqueId: zoneId,
          positionX: zoneX,
          positionY: zoneY,
          width: zoneWidth,
          height: zoneHeight,
          fill: 'rgba(0, 0, 0, 0)', // Invisible
          opacity: 0,
          isInteractive: false,
          checkCollisions: true,
          collisionGroup: 'camping_tp',
        }),
      );
      console.log(
        '[CVM] Created camping TP zone at (' +
          zoneX +
          ', ' +
          zoneY +
          ') size ' +
          zoneWidth +
          'x' +
          zoneHeight,
      );
    }
  }

  /**
   * Remove the camping TP zone (e.g., when returning to lobby).
   */
  removeCampingTpZone() {
    if (!playerManager.isHost) return;

    var existing = spriteManager.getSprite(this._campingTpZoneId);
    if (existing) {
      spriteManager.removeSprite(this._campingTpZoneId);
      console.log('[CVM] Removed camping TP zone');
    }
  }

  /**
   * Handle collision with camping TP zone.
   * When a player enters the zone, teleport them away from the UI.
   */
  onSpriteCollisionStart({
    sprite1,
    sprite2,
  }: {
    sprite1: PseudoSprite;
    sprite2: PseudoSprite;
  }) {
    if (!playerManager.isHost) return;
    if (!this._layoutConfig.CAMPING_TP_ENABLED) return;

    var s1 = sprite1;
    var s2 = sprite2;
    if (!s1 || !s2) return;

    // Check if one sprite is a player and the other is the camping zone
    var playerSprite =
      (s1 as any).playerId !== undefined
        ? s1
        : (s2 as any).playerId !== undefined
          ? s2
          : null;
    var zoneSprite =
      s1.collisionGroup === 'camping_tp'
        ? s1
        : s2.collisionGroup === 'camping_tp'
          ? s2
          : null;

    if (playerSprite && zoneSprite) {
      var pid = (playerSprite as any).playerId;
      if (pid) {
        // Teleport player away from the UI area
        var teleportRadius =
          this._layoutConfig.CAMPING_TP_TELEPORT_RADIUS || 150;

        // Teleport to a random position around the center, but away from the camping zone
        var angle = Math.random() * Math.PI * 2;
        var targetX = this.centerX + Math.cos(angle) * teleportRadius * 2;
        var targetY = this.centerY + Math.sin(angle) * teleportRadius * 2;

        // Clamp to stage bounds
        targetX = Math.max(50, Math.min(this.stageWidth - 50, targetX));
        targetY = Math.max(50, Math.min(this.stageHeight - 50, targetY));

        playerManager.teleportPlayers([pid], {
          distributionType: 'radius',
          radius: 30,
          positionX: targetX,
          positionY: targetY,
        });

        console.log(
          '[CVM] Teleported player P' +
            pid +
            ' away from UI zone to (' +
            Math.round(targetX) +
            ', ' +
            Math.round(targetY) +
            ')',
        );
      }
    }
  }

  /**
   * Draw pile back (persistent). Created once and removed when deckSize==0.
   */
  updateDrawPileView(deckSize: number) {
    var pileId = 'draw_pile';
    var backgroundId = pileId + '_background';
    var idx = this.persistentUiIds.toArray().indexOf(pileId);
    if (deckSize > 0) {
      if (idx === -1) {
        var xPos = this.centerX + this.cardWidth;
        var yPos = this.centerY / 2;
        var createdIds = this.drawCardBack(
          pileId,
          xPos,
          yPos,
          this.cardWidth,
          this.cardHeight,
          0,
          true,
        );
        this.persistentUiIds = this.persistentUiIds
          .toArray()
          .concat(createdIds) as any;
      }
    } else if (idx !== -1) {
      spriteManager.removeSprite(pileId);
      spriteManager.removeSprite(backgroundId);
      var arr = this.persistentUiIds.toArray();
      arr.splice(idx, 1);
      // Also remove background from persistent IDs if it exists
      var bgIdx = arr.indexOf(backgroundId);
      if (bgIdx !== -1) {
        arr.splice(bgIdx, 1);
      }
      this.persistentUiIds = arr as any;
    }
  }

  /**
   * Other player status indicators (persistent).
   * Shows player name and remaining card count positioned around top.
   * Left-aligned with line breaks between players for readability.
   */
  updatePlayerStatus(allPlayerHands: any) {
    // Clear previous status sprites
    var statusIds = this._playerStatusIds.toArray();
    for (var i = 0; i < statusIds.length; i++) {
      spriteManager.removeSprite(statusIds[i]);
    }
    this._playerStatusIds = [] as any;

    if (!allPlayerHands) return;

    console.log('[CVM] updatePlayerStatus - myPlayerId:', this.myPlayerId);

    // Get all player IDs except mine (only show OTHER players' status)
    var allIds = [];
    for (var pid in allPlayerHands) {
      if (allPlayerHands.hasOwnProperty(pid)) {
        var playerId = parseInt(pid);
        console.log(
          '[CVM] checking playerId:',
          playerId,
          'vs myPlayerId:',
          this.myPlayerId,
          'equal?',
          playerId === this.myPlayerId,
        );
        // Skip rendering status for my own hand - I can already see my cards
        if (playerId !== this.myPlayerId) {
          allIds.push(playerId);
          console.log('[CVM] added opponent playerId:', playerId);
        } else {
          console.log('[CVM] skipped self playerId:', playerId);
        }
      }
    }
    console.log('[CVM] rendering status for opponent IDs:', allIds);

    // Position opponents at top-left with vertical spacing
    // Add 20px offset to X to avoid negative positioning, subtract 20px from Y to move up
    var startX = (this._layoutConfig.PLAYER_STATUS_START_X || 10) + 20;
    var startY =
      this.stageHeight * this._layoutConfig.PLAYER_STATUS_Y_PERCENT - 20;
    var lineHeight = this._layoutConfig.PLAYER_STATUS_LINE_HEIGHT;

    for (var idx = 0; idx < allIds.length; idx++) {
      var currentPlayerId = allIds[idx];
      var hand = allPlayerHands[currentPlayerId + ''];
      var cardCount = hand ? hand.length : 0;
      var yPos = startY + idx * lineHeight;

      var statusId = 'player_status_' + currentPlayerId;
      var statusBgId = statusId + '_bg';
      // Get player details to get username
      var playerDetails = playerManager.getPlayerDetails(currentPlayerId);
      var playerName = playerDetails
        ? playerDetails.username
        : 'Player ' + currentPlayerId;
      var statusText =
        playerName + ': ' + cardCount + (cardCount === 1 ? ' card' : ' cards');

      // Calculate background dimensions
      var textWidth = this._estimateTextWidth(statusText, 'tiny');
      var bgPaddingX = this._layoutConfig.TEXT_BG_PADDING_X;
      var bgPaddingY = this._layoutConfig.TEXT_BG_PADDING_Y;
      var bgWidth = textWidth + bgPaddingX * 2;
      var bgHeight = this._layoutConfig.FONT_SIZE_TINY * 1.2 + bgPaddingY * 2;

      // Create background rect first
      var bg = spriteManager.addSprite(
        'rect',
        this._prune({
          uniqueId: statusBgId,
          positionX: startX - bgPaddingX,
          positionY: yPos - bgPaddingY,
          width: bgWidth,
          height: bgHeight,
          fill: this._layoutConfig.TEXT_BG_COLOR,
          isPlayerControlled: true,
          isInteractive: false,
        }),
      );
      if (bg) {
        this._playerStatusIds.push(statusBgId);
      }

      // Create text on top
      spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: statusId,
          text: statusText,
          positionX: startX,
          positionY: yPos,
          fontSize: this._layoutConfig.FONT_SIZE_TINY,
          fontColor: this._layoutConfig.TEXT_COLOR,
          strokeColor: this._layoutConfig.TEXT_STROKE_COLOR,
          strokeWeight: this._layoutConfig.TEXT_STROKE_WEIGHT,
          isInteractive: false,
          isPlayerControlled: true, // Each client renders their own opponent status
        }),
      );

      this._playerStatusIds.push(statusId);
    }
  }

  /**
   * Composite card: base + rank + suit + center art.
   * Returns created sprite ids (for cleanup tracking).
   */
  drawCardFace(config: any) {
    var createdIds = [];
    var artDetails = this.getCardArtDetails(config.card);
    var textColor = this._nzStr(artDetails.color).toLowerCase();

    var base = spriteManager.addSprite(
      'blank_card',
      this._prune({
        uniqueId: config.baseId,
        positionX: config.x,
        positionY: config.y,
        width: config.width,
        height: config.height,
        strokeColor: this._layoutConfig.CARD_STROKE_COLOR,
        strokeWeight: this._layoutConfig.CARD_STROKE_WEIGHT,
        isPlayerControlled: config.isPlayerControlled,
        isInteractive: config.isPlayerControlled,
      }),
    );
    if (base) createdIds.push(base.uniqueId);

    var rankTop = spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: config.baseId + '_rank_top',
        text: config.card && config.card.rank ? '' + config.card.rank : ' ',
        positionX: config.x + this._layoutConfig.CARD_LEFT_VALUE_X,
        positionY: config.y + this._layoutConfig.CARD_LEFT_VALUE_Y,
        fontSize: this._layoutConfig.FONT_SIZE_SMALL,
        fontColor: textColor,
        strokeColor: textColor === 'red' ? '#FFFFFF' : '#000000',
        strokeWeight: 1,
        isPlayerControlled: config.isPlayerControlled,
        isInteractive: false,
      }),
    );
    if (rankTop) createdIds.push(rankTop.uniqueId);

    // Don't show suit icon for joker
    var isJoker = config.card && config.card.rank === 'joker';
    if (artDetails.suitIcon && !isJoker) {
      var suitTop = spriteManager.addSprite(
        artDetails.suitIcon,
        this._prune({
          uniqueId: config.baseId + '_suit_top',
          positionX: config.x + this._layoutConfig.CARD_SUIT_LEFT_X,
          positionY: config.y + this._layoutConfig.CARD_SUIT_LEFT_Y_OFFSET,
          width: this._layoutConfig.CARD_SUIT_LEFT_SIZE,
          height: this._layoutConfig.CARD_SUIT_LEFT_SIZE,
          // scaleX: .5,
          // scaleY: .5,
          isPlayerControlled: config.isPlayerControlled,
          isInteractive: false,
        }),
      );
      if (suitTop) createdIds.push(suitTop.uniqueId);
    }

    var originalArtDetails = this.getCardArtDetails(config.card);
    var centerArtAsset = config.overrideSuit
      ? artDetails.suitIcon
      : originalArtDetails.centerArt;
    if (centerArtAsset) {
      // Calculate center art size based on card type
      var baseSize = this._layoutConfig.CARD_CENTER_SUIT_SIZE;
      var centerSize = baseSize;

      if (isJoker) {
        centerSize = baseSize * this._layoutConfig.CARD_CENTER_JOKER_MULTIPLIER;
      } else if (
        config.card &&
        (config.card.rank === 'J' ||
          config.card.rank === 'Q' ||
          config.card.rank === 'K')
      ) {
        centerSize = baseSize * this._layoutConfig.CARD_CENTER_FACE_MULTIPLIER;
      }

      // Apply Y offset for face cards to make room for special labels
      var isFaceCard =
        config.card &&
        (config.card.rank === 'J' ||
          config.card.rank === 'Q' ||
          config.card.rank === 'K');
      var faceYOffset = isFaceCard
        ? this._layoutConfig.CARD_CENTER_FACE_Y_OFFSET || 0
        : 0;

      var centerArt = spriteManager.addSprite(
        centerArtAsset,
        this._prune({
          uniqueId: config.baseId + '_center',
          positionX: config.x + config.width / 2 - centerSize / 2,
          positionY:
            config.y + config.height / 2 - centerSize / 2 + faceYOffset,
          width: centerSize,
          height: centerSize,
          // scaleX: isJoker? .5: isFaceCard ? .2 : .5,
          // scaleY: isJoker? .5: isFaceCard ? .2 : .5,
          isPlayerControlled: config.isPlayerControlled,
          isInteractive: false,
        }),
      );
      if (centerArt) createdIds.push(centerArt.uniqueId);
    }

    // Add special card label if applicable (positioned at bottom center)
    var cardRank = config.card && config.card.rank ? '' + config.card.rank : '';
    var specialLabel = this._getSpecialCardLabel(cardRank);
    if (specialLabel) {
      var labelSize = this._layoutConfig.SPECIAL_CARD_LABEL_SIZE || 18;
      var labelColor = this._layoutConfig.SPECIAL_CARD_LABEL_COLOR || '#000000';
      var labelStrokeColor =
        this._layoutConfig.SPECIAL_CARD_LABEL_STROKE_COLOR || '#FFFFFF';
      var labelStrokeWeight =
        this._layoutConfig.SPECIAL_CARD_LABEL_STROKE_WEIGHT || 2;
      var labelYOffset = this._layoutConfig.SPECIAL_CARD_LABEL_Y_OFFSET || 30;

      // Estimate label width for centering (rough approximation)
      var labelWidth = specialLabel.length * (labelSize * 0.6);

      var labelSprite = spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: config.baseId + '_special_label',
          text: specialLabel,
          positionX: config.x + config.width / 2 - labelWidth / 2,
          positionY: config.y + config.height - labelYOffset, // Bottom of card minus offset
          fontSize: labelSize,
          fontColor: labelColor,
          strokeColor: labelStrokeColor,
          strokeWeight: labelStrokeWeight,
          isPlayerControlled: config.isPlayerControlled,
          isInteractive: false,
        }),
      );
      if (labelSprite) createdIds.push(labelSprite.uniqueId);
    }

    return createdIds;
  }

  /** Simple card back block. */
  drawCardBack(
    baseId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rotation: number,
    isInteractive: boolean,
  ) {
    var createdIds = [];

    console.log("draw pile interactive",isInteractive)
    // Base blank card
    var blankCard = spriteManager.addSprite(
      'blank_card',
      this._prune({
        uniqueId: baseId,
        positionX: x,
        positionY: y,
        width: w,
        height: h,
        isInteractive: isInteractive,
        rotation: rotation,
        opacity:0,
        displayLayer:"BOTTOM"
      }),
    );
    if (blankCard) createdIds.push(blankCard.uniqueId);

    // Card background sprite centered on top
    var cardBackground = spriteManager.addSprite(
      'card_background',
      this._prune({
        uniqueId: baseId + '_background',
        positionX: x + w / 2 - w / 2,
        positionY: y + h / 2 - h / 2,
        width: w,
        height: h,
        // scaleX: .4,
        // scaleY: .4,
        isInteractive: true,
        rotation: rotation,
        bottomAdjust:"BRING_TO_FRONT",
      }),
    );
    if (cardBackground) createdIds.push(cardBackground.uniqueId);

    return createdIds;
  }

  /**
   * Visual mapping from card data -> asset ids and color.
   * - suitIcon: small glyph for corners
   * - centerArt: face art or suit for number cards
   */
  getCardArtDetails(card: CardData) {
    if (!card || !card.suit) {
      return { suitIcon: '', centerArt: '', color: 'Black' };
    }

    var isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    var color = isRed ? 'Red' : 'Black';

    // Get asset names from config
    var assets = this._layoutConfig.CARD_ASSETS;
    var suitAssets = assets[card.suit];

    if (!suitAssets) {
      return { suitIcon: '', centerArt: '', color: color };
    }

    var suitIcon = suitAssets.suit || '';
    var centerArt = '';

    // Determine center art based on rank
    if (card.rank === 'J') {
      centerArt = suitAssets.jack || suitIcon;
    } else if (card.rank === 'Q') {
      centerArt = suitAssets.queen || suitIcon;
    } else if (card.rank === 'K') {
      centerArt = suitAssets.king || suitIcon;
    } else if (card.rank === 'joker') {
      centerArt = suitAssets.face || suitIcon;
    } else {
      // Number cards use the suit icon
      centerArt = suitIcon;
    }

    return { suitIcon: suitIcon, centerArt: centerArt, color: color };
  }

  // ==========================================
  // HELP SYSTEM
  // ==========================================

  /**
   * Render the help button (?) in the upper right corner
   */
  renderHelpButton() {
    var buttonId = 'help_button';

    var buttonSize = this._layoutConfig.HELP_BUTTON_SIZE || 45;
    var xOffset = this._layoutConfig.HELP_BUTTON_X_OFFSET || 50;
    var yPercent = this._layoutConfig.HELP_BUTTON_Y_PERCENT || 0.02;

    var xPos = this.stageWidth - xOffset;
    var yPos = this.stageHeight * yPercent;

    // Create button (no background)
    if (!spriteManager.getSprite(buttonId)) {
      spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: buttonId,
          text: '❓',
          positionX: xPos,
          positionY: yPos,
          fontSize: buttonSize,
          fontColor: '#FFFFFF',
          isInteractive: true,
          isPlayerControlled: true,
        }),
      );
    }
  }

  /**
   * Show the help drawer overlay with game instructions
   *
   * === COMPACT TOP LAYOUT (2024-12-18) ===
   * Positioned at the top of the screen in the "safe zone":
   * - Right of player card counts (left side)
   * - Above the draw/play piles (which start around y=250)
   * - Left of the help button
   * Uses a compact 2-column layout to fit all info.
   * =================================
   */
  showHelpDrawer() {
    this._helpDrawerOpen = true;

    // Clear any existing help sprites
    this.closeHelpDrawer();
    this._helpDrawerOpen = true;

    // Compact layout settings
    var fontSize = 22;
    var lineHeight = 28;
    var padding = 12;

    // Position: top of screen, avoid player counts on left, help button on right
    // Safe zone: x=180 to x=900, y=10 to y=200 (above piles at ~250)
    var overlayX = 180;
    var overlayY = 10;
    var overlayWidth = 720;
    var overlayHeight = 190;

    // Create background
    var bgId = 'help_overlay_bg';
    spriteManager.addSprite(
      'rect',
      this._prune({
        uniqueId: bgId,
        positionX: overlayX,
        positionY: overlayY,
        width: overlayWidth,
        height: overlayHeight,
        fill: 'rgba(0, 0, 0, 0.92)',
        strokeColor: '#FFD700',
        strokeWeight: 2,
        isInteractive: false,
        isPlayerControlled: true,
        displayLayer:"top",
      }),
    );
    this._helpSpriteIds.push(bgId);

    // Title - centered at top
    var titleId = 'help_title';
    var titleText = '🃏 Last Card Rules';
    var titleWidth = this._estimateTextWidth(titleText, 'medium');
    var titleX = overlayX + (overlayWidth - titleWidth) / 2;

    spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: titleId,
        text: titleText,
        positionX: titleX,
        positionY: overlayY + padding,
        fontSize: fontSize + 4,
        fontColor: '#FFD700',
        strokeColor: '#000000',
        strokeWeight: 1,
        isPlayerControlled: true,
        displayLayer:"top",
        topAdjust:1000,
      }),
    );
    this._helpSpriteIds.push(titleId);

    // Two-column layout
    var col1X = overlayX + padding;
    var col2X = overlayX + overlayWidth / 2 + padding;
    var startY = overlayY + padding + 35;

    // Column 1: Basic Rules
    var col1Lines = [
      '📋 Basic Rules:',
      '• Match suit or rank',
      "• Draw if you can't play",
      '• First to empty hand wins',
    ];

    var y1 = startY;
    for (var i = 0; i < col1Lines.length; i++) {
      var lineId = 'help_col1_' + i;
      var isHeader = col1Lines[i].indexOf('📋') !== -1;

      spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: lineId,
          text: col1Lines[i],
          positionX: col1X,
          positionY: y1,
          fontSize: isHeader ? fontSize : fontSize - 2,
          fontColor: isHeader ? '#FFD700' : '#FFFFFF',
          strokeColor: '#000000',
          strokeWeight: 1,
          isPlayerControlled: true,
        displayLayer:"top",
        topAdjust:1000,
        }),
      );
      this._helpSpriteIds.push(lineId);
      y1 += lineHeight;
    }

    // Column 2: Special Cards
    var col2Lines = [
      '⚡ Special Cards:',
      '• 2 = Next draws 2, skipped',
      '• A = Skip next player',
      '• Q = Reverse direction',
      '• Joker = Wild (pick suit)',
    ];

    var y2 = startY;
    for (var j = 0; j < col2Lines.length; j++) {
      var lineId2 = 'help_col2_' + j;
      var isHeader2 = col2Lines[j].indexOf('⚡') !== -1;

      spriteManager.addSprite(
        'text',
        this._prune({
          uniqueId: lineId2,
          text: col2Lines[j],
          positionX: col2X,
          positionY: y2,
          fontSize: isHeader2 ? fontSize : fontSize - 2,
          fontColor: isHeader2 ? '#FFD700' : '#FFFFFF',
          strokeColor: '#000000',
          strokeWeight: 1,
          isPlayerControlled: true,
        displayLayer:"top",
        topAdjust:1000,
        }),
      );
      this._helpSpriteIds.push(lineId2);
      y2 += lineHeight;
    }

    // Close hint at bottom of overlay
    var closeId = 'help_close_hint';
    var closeText = '(tap ❓ to close)';
    var closeWidth = this._estimateTextWidth(closeText, 'tiny');
    var closeX = overlayX + (overlayWidth - closeWidth) / 2;

    spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: closeId,
        text: closeText,
        positionX: closeX,
        positionY: overlayY + overlayHeight - 22,
        fontSize: 18,
        fontColor: '#666666',
        isPlayerControlled: true,
        displayLayer:"top",
        topAdjust:1000,
      }),
    );
    this._helpSpriteIds.push(closeId);

    console.log('[CVM] Help drawer opened (compact top layout)');
  }

  /**
   * Close the help drawer
   */
  closeHelpDrawer() {
    this._helpDrawerOpen = false;

    // Remove all help sprites
    var helpIds = this._helpSpriteIds.toArray
      ? this._helpSpriteIds.toArray()
      : this._helpSpriteIds;

    if (helpIds) {
      for (var i = 0; i < helpIds.length; i++) {
        var id = helpIds[i];
        if (spriteManager.getSprite(id)) {
          spriteManager.removeSprite(id);
        }
      }
    }
    this._helpSpriteIds = [] as any;
  }

  /**
   * Get the special card label for a card rank (if any)
   * Returns null if no special label for this card
   */
  _getSpecialCardLabel(rank: string): string {
    if (!this._localGameState || !this._localGameState.specialCards) {
      console.log(
        '[CVM] _getSpecialCardLabel: no specialCards in state for rank=' + rank,
      );
      return null;
    }
    var special = this._localGameState.specialCards;

    if (special.draw2 && special.draw2.enabled && rank === special.draw2.rank) {
      console.log(
        '[CVM] _getSpecialCardLabel: draw2 match for rank=' +
          rank +
          ' label=' +
          special.draw2.label,
      );
      return special.draw2.label;
    }
    if (special.skip && special.skip.enabled && rank === special.skip.rank) {
      console.log(
        '[CVM] _getSpecialCardLabel: skip match for rank=' +
          rank +
          ' label=' +
          special.skip.label,
      );
      return special.skip.label;
    }
    if (
      special.reverse &&
      special.reverse.enabled &&
      rank === special.reverse.rank
    ) {
      console.log(
        '[CVM] _getSpecialCardLabel: reverse match for rank=' +
          rank +
          ' label=' +
          special.reverse.label,
      );
      return special.reverse.label;
    }
    if (special.wild && special.wild.enabled && rank === special.wild.rank) {
      console.log(
        '[CVM] _getSpecialCardLabel: wild match for rank=' +
          rank +
          ' label=' +
          special.wild.label,
      );
      return special.wild.label;
    }

    return null;
  }
}
