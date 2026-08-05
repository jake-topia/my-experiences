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
      if (v === null || v === undefined) continue;
      if (typeof v === 'boolean' && v === false) continue;
      if (typeof v === 'string' && v === '') continue;
      if (typeof v === 'number' && v === 0) continue;
      out[k] = v;
    }
    return out;
  }

  // ---------- Engine-safe null/number/bool helpers ----------
  _nzStr(v: any) {
    return v === null || v === undefined ? '' : '' + v;
  }
  _nzNum(v: any, fallback: number) {
    var n = +v;
    return v === null || v === undefined || isNaN(n) ? fallback : n;
  }
  _nzBool(v: any, fallback: boolean) {
    return v === null || v === undefined ? fallback : !!v;
  }

  /** My local player id (for input routing and turn/UI checks). */
  myPlayerId: number;

  // ---------- Sprite id tracking (locals only; not game state) ----------
  myCardSpriteIds: PseudoList; // ids for my hand
  opponentCardSpriteIds: PseudoList; // (reserved) opponents if/when rendered
  persistentUiIds: PseudoList; // UI that survives updates (buttons, draw pile)
  _suitSelectorIds: PseudoList; // suit pick overlay sprites

  // ---------- Visual + local state mirrors ----------
  cardWidth: number;
  cardHeight: number;
  _localGameState: any; // last payload received (read-only usage)
  _lastStateVersion: number;

  // ---------- One-time gates to prevent first-frame glitches ----------
  _handPrimed: boolean;
  _pilePrimed: boolean;

  constructor() {
    this.myPlayerId = 0;
    this.cardWidth = 80;
    this.cardHeight = 130;
    this._localGameState = null;
    this._lastStateVersion = 0;
    this.myCardSpriteIds = [];
    this.opponentCardSpriteIds = [];
    this.persistentUiIds = [];
    this._suitSelectorIds = [];
    this._handPrimed = false;
    this._pilePrimed = false;
    console.log('[CVM] init');
  }

  onInit() {
    // Cache my id and request a fresh snapshot in case we joined mid-game.
    this.myPlayerId = playerManager.getMyPlayerId();
    eventManager.emit('playerRequestsFullSync', {
      fromPlayerId: this.myPlayerId,
    });
    console.log('[CVM] ready P' + this.myPlayerId);
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
      this.processStateUpdate(newState);
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
    this._localGameState = newState;

    // Always remove any suit overlay before rebuilding UI for new state.
    this.clearSuitSelector();

    if (newState.feedback && newState.feedback.playerId === this.myPlayerId) {
      console.log('[CVM] msg host: ' + newState.feedback.message);
    }

    if (newState.state === 'WAITING') {
      // Lobby view
      this.clearGameSprites();
      this.drawLobbyUI(newState);
      this._handPrimed = false;
      this._pilePrimed = false;
    } else if (
      newState.state === 'ACTIVE_GAME' ||
      newState.state === 'GAME_OVER'
    ) {
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
  }

  /**
   * Click router:
   * - Suit buttons -> playerSelectsSuit
   * - Lobby start button (host only) -> hostStartsGame
   * - Hand cards (my turn only) -> playerWantsToPlayCard
   * - Draw pile (my turn only) -> playerWantsToDrawCard
   */
  onSpriteClicked({ sprite }: { sprite: any }) {
    if (sprite == undefined || !this._localGameState) return;

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
      if (sprite.uniqueId && sprite.uniqueId === 'draw_pile') {
        eventManager.emit('playerWantsToDrawCard', {
          fromPlayerId: this.myPlayerId,
        });
      }
    }
  }

  // ---------- Clear helpers (ephemeral sprites) ----------
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
    }
    this.myCardSpriteIds = [];
    this.opponentCardSpriteIds = [];
  }

  clearLobbySprites() {
    var buttonId = 'start_game_button';
    var buttonIndex = this.persistentUiIds.toArray().indexOf(buttonId);
    if (buttonIndex !== -1) {
      spriteManager.removeSprite(buttonId);
      var buf = this.persistentUiIds.toArray();
      buf.splice(buttonIndex, 1);
      this.persistentUiIds = buf;
    }
  }

  clearSuitSelector() {
    var selectorIds = this._suitSelectorIds.toArray();
    for (var i = 0; i < selectorIds.length; i++) {
      spriteManager.removeSprite(selectorIds[i]);
    }
    this._suitSelectorIds = [];
  }

  // ---------- Drawing ----------
  /**
   * Draw my hand centered along the bottom.
   * Uses ephemeral sprites; ids collected into myCardSpriteIds each frame.
   */
  drawMyHand(allPlayerHands: any) {
    var myHand = allPlayerHands[this.myPlayerId + ''];
    if (!myHand) return;

    this.myCardSpriteIds = [];
    var createdCount = 0;

    var handSize = myHand.length;
    var screenWidth = 500,
      screenHeight = 500;
    var buffer = 10,
      totalHandWidth = handSize * (this.cardWidth + buffer);
    var startX = (screenWidth - totalHandWidth) / 2;

    for (var i = 0; i < handSize; i++) {
      var card = myHand[i];
      if (!card || !card.assetId) continue;
      var xPos = startX + i * (this.cardWidth + buffer);
      var yPos = screenHeight - (this.cardWidth + 80);

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
          .concat(createdSpriteIds);
      }
    }
    if (createdCount > 0) this._handPrimed = true;
  }

  /**
   * Suit picker overlay (four clickable icons), centered.
   * Ephemeral; cleared on each update unless explicitly needed.
   */
  drawSuitSelector() {
    var suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    var iconSize = 50;
    var totalWidth = suits.length * (iconSize + 10) - 10;
    var startX = (500 - totalWidth) / 2;

    for (var i = 0; i < suits.length; i++) {
      var suit = suits[i];
      var xPos = startX + i * (iconSize + 10);
      var yPos = 250;
      var artDetails = this.getCardArtDetails({
        suit: suit,
        rank: 'A',
        assetId: '',
      });
      if (artDetails.suitIcon) {
        var icon = spriteManager.addSprite(artDetails.suitIcon, {
          uniqueId: 'suit_selector_' + suit,
          positionX: xPos,
          positionY: yPos,
          width: iconSize,
          height: iconSize,
          isInteractive: true,
          isPlayerControlled: true,
        });
        if (icon) this._suitSelectorIds.push(icon.uniqueId);
      }
    }
  }

  /**
   * Host-only button for starting the game.
   * "Update-or-create" so we avoid duplicate sprite errors.
   */
  drawLobbyUI(gameState: any) {
    if (this.myPlayerId === gameState.hostPlayerId) {
      var canStart = gameState.canStartGame;
      var numPlayers = Object.keys(gameState.playerHands).length;
      var buttonText = canStart
        ? 'Start Game'
        : 'Waiting... (' + numPlayers + ' players)';
      var buttonId = 'start_game_button';

      if (this.persistentUiIds.toArray().indexOf(buttonId) !== -1) {
        spriteManager.updateSprite(buttonId, {
          text: buttonText,
          isInteractive: canStart,
          opacity: canStart ? 1.0 : 0.5,
        });
      } else {
        var button = spriteManager.addSprite('text', {
          uniqueId: buttonId,
          text: buttonText,
          isInteractive: canStart,
          opacity: canStart ? 1.0 : 0.5,
          positionX: 250,
          positionY: 250,
        });
        if (button) this.persistentUiIds.push(button.uniqueId);
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

    if (spriteManager.getSprite(baseId)) spriteManager.removeSprite(baseId);
    if (spriteManager.getSprite(rankId)) spriteManager.removeSprite(rankId);
    if (spriteManager.getSprite(suitId)) spriteManager.removeSprite(suitId);
    if (spriteManager.getSprite(centerId)) spriteManager.removeSprite(centerId);

    if (!playPile || playPile.length === 0) return;

    var topCard = playPile[playPile.length - 1];
    if (!topCard) return;

    var xPos = 500 / 2 - this.cardWidth;
    var yPos = 500 / 4;

    spriteManager.addSprite(
      'blank_card',
      this._prune({
        uniqueId: baseId,
        positionX: xPos,
        positionY: yPos,
        width: this.cardWidth,
        height: this.cardHeight,
      }),
    );
    spriteManager.addSprite(
      'text',
      this._prune({
        uniqueId: rankId,
        text: '' + topCard.rank,
        positionX: xPos + 5,
        positionY: yPos + 5,
        fontSize: 20,
      }),
    );

    var displayCard = activeSuit
      ? { suit: activeSuit, rank: topCard.rank, assetId: '' }
      : topCard;
    var art = this.getCardArtDetails(displayCard);
    var orig = this.getCardArtDetails(topCard);

    if (art && art.suitIcon) {
      spriteManager.addSprite(
        art.suitIcon,
        this._prune({
          uniqueId: suitId,
          positionX: xPos + 5,
          positionY: yPos + 30,
          width: 15,
          height: 15,
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
      spriteManager.addSprite(
        centerAsset,
        this._prune({
          uniqueId: centerId,
          positionX: xPos + this.cardWidth / 2 - 20,
          positionY: yPos + this.cardHeight / 2 - 20,
          width: 40,
          height: 40,
        }),
      );
    }
  }

  /**
   * Turn banner text (persistent). Uses "update-or-create" to avoid duplicates
   * and re-centers after each re-measure.
   */
  updateTurnIndicator(gameState: any) {
    var uniqueId = 'turn_indicator_text_' + this.myPlayerId;
    var message = 'Waiting for players...';
    if (gameState.isAwaitingSuitChoice) {
      if (gameState.currentPlayerId === this.myPlayerId) {
        message = 'Choose a suit!';
      } else {
        var pd = playerManager.getPlayerDetails(gameState.currentPlayerId);
        var name = pd && pd.username ? pd.username : 'player';
        message = 'Waiting for ' + name + ' to choose a suit...';
      }
    } else if (gameState.state === 'ACTIVE_GAME') {
      var isMyTurn = this.myPlayerId === parseInt(gameState.currentPlayerId);
      var pd2 = playerManager.getPlayerDetails(gameState.currentPlayerId);
      var name2 = pd2 && pd2.username ? pd2.username : 'player';
      message = isMyTurn ? 'Your Turn!' : 'Waiting for ' + name2 + '...';
    } else if (gameState.state === 'GAME_OVER') {
      var wd = playerManager.getPlayerDetails(gameState.winnerId);
      var wname = wd && wd.username ? wd.username : 'player';
      message =
        this.myPlayerId === parseInt(gameState.winnerId)
          ? 'You Win!'
          : wname + ' Wins!';
    }

    var safeText = this._nzStr(message, ' ');

    var existing = spriteManager.getSprite(uniqueId);
    if (existing) {
      spriteManager.updateSprite(uniqueId, { text: safeText });
      var meas = spriteManager.getSprite(uniqueId);
      if (meas) {
        spriteManager.updateSprite(uniqueId, {
          positionX: this._nzNum(250 - meas.width * 0.5, 250),
        });
      }
    } else {
      var textSprite = spriteManager.addSprite('status_text', {
        uniqueId: uniqueId,
        text: safeText,
        isPlayerControlled: true,
        positionX: this._nzNum(500 / 2, 250),
        positionY: this._nzNum(40, 40),
      });
      if (textSprite) {
        spriteManager.updateSprite(uniqueId, {
          positionX: this._nzNum(250 - textSprite.width * 0.5, 250),
        });
      }
    }
  }

  /**
   * Draw pile back (persistent). Created once and removed when deckSize==0.
   */
  updateDrawPileView(deckSize: number) {
    var pileId = 'draw_pile';
    var idx = this.persistentUiIds.toArray().indexOf(pileId);
    if (deckSize > 0) {
      if (idx === -1) {
        var xPos = 500 / 2 + this.cardWidth;
        var yPos = 500 / 4;
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
          .concat(createdIds);
      }
    } else if (idx !== -1) {
      spriteManager.removeSprite(pileId);
      var arr = this.persistentUiIds.toArray();
      arr.splice(idx, 1);
      this.persistentUiIds = arr;
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
        positionX: config.x + 5,
        positionY: config.y + 5,
        fontSize: 20,
        fill: textColor,
        isPlayerControlled: config.isPlayerControlled,
        isInteractive: false,
      }),
    );
    if (rankTop) createdIds.push(rankTop.uniqueId);

    if (artDetails.suitIcon) {
      var suitTop = spriteManager.addSprite(
        artDetails.suitIcon,
        this._prune({
          uniqueId: config.baseId + '_suit_top',
          positionX: config.x + 5,
          positionY: config.y + 30,
          width: 15,
          height: 15,
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
      var centerArt = spriteManager.addSprite(
        centerArtAsset,
        this._prune({
          uniqueId: config.baseId + '_center',
          positionX: config.x + config.width / 2 - 20,
          positionY: config.y + config.height / 2 - 20,
          width: 40,
          height: 40,
          isPlayerControlled: config.isPlayerControlled,
          isInteractive: false,
        }),
      );
      if (centerArt) createdIds.push(centerArt.uniqueId);
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
    var cardBack = spriteManager.addSprite(
      'blank_card',
      this._prune({
        uniqueId: baseId,
        positionX: x,
        positionY: y,
        width: w,
        height: h,
        isInteractive: isInteractive,
        rotation: rotation,
      }),
    );
    return cardBack ? [cardBack.uniqueId] : [];
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
    var suitIcon = '',
      centerArt = '';
    switch (card.suit) {
      case 'hearts':
        suitIcon = 'Heart_' + color + '_1';
        break;
      case 'diamonds':
        suitIcon = 'Diamond_' + color + '_1';
        break;
      case 'clubs':
        suitIcon = 'Club_' + color + '_1';
        break;
      case 'spades':
        suitIcon = 'Spade_' + color + '_1';
        break;
      case 'joker':
        suitIcon = 'Joker_' + color + '_1';
        break;
    }
    switch (card.rank) {
      case 'J':
        centerArt = 'Jack_' + color + '_1';
        break;
      case 'Q':
        centerArt = 'Queen_' + color + '_1';
        break;
      case 'K':
        centerArt = 'King_' + color + '_1';
        break;
      case 'joker':
        centerArt = 'Joker_' + color + '_1';
        break;
      default:
        centerArt = suitIcon;
    }
    return { suitIcon: suitIcon, centerArt: centerArt, color: color };
  }
}
