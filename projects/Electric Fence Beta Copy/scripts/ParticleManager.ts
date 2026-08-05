class ParticleManager extends SystemScript {
  // Declare properties
  interactivePublicKey: string;
  particleType: PseudoList;

  constructor() {
    this.interactivePublicKey = stateManager.getVariable('PublicKey');
    this.particleType = [
      'balloonDisco_breeze',
      'blackSmoke_puff',
      'blueSmoke_fog',
      'blueSmoke_puff',
      'brain_float',
      'classicConfetti_explosion',
      'classicConfetti_fall',
      'crown_float',
      'disco_float',
      'explosion_float',
      'greenSmoke_puff',
      'guitar_float',
      'guitarMusicNote_breeze',
      'lightBlueSmoke_puff',
      'medal_float',
      'musicNote_breeze',
      'musicNote_float',
      'partyPopper_float',
      'pastelConfetti_explosion',
      'pastelConfetti_fall',
      'pawPrint_float',
      'pinkHeart_burst',
      'pinkHeart_float',
      'pinkSmoke_fog',
      'purpleSmoke_fog',
      'purpleSmoke_puff',
      'rainbow_burst',
      'rainbow_zoom',
      'redHeart_float',
      'redPinkHeart_float',
      'rwbConfetti_explosion',
      'rwbConfetti_fall',
      'sleep_float',
      'sparkles_float',
      'starStruck_breeze',
      'starStruck_float',
      'trophy_float',
      'trophyBalloon_float',
      'whiteStar_burst',
    ];
  }

  onInit() {}

  /**
   * Shoots a particle system.
   * @param ParticleType:
   * 0 - balloonDisco_breeze
   * 1 - blackSmoke_puff
   * 2 - blueSmoke_fog
   * 3 - blueSmoke_puff
   * 4 - brain_float
   * 5 - classicConfetti_explosion
   * 6 - classicConfetti_fall
   * 7 - crown_float
   * 8 - disco_float
   * 9 - explosion_float
   * 10 - greenSmoke_puff
   * 11 - guitar_float
   * 12 - guitarMusicNote_breeze
   * 13 - lightBlueSmoke_puff
   * 14 - medal_float
   * 15 - musicNote_breeze
   * 16 - musicNote_float
   * 17 - partyPopper_float
   * 18 - pastelConfetti_explosion
   * 19 - pastelConfetti_fall
   * 20 - pawPrint_float
   * 21 - pinkHeart_burst
   * 22 - pinkHeart_float
   * 23 - pinkSmoke_fog
   * 24 - purpleSmoke_fog
   * 25 - purpleSmoke_puff
   * 26 - rainbow_burst
   * 27 - rainbow_zoom
   * 28 - redHeart_float
   * 29 - redPinkHeart_float
   * 30 - rwbConfetti_explosion
   * 31 - rwbConfetti_fall
   * 32 - sleep_float
   * 33 - sparkles_float
   * 34 - starStruck_breeze
   * 35 - starStruck_float
   * 36 - trophy_float
   * 37 - trophyBalloon_float
   * 38 - whiteStar_burst
   * @param playerId The ID of the player to follow (optional)
   * @param position - the spot for the effect
   * @param duration - the time (in seconds)
   */
  displayParticles(
    position: { x; y },
    particleType: number,
    duration: number,
    playerId?: number,
  ) {
    const particleOptions = {
      duration: duration,
      particleName: this.particleType[particleType],
      position: position,
      interactivePublicKey: this.interactivePublicKey,
      followPlayerId: playerId,
    };
    try {
      const particle =
        integrationsManager.triggerParticleEffect(particleOptions);
    } catch (e) {
      console.log('!!! ParticleManager ERROR:', e);
    }
  }
}
