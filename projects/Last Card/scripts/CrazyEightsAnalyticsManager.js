"use strict";
class CrazyEightsAnalyticsManager extends SystemScript {
    systemName;
    analyticsPublicKey;
    lastGameInitiatorProfileId; // Track who started the current game
    activeGamePlayers; // Track players in active game
    // Game state tracking for analytics
    _turnCount; // Turns taken in current game
    _cardsPlayedCount; // Cards played (not drawn) in current game
    _maxHandSizes; // Track max hand size per player
    _forcedDrawCount; // Times players had to draw (no playable card)
    _deckReshuffleCount; // Times deck was reshuffled from discard
    onInit() {
        console.log('[C8Analytics] Initializing analytics manager');
        this.systemName = 'CrazyEightsAnalyticsManager';
        this.analyticsPublicKey = '';
        this.lastGameInitiatorProfileId = '';
        this.activeGamePlayers = [];
        // Initialize game state tracking
        this._turnCount = 0;
        this._cardsPlayedCount = 0;
        this._maxHandSizes = {};
        this._forcedDrawCount = 0;
        this._deckReshuffleCount = 0;
        // Get analytics public key from state manager
        try {
            this.analyticsPublicKey = stateManager.getVariable('PublicKey');
            if (this.analyticsPublicKey) {
                console.log('[C8Analytics] Analytics key loaded successfully');
            }
            else {
                console.warn('[C8Analytics] No PublicKey found in state manager');
            }
        }
        catch (e) {
            console.warn('[C8Analytics] Failed to get PublicKey for analytics:', e);
            this.analyticsPublicKey = '';
        }
    }
    /**
     * Track player joining the game
     * @param playerId - ID of player joining
     */
    trackPlayerJoin(playerId) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId) {
                console.warn('[C8Analytics] No profileId for player', playerId);
                return;
            }
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsJoins',
                        profileId: profileId,
                    },
                    {
                        analyticName: 'crazyEightsUniqueJoins',
                        profileId: profileId,
                        uniqueKey: profileId,
                    },
                ],
            });
            console.log('[C8Analytics] Player join tracked:', playerId);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking player join:', e);
        }
    }
    /**
     * Track game start
     * @param starterPlayerId - ID of player who started the game (host)
     * @param playerCount - Number of players in game
     */
    trackGameStart(starterPlayerId, playerCount) {
        // Reset game tracking for new game
        this.resetGameTracking();
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(starterPlayerId);
            const profileId = details?.profileId;
            const analytics = [
                {
                    analyticName: 'crazyEightsGameStarts',
                },
                {
                    analyticName: 'crazyEightsGameStarts-' + playerCount + 'p',
                },
            ];
            if (profileId) {
                this.lastGameInitiatorProfileId = profileId;
                analytics.push({
                    analyticName: 'crazyEightsPlayerStarts',
                    profileId: profileId,
                });
                analytics.push({
                    analyticName: 'crazyEightsUniquePlayerStarts',
                    profileId: profileId,
                    uniqueKey: profileId,
                });
            }
            // Track all players starting
            const allPlayerIds = playerManager.getPlayerIds();
            this.activeGamePlayers = [];
            for (let i = 0; i < allPlayerIds.length; i++) {
                const pid = allPlayerIds[i];
                this.activeGamePlayers.push(pid);
                const pDetails = playerManager.getPlayerDetails(pid);
                const pProfileId = pDetails?.profileId;
                if (pProfileId && pProfileId !== profileId) {
                    analytics.push({
                        analyticName: 'crazyEightsPlayerStarts',
                        profileId: pProfileId,
                    });
                    analytics.push({
                        analyticName: 'crazyEightsUniquePlayerStarts',
                        profileId: pProfileId,
                        uniqueKey: pProfileId,
                    });
                }
            }
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics,
            });
            console.log('[C8Analytics] Game start tracked:', playerCount, 'players');
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking game start:', e);
        }
    }
    /**
     * Track game completion (win/loss)
     * @param winnerId - ID of winning player
     * @param playerCount - Number of players in game
     */
    trackGameCompletion(winnerId, playerCount) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const analytics = [
                {
                    analyticName: 'crazyEightsGameCompletions',
                },
                {
                    analyticName: 'crazyEightsGameCompletions-' + playerCount + 'p',
                },
            ];
            // Track winner
            const winnerDetails = playerManager.getPlayerDetails(winnerId);
            const winnerProfileId = winnerDetails?.profileId;
            if (winnerProfileId) {
                analytics.push({
                    analyticName: 'crazyEightsWins',
                    profileId: winnerProfileId,
                });
                analytics.push({
                    analyticName: 'crazyEightsWins-' + playerCount + 'p',
                    profileId: winnerProfileId,
                });
                analytics.push({
                    analyticName: 'crazyEightsUniqueWins',
                    profileId: winnerProfileId,
                    uniqueKey: winnerProfileId,
                });
                analytics.push({
                    analyticName: 'crazyEightsPlayerCompletions',
                    profileId: winnerProfileId,
                });
                analytics.push({
                    analyticName: 'crazyEightsUniquePlayerCompletions',
                    profileId: winnerProfileId,
                    uniqueKey: winnerProfileId,
                });
            }
            // Track losses for other players
            for (let i = 0; i < this.activeGamePlayers.length; i++) {
                const pid = this.activeGamePlayers[i];
                if (pid === winnerId)
                    continue;
                const loserDetails = playerManager.getPlayerDetails(pid);
                const loserProfileId = loserDetails?.profileId;
                if (loserProfileId) {
                    analytics.push({
                        analyticName: 'crazyEightsLosses',
                        profileId: loserProfileId,
                    });
                    analytics.push({
                        analyticName: 'crazyEightsLosses-' + playerCount + 'p',
                        profileId: loserProfileId,
                    });
                    analytics.push({
                        analyticName: 'crazyEightsPlayerCompletions',
                        profileId: loserProfileId,
                    });
                    analytics.push({
                        analyticName: 'crazyEightsUniquePlayerCompletions',
                        profileId: loserProfileId,
                        uniqueKey: loserProfileId,
                    });
                }
            }
            // Track game initiator if available
            if (this.lastGameInitiatorProfileId) {
                analytics.push({
                    analyticName: 'crazyEightsGameInitiator-' + this.lastGameInitiatorProfileId,
                });
            }
            // Track game duration metrics
            analytics.push({
                analyticName: 'crazyEightsTotalTurns',
                incrementBy: this._turnCount,
            });
            analytics.push({
                analyticName: 'crazyEightsTotalCardsPlayed',
                incrementBy: this._cardsPlayedCount,
            });
            // Categorize game length
            let gameLength = 'short'; // < 10 turns
            if (this._turnCount >= 20) {
                gameLength = 'long';
            }
            else if (this._turnCount >= 10) {
                gameLength = 'medium';
            }
            analytics.push({
                analyticName: 'crazyEightsGameLength-' + gameLength,
            });
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics,
            });
            console.log('[C8Analytics] Game completion tracked - Winner:', winnerId, 'Turns:', this._turnCount);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking game completion:', e);
        }
    }
    /**
     * Track wild card (Joker) play
     * @param playerId - ID of player who played the wild card
     * @param chosenSuit - The suit they chose
     */
    trackWildCardPlay(playerId, chosenSuit) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId)
                return;
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsWildCardPlays',
                        profileId: profileId,
                    },
                    {
                        analyticName: 'crazyEightsWildCardSuit-' + chosenSuit,
                        profileId: profileId,
                    },
                ],
            });
            console.log('[C8Analytics] Wild card play tracked:', playerId, 'chose', chosenSuit);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking wild card play:', e);
        }
    }
    /**
     * Track Draw 2 card play
     * @param playerId - ID of player who played the Draw 2
     */
    trackDraw2Play(playerId) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId)
                return;
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsDraw2Plays',
                        profileId: profileId,
                    },
                    {
                        analyticName: 'crazyEightsSpecialCardPlays',
                        profileId: profileId,
                    },
                ],
            });
            console.log('[C8Analytics] Draw 2 play tracked:', playerId);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking Draw 2 play:', e);
        }
    }
    /**
     * Track Skip card (Ace) play
     * @param playerId - ID of player who played the Skip
     */
    trackSkipPlay(playerId) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId)
                return;
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsSkipPlays',
                        profileId: profileId,
                    },
                    {
                        analyticName: 'crazyEightsSpecialCardPlays',
                        profileId: profileId,
                    },
                ],
            });
            console.log('[C8Analytics] Skip play tracked:', playerId);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking Skip play:', e);
        }
    }
    /**
     * Track Reverse card (Queen) play
     * @param playerId - ID of player who played the Reverse
     */
    trackReversePlay(playerId) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId)
                return;
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsReversePlays',
                        profileId: profileId,
                    },
                    {
                        analyticName: 'crazyEightsSpecialCardPlays',
                        profileId: profileId,
                    },
                ],
            });
            console.log('[C8Analytics] Reverse play tracked:', playerId);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking Reverse play:', e);
        }
    }
    /**
     * Track card draw
     * @param playerId - ID of player who drew a card
     * @param wasForcedDraw - Whether player had no playable cards
     */
    trackCardDraw(playerId, wasForcedDraw = true) {
        if (!this.analyticsPublicKey)
            return;
        if (wasForcedDraw) {
            this._forcedDrawCount++;
        }
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId)
                return;
            const analytics = [
                {
                    analyticName: 'crazyEightsCardDraws',
                    profileId: profileId,
                },
            ];
            if (wasForcedDraw) {
                analytics.push({
                    analyticName: 'crazyEightsForcedDraws',
                    profileId: profileId,
                });
            }
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics,
            });
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking card draw:', e);
        }
    }
    /**
     * Track a card being played (not drawn)
     * @param playerId - ID of player who played the card
     */
    trackCardPlayed(playerId) {
        this._cardsPlayedCount++;
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId)
                return;
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsCardsPlayed',
                        profileId: profileId,
                    },
                ],
            });
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking card played:', e);
        }
    }
    /**
     * Track turn completion
     */
    trackTurnComplete() {
        console.log("trackTurnComplete", this._turnCount);
        this._turnCount++;
        console.log("trackTurnComplete after", this._turnCount);
    }
    /**
     * Track deck reshuffle from discard pile
     */
    trackDeckReshuffle() {
        this._deckReshuffleCount++;
        if (!this.analyticsPublicKey)
            return;
        try {
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsDeckReshuffles',
                    },
                ],
            });
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking deck reshuffle:', e);
        }
    }
    /**
     * Track max hand size for a player
     * @param playerId - Player ID
     * @param handSize - Current hand size
     */
    trackHandSize(playerId, handSize) {
        const key = playerId + '';
        const currentMax = this._maxHandSizes[key] || 0;
        if (handSize > currentMax) {
            this._maxHandSizes[key] = handSize;
        }
    }
    /**
     * Track game abandonment (player left mid-game)
     * @param playerId - Player who left
     * @param playerCount - Players remaining
     */
    trackGameAbandon(playerId, playerCount) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            const analytics = [
                {
                    analyticName: 'crazyEightsGameAbandons',
                },
                {
                    analyticName: 'crazyEightsGameAbandons-' + playerCount + 'p',
                },
            ];
            if (profileId) {
                analytics.push({
                    analyticName: 'crazyEightsPlayerAbandons',
                    profileId: profileId,
                });
            }
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics,
            });
            console.log('[C8Analytics] Game abandon tracked:', playerId);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking game abandon:', e);
        }
    }
    /**
     * Track spectator joining mid-game
     * @param playerId - Spectator player ID
     */
    trackSpectatorJoin(playerId) {
        if (!this.analyticsPublicKey)
            return;
        try {
            const details = playerManager.getPlayerDetails(playerId);
            const profileId = details?.profileId;
            if (!profileId)
                return;
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: this.analyticsPublicKey,
                analytics: [
                    {
                        analyticName: 'crazyEightsSpectatorJoins',
                        profileId: profileId,
                    },
                    {
                        analyticName: 'crazyEightsUniqueSpectators',
                        profileId: profileId,
                        uniqueKey: profileId,
                    },
                ],
            });
            console.log('[C8Analytics] Spectator join tracked:', playerId);
        }
        catch (e) {
            console.warn('[C8Analytics] Error tracking spectator join:', e);
        }
    }
    /**
     * Reset game-specific tracking for new game
     */
    resetGameTracking() {
        this._turnCount = 0;
        this._cardsPlayedCount = 0;
        this._maxHandSizes = {};
        this._forcedDrawCount = 0;
        this._deckReshuffleCount = 0;
        this.activeGamePlayers = [];
        console.log('[C8Analytics] Game tracking reset');
    }
    /**
     * Get game duration stats for completion tracking
     */
    getGameStats() {
        return {
            turnCount: this._turnCount,
            cardsPlayed: this._cardsPlayedCount,
            forcedDraws: this._forcedDrawCount,
            deckReshuffles: this._deckReshuffleCount,
            maxHandSizes: this._maxHandSizes,
        };
    }
}
