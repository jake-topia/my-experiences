class CrazyEightsConfigSystem extends SystemScript {
  private _config: any;

  constructor() {
    this._config = {
      minPlayers: 2,
      maxPlayers: 8,
      initialHandSize: 5,
      deck: {
        type: 'standardWithJokers',
        jokerCount: 10,
      },

      // ==========================================
      // SPECIAL CARD RULES (configurable)
      // Set any to null/undefined to disable
      // ==========================================
      specialCards: {
        // Draw 2: Next player draws 2 cards and loses turn
        draw2: {
          enabled: true,
          rank: '2',
          drawCount: 2,
          label: '+2', // Label shown on card
          description: 'Next player draws 2 cards',
        },
        // Skip: Next player loses their turn
        skip: {
          enabled: true,
          rank: 'A',
          label: 'SKIP', // Label shown on card
          description: 'Skip the next player',
        },
        // Reverse: Reverses play direction
        reverse: {
          enabled: true,
          rank: 'Q',
          label: 'REVERSE', // Label shown on card
          description: 'Reverse play direction',
        },
        // Wild (Joker) - already implemented, included for documentation
        wild: {
          enabled: true,
          rank: 'joker',
          label: 'WILD',
          description: 'Play on any card, choose next suit',
        },
      },

      // ==========================================
      // GAME INSTRUCTIONS
      // ==========================================
      instructions: {
        title: '🃏 Last Card 🃏',
        rules: [
          'Match the top card by SUIT or RANK',
          'If you cannot play, draw from the deck',
          'First player to empty their hand wins!',
        ],
        specialCardRules: [
          '2️⃣ = Next player draws 2 cards',
          '🅰️ Ace = Skip the next player',
          '👸 Queen = Reverse play direction',
          '🃏 Joker = Wild! Play anytime, pick the suit',
        ],
      },
    };
  }

  // The engine will call this method to get the configuration.
  public getConfig() {
    return this._config;
  }

  /**
   * Get formatted game instructions as a string
   * Used by the help system
   */
  public getInstructions(): string {
    var cfg = this._config;
    var lines = [];

    lines.push(cfg.instructions.title);
    lines.push('');
    lines.push('📋 Basic Rules:');
    for (var i = 0; i < cfg.instructions.rules.length; i++) {
      lines.push('  • ' + cfg.instructions.rules[i]);
    }

    // Only show special card rules if any are enabled
    var hasSpecialCards =
      cfg.specialCards.draw2.enabled ||
      cfg.specialCards.skip.enabled ||
      cfg.specialCards.reverse.enabled ||
      cfg.specialCards.wild.enabled;

    if (hasSpecialCards) {
      lines.push('');
      lines.push('⚡ Special Cards:');
      for (var j = 0; j < cfg.instructions.specialCardRules.length; j++) {
        lines.push('  • ' + cfg.instructions.specialCardRules[j]);
      }
    }

    return lines.join('\n');
  }
}
