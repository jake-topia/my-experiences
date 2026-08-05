class TimerManager extends SystemScript {
  // --- Step clock ---
  private currentStep: number;

  // --- Electric Fence (legacy) ---
  private countdownTimerTargetStep: number;
  private countdownPayload: string;
  private startGameplayTimerTargetStep: number;
  private nextLevelTimerTargetStep: number;
  private gameplayUpdateIntervalTargetStep: number;
  private resetLastTeleportedTimerTargetStep: number;
  private resetLastTeleportedPayload: string;

  // --- Lava countdown tick (stringified payload {value}) ---
  private lavaGameCountdownTick_TargetStep: number;
  private lavaGameCountdownTick_Payload: string;

  // --- Lava game timers ---
  private triggerCountdown_TargetStep: number;
  private endCurrentLavaWave_TargetStep: number;
  private initiateNextWaveCycle_TargetStep: number;
  private offerRestart_TargetStep: number;
  private lavaFlashTick_TargetStep: number;
  private finishMainCountdown_TargetStep: number;

  // --- UI message clear ---
  private messageClear_TargetStep: number;
  private messageClear_Payload: string;

  // --- Bonus Zone timers ---
  private moveBonusZone_TargetStep: number;
  private awardBonusPoints_TargetStep: number;
  private jumpBonusZone_TargetStep: number;

  constructor() {
    console.log('[Timer] INFO ctor:init');
    this.currentStep = 0;

    // Legacy
    this.countdownTimerTargetStep = 0;
    this.countdownPayload = '';
    this.startGameplayTimerTargetStep = 0;
    this.nextLevelTimerTargetStep = 0;
    this.gameplayUpdateIntervalTargetStep = 0;
    this.resetLastTeleportedTimerTargetStep = 0;
    this.resetLastTeleportedPayload = '';

    // Lava
    this.triggerCountdown_TargetStep = 0;
    this.endCurrentLavaWave_TargetStep = 0;
    this.initiateNextWaveCycle_TargetStep = 0;
    this.offerRestart_TargetStep = 0;
    this.lavaFlashTick_TargetStep = 0;
    this.finishMainCountdown_TargetStep = 0;

    // UI
    this.messageClear_TargetStep = 0;
    this.messageClear_Payload = '';

    // Lava countdown tick
    this.lavaGameCountdownTick_TargetStep = 0;
    this.lavaGameCountdownTick_Payload = '';

    // Bonus Zone
    this.moveBonusZone_TargetStep = 0;
    this.awardBonusPoints_TargetStep = 0;
    this.jumpBonusZone_TargetStep = 0;
  }

  /**
   * Ready signal.
   */
  onInit() {
    console.log('[Timer] INFO onInit:ready');
    try {
      eventManager.emit('timerManagerReady', {});
    } catch (e) {
      console.log('[Timer] ERROR onInit: emit timerManagerReady failed', e);
    }
  }

  /**
   * Host-only heartbeat: increments step and fires any timers that have reached their targets.
   */
  onStep() {
    if (!playerManager.isHost) return;
    this.currentStep++;

    // --- Lava main countdown tick ---
    if (
      this.lavaGameCountdownTick_TargetStep > 0 &&
      this.currentStep >= this.lavaGameCountdownTick_TargetStep
    ) {
      let payloadToEmit: any = null;
      const payloadString = this.lavaGameCountdownTick_Payload;
      this.lavaGameCountdownTick_TargetStep = 0;
      this.lavaGameCountdownTick_Payload = '';
      try {
        if (payloadString && payloadString !== '')
          payloadToEmit = JSON.parse(payloadString);
        eventManager.emit('lavaGameCountdownTick', payloadToEmit);
      } catch (e) {
        console.log('[Timer] ERROR onStep: lavaGameCountdownTick', e);
        try {
          eventManager.emit('lavaGameCountdownTick', null);
        } catch (emitErr) {}
      }
    }

    // --- Legacy: countdown tick (general) ---
    if (
      this.countdownTimerTargetStep > 0 &&
      this.currentStep >= this.countdownTimerTargetStep
    ) {
      let valueToEmit: number | null = null;
      let payloadString = this.countdownPayload;
      this.countdownTimerTargetStep = 0;
      this.countdownPayload = '';
      try {
        if (payloadString && payloadString !== '') {
          const parsed = JSON.parse(payloadString);
          if (parsed && typeof parsed.countdownNextValue === 'number') {
            valueToEmit = parsed.countdownNextValue;
          } else {
            valueToEmit = +payloadString;
          }
        } else {
          valueToEmit = null;
        }
        eventManager.emit('handleCountdownTick', valueToEmit);
      } catch (e) {
        console.log('[Timer] ERROR onStep: countdown', e);
        try {
          eventManager.emit('handleCountdownTick', null);
        } catch (emitErr) {}
      }
    }

    // --- Legacy: start gameplay ---
    if (
      this.startGameplayTimerTargetStep > 0 &&
      this.currentStep >= this.startGameplayTimerTargetStep
    ) {
      this.startGameplayTimerTargetStep = 0;
      try {
        eventManager.emit('startGameplayNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: startGameplayNow', e);
      }
    }

    // --- Legacy: next level ---
    if (
      this.nextLevelTimerTargetStep > 0 &&
      this.currentStep >= this.nextLevelTimerTargetStep
    ) {
      this.nextLevelTimerTargetStep = 0;
      try {
        eventManager.emit('triggerNextLevel', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: triggerNextLevel', e);
      }
    }

    // --- Legacy: gameplayUpdate interval (reschedules itself) ---
    if (
      this.gameplayUpdateIntervalTargetStep > 0 &&
      this.currentStep >= this.gameplayUpdateIntervalTargetStep
    ) {
      try {
        eventManager.emit('updateGameplayDisplay', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: updateGameplayDisplay', e);
      }
      const intervalSteps = 1;
      this.gameplayUpdateIntervalTargetStep += intervalSteps;
    }

    // --- Legacy: reset last teleported ---
    if (
      this.resetLastTeleportedTimerTargetStep > 0 &&
      this.currentStep >= this.resetLastTeleportedTimerTargetStep
    ) {
      let payloadToEmit: PseudoAny = null;
      try {
        if (
          this.resetLastTeleportedPayload &&
          this.resetLastTeleportedPayload !== ''
        ) {
          payloadToEmit = JSON.parse(this.resetLastTeleportedPayload);
        }
        eventManager.emit('resetLastTeleported', payloadToEmit || {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: resetLastTeleported', e);
      }
      this.resetLastTeleportedTimerTargetStep = 0;
      this.resetLastTeleportedPayload = '';
    }

    // --- Lava: trigger countdown ---
    if (
      this.triggerCountdown_TargetStep > 0 &&
      this.currentStep >= this.triggerCountdown_TargetStep
    ) {
      this.triggerCountdown_TargetStep = 0;
      try {
        eventManager.emit('triggerCountdownNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: triggerCountdownNow', e);
      }
    }

    // --- Lava: end wave ---
    if (
      this.endCurrentLavaWave_TargetStep > 0 &&
      this.currentStep >= this.endCurrentLavaWave_TargetStep
    ) {
      this.endCurrentLavaWave_TargetStep = 0;
      try {
        eventManager.emit('endCurrentLavaWaveNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: endCurrentLavaWaveNow', e);
      }
    }

    // --- Lava: initiate next wave ---
    if (
      this.initiateNextWaveCycle_TargetStep > 0 &&
      this.currentStep >= this.initiateNextWaveCycle_TargetStep
    ) {
      this.initiateNextWaveCycle_TargetStep = 0;
      try {
        eventManager.emit('initiateNextWaveCycleNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: initiateNextWaveCycleNow', e);
      }
    }

    // --- Lava: offer restart ---
    if (
      this.offerRestart_TargetStep > 0 &&
      this.currentStep >= this.offerRestart_TargetStep
    ) {
      this.offerRestart_TargetStep = 0;
      try {
        eventManager.emit('offerRestartNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: offerRestartNow', e);
      }
    }

    // --- Lava: flash tick (legacy flashing) ---
    if (
      this.lavaFlashTick_TargetStep > 0 &&
      this.currentStep >= this.lavaFlashTick_TargetStep
    ) {
      this.lavaFlashTick_TargetStep = 0;
      try {
        eventManager.emit('lavaFlashTickNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: lavaFlashTickNow', e);
      }
    }

    // --- Lava: finish main countdown ("GO!" dwell) ---
    if (
      this.finishMainCountdown_TargetStep > 0 &&
      this.currentStep >= this.finishMainCountdown_TargetStep
    ) {
      this.finishMainCountdown_TargetStep = 0;
      try {
        eventManager.emit('finishMainCountdownNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: finishMainCountdownNow', e);
      }
    }

    // --- UI: message clear ---
    if (
      this.messageClear_TargetStep > 0 &&
      this.currentStep >= this.messageClear_TargetStep
    ) {
      let payloadToEmit: PseudoAny = null;
      let payloadString = this.messageClear_Payload;
      this.messageClear_TargetStep = 0;
      this.messageClear_Payload = '';
      try {
        if (payloadString && payloadString !== '')
          payloadToEmit = JSON.parse(payloadString);
        eventManager.emit('clearMessageNow', payloadToEmit);
      } catch (e) {
        console.log('[Timer] ERROR onStep: messageClear', e);
        try {
          eventManager.emit('clearMessageNow', null);
        } catch (emitErr) {}
      }
    }

    // --- Bonus: move (currently disabled emit, retained for future) ---
    if (
      this.moveBonusZone_TargetStep > 0 &&
      this.currentStep >= this.moveBonusZone_TargetStep
    ) {
      this.moveBonusZone_TargetStep = 0;
      try {
        // eventManager.emit('moveBonusZoneNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: moveBonusZoneNow', e);
      }
    }

    // --- Bonus: award points (currently disabled emit, retained for future) ---
    if (
      this.awardBonusPoints_TargetStep > 0 &&
      this.currentStep >= this.awardBonusPoints_TargetStep
    ) {
      this.awardBonusPoints_TargetStep = 0;
      try {
        // eventManager.emit('awardBonusPointsNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: awardBonusPointsNow', e);
      }
    }

    // --- Bonus: jump ---
    if (
      this.jumpBonusZone_TargetStep > 0 &&
      this.currentStep >= this.jumpBonusZone_TargetStep
    ) {
      this.jumpBonusZone_TargetStep = 0;
      try {
        eventManager.emit('jumpBonusZoneNow', {});
      } catch (e) {
        console.log('[Timer] ERROR onStep: jumpBonusZoneNow', e);
      }
    }
  }

  /**
   * Schedule a one-shot timer by name (seconds → steps).
   */
  setTimer(
    type:
      | 'countdown'
      | 'startGameplay'
      | 'nextLevel'
      | 'resetLastTeleported'
      | 'triggerCountdown'
      | 'endCurrentLavaWave'
      | 'initiateNextWaveCycle'
      | 'offerRestart'
      | 'lavaFlashTick'
      | 'finishMainCountdown'
      | 'messageClear'
      | 'lavaGameCountdownTick'
      | 'moveBonusZone'
      | 'awardBonusPoints'
      | 'jumpBonusZone',
    delaySeconds: number,
    payload?: PseudoAny,
  ) {
    var delaySteps = 1;
    if (delaySeconds > 0) {
      var wholeSteps = 0;
      var tempVal = delaySeconds;
      while (tempVal >= 1) {
        wholeSteps++;
        tempVal--;
      }
      delaySteps = delaySeconds > wholeSteps ? wholeSteps + 1 : wholeSteps;
      if (delaySteps < 1) delaySteps = 1;
    }
    var targetStep = this.currentStep + delaySteps;

    console.log('[Timer] INFO set ' + type + ' → step ' + targetStep);

    switch (type) {
      case 'lavaGameCountdownTick':
        this.lavaGameCountdownTick_TargetStep = targetStep;
        try {
          this.lavaGameCountdownTick_Payload = payload
            ? JSON.stringify(payload)
            : '';
        } catch (e) {
          this.lavaGameCountdownTick_Payload = '';
        }
        break;

      case 'countdown':
        this.countdownTimerTargetStep = targetStep;
        try {
          this.countdownPayload = payload ? JSON.stringify(payload) : '';
        } catch (e) {
          this.countdownPayload = '';
        }
        break;

      case 'startGameplay':
        this.startGameplayTimerTargetStep = targetStep;
        break;

      case 'nextLevel':
        this.nextLevelTimerTargetStep = targetStep;
        break;

      case 'resetLastTeleported':
        this.resetLastTeleportedTimerTargetStep = targetStep;
        try {
          this.resetLastTeleportedPayload = payload
            ? JSON.stringify(payload)
            : '';
        } catch (e) {
          this.resetLastTeleportedPayload = '';
        }
        break;

      case 'triggerCountdown':
        this.triggerCountdown_TargetStep = targetStep;
        break;

      case 'endCurrentLavaWave':
        this.endCurrentLavaWave_TargetStep = targetStep;
        break;

      case 'initiateNextWaveCycle':
        this.initiateNextWaveCycle_TargetStep = targetStep;
        break;

      case 'offerRestart':
        this.offerRestart_TargetStep = targetStep;
        break;

      case 'lavaFlashTick':
        this.lavaFlashTick_TargetStep = targetStep;
        break;

      case 'finishMainCountdown':
        this.finishMainCountdown_TargetStep = targetStep;
        break;

      case 'messageClear':
        this.messageClear_TargetStep = targetStep;
        try {
          this.messageClear_Payload = payload ? JSON.stringify(payload) : '';
        } catch (e) {
          this.messageClear_Payload = '';
        }
        break;

      case 'moveBonusZone':
        this.moveBonusZone_TargetStep = targetStep;
        break;

      case 'awardBonusPoints':
        this.awardBonusPoints_TargetStep = targetStep;
        break;

      case 'jumpBonusZone':
        this.jumpBonusZone_TargetStep = targetStep;
        break;

      default:
        console.log('[Timer] ERROR setTimer: unknown type ' + type);
    }
  }

  /**
   * Schedule a repeating interval (legacy: 'gameplayUpdate' only).
   */
  setInterval(type: 'gameplayUpdate', intervalSeconds: number) {
    if (type !== 'gameplayUpdate') {
      console.log('[Timer] ERROR setInterval: unknown type ' + type);
      return;
    }
    var intervalSteps = 1;
    if (intervalSeconds > 0) {
      var wholeSteps = 0;
      var tempVal = intervalSeconds;
      while (tempVal >= 1) {
        wholeSteps++;
        tempVal--;
      }
      intervalSteps =
        intervalSeconds > wholeSteps ? wholeSteps + 1 : wholeSteps;
      if (intervalSteps < 1) intervalSteps = 1;
    }
    this.gameplayUpdateIntervalTargetStep = this.currentStep + intervalSteps;
    console.log(
      '[Timer] INFO setInterval gameplayUpdate every ' +
        intervalSteps +
        ' steps',
    );
  }

  /**
   * Cancel a scheduled timer or interval by name.
   */
  clearTimer(
    type:
      | 'countdown'
      | 'startGameplay'
      | 'nextLevel'
      | 'gameplayUpdate'
      | 'resetLastTeleported'
      | 'triggerCountdown'
      | 'endCurrentLavaWave'
      | 'initiateNextWaveCycle'
      | 'offerRestart'
      | 'lavaFlashTick'
      | 'finishMainCountdown'
      | 'messageClear'
      | 'lavaGameCountdownTick'
      | 'moveBonusZone'
      | 'awardBonusPoints'
      | 'jumpBonusZone',
  ) {
    switch (type) {
      case 'lavaGameCountdownTick':
        if (this.lavaGameCountdownTick_TargetStep > 0)
          console.log('[Timer] INFO clear lavaGameCountdownTick');
        this.lavaGameCountdownTick_TargetStep = 0;
        this.lavaGameCountdownTick_Payload = '';
        break;

      case 'countdown':
        if (this.countdownTimerTargetStep > 0)
          console.log('[Timer] INFO clear countdown');
        this.countdownTimerTargetStep = 0;
        this.countdownPayload = '';
        break;

      case 'startGameplay':
        if (this.startGameplayTimerTargetStep > 0)
          console.log('[Timer] INFO clear startGameplay');
        this.startGameplayTimerTargetStep = 0;
        break;

      case 'nextLevel':
        if (this.nextLevelTimerTargetStep > 0)
          console.log('[Timer] INFO clear nextLevel');
        this.nextLevelTimerTargetStep = 0;
        break;

      case 'gameplayUpdate':
        if (this.gameplayUpdateIntervalTargetStep > 0)
          console.log('[Timer] INFO clear gameplayUpdate');
        this.gameplayUpdateIntervalTargetStep = 0;
        break;

      case 'resetLastTeleported':
        if (this.resetLastTeleportedTimerTargetStep > 0)
          console.log('[Timer] INFO clear resetLastTeleported');
        this.resetLastTeleportedTimerTargetStep = 0;
        this.resetLastTeleportedPayload = '';
        break;

      case 'triggerCountdown':
        if (this.triggerCountdown_TargetStep > 0)
          console.log('[Timer] INFO clear triggerCountdown');
        this.triggerCountdown_TargetStep = 0;
        break;

      case 'endCurrentLavaWave':
        if (this.endCurrentLavaWave_TargetStep > 0)
          console.log('[Timer] INFO clear endCurrentLavaWave');
        this.endCurrentLavaWave_TargetStep = 0;
        break;

      case 'initiateNextWaveCycle':
        if (this.initiateNextWaveCycle_TargetStep > 0)
          console.log('[Timer] INFO clear initiateNextWaveCycle');
        this.initiateNextWaveCycle_TargetStep = 0;
        break;

      case 'offerRestart':
        if (this.offerRestart_TargetStep > 0)
          console.log('[Timer] INFO clear offerRestart');
        this.offerRestart_TargetStep = 0;
        break;

      case 'lavaFlashTick':
        if (this.lavaFlashTick_TargetStep > 0)
          console.log('[Timer] INFO clear lavaFlashTick');
        this.lavaFlashTick_TargetStep = 0;
        break;

      case 'finishMainCountdown':
        if (this.finishMainCountdown_TargetStep > 0)
          console.log('[Timer] INFO clear finishMainCountdown');
        this.finishMainCountdown_TargetStep = 0;
        break;

      case 'messageClear':
        if (this.messageClear_TargetStep > 0)
          console.log('[Timer] INFO clear messageClear');
        this.messageClear_TargetStep = 0;
        this.messageClear_Payload = '';
        break;

      case 'moveBonusZone':
        if (this.moveBonusZone_TargetStep > 0)
          console.log('[Timer] INFO clear moveBonusZone');
        this.moveBonusZone_TargetStep = 0;
        break;

      case 'awardBonusPoints':
        if (this.awardBonusPoints_TargetStep > 0)
          console.log('[Timer] INFO clear awardBonusPoints');
        this.awardBonusPoints_TargetStep = 0;
        break;

      case 'jumpBonusZone':
        if (this.jumpBonusZone_TargetStep > 0)
          console.log('[Timer] INFO clear jumpBonusZone');
        this.jumpBonusZone_TargetStep = 0;
        break;

      default:
        console.log('[Timer] ERROR clearTimer: unknown type ' + type);
    }
  }
}
