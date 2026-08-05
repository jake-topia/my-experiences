class PongAnalyticsManager extends SystemScript {
  systemName: string;
  analyticsPublicKey: string;
  lastGameInitiatorProfileId: string; // Track who started the current game
  activeGamePlayers: PseudoList; // Track players in active game
  currentGamePaddleHits: number; // Track paddle hits in current game
  currentGameMultiballs: number; // Track multiball triggers in current game

  onInit() {
    console.log('[PongAnalytics] Initializing analytics manager');
    this.systemName = 'PongAnalyticsManager';
    this.analyticsPublicKey = '';
    this.lastGameInitiatorProfileId = '';
    this.activeGamePlayers = [] as any;
    this.currentGamePaddleHits = 0;
    this.currentGameMultiballs = 0;

    // Get analytics public key from state manager
    try {
      this.analyticsPublicKey = stateManager.getVariable('PublicKey');
      console.log('[PongAnalytics] Analytics key loaded successfully');
    } catch (e) {
      console.warn('[PongAnalytics] Failed to get PublicKey for analytics:', e);
      this.analyticsPublicKey = '';
    }
  }

  /**
   * Track player joining a team
   * @param playerId - ID of player joining
   */
  trackPlayerJoin(playerId: number) {
    if (!this.analyticsPublicKey) return;

    try {
      const details = playerManager.getPlayerDetails(playerId);
      const profileId = details?.profileId;

      if (!profileId) {
        console.warn('[PongAnalytics] No profileId for player', playerId);
        return;
      }

      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: this.analyticsPublicKey,
        analytics: [
          {
            analyticName: 'tpongJoins',
            profileId: profileId,
          },
          {
            analyticName: 'tpongUniqueJoins',
            profileId: profileId,
            uniqueKey: profileId,
          },
        ],
      });

      console.log('[PongAnalytics] Player join tracked:', playerId);
    } catch (e) {
      console.warn('[PongAnalytics] Error tracking player join:', e);
    }
  }

  /**
   * Track game start
   * @param starterPlayerId - ID of player who started the game
   * @param playerCount - Number of players in game (2 or 4)
   */
  trackGameStart(starterPlayerId: number, playerCount: number) {
    if (!this.analyticsPublicKey) return;

    try {
      const details = playerManager.getPlayerDetails(starterPlayerId);
      const profileId = details?.profileId;

      const analytics: any[] = [
        {
          analyticName: 'tpongGameStarts',
        },
        {
          analyticName: 'tpongGameStarts-' + playerCount + 'p',
        },
      ];

      if (profileId) {
        this.lastGameInitiatorProfileId = profileId;

        analytics.push({
          analyticName: 'tpongPlayerStarts',
          profileId: profileId,
        });
        analytics.push({
          analyticName: 'tpongUniquePlayerStarts',
          profileId: profileId,
          uniqueKey: profileId,
        });
      }

      // Track all players starting
      const allPlayerIds = playerManager.getPlayerIds();
      for (let i = 0; i < allPlayerIds.length; i++) {
        const pid = allPlayerIds[i];
        const pDetails = playerManager.getPlayerDetails(pid);
        const pProfileId = pDetails?.profileId;

        if (pProfileId && pProfileId !== profileId) {
          analytics.push({
            analyticName: 'tpongPlayerStarts',
            profileId: pProfileId,
          });
          analytics.push({
            analyticName: 'tpongUniquePlayerStarts',
            profileId: pProfileId,
            uniqueKey: pProfileId,
          });
        }
      }

      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: this.analyticsPublicKey,
        analytics,
      });

      console.log(
        '[PongAnalytics] Game start tracked:',
        playerCount,
        'players',
      );
    } catch (e) {
      console.warn('[PongAnalytics] Error tracking game start:', e);
    }
  }

  /**
   * Track round completion
   * @param roundNumber - Round number (1, 2, or 3)
   * @param winnerTeam - Winning team ID ('red', 'blue', 'green', 'yellow', or null for tie)
   * @param playerCount - Number of players in game (2 or 4)
   * @param gameManager - Reference to game manager for accessing team data
   */
  trackRoundCompletion(
    roundNumber: number,
    winnerTeam: string | null,
    playerCount: number,
    gameManager: any,
  ) {
    if (!this.analyticsPublicKey) return;

    try {
      const analytics: any[] = [];

      // Get active teams
      const activeTeams: string[] = [];
      if (gameManager.teamRed && gameManager.teamRed.length > 0)
        activeTeams.push('red');
      if (gameManager.teamBlue && gameManager.teamBlue.length > 0)
        activeTeams.push('blue');
      if (gameManager.teamGreen && gameManager.teamGreen.length > 0)
        activeTeams.push('green');
      if (gameManager.teamYellow && gameManager.teamYellow.length > 0)
        activeTeams.push('yellow');

      if (winnerTeam) {
        // Round win
        const winnerPlayerId = this.getTeamPlayerId(winnerTeam, gameManager);
        if (winnerPlayerId) {
          const winnerProfile =
            playerManager.getPlayerDetails(winnerPlayerId)?.profileId;
          if (winnerProfile) {
            analytics.push({
              analyticName: 'tpongRound' + roundNumber + 'Wins',
              profileId: winnerProfile,
            });
            analytics.push({
              analyticName:
                'tpongRound' + roundNumber + 'Wins-' + playerCount + 'p',
              profileId: winnerProfile,
            });
          }
        }

        // Round losses for other teams
        for (let i = 0; i < activeTeams.length; i++) {
          const team = activeTeams[i];
          if (team !== winnerTeam) {
            const loserPlayerId = this.getTeamPlayerId(team, gameManager);
            if (loserPlayerId) {
              const loserProfile =
                playerManager.getPlayerDetails(loserPlayerId)?.profileId;
              if (loserProfile) {
                analytics.push({
                  analyticName: 'tpongRound' + roundNumber + 'Losses',
                  profileId: loserProfile,
                });
                analytics.push({
                  analyticName:
                    'tpongRound' + roundNumber + 'Losses-' + playerCount + 'p',
                  profileId: loserProfile,
                });
              }
            }
          }
        }
      } else {
        // Round tie - all active players get a tie
        for (let i = 0; i < activeTeams.length; i++) {
          const team = activeTeams[i];
          const playerId = this.getTeamPlayerId(team, gameManager);
          if (playerId) {
            const profile = playerManager.getPlayerDetails(playerId)?.profileId;
            if (profile) {
              analytics.push({
                analyticName: 'tpongRound' + roundNumber + 'Ties',
                profileId: profile,
              });
              analytics.push({
                analyticName:
                  'tpongRound' + roundNumber + 'Ties-' + playerCount + 'p',
                profileId: profile,
              });
            }
          }
        }
      }

      if (analytics.length > 0) {
        integrationsManager.putPublicKeyAnalytics({
          interactivePublicKey: this.analyticsPublicKey,
          analytics,
        });
        console.log('[PongAnalytics] Round', roundNumber, 'completion tracked');
      }
    } catch (e) {
      console.warn('[PongAnalytics] Error tracking round completion:', e);
    }
  }

  /**
   * Track tournament completion
   * @param winnerTeam - Winning team ID ('red', 'blue', 'green', 'yellow', or null for tie)
   * @param playerCount - Number of players in game (2 or 4)
   * @param gameManager - Reference to game manager for accessing team data
   */
  trackTournamentCompletion(
    winnerTeam: string | null,
    playerCount: number,
    gameManager: any,
  ) {
    if (!this.analyticsPublicKey) return;

    try {
      const analytics: any[] = [
        {
          analyticName: 'tpongGameCompletions',
        },
        {
          analyticName: 'tpongGameCompletions-' + playerCount + 'p',
        },
      ];

      // Get active teams
      const activeTeams: string[] = [];
      if (gameManager.teamRed && gameManager.teamRed.length > 0)
        activeTeams.push('red');
      if (gameManager.teamBlue && gameManager.teamBlue.length > 0)
        activeTeams.push('blue');
      if (gameManager.teamGreen && gameManager.teamGreen.length > 0)
        activeTeams.push('green');
      if (gameManager.teamYellow && gameManager.teamYellow.length > 0)
        activeTeams.push('yellow');

      // Track player completions for all participants
      for (let i = 0; i < activeTeams.length; i++) {
        const team = activeTeams[i];
        const playerId = this.getTeamPlayerId(team, gameManager);
        if (playerId) {
          const profile = playerManager.getPlayerDetails(playerId)?.profileId;
          if (profile) {
            analytics.push({
              analyticName: 'tpongPlayerCompletions',
              profileId: profile,
            });
            analytics.push({
              analyticName: 'tpongUniquePlayerCompletions',
              profileId: profile,
              uniqueKey: profile,
            });
          }
        }
      }

      // Determine if there's a tie (multiple teams with same max wins)
      const winners: string[] = [];
      if (winnerTeam) {
        // Check if it's a tie format: "tie:red,blue"
        if (winnerTeam.indexOf('tie:') === 0) {
          const tiedTeams = winnerTeam.substring(4).split(',');
          for (let i = 0; i < tiedTeams.length; i++) {
            winners.push(tiedTeams[i]);
          }
        } else {
          winners.push(winnerTeam);
        }
      }

      if (winners.length === 0) {
        // No clear winner - treat as overall tie
        for (let i = 0; i < activeTeams.length; i++) {
          const team = activeTeams[i];
          const playerId = this.getTeamPlayerId(team, gameManager);
          if (playerId) {
            const profile = playerManager.getPlayerDetails(playerId)?.profileId;
            if (profile) {
              analytics.push({
                analyticName: 'tpongTournamentTies',
                profileId: profile,
              });
              analytics.push({
                analyticName: 'tpongTournamentTies-' + playerCount + 'p',
                profileId: profile,
              });
            }
          }
        }
      } else if (winners.length === 1) {
        // Single winner
        const winnerId = this.getTeamPlayerId(winners[0], gameManager);
        if (winnerId) {
          const winnerProfile =
            playerManager.getPlayerDetails(winnerId)?.profileId;
          if (winnerProfile) {
            analytics.push({
              analyticName: 'tpongTournamentWins',
              profileId: winnerProfile,
            });
            analytics.push({
              analyticName: 'tpongTournamentWins-' + playerCount + 'p',
              profileId: winnerProfile,
            });
          }
        }

        // Track losses for other teams
        for (let i = 0; i < activeTeams.length; i++) {
          const team = activeTeams[i];
          if (team !== winners[0]) {
            const loserId = this.getTeamPlayerId(team, gameManager);
            if (loserId) {
              const loserProfile =
                playerManager.getPlayerDetails(loserId)?.profileId;
              if (loserProfile) {
                analytics.push({
                  analyticName: 'tpongTournamentLosses',
                  profileId: loserProfile,
                });
                analytics.push({
                  analyticName: 'tpongTournamentLosses-' + playerCount + 'p',
                  profileId: loserProfile,
                });
              }
            }
          }
        }
      } else {
        // Multiple winners (tie)
        for (let i = 0; i < winners.length; i++) {
          const winnerId = this.getTeamPlayerId(winners[i], gameManager);
          if (winnerId) {
            const profile = playerManager.getPlayerDetails(winnerId)?.profileId;
            if (profile) {
              analytics.push({
                analyticName: 'tpongTournamentTies',
                profileId: profile,
              });
              analytics.push({
                analyticName: 'tpongTournamentTies-' + playerCount + 'p',
                profileId: profile,
              });
            }
          }
        }

        // Track losses for teams not in the tie
        for (let i = 0; i < activeTeams.length; i++) {
          const team = activeTeams[i];
          let isTied = false;
          for (let j = 0; j < winners.length; j++) {
            if (team === winners[j]) {
              isTied = true;
              break;
            }
          }
          if (!isTied) {
            const loserId = this.getTeamPlayerId(team, gameManager);
            if (loserId) {
              const loserProfile =
                playerManager.getPlayerDetails(loserId)?.profileId;
              if (loserProfile) {
                analytics.push({
                  analyticName: 'tpongTournamentLosses',
                  profileId: loserProfile,
                });
                analytics.push({
                  analyticName: 'tpongTournamentLosses-' + playerCount + 'p',
                  profileId: loserProfile,
                });
              }
            }
          }
        }
      }

      // Track game initiator if available
      if (this.lastGameInitiatorProfileId) {
        analytics.push({
          analyticName: 'tpongGameInitiator-' + this.lastGameInitiatorProfileId,
        });
      }

      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: this.analyticsPublicKey,
        analytics,
      });

      console.log('[PongAnalytics] Tournament completion tracked');
    } catch (e) {
      console.warn('[PongAnalytics] Error tracking tournament completion:', e);
    }
  }

  /**
   * Helper: Get player ID from team
   */
  getTeamPlayerId(teamId: string, gameManager: any): number | null {
    if (!gameManager) return null;

    let teamList: any = null;
    if (teamId === 'red') teamList = gameManager.teamRed;
    else if (teamId === 'blue') teamList = gameManager.teamBlue;
    else if (teamId === 'green') teamList = gameManager.teamGreen;
    else if (teamId === 'yellow') teamList = gameManager.teamYellow;

    if (teamList && teamList.length > 0) {
      return teamList[0];
    }

    return null;
  }

  /**
   * Track paddle hit (for engagement metrics)
   * @param hitterPlayerId - Player who hit the ball (optional)
   */
  trackPaddleHit(hitterPlayerId?: number) {
    this.currentGamePaddleHits++;

    if (!this.analyticsPublicKey) return;

    try {
      const analytics: any[] = [
        {
          analyticName: 'tpongPaddleHits',
        },
      ];

      // Track per-player paddle hits if we have the player ID
      if (hitterPlayerId) {
        const details = playerManager.getPlayerDetails(hitterPlayerId);
        const profileId = details?.profileId;
        if (profileId) {
          analytics.push({
            analyticName: 'tpongPlayerPaddleHits',
            profileId: profileId,
          });
        }
      }

      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: this.analyticsPublicKey,
        analytics,
      });
    } catch (e) {
      console.warn('[PongAnalytics] Error tracking paddle hit:', e);
    }
  }

  /**
   * Track multiball trigger (chaos feature)
   * @param ballNumber - Which ball number was spawned (2, 3, 4, etc.)
   * @param playerCount - Number of players in game
   */
  trackMultiballTrigger(ballNumber: number, playerCount: number) {
    this.currentGameMultiballs++;

    if (!this.analyticsPublicKey) return;

    try {
      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: this.analyticsPublicKey,
        analytics: [
          {
            analyticName: 'tpongMultiballs',
          },
          {
            analyticName: 'tpongMultiballs-' + playerCount + 'p',
          },
          {
            analyticName: 'tpongMultiball-ball' + ballNumber,
          },
        ],
      });

      console.log(
        '[PongAnalytics] Multiball trigger tracked: ball #' + ballNumber,
      );
    } catch (e) {
      console.warn('[PongAnalytics] Error tracking multiball:', e);
    }
  }

  /**
   * Track sudden death occurrence
   * @param playerCount - Number of players in game
   */
  trackSuddenDeath(playerCount: number) {
    if (!this.analyticsPublicKey) return;

    try {
      integrationsManager.putPublicKeyAnalytics({
        interactivePublicKey: this.analyticsPublicKey,
        analytics: [
          {
            analyticName: 'tpongSuddenDeaths',
          },
          {
            analyticName: 'tpongSuddenDeaths-' + playerCount + 'p',
          },
        ],
      });

      console.log('[PongAnalytics] Sudden death tracked');
    } catch (e) {
      console.warn('[PongAnalytics] Error tracking sudden death:', e);
    }
  }

  /**
   * Reset game-specific counters (called at game start)
   */
  resetGameCounters() {
    this.currentGamePaddleHits = 0;
    this.currentGameMultiballs = 0;
  }
}
