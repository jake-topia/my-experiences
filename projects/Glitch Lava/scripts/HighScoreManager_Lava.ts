interface LavaScoreEntry {
  initials: string; // e.g., PE-TE-GE
  numPlayers: number; // team size
  cycles: number; // waves completed
  totalScore: number; // accumulated score
  timestamp: number; // for tiebreak (older first)
}

class HighScoreManager_Lava extends SystemScript {
  // Data
  highScores: PseudoList;
  maxScoresToKeep: number;

  // UI
  highScoreDisplaySprite: PseudoSprite;
  worldWidth: number;
  worldHeight: number;

  constructor() {
    console.log('[HighScore] INFO ctor:init');
    this.highScores = [];
    this.maxScoresToKeep = 10;
    this.worldWidth = 1000;
    this.worldHeight = 1000;
    this.highScoreDisplaySprite = null;
  }
  // --- TESTING FUNCTIONS ----------------------------------------------------

  /**
   * FOR TESTING: Clears all high scores and replaces them with a sample Top 10 list.
   * Call this from GameManager's onInit when you need to reset the scoreboard.
   */
  async seedTestScores() {
    console.log('[HighScore] INFO Seeding test scores...');
    var now = Date.now();

    var testScores = [
      {
        initials: 'PV-GM',
        numPlayers: 2,
        cycles: 9,
        totalScore: 98,
        timestamp: now - 1000,
      },
      {
        initials: 'HOT',
        numPlayers: 1,
        cycles: 9,
        totalScore: 95,
        timestamp: now - 2000,
      },
      {
        initials: 'LAVA',
        numPlayers: 1,
        cycles: 8,
        totalScore: 88,
        timestamp: now - 3000,
      },
      {
        initials: 'DGE-JP',
        numPlayers: 2,
        cycles: 8,
        totalScore: 85,
        timestamp: now - 4000,
      },
      {
        initials: 'BURN',
        numPlayers: 1,
        cycles: 7,
        totalScore: 79,
        timestamp: now - 5000,
      },
      {
        initials: 'GLTCH',
        numPlayers: 1,
        cycles: 7,
        totalScore: 76,
        timestamp: now - 6000,
      },
      {
        initials: 'RUN',
        numPlayers: 1,
        cycles: 6,
        totalScore: 68,
        timestamp: now - 7000,
      },
      {
        initials: 'FLR-IS',
        numPlayers: 2,
        cycles: 6,
        totalScore: 65,
        timestamp: now - 8000,
      },
      {
        initials: 'JUMP',
        numPlayers: 1,
        cycles: 5,
        totalScore: 59,
        timestamp: now - 9000,
      },
      {
        initials: 'MELT',
        numPlayers: 1,
        cycles: 5,
        totalScore: 52,
        timestamp: now - 10000,
      },
    ];

    // Overwrite the current scores with the test data
    this.highScores = testScores as any;

    // Save the new list to the cloud and update the on-screen display
    await this.saveHighScores();
    this.updateDisplay();

    console.log('[HighScore] INFO Seeding complete. Display updated.');
  }
  // --- Lifecycle -------------------------------------------------------------

  async onInit() {
    // Create the text sprite (hidden via opacity)
    if (spriteManager && typeof spriteManager.addSprite === 'function') {
      // UPDATE: Repositioned High Score UI to the left and resized font.
      var sprite = spriteManager.addSprite('text', {
        uniqueId: 'lavaHighScoreText',
        positionX: 20,
        positionY: 500, // Position below ScoreManager's HUD
        fontSize: 18, // Slightly smaller font for the list
        fontColor: '#FFFFFF',
        text: 'Loading Scores...',
        opacity: 0,
        align: 'left' as const,
        width: 700,
      });
      if (sprite) {
        this.highScoreDisplaySprite = sprite;
      }
    } else {
      console.log(
        '[HighScore] WARN could not create score sprite, spriteManager unavailable.',
      );
    }

    await this.loadHighScores();

    this.updateDisplay();
    console.log('[HighScore] INFO onInit complete');
  }

