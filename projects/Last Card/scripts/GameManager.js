"use strict";
class GameManager extends SystemScript {
    // ---------- Injected systems ----------
    _configProvider;
    _rulesProvider;
    _analyticsManager;
    // ---------- Config ----------
    _config;
    // ---------- Host-only authoritative state ----------
    _deck; // draw pile
    _playerHands; // { [playerId: string]: Card[] }
    _discardPile; // top is last element
    _playerTurnOrder; // array of playerIds
    _currentPlayerIndex;
    _spectators; // players who joined mid-game
    // ---------- Fields mirrored to clients ----------
    currentGameState; // 'WAITING_FOR_PLAYERS' | 'PREPARING_GAME' | 'ACTIVE_GAME' | 'GAME_OVER'
    hostPlayerId; // who can start the game
    _stateVersion; // monotonic; clients ignore old versions
    _activeSuit; // '', or one of 'hearts'|'diamonds'|'clubs'|'spades'
    _isAwaitingSuitChoice; // true after a wild card until suit chosen
    _lastSuitChoiceT; // last processed clientSuitChoice timestamp
    _playDirection; // 1 = clockwise, -1 = counter-clockwise (for reverse)
    _pendingDraw2; // stacking draw 2 count (0 = none pending)
    _lastAction; // Last action taken (for display to players)
    _cardPlayedThisTurn; // true after a card is played, cleared on turn advance
    _hasDrawnThisTurn; // true after a draw, cleared on turn advance
    // ---------- Player Colors ----------
    _playerColors; // position -> player tint color hex
    // ---------- Engine-safe helpers: never pass null/undefined into engine APIs ----------
    _nzStr(v, fb = '') {
        return v === null || v === undefined ? fb : '' + v;
    }
    _nzNum(v, fb = 0) {
        const n = +v;
        // eslint-disable-next-line no-restricted-globals
        return v === null || v === undefined || isNaN(n) ? fb : n;
    }
    _nzBool(v, fb = false) {
        return v === null || v === undefined ? fb : !!v;
    }
    onInit() {
        // Attach config/rules systems and cache config.
        scriptManager.attachSystem({ scriptId: 'CrazyEightsConfigSystem' });
        scriptManager.attachSystem({ scriptId: 'CrazyEightsRulesSystem' });
        this._configProvider = scriptManager.getSystem({
            systemName: 'CrazyEightsConfigSystem',
        });
        this._rulesProvider = scriptManager.getSystem({
            systemName: 'CrazyEightsRulesSystem',
        });
        this._config = this._configProvider.getConfig();
        // Get analytics manager reference
        this._analyticsManager = scriptManager.getSystem({
            systemName: 'CrazyEightsAnalyticsManager',
        });
        if (!this._analyticsManager) {
            console.warn('[GM] Analytics manager not found - analytics disabled');
        }
        // Host-only initialization of authoritative state.
        if (playerManager.isHost) {
            // Set the stage to 'back' for proper game rendering
            stageManager.setCurrentStage('back');
            this.currentGameState = 'WAITING_FOR_PLAYERS';
            this.hostPlayerId = playerManager.getMyPlayerId();
            this._stateVersion = 0;
            this._deck = [];
            this._playerHands = {};
            this._discardPile = [];
            this._playerTurnOrder = [];
            this._currentPlayerIndex = 0;
            this._activeSuit = '';
            this._isAwaitingSuitChoice = false;
            this._lastSuitChoiceT = 0;
            this._spectators = [];
            this._playDirection = 1; // 1 = clockwise (default)
            this._pendingDraw2 = 0; // No pending draw 2
            this._lastAction = ''; // No action yet
            this._cardPlayedThisTurn = false;
            this._hasDrawnThisTurn = false;
            // Initialize player colors for up to 4 players (card game colors)
            this._playerColors = {};
            this._playerColors['0'] = '#D9A19A'; // Light red
            this._playerColors['1'] = '#A3C4D9'; // Light blue
            this._playerColors['2'] = '#A8D9A1'; // Light green
            this._playerColors['3'] = '#F5D9A3'; // Light yellow/gold
            console.log('[GM] init - host state initialized');
            if (playerManager.getPlayerIds().length < this._config.minPlayers) {
                this.setWorldActivity('GAME_WAITING');
            }
        }
    }
    // ---------- Player lifecycle ----------
    onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        console.log('[GM] Player joined: P' + playerId);
        // Track join in analytics
        if (this._analyticsManager) {
            this._analyticsManager.trackPlayerJoin(playerId);
        }
        // Handle mid-game joins - players become spectators
        if (this.currentGameState === 'ACTIVE_GAME' ||
            this.currentGameState === 'PREPARING_GAME') {
            console.log('[GM] Game in progress - P' + playerId + ' becomes spectator');
            this._spectators.push(playerId);
            this._setSpectatorNameplate(playerId);
            // Track spectator join in analytics
            if (this._analyticsManager) {
                this._analyticsManager.trackSpectatorJoin(playerId);
            }
            // Don't add to playerHands or update lobby - they're spectating
            return;
        }
        // Assign player color and nameplate for lobby
        this._assignPlayerColorAndNameplate(playerId);
        this.updateLobbyState();
    }
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        console.log('[GM] Player left: P' + playerId);
        // Remove from spectators if applicable
        for (let i = 0; i < this._spectators.length; i++) {
            if (this._spectators[i] === playerId) {
                for (let j = i + 1; j < this._spectators.length; j++) {
                    this._spectators[j - 1] = this._spectators[j];
                }
                this._spectators.pop();
                break;
            }
        }
        // Check if leaving player was in the active game
        const wasInGame = this._playerHands[playerId + ''] !== undefined;
        delete this._playerHands[playerId + ''];
        // Remove from turn order if present
        for (let k = 0; k < this._playerTurnOrder.length; k++) {
            if (this._playerTurnOrder[k] === playerId) {
                // Adjust current index if needed
                if (k < this._currentPlayerIndex) {
                    this._currentPlayerIndex--;
                }
                else if (k === this._currentPlayerIndex &&
                    this._currentPlayerIndex >= this._playerTurnOrder.length - 1) {
                    this._currentPlayerIndex = 0;
                }
                // Remove from turn order
                for (let m = k + 1; m < this._playerTurnOrder.length; m++) {
                    this._playerTurnOrder[m - 1] = this._playerTurnOrder[m];
                }
                this._playerTurnOrder.pop();
                break;
            }
        }
        // If game is active and only 1 player remains, end the game
        if (this.currentGameState === 'ACTIVE_GAME') {
            // Track abandonment if player was in the game
            if (wasInGame && this._analyticsManager) {
                this._analyticsManager.trackGameAbandon(playerId, this._playerTurnOrder.length + 1);
            }
            if (this._playerTurnOrder.length <= 1) {
                console.log('[GM] Only one player left - ending game');
                if (this._playerTurnOrder.length === 1) {
                    const lastPlayerId = this._playerTurnOrder[0];
                    this.currentGameState = 'GAME_OVER';
                    this.updateNetworkedState(lastPlayerId);
                }
                else {
                    // No players left, return to lobby
                    this.currentGameState = 'WAITING_FOR_PLAYERS';
                    this.updateLobbyState();
                }
                return;
            }
            else if (wasInGame) {
                // Player left mid-game but game can continue - update game state only
                this.updateNetworkedState();
                return; // Don't fall through to updateLobbyState
            }
        }
        // Only update lobby state if we're not in an active game
        if (this.currentGameState !== 'ACTIVE_GAME') {
            this.updateLobbyState();
        }
    }
    // ---------- Player color and nameplate helpers ----------
    _getPlayerPosition(playerId) {
        const ids = playerManager.getPlayerIds();
        for (let i = 0; i < ids.length; i++) {
            if (ids[i] === playerId)
                return i;
        }
        return 0;
    }
    _assignPlayerColorAndNameplate(playerId) {
        const position = this._getPlayerPosition(playerId);
        const colorKey = (position % 4) + '';
        const tintColor = this._playerColors[colorKey] || '#CCCCCC';
        // Apply tint to player
        playerManager.tintPlayer(playerId, tintColor);
        // Update nameplate
        this._updatePlayerNameplate(playerId, false);
    }
    _updatePlayerNameplate(playerId, isCurrentTurn) {
        const details = playerManager.getPlayerDetails(playerId);
        if (!details)
            return;
        const username = details.username || 'Player ' + playerId;
        const hand = this._playerHands[playerId + ''];
        const cardCount = hand ? hand.length : 0;
        let nameplate = '';
        // Add turn indicator emoji if it's their turn
        if (isCurrentTurn) {
            nameplate += '🎯 ';
        }
        // Add card count during active game
        if (this.currentGameState === 'ACTIVE_GAME' && cardCount > 0) {
            nameplate += '🃏' + cardCount + ' ';
        }
        nameplate += username;
        playerManager.setNameplate(playerId, nameplate);
    }
    _setSpectatorNameplate(playerId) {
        const details = playerManager.getPlayerDetails(playerId);
        if (!details)
            return;
        const username = details.username || 'Player ' + playerId;
        playerManager.setNameplate(playerId, '👁️ ' + username + ' (Watching)');
        // Give spectators a neutral gray tint
        playerManager.tintPlayer(playerId, '#888888');
    }
    _updateAllPlayerNameplates() {
        const currentPlayerId = this._playerTurnOrder.length > 0
            ? this._playerTurnOrder[this._currentPlayerIndex]
            : 0;
        for (let i = 0; i < this._playerTurnOrder.length; i++) {
            const pid = this._playerTurnOrder[i];
            this._updatePlayerNameplate(pid, pid === currentPlayerId);
        }
    }
    // ---------- Host UI actions ----------
    onEvent_hostStartsGame({ fromPlayerId }) {
        if (!playerManager.isHost || fromPlayerId !== this.hostPlayerId)
            return;
        const numPlayers = playerManager.getPlayerIds().length;
        const canStart = numPlayers >= this._config.minPlayers &&
            numPlayers <= this._config.maxPlayers;
        // Handle Play Again from GAME_OVER state
        if (this.currentGameState === 'GAME_OVER') {
            console.log('[GM] Play Again requested by P' +
                fromPlayerId +
                ' - resetting to lobby');
            this.currentGameState = 'WAITING_FOR_PLAYERS';
            // Don't reset _stateVersion - keep incrementing to ensure clients see the update
            this._deck = [];
            this._playerHands = {};
            this._discardPile = [];
            this._playerTurnOrder = [];
            this._currentPlayerIndex = 0;
            this._activeSuit = '';
            this._isAwaitingSuitChoice = false;
            this._lastSuitChoiceT = 0;
            this._playDirection = 1; // Reset direction
            this._pendingDraw2 = 0; // Reset pending draw
            this._lastAction = ''; // Reset last action
            this.updateLobbyState();
            return;
        }
        // Handle Start Game from WAITING_FOR_PLAYERS state
        if (this.currentGameState === 'WAITING_FOR_PLAYERS' && canStart) {
            console.log('[GM] start requested by P' + fromPlayerId);
            this.currentGameState = 'PREPARING_GAME';
            this.prepareAndDealNow();
        }
    }
    /**
     * Lobby broadcast. Minimal payload so clients can show "waiting" UI
     * and whether the host is allowed to start the game.
     */
    updateLobbyState() {
        if (!playerManager.isHost)
            return;
        this._stateVersion++;
        const ids = playerManager.getPlayerIds();
        const canStart = ids.length >= this._config.minPlayers &&
            ids.length <= this._config.maxPlayers;
        const lobbyHands = {};
        for (let i = 0; i < ids.length; i++) {
            lobbyHands[ids[i] + ''] = [];
        }
        const stateToSend = {
            state: 'WAITING',
            playerHands: lobbyHands,
            deckSize: 0,
            discardPile: [],
            currentPlayerId: 0,
            winnerId: 0,
            hostPlayerId: this.hostPlayerId,
            canStartGame: canStart,
            isAwaitingSuitChoice: false,
            activeSuit: '',
            stateVersion: this._stateVersion,
        };
        console.log('[GM] sync LOBBY v' +
            this._stateVersion +
            ' players=' +
            ids.length +
            ' canStart=' +
            canStart);
        if (!canStart && ids.length > 0) {
            this.setWorldActivity('GAME_WAITING');
        }
        stateManager.setVariable('networkedGameState', stateToSend);
    }
    /**
     * New round setup: build/shuffle/deal, pick initial discard, enter ACTIVE_GAME, then broadcast.
     */
    prepareAndDealNow() {
        console.log('[GM] prepare: build/shuffle/deal');
        this.createDeck();
        this.shuffleDeck();
        this.dealCards(this._config.initialHandSize);
        const playerIds = playerManager.getPlayerIds();
        this._playerTurnOrder = [];
        for (let i = 0; i < playerIds.length; i++) {
            this._playerTurnOrder.push(playerIds[i]);
        }
        this._currentPlayerIndex = 0;
        this._cardPlayedThisTurn = false;
        this._hasDrawnThisTurn = false;
        this.currentGameState = 'ACTIVE_GAME';
        this.setWorldActivity('GAME_ON');
        // Track game start analytics
        const playerCount = this._playerTurnOrder.length;
        if (this._analyticsManager) {
            this._analyticsManager.trackGameStart(this.hostPlayerId, playerCount);
        }
        // Assign colors and update nameplates for all players
        for (let p = 0; p < this._playerTurnOrder.length; p++) {
            const pid = this._playerTurnOrder[p];
            this._assignPlayerColorAndNameplate(pid);
        }
        // Update to show whose turn it is
        this._updateAllPlayerNameplates();
        const initialCard = this._rulesProvider.getInitialDiscardCard(this._deck);
        if (initialCard) {
            this._discardPile.push(initialCard);
            console.log('[GM] prep: initial discard=' +
                initialCard.assetId +
                ' deck=' +
                this._deck.length);
        }
        else {
            console.log('[GM] prep: no valid initial discard; deck=' + this._deck.length);
        }
        this._activeSuit = '';
        this._isAwaitingSuitChoice = false;
        this._playDirection = 1; // Start clockwise
        this._pendingDraw2 = 0; // No pending draw 2
        this.updateNetworkedState();
    }
    /**
     * Broadcast full authoritative view (engine-safe) to clients.
     * - Clones hands to plain objects.
     * - Includes turn owner, deck size, discard pile, suit state, and winner (if any).
     */
    updateNetworkedState(winnerId = 0, feedback) {
        if (!playerManager.isHost)
            return;
        this._stateVersion++;
        const currentPlayerId = this._playerTurnOrder.length > 0
            ? this._playerTurnOrder[this._currentPlayerIndex]
            : 0;
        // Clone hands to plain arrays of {suit,rank,assetId}.
        const ids = playerManager.getPlayerIds();
        const handsPlain = {};
        for (let i = 0; i < ids.length; i++) {
            const pid = ids[i] + '';
            const hand = this._playerHands[pid] || [];
            const cloned = [];
            for (let j = 0; j < hand.length; j++) {
                const c = hand[j] || {};
                cloned.push({ suit: c.suit, rank: c.rank, assetId: c.assetId });
            }
            handsPlain[pid] = cloned;
        }
        // Track game completion analytics
        if (winnerId && this._analyticsManager) {
            const playerCount = this._playerTurnOrder.length;
            this._analyticsManager.trackGameCompletion(winnerId, playerCount);
        }
        // Update all player nameplates to reflect current turn
        this._updateAllPlayerNameplates();
        const payload = {
            state: winnerId ? 'GAME_OVER' : 'ACTIVE_GAME',
            playerHands: handsPlain,
            deckSize: this._deck.length,
            discardPile: this._discardPile.toArray().slice(0),
            currentPlayerId: currentPlayerId,
            isAwaitingSuitChoice: !!this._isAwaitingSuitChoice,
            activeSuit: this._activeSuit || '',
            winnerId: winnerId,
            hostPlayerId: this.hostPlayerId,
            canStartGame: false,
            stateVersion: this._stateVersion,
            playerCount: this._playerTurnOrder.length, // Add player count for UI
            playDirection: this._playDirection, // 1 = clockwise, -1 = counter-clockwise
            pendingDraw2: this._pendingDraw2, // For showing "+2" stacking indicator
            specialCards: this._config.specialCards, // Send special card config to clients
            lastAction: this._lastAction || '', // Last action for display
        };
        if (feedback && typeof feedback.message === 'string') {
            payload.feedback = feedback;
        }
        console.log('[GM] sync GAME v' +
            this._stateVersion +
            ' turn=P' +
            currentPlayerId +
            (winnerId ? ' WINNER=P' + winnerId : ''));
        stateManager.setVariable('networkedGameState', payload);
    }
    // ---------- Player actions during ACTIVE_GAME ----------
    onEvent_playerWantsToPlayCard({ fromPlayerId, cardData, }) {
        if (!playerManager.isHost)
            return;
        // Alias path for clients choosing a suit after a wild
        if (this._isAwaitingSuitChoice && cardData?.assetId) {
            const pfx = 'SUIT_CHOICE__';
            if (cardData.assetId.indexOf(pfx) === 0) {
                const suit = cardData.assetId.substring(pfx.length); // 'hearts'|'diamonds'|'clubs'|'spades'
                this.onEvent_playerSelectsSuit({
                    fromPlayerId: fromPlayerId,
                    suit: suit,
                });
                return;
            }
        }
        if (this.currentGameState !== 'ACTIVE_GAME' || this._isAwaitingSuitChoice)
            return;
        if (this._cardPlayedThisTurn)
            return;
        const currentPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
        if (fromPlayerId !== currentPlayerId)
            return;
        const hand = this._playerHands[fromPlayerId + ''];
        let idx = -1;
        for (let i = 0; i < hand.length; i++) {
            if (hand[i].assetId === cardData.assetId) {
                idx = i;
                break;
            }
        }
        if (idx === -1)
            return;
        this._cardPlayedThisTurn = true;
        const topRef = this._discardPile.length
            ? this._discardPile[this._discardPile.length - 1]
            : undefined;
        const topCard = topRef
            ? { suit: topRef.suit, rank: topRef.rank, assetId: topRef.assetId }
            : undefined;
        // Deref to plain object so proxy survives removal from the PseudoList
        const ref = hand[idx];
        const playedCard = { suit: ref.suit, rank: ref.rank, assetId: ref.assetId };
        console.log('[GM] play try P' +
            fromPlayerId +
            ' ' +
            playedCard.assetId +
            ' vs ' +
            (topCard ? topCard.assetId : 'empty') +
            ' activeSuit=' +
            (this._activeSuit || '-'));
        const ok = this._rulesProvider.isValidPlay(playedCard, topCard, this._activeSuit || undefined);
        if (!ok) {
            this.updateNetworkedState(0, {
                playerId: fromPlayerId,
                message: 'Invalid Card! Follow the active suit or rank.',
            });
            return;
        }
        // Remove card from hand: toArray → plain splice → reassign
        // (PseudoList doesn't support slot assignment for objects, and splice is buggy)
        var handArr = hand.toArray();
        handArr.splice(idx, 1);
        this._playerHands[fromPlayerId + ''] = handArr;
        this._discardPile.push(playedCard);
        this._activeSuit = '';
        // Track card played in analytics
        if (this._analyticsManager) {
            this._analyticsManager.trackCardPlayed(fromPlayerId);
            this._analyticsManager.trackTurnComplete();
        }
        var updatedHand = this._playerHands[fromPlayerId + ''];
        console.log('[GM] play ok: top=' + playedCard.assetId + ' handSize=' + updatedHand.length);
        if (updatedHand.length === 0) {
            this.currentGameState = 'GAME_OVER';
            this.updateNetworkedState(fromPlayerId);
            return;
        }
        // Handle special cards
        var specialCards = this._config.specialCards;
        var cardRank = playedCard.rank ? '' + playedCard.rank : '';
        // Check for Wild card (Joker) - existing behavior
        if (this._rulesProvider.isWildCard(playedCard)) {
            console.log('[GM] play wild: awaiting suit from P' + fromPlayerId);
            var wildPlayerDetails = playerManager.getPlayerDetails(fromPlayerId);
            var wildPlayerName = wildPlayerDetails && wildPlayerDetails.username
                ? wildPlayerDetails.username
                : 'Player';
            this._lastAction = '🃏 ' + wildPlayerName + ' played Wild!';
            this._isAwaitingSuitChoice = true;
            this.updateNetworkedState();
            return;
        }
        // Check for Draw 2
        if (specialCards.draw2.enabled && cardRank === specialCards.draw2.rank) {
            console.log('[GM] Draw 2 played by P' + fromPlayerId);
            // Track special card play in analytics
            if (this._analyticsManager) {
                this._analyticsManager.trackDraw2Play(fromPlayerId);
            }
            var playerDetails = playerManager.getPlayerDetails(fromPlayerId);
            var playerName = playerDetails && playerDetails.username
                ? playerDetails.username
                : 'Player';
            this._lastAction = '📥 ' + playerName + ' played Draw 2!';
            this._advanceTurn();
            // Make next player draw 2 cards
            var nextPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
            this._forcePlayerDraw(nextPlayerId, specialCards.draw2.drawCount);
            // Skip the player who had to draw (they lose their turn)
            this._advanceTurn();
            this.updateNetworkedState(0, {
                playerId: nextPlayerId,
                message: 'Drew ' + specialCards.draw2.drawCount + ' cards!',
            });
            return;
        }
        // Check for Skip (Ace)
        if (specialCards.skip.enabled && cardRank === specialCards.skip.rank) {
            console.log('[GM] Skip played by P' + fromPlayerId);
            // Track special card play in analytics
            if (this._analyticsManager) {
                this._analyticsManager.trackSkipPlay(fromPlayerId);
            }
            var skipPlayerDetails = playerManager.getPlayerDetails(fromPlayerId);
            var skipPlayerName = skipPlayerDetails && skipPlayerDetails.username
                ? skipPlayerDetails.username
                : 'Player';
            this._lastAction = '⏭️ ' + skipPlayerName + ' played Skip!';
            // Advance twice to skip the next player
            this._advanceTurn();
            var skippedPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
            this._advanceTurn();
            this.updateNetworkedState(0, {
                playerId: skippedPlayerId,
                message: 'Turn skipped!',
            });
            return;
        }
        // Check for Reverse (Queen)
        if (specialCards.reverse.enabled &&
            cardRank === specialCards.reverse.rank) {
            console.log('[GM] Reverse played by P' +
                fromPlayerId +
                ' - direction was ' +
                this._playDirection);
            // Track special card play in analytics
            if (this._analyticsManager) {
                this._analyticsManager.trackReversePlay(fromPlayerId);
            }
            var revPlayerDetails = playerManager.getPlayerDetails(fromPlayerId);
            var revPlayerName = revPlayerDetails && revPlayerDetails.username
                ? revPlayerDetails.username
                : 'Player';
            this._lastAction = '🔄 ' + revPlayerName + ' played Reverse!';
            // Reverse direction
            this._playDirection = this._playDirection * -1;
            // In 2-player game, reverse acts like skip
            if (this._playerTurnOrder.length === 2) {
                // In 2p, reverse means same player goes again — reset flags for their next play
                this._cardPlayedThisTurn = false;
                this._hasDrawnThisTurn = false;
                this.updateNetworkedState(0, {
                    playerId: fromPlayerId,
                    message: 'Direction reversed! Your turn again.',
                });
                return;
            }
            this._advanceTurn();
            this.updateNetworkedState(0, {
                playerId: this._playerTurnOrder[this._currentPlayerIndex],
                message: 'Direction reversed!',
            });
            return;
        }
        // Normal card - just advance turn
        var normPlayerDetails = playerManager.getPlayerDetails(fromPlayerId);
        var normPlayerName = normPlayerDetails && normPlayerDetails.username
            ? normPlayerDetails.username
            : 'Player';
        var cardDisplay = playedCard.rank + ' of ' + playedCard.suit;
        this._lastAction = '🃏 ' + normPlayerName + ' played ' + cardDisplay;
        this._advanceTurn();
        this.updateNetworkedState();
    }
    onEvent_playerSelectsSuit({ fromPlayerId, suit, }) {
        if (!playerManager.isHost || !this._isAwaitingSuitChoice)
            return;
        const currentPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
        if (fromPlayerId !== currentPlayerId)
            return;
        const valid = ['hearts', 'diamonds', 'clubs', 'spades'];
        if (valid.indexOf(suit) === -1) {
            console.log('[GM] suit reject: ' + suit);
            return;
        }
        console.log('[GM] suit chosen P' + fromPlayerId + '=' + suit);
        this._activeSuit = suit;
        this._isAwaitingSuitChoice = false;
        // Track wild card play analytics
        if (this._analyticsManager) {
            this._analyticsManager.trackWildCardPlay(fromPlayerId, suit);
        }
        this._advanceTurn();
        this.updateNetworkedState();
    }
    onEvent_playerWantsToDrawCard({ fromPlayerId }) {
        console.log(`[GM] onEvent_playerWantsToDrawCard ${fromPlayerId}`);
        if (!playerManager.isHost ||
            this.currentGameState !== 'ACTIVE_GAME' ||
            this._isAwaitingSuitChoice)
            return console.log("[GM] onEvent_playerWantsToDrawCard EE 1");
        const currentPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
        if (fromPlayerId !== currentPlayerId)
            return console.log("[GM] onEvent_playerWantsToDrawCard not current player");
        if (this._hasDrawnThisTurn)
            return console.log("[GM] onEvent_playerWantsToDrawCard already drew this turn");
        const hand = this._playerHands[fromPlayerId + ''];
        const topRef2 = this._discardPile.length
            ? this._discardPile[this._discardPile.length - 1]
            : undefined;
        const topCard = topRef2
            ? { suit: topRef2.suit, rank: topRef2.rank, assetId: topRef2.assetId }
            : undefined;
        if (!this._rulesProvider.canDrawCard(hand, topCard, this._activeSuit || undefined)) {
            console.log("[GM] onEvent_playerWantsToDrawCard playable card");
            this.updateNetworkedState(0, {
                playerId: fromPlayerId,
                message: 'You have a playable card!',
            });
            return;
        }
        // Rebuild deck from discard if empty (keep top).
        if (this._deck.length === 0) {
            if (this._discardPile.length > 1) {
                const keepTop = this._discardPile.pop();
                const rebuilt = this._discardPile.toArray().slice(0);
                this.shuffleDeckArray(rebuilt);
                // Clear and refill _deck (preserve PseudoList)
                while (this._deck.length > 0) {
                    this._deck.pop();
                }
                for (let i = 0; i < rebuilt.length; i++) {
                    this._deck.push(rebuilt[i]);
                }
                // Clear and refill _discardPile (preserve PseudoList)
                while (this._discardPile.length > 0) {
                    this._discardPile.pop();
                }
                this._discardPile.push(keepTop);
                // Track deck reshuffle
                if (this._analyticsManager) {
                    this._analyticsManager.trackDeckReshuffle();
                }
                console.log('[GM] draw: rebuilt deck size=' + this._deck.length);
            }
            else {
                console.log('[GM] draw: deck empty; cannot rebuild');
            }
        }
        this._hasDrawnThisTurn = true;
        const newCard = this._deck.pop();
        if (newCard) {
            this._playerHands[fromPlayerId + ''].push(newCard);
            console.log('[GM] draw: P' +
                fromPlayerId +
                ' +' +
                newCard.assetId +
                ' deck=' +
                this._deck.length);
            // Track card draw analytics (forced draw since canDrawCard passed)
            if (this._analyticsManager) {
                this._analyticsManager.trackCardDraw(fromPlayerId, true);
                // Track new hand size
                const newHandSize = this._playerHands[fromPlayerId + ''].length;
                this._analyticsManager.trackHandSize(fromPlayerId, newHandSize);
                this._analyticsManager.trackTurnComplete();
            }
        }
        this._advanceTurn();
        this.updateNetworkedState();
    }
    // ---------- Turn + shuffle utilities ----------
    _advanceTurn() {
        if (this._playerTurnOrder.length === 0)
            return;
        // Respect play direction (1 = clockwise, -1 = counter-clockwise)
        var len = this._playerTurnOrder.length;
        this._currentPlayerIndex =
            (this._currentPlayerIndex + this._playDirection + len) % len;
        this._cardPlayedThisTurn = false;
        this._hasDrawnThisTurn = false;
    }
    /**
     * Force a player to draw cards (used by Draw 2 special card)
     * Rebuilds deck from discard if needed
     */
    _forcePlayerDraw(playerId, count) {
        var hand = this._playerHands[playerId + ''];
        if (!hand)
            return;
        for (var i = 0; i < count; i++) {
            // Rebuild deck if empty
            if (this._deck.length === 0) {
                this._rebuildDeckFromDiscard();
            }
            if (this._deck.length > 0) {
                var newCard = this._deck.pop();
                if (newCard) {
                    hand.push(newCard);
                    console.log('[GM] force draw: P' + playerId + ' +' + newCard.assetId);
                }
            }
        }
        // Track analytics
        if (this._analyticsManager) {
            this._analyticsManager.trackCardDraw(playerId, true);
            this._analyticsManager.trackHandSize(playerId, hand.length);
        }
    }
    /**
     * Rebuild deck from discard pile (keeping top card)
     */
    _rebuildDeckFromDiscard() {
        if (this._discardPile.length <= 1) {
            console.log('[GM] cannot rebuild: discard too small');
            return;
        }
        var keepTop = this._discardPile.pop();
        var rebuilt = this._discardPile.toArray().slice(0);
        this.shuffleDeckArray(rebuilt);
        // Clear and refill _deck
        while (this._deck.length > 0) {
            this._deck.pop();
        }
        for (var i = 0; i < rebuilt.length; i++) {
            this._deck.push(rebuilt[i]);
        }
        // Clear and refill _discardPile
        while (this._discardPile.length > 0) {
            this._discardPile.pop();
        }
        this._discardPile.push(keepTop);
        if (this._analyticsManager) {
            this._analyticsManager.trackDeckReshuffle();
        }
        console.log('[GM] rebuilt deck size=' + this._deck.length);
    }
    shuffleDeckArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
    }
    // ---------- Resync ----------
    onEvent_playerRequestsFullSync({ fromPlayerId }) {
        if (!playerManager.isHost)
            return;
        console.log('[GM] full sync requested by P' +
            fromPlayerId +
            ' (v' +
            this._stateVersion +
            ')');
        if (this.currentGameState === 'WAITING_FOR_PLAYERS')
            this.updateLobbyState();
        else
            this.updateNetworkedState();
    }
    // ---------- Deck build/deal ----------
    createDeck() {
        this._deck = [];
        if (this._config.deck.type === 'standardWithJokers') {
            const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
            const ranks = [
                '2',
                '3',
                '4',
                '5',
                '6',
                '7',
                '8',
                '9',
                '10',
                'J',
                'Q',
                'K',
                'A',
            ];
            for (let s = 0; s < suits.length; s++) {
                for (let r = 0; r < ranks.length; r++) {
                    this._deck.push({
                        suit: suits[s],
                        rank: ranks[r],
                        assetId: 'card_' + suits[s] + '_' + ranks[r],
                    });
                }
            }
            for (let i = 0; i < this._config.deck.jokerCount; i++) {
                this._deck.push({
                    suit: 'joker',
                    rank: 'joker',
                    assetId: 'card_joker_' + (i + 1),
                });
            }
        }
        console.log('[GM] deck created size=' + this._deck.length);
    }
    shuffleDeck() {
        for (let i = this._deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = this._deck[i];
            this._deck[i] = this._deck[j];
            this._deck[j] = t;
        }
    }
    dealCards(numCards) {
        const ids = playerManager.getPlayerIds();
        for (let i = 0; i < ids.length; i++) {
            this._playerHands[ids[i] + ''] = [];
        }
        console.log('[GM] deal ' + numCards + ' x ' + ids.length + ' players');
        for (let c = 0; c < numCards; c++) {
            for (let p = 0; p < ids.length; p++) {
                if (this._deck.length === 0)
                    break;
                const card = this._deck.pop();
                if (card)
                    this._playerHands[ids[p] + ''].push(card);
            }
        }
        // Hand sizes for verification.
        for (let q = 0; q < ids.length; q++) {
            const pid = ids[q];
            const hand = this._playerHands[pid + ''] || [];
            console.log('[GM] deal: P' + pid + ' hand=' + hand.length);
        }
        console.log('[GM] deal done deck=' + this._deck.length);
    }
    setWorldActivity(type) {
        try {
            if (!playerManager.isHost)
                return;
            const publicKey = stateManager.getVariable('PublicKey');
            if (!publicKey)
                return;
            integrationsManager.setWorldActivity({
                type: type,
                interactivePublicKey: publicKey,
            });
        }
        catch (e) { }
    }
}
