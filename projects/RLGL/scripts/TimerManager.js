"use strict";
class TimerManager extends SystemScript {
    countdownSprite;
    currentStep;
    countdownTargetStep;
    countdownValue;
    roundFinishDeadlineMs;
    roundFinishLastDisplayedSeconds;
    worldWidth;
    worldHeight;
    isClearing;
    constructor() {
        if (!playerManager.isHost)
            return;
        this.countdownSprite = null;
        this.currentStep = 0;
        this.countdownTargetStep = 0;
        this.countdownValue = 0;
        this.roundFinishDeadlineMs = 0;
        this.roundFinishLastDisplayedSeconds = -1;
        this.worldWidth = 1500;
        this.worldHeight = 1500;
        this.isClearing = false;
    }
    onInit() {
        if (!playerManager.isHost)
            return;
        this.countdownSprite = spriteManager.addSprite('countdownText', {
            uniqueId: 'countdownText',
            positionX: 0,
            positionY: this.worldHeight / 2,
            containerWidth: this.worldWidth,
            width: this.worldWidth,
            text: '',
            fontSize: 80,
            align: 'center',
        });
    }
    onStep() {
        if (!playerManager.isHost)
            return;
        this.currentStep++;
        if (this.countdownTargetStep > 0 && this.currentStep >= this.countdownTargetStep) {
            this.countdownTargetStep = 0;
            this.processCountdownTick();
        }
        this.updateRoundFinishCountdownDisplay();
    }
    startCountdown(seconds) {
        this.roundFinishDeadlineMs = 0;
        this.roundFinishLastDisplayedSeconds = -1;
        this.countdownValue = seconds;
        this.isClearing = false;
        this.scheduleNextTick();
    }
    startRoundFinishCountdown(seconds) {
        this.countdownTargetStep = 0;
        this.countdownValue = 0;
        this.isClearing = false;
        this.roundFinishDeadlineMs = Date.now() + (seconds * 1000);
        this.roundFinishLastDisplayedSeconds = -1;
        this.updateRoundFinishCountdownDisplay();
    }
    isRoundFinishCountdownActive() {
        return this.roundFinishDeadlineMs > 0;
    }
    hasRoundFinishCountdownExpired() {
        if (this.roundFinishDeadlineMs <= 0)
            return false;
        return Date.now() >= this.roundFinishDeadlineMs;
    }
    scheduleNextTick() {
        this.countdownTargetStep = this.currentStep + 1;
    }
    processCountdownTick() {
        if (this.isClearing) {
            this.updateDisplay('');
            eventManager.emit('allowMovement', {});
            this.isClearing = false;
            this.countdownValue = -999;
            return;
        }
        if (this.countdownValue > 0) {
            this.updateDisplay(`${this.countdownValue}`);
            eventManager.emit('countdownTick', { countdownValue: this.countdownValue });
            this.countdownValue--;
            this.scheduleNextTick();
        }
        else if (this.countdownValue === 0) {
            this.updateDisplay('GO!');
            this.isClearing = true;
            this.countdownValue = -1;
            this.scheduleNextTick();
        }
    }
    updateDisplay(text) {
        if (!this.countdownSprite)
            return;
        spriteManager.updateSprite(this.countdownSprite.uniqueId, { text: text });
    }
    updateRoundFinishCountdownDisplay() {
        if (this.roundFinishDeadlineMs <= 0)
            return;
        const remainingMs = this.roundFinishDeadlineMs - Date.now();
        let remainingSeconds = 0;
        if (remainingMs > 0) {
            remainingSeconds = Math.ceil(remainingMs / 1000);
        }
        if (remainingSeconds === this.roundFinishLastDisplayedSeconds)
            return;
        this.roundFinishLastDisplayedSeconds = remainingSeconds;
        this.updateDisplay(remainingSeconds.toString() + 's remaining!');
    }
    clearTimer() {
        this.countdownTargetStep = 0;
        this.countdownValue = 0;
        this.roundFinishDeadlineMs = 0;
        this.roundFinishLastDisplayedSeconds = -1;
        this.isClearing = false;
        this.updateDisplay('');
    }
}