  // --- Helpers -------------------------------------------------------------

  /**
   * Safely converts a PseudoList or a plain array into a plain array.
   */
  private asArray(list: any): any[] {
    if (!list) {
      return [];
    }
    // Note: Array.isArray is ES5, so it's safe to use.
    if (Array.isArray(list)) {
      return list;
    }
    if (typeof list.toArray === 'function') {
      return list.toArray();
    }
    // This function can't use a try/catch, so we return an empty array for unknown types.
    console.log('[HighScore] WARN asArray: received an unknown list type.');
    return [];
  }

  /**
   * [UPDATED] Builds a hyphenated string of player initials from an array of player IDs.
   * Correctly handles multi-word names (e.g., "Pete Vigeant" -> "PV").
   * @param {number[]} playerIdsArray A plain array of player IDs.
   * @returns {string} The formatted initials string.
   */
  private buildTeamInitials(playerIdsArray: number[]): string {
    if (!playerIdsArray || playerIdsArray.length === 0) {
      return '???';
    }

    var initialsList = [];

    for (var i = 0; i < playerIdsArray.length; i++) {
      var currentPlayerId = playerIdsArray[i];
      var playerDetails = null;
      // Default fallback, e.g., "P1", "P38"
      var playerInitials = ('P' + currentPlayerId).substring(0, 2);

      if (
        typeof playerManager !== 'undefined' &&
        typeof playerManager.getPlayerDetails === 'function'
      ) {
        playerDetails = playerManager.getPlayerDetails(currentPlayerId);
      }

      if (playerDetails && playerDetails.username) {
        var username = playerDetails.username.trim();

        // Filter out empty strings that can result from multiple spaces, e.g., "Pete  Vigeant"
        var nameParts = username.split(' ').filter(function (part) {
          return part.length > 0;
        });

        if (nameParts.length > 1) {
          var firstInitial = nameParts[0].charAt(0);
          var lastInitial = nameParts[nameParts.length - 1].charAt(0);
          playerInitials = (firstInitial + lastInitial).toUpperCase();
        } else if (nameParts.length === 1) {
          // For a single name like "Glitch", it takes the first two letters -> "GL"
          playerInitials = nameParts[0].substring(0, 2).toUpperCase();
        }
        // If username was empty or just spaces, the default 'P' + ID fallback remains.
      }

      initialsList.push(playerInitials);
    }

    return initialsList.join('-');
  }
  /**
   * Sorts and trims a plain array of score entries.
   */
  private sortAndTrim(entries: any[]): any[] {
    entries.sort(function (a, b) {
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      if (b.cycles !== a.cycles) {
        return b.cycles - a.cycles;
      }
      return a.timestamp - b.timestamp; // older first on ties
    });
    return entries.slice(0, this.maxScoresToKeep);
  }

  // --- Public API (called by GameManager) -----------------------------------

