class CrazyEightsRulesSystem extends SystemScript {
  // tiny helper so suits are consistent
  normalizeSuit(s: any): string {
    if (!s) return '';
    var t = ('' + s).toLowerCase();
    if (
      t === 'hearts' ||
      t === 'diamonds' ||
      t === 'clubs' ||
      t === 'spades' ||
      t === 'joker'
    )
      return t;
    if (t === 'heart') return 'hearts';
    if (t === 'diamond') return 'diamonds';
    if (t === 'club') return 'clubs';
    if (t === 'spade') return 'spades';
    return '';
  }

  isWildCard(card: any): boolean {
    return !!(card && this.normalizeSuit(card.suit) === 'joker');
  }

  /**
   * Validate a play.
   * @param playedCard required
   * @param topCard optional (undefined when pile empty)
   * @param activeSuit optional (undefined when no wild suit is set)
   */
  isValidPlay(playedCard: any, topCard?: any, activeSuit?: any): boolean {
    // Never allow rules to run on nulls (engine bug workaround)
    if (!playedCard) return false;

    var pSuit = this.normalizeSuit(playedCard.suit);
    var pRank = playedCard && playedCard.rank ? '' + playedCard.rank : '';

    if (this.isWildCard(playedCard)) return true;

    // If wild suit is active, it must match suit OR the rank must match the physical topCard
    if (activeSuit !== undefined && activeSuit !== null && activeSuit !== '') {
      var chosenSuit = this.normalizeSuit(activeSuit);
      if (!chosenSuit) return false; // malformed active suit
      if (pSuit === chosenSuit) return true;
      // rank match only makes sense if we actually have a top card
      if (topCard && '' + topCard.rank === pRank) return true;
      return false;
    }

    // If no top card yet, any non-wild can start
    if (!topCard) return true;

    var tSuit = this.normalizeSuit(topCard.suit);
    var tRank = topCard && topCard.rank ? '' + topCard.rank : '';

    return pSuit === tSuit || pRank === tRank;
  }

  /**
   * Can the player draw? Only if they have no valid play.
   */
  canDrawCard(playerHand: any[], topCard?: any, activeSuit?: any): boolean {
    if (!playerHand || !playerHand.length) return true;
    for (var i = 0; i < playerHand.length; i++) {
      if (this.isValidPlay(playerHand[i], topCard, activeSuit)) return false;
    }
    return true;
  }

  /**
   * Choose a safe initial discard (non-joker) and mutate the deck.
   * Works with PseudoList or Array.
   */
  getInitialDiscardCard(deck: any): any {
    if (!deck) return undefined;
    var arr = deck.toArray ? deck.toArray() : deck.slice ? deck.slice() : [];

    var picked = undefined;
    for (var i = arr.length - 1; i >= 0; i--) {
      var c = arr[i];
      if (c && !this.isWildCard(c)) {
        picked = arr.splice(i, 1)[0];
        break;
      }
    }

    // write back into the given deck (avoid passing nulls)
    if (deck.toArray) {
      while (deck.length > 0) deck.pop();
      for (var j = 0; j < arr.length; j++) deck.push(arr[j]);
    } else if (deck.splice) {
      deck.length = 0;
      for (var k = 0; k < arr.length; k++) deck.push(arr[k]);
    }

    return picked; // may be undefined if all jokers
  }
}
