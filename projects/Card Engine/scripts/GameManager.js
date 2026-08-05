"use strict";
class GameManager extends SystemScript {
    // ---------- Injected systems ----------
    _configProvider;
    _rulesProvider;
    // ---------- Config ----------
    _config;
    // ---------- Host-only authoritative state ----------
    _deck; // draw pile
    _playerHands; // { [playerId: string]: Card[] }
    _discardPile; // top is last element
    _playerTurnOrder; // array of playerIds
    _currentPlayerIndex;
    // ---------- Fields mirrored to clients ----------
    currentGameState; // 'WAITING_FOR_PLAYERS' | 'PREPARING_GAME' | 'ACTIVE_GAME' | 'GAME_OVER'
    hostPlayerId; // who can start the game
    _stateVersion; // monotonic; clients ignore old versions
    _activeSuit; // '', or one of 'hearts'|'diamonds'|'clubs'|'spades'
    _isAwaitingSuitChoice; // true after a wild card until suit chosen
    _lastSuitChoiceT; // last processed clientSuitChoice timestamp
    constructor() {
        console.log('[GM] init');
    }
    // ---------- Engine-safe helpers: never pass null/undefined into engine APIs ----------
    _nzStr(v, fb = '') {
        return v === null || v === undefined ? fb : '' + v;
    }
    _nzNum(v, fb = 0) {
        const n = +v;
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
        // Host-only initialization of authoritative state.
        if (playerManager.isHost) {
            this.currentGameState = 'WAITING_FOR_PLAYERS';
            this.hostPlayerId = 0;
            this._stateVersion = 0;
            this._deck = [];
            this._playerHands = {};
            this._discardPile = [];
            this._playerTurnOrder = [];
            this._currentPlayerIndex = 0;
            this._activeSuit = '';
            this._isAwaitingSuitChoice = false;
            this._lastSuitChoiceT = 0;
        }
    }
    // ---------- Player lifecycle ----------
    async onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        if (this.hostPlayerId === 0) {
            this.hostPlayerId = playerId;
            console.log('[GM] host registered P' + playerId);
        }
        this.updateLobbyState();
    }
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        delete this._playerHands[playerId + ''];
        this.updateLobbyState();
    }
    // ---------- Host UI actions ----------
    onEvent_hostStartsGame({ fromPlayerId }) {
        if (!playerManager.isHost || fromPlayerId !== this.hostPlayerId)
            return;
        var numPlayers = playerManager.getPlayerIds().length;
        var canStart = numPlayers >= this._config.minPlayers &&
            numPlayers <= this._config.maxPlayers;
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
        var ids = playerManager.getPlayerIds();
        var canStart = ids.length >= this._config.minPlayers &&
            ids.length <= this._config.maxPlayers;
        var lobbyHands = {};
        for (var i = 0; i < ids.length; i++) {
            lobbyHands[ids[i] + ''] = {};
        }
        var stateToSend = {
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
        this._playerTurnOrder = playerManager.getPlayerIds();
        this._currentPlayerIndex = 0;
        this.currentGameState = 'ACTIVE_GAME';
        var initialCard = this._rulesProvider.getInitialDiscardCard(this._deck);
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
        var currentPlayerId = this._playerTurnOrder.length > 0
            ? this._playerTurnOrder[this._currentPlayerIndex]
            : 0;
        // Clone hands to plain arrays of {suit,rank,assetId}.
        var ids = playerManager.getPlayerIds();
        var handsPlain = {};
        for (var i = 0; i < ids.length; i++) {
            var pid = ids[i] + '';
            var hand = this._playerHands[pid] || [];
            var cloned = [];
            for (var j = 0; j < hand.length; j++) {
                var c = hand[j] || {};
                cloned.push({ suit: c.suit, rank: c.rank, assetId: c.assetId });
            }
            handsPlain[pid] = cloned;
        }
        var payload = {
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
        if (this._isAwaitingSuitChoice && cardData && cardData.assetId) {
            var pfx = 'SUIT_CHOICE__';
            if (cardData.assetId.indexOf(pfx) === 0) {
                var suit = cardData.assetId.substring(pfx.length); // 'hearts'|'diamonds'|'clubs'|'spades'
                this.onEvent_playerSelectsSuit({
                    fromPlayerId: fromPlayerId,
                    suit: suit,
                });
                return;
            }
        }
        if (this.currentGameState !== 'ACTIVE_GAME' || this._isAwaitingSuitChoice)
            return;
        var currentPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
        if (fromPlayerId !== currentPlayerId)
            return;
        var hand = this._playerHands[fromPlayerId + ''];
        var idx = -1;
        for (var i = 0; i < hand.length; i++) {
            if (hand[i].assetId === cardData.assetId) {
                idx = i;
                break;
            }
        }
        if (idx === -1)
            return;
        var topCard = this._discardPile.length
            ? this._discardPile[this._discardPile.length - 1]
            : undefined;
        var playedCard = hand[idx];
        console.log('[GM] play try P' +
            fromPlayerId +
            ' ' +
            playedCard.assetId +
            ' vs ' +
            (topCard ? topCard.assetId : 'empty') +
            ' activeSuit=' +
            (this._activeSuit || '-'));
        var ok = this._rulesProvider.isValidPlay(playedCard, topCard, this._activeSuit || undefined);
        if (!ok) {
            this.updateNetworkedState(0, {
                playerId: fromPlayerId,
                message: 'Invalid Card! Follow the active suit or rank.',
            });
            return;
        }
        hand.splice(idx, 1);
        this._discardPile.push(playedCard);
        this._activeSuit = '';
        console.log('[GM] play ok: top=' + playedCard.assetId + ' handSize=' + hand.length);
        if (hand.length === 0) {
            this.currentGameState = 'GAME_OVER';
            this.updateNetworkedState(fromPlayerId);
            return;
        }
        if (this._rulesProvider.isWildCard(playedCard)) {
            console.log('[GM] play wild: awaiting suit from P' + fromPlayerId);
            this._isAwaitingSuitChoice = true;
            this.updateNetworkedState();
        }
        else {
            this._advanceTurn();
            this.updateNetworkedState();
        }
    }
    onEvent_playerSelectsSuit({ fromPlayerId, suit, }) {
        if (!playerManager.isHost || !this._isAwaitingSuitChoice)
            return;
        var currentPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
        if (fromPlayerId !== currentPlayerId)
            return;
        var valid = ['hearts', 'diamonds', 'clubs', 'spades'];
        if (valid.indexOf(suit) === -1) {
            console.log('[GM] suit reject: ' + suit);
            return;
        }
        console.log('[GM] suit chosen P' + fromPlayerId + '=' + suit);
        this._activeSuit = suit;
        this._isAwaitingSuitChoice = false;
        this._advanceTurn();
        this.updateNetworkedState();
    }
    onEvent_playerWantsToDrawCard({ fromPlayerId }) {
        if (!playerManager.isHost ||
            this.currentGameState !== 'ACTIVE_GAME' ||
            this._isAwaitingSuitChoice)
            return;
        var currentPlayerId = this._playerTurnOrder[this._currentPlayerIndex];
        if (fromPlayerId !== currentPlayerId)
            return;
        var hand = this._playerHands[fromPlayerId + ''];
        var topCard = this._discardPile.length
            ? this._discardPile[this._discardPile.length - 1]
            : undefined;
        if (!this._rulesProvider.canDrawCard(hand, topCard, this._activeSuit || undefined)) {
            this.updateNetworkedState(0, {
                playerId: fromPlayerId,
                message: 'You have a playable card!',
            });
            return;
        }
        // Rebuild deck from discard if empty (keep top).
        if (this._deck.length === 0) {
            if (this._discardPile.length > 1) {
                var keepTop = this._discardPile.pop();
                var rebuilt = this._discardPile.toArray().slice(0);
                this.shuffleDeckArray(rebuilt);
                this._deck = rebuilt;
                this._discardPile = [keepTop];
                console.log('[GM] draw: rebuilt deck size=' + this._deck.length);
            }
            else {
                console.log('[GM] draw: deck empty; cannot rebuild');
            }
        }
        var newCard = this._deck.pop();
        if (newCard) {
            this._playerHands[fromPlayerId + ''].push(newCard);
            console.log('[GM] draw: P' +
                fromPlayerId +
                ' +' +
                newCard.assetId +
                ' deck=' +
                this._deck.length);
        }
        //this._activeSuit = '';
        this._advanceTurn();
        this.updateNetworkedState();
    }
    // ---------- Turn + shuffle utilities ----------
    _advanceTurn() {
        if (this._playerTurnOrder.length === 0)
            return;
        this._currentPlayerIndex =
            (this._currentPlayerIndex + 1) % this._playerTurnOrder.length;
    }
    shuffleDeckArray(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = arr[i];
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
            var suits = ['hearts', 'diamonds', 'clubs', 'spades'];
            var ranks = [
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
            for (var s = 0; s < suits.length; s++) {
                for (var r = 0; r < ranks.length; r++) {
                    this._deck.push({
                        suit: suits[s],
                        rank: ranks[r],
                        assetId: 'card_' + suits[s] + '_' + ranks[r],
                    });
                }
            }
            for (var i = 0; i < this._config.deck.jokerCount; i++) {
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
        for (var i = this._deck.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = this._deck[i];
            this._deck[i] = this._deck[j];
            this._deck[j] = t;
        }
    }
    dealCards(numCards) {
        var ids = playerManager.getPlayerIds();
        for (var i = 0; i < ids.length; i++) {
            this._playerHands[ids[i] + ''] = [];
        }
        console.log('[GM] deal ' + numCards + ' x ' + ids.length + ' players');
        for (var c = 0; c < numCards; c++) {
            for (var p = 0; p < ids.length; p++) {
                if (this._deck.length === 0)
                    break;
                var card = this._deck.pop();
                if (card)
                    this._playerHands[ids[p] + ''].push(card);
            }
        }
        // Hand sizes for verification.
        for (var q = 0; q < ids.length; q++) {
            var pid = ids[q];
            var hand = this._playerHands[pid + ''] || [];
            console.log('[GM] deal: P' + pid + ' hand=' + hand.length);
        }
        console.log('[GM] deal done deck=' + this._deck.length);
    }
}