  /**
   * Called by GM at GAME OVER.
   */
  async submitScore(
    playerIds: PseudoList,
    cyclesSurvived: number,
    totalScore: number,
  ) {
    var ids = this.asArray(playerIds);
    // If there are no players, don't record a score.
    if (ids.length === 0) {
      return;
    }
    var initials = this.buildTeamInitials(ids);

    var entry: LavaScoreEntry = {
      initials: initials,
      numPlayers: ids.length,
      cycles: cyclesSurvived,
      totalScore: totalScore,
      timestamp: Date.now(),
    };

    var list = this.asArray(this.highScores);
    list.push(entry);
    list = this.sortAndTrim(list);
    this.highScores = list as any;
    var madeLeaderboard = false;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === entry) {
        madeLeaderboard = true;
        break;
      }
    }

    await this.saveHighScores();
    this.updateDisplay();
    if (madeLeaderboard) {
      this.triggerHighScoreActivity();
    }
    console.log('[HighScore] INFO submit:', initials, 'score=', totalScore);
  }

  /**
   * Show/Hide leaderboard block (opacity only).
   */
  toggleHighScoreDisplay(show: boolean) {
    if (this.highScoreDisplaySprite && spriteManager) {
      spriteManager.updateSprite(this.highScoreDisplaySprite.uniqueId, {
        opacity: show ? 1 : 0,
      });
    }
  }

  /**
   * Optional: put a temporary message into the HS spot.
   */
  displayMessage(msg: string) {
    if (this.highScoreDisplaySprite && spriteManager) {
      spriteManager.updateSprite(this.highScoreDisplaySprite.uniqueId, {
        text: msg,
      });
    }
  }

  // --- Rendering -------------------------------------------------------------

  private updateDisplay() {
    var list = this.asArray(this.highScores);
    var text = '🏆 HIGH SCORES 🏆\n\n';

    if (!list || list.length === 0) {
      text += 'No scores yet. Be the first!';
    } else {
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        // UPDATE: Adjusted spacing slightly for better alignment
        text +=
          i +
          1 +
          '. ' +
          s.initials +
          ' (' +
          s.numPlayers +
          'P)\n' +
          '    Waves: ' +
          s.cycles +
          '   Score: ' +
          s.totalScore +
          '\n';
      }
    }

    if (this.highScoreDisplaySprite && spriteManager) {
      spriteManager.updateSprite(this.highScoreDisplaySprite.uniqueId, {
        text: text,
      });
    }
    console.log('[HighScore] INFO list:\n' + text);
  }

  // --- Cloud persistence ----------------------------------------------------

  private getPublicKey(): string | null {
    var key = stateManager.getVariable('PublicKey') as string;
    if (!key) {
      console.log(
        '!!! HighScoreManager_Lava: PublicKey missing; cannot load/save.',
      );
      return null;
    }
    return key;
  }

  private async loadHighScores() {
    var key = this.getPublicKey();
    if (!key) {
      this.highScores = [];
      return;
    }

    // Since this can fail, we'll handle a null result from the manager
    var dataObject = await integrationsManager.getDataObject({
      interactivePublicKey: key,
      scope: 'WORLD',
    });

    var loaded = [];
    if (
      dataObject &&
      typeof dataObject === 'object' &&
      Array.isArray((dataObject).lavaHighScores)
    ) {
      loaded = (dataObject).lavaHighScores;
    }

    // Sanitize, sort, and trim the loaded data
    loaded = loaded.filter(function (e) {
      return (
        e &&
        typeof e.initials === 'string' &&
        typeof e.totalScore === 'number' &&
        typeof e.cycles === 'number' &&
        typeof e.timestamp === 'number'
      );
    });

    loaded = this.sortAndTrim(loaded);

    this.highScores = loaded;
    console.log(
      '[HighScore] INFO loaded ' +
        this.asArray(this.highScores).length +
        ' entries from cloud.',
    );
  }

  private async saveHighScores() {
    var key = this.getPublicKey();
    if (!key) {
      return;
    }

    var dataObject =
      (await integrationsManager.getDataObject({
        interactivePublicKey: key,
        scope: 'WORLD',
      })) || {};

    var toSave = this.asArray(this.highScores);
    (dataObject).lavaHighScores = toSave;

    await integrationsManager.updateDataObject({
      interactivePublicKey: key,
      scope: 'WORLD',
      payload: dataObject,
    });
    console.log(
      '[HighScore] INFO saved ' + toSave.length + ' entries to cloud.',
    );
  }

  private triggerHighScoreActivity() {
    try {
      var key = this.getPublicKey();
      if (!key) {
        return;
      }
      integrationsManager.setWorldActivity({
        type: 'GAME_HIGH_SCORE',
        interactivePublicKey: key,
      });
    } catch (e) {
      console.log('[HighScore] WARN activity trigger failed', e);
    }
  }
}
