"use strict";
class TimerManager extends SystemScript {
    // --- Properties ---
    currentStep;
    // Target step for each specific timer type. 0 means inactive.
    countdownTimerTargetStep;
    startGameplayTimerTargetStep;
    nextLevelTimerTargetStep;
    gameplayUpdateIntervalTargetStep; // For live score
    clearTeleportFlagTimerTargetStep; // Add property for this timer
    clearTeleportFlagPayload; // Add property for its payload
    resetLastTeleportedTimerTargetStep;
    resetLastTeleportedPayload; // Stores {playerId: number} as string
    // Store countdown payload value as string
    countdownPayload;
    /** Constructor: Initialize ALL properties here */
    constructor() {
        console.log('TimerManager Constructor: Initializing...');
        this.resetLastTeleportedTimerTargetStep = 0;
        this.resetLastTeleportedPayload = '';
        this.currentStep = 0;
        this.countdownTimerTargetStep = 0;
        this.startGameplayTimerTargetStep = 0;
        this.nextLevelTimerTargetStep = 0;
        this.gameplayUpdateIntervalTargetStep = 0;
        this.countdownPayload = '';
        this.clearTeleportFlagTimerTargetStep = 0; // Initialize
        this.clearTeleportFlagPayload = ''; // Initialize
        console.log('TimerManager Constructor: Initialized.');
    }
    /** onInit: Signal readiness */
    onInit() {
        console.log('TimerManager onInit: Ready.');
        try {
            eventManager.emit('timerManagerReady', {});
            console.log('TimerManager: Emitted timerManagerReady event.');
        }
        catch (e) {
            console.log('!!! TimerManager ERROR emitting timerManagerReady event:', e);
        }
    }
    /** onStep: Check each individual timer property */
    onStep() {
        if (!playerManager.isHost)
            return;
        this.currentStep++;
        // --- Check Countdown Timer ---
        if (this.countdownTimerTargetStep > 0 &&
            this.currentStep >= this.countdownTimerTargetStep) {
            console.log(`TimerManager onStep: FIRING timer 'countdown'`);
            let valueToEmit = null; // Note: +"" results in 0, not NaN
            let payloadString = this.countdownPayload; // Copy payload
            // Deactivate timer BEFORE emitting
            this.countdownTimerTargetStep = 0;
            this.countdownPayload = '';
            console.log(`TimerManager onStep: Deactivated 'countdown' timer.`);
            try {
                // Parse the copied payload string
                if (payloadString !== '') {
                    valueToEmit = +payloadString;
                    console.log(`>>> Value after conversion: ${valueToEmit} (Type: ${typeof valueToEmit})`); // Optional debug log
                }
                else {
                    console.log(`!!! TimerManager WARN: Stored countdownPayload was empty when firing timer.`);
                    valueToEmit = null;
                }
                eventManager.emit('handleCountdownTick', valueToEmit);
                console.log(`TimerManager onStep: Emitted 'handleCountdownTick' with value: ${valueToEmit}`);
            }
            catch (e) {
                console.log('!!! TimerManager onStep ERROR parsing/emitting Countdown:', e);
                try {
                    eventManager.emit('handleCountdownTick', null);
                }
                catch (emitErr) { } // Attempt to emit null on error
            }
        } // End Countdown Check
        // --- Check Start Gameplay Timer ---
        if (this.startGameplayTimerTargetStep > 0 &&
            this.currentStep >= this.startGameplayTimerTargetStep) {
            console.log(`TimerManager onStep: FIRING timer 'startGameplay'`);
            try {
                eventManager.emit('startGameplayNow', {});
                console.log(`TimerManager onStep: Emitted 'startGameplayNow'`);
            }
            catch (e) {
                console.log('!!! TimerManager onStep ERROR emitting StartGameplay:', e);
            }
            this.startGameplayTimerTargetStep = 0;
            console.log(`TimerManager onStep: Deactivated 'startGameplay' timer.`);
        }
        // --- Check Next Level Timer ---
        if (this.nextLevelTimerTargetStep > 0 &&
            this.currentStep >= this.nextLevelTimerTargetStep) {
            console.log(`TimerManager onStep: FIRING timer 'nextLevel'`);
            try {
                eventManager.emit('triggerNextLevel', {});
                console.log(`TimerManager onStep: Emitted 'triggerNextLevel'`);
            }
            catch (e) {
                console.log('!!! TimerManager onStep ERROR emitting NextLevel:', e);
            }
            this.nextLevelTimerTargetStep = 0;
            console.log(`TimerManager onStep: Deactivated 'nextLevel' timer.`);
        }
        // --- Check Gameplay Update Interval Timer ---
        if (this.gameplayUpdateIntervalTargetStep > 0 &&
            this.currentStep >= this.gameplayUpdateIntervalTargetStep) {
            console.log(`TimerManager onStep: FIRING timer 'gameplayUpdate'`);
            try {
                eventManager.emit('updateGameplayDisplay', {});
                // console.log(`TimerManager onStep: Emitted 'updateGameplayDisplay'`);
            }
            catch (e) {
                console.log('!!! TimerManager onStep ERROR emitting GameplayUpdate:', e);
            }
            // Reschedule for the next interval
            const intervalSteps = 1; // Assuming 1 second interval always
            this.gameplayUpdateIntervalTargetStep += intervalSteps;
        }
        if (this.clearTeleportFlagTimerTargetStep > 0 &&
            this.currentStep >= this.clearTeleportFlagTimerTargetStep) {
            console.log(`TimerManager onStep: FIRING timer 'clearTeleportFlag'`);
            let payloadToEmit = null; // Expect { playerId: number }
            try {
                if (this.clearTeleportFlagPayload !== '') {
                    payloadToEmit = JSON.parse(this.clearTeleportFlagPayload); // Parse the payload string
                    // Basic validation (optional)
                    if (!payloadToEmit || typeof payloadToEmit.playerId !== 'number') {
                        console.log('!!! TimerManager WARN: Invalid payload for clearTeleportFlag:', payloadToEmit);
                        payloadToEmit = null; // Don't emit if invalid
                    }
                }
                else {
                    console.log('!!! TimerManager WARN: Empty payload for clearTeleportFlag');
                }
                const playerCheck = playerManager.getPlayerIds();
                if (!playerCheck.includes(payloadToEmit.playerId))
                    return;
                eventManager.emit('clearTeleportFlag', payloadToEmit || {}); // Emit parsed payload or empty object
                console.log(`TimerManager onStep: Emitted 'clearTeleportFlag' with payload:`, payloadToEmit);
            }
            catch (e) {
                console.log('!!! TimerManager onStep ERROR parsing/emitting clearTeleportFlag:', e);
            }
            this.clearTeleportFlagTimerTargetStep = 0; // Deactivate timer
            this.clearTeleportFlagPayload = '';
            console.log(`TimerManager onStep: Deactivated 'clearTeleportFlag' timer.`);
        }
        if (this.resetLastTeleportedTimerTargetStep > 0 &&
            this.currentStep >= this.resetLastTeleportedTimerTargetStep) {
            console.log(`TimerManager onStep: FIRING timer 'resetLastTeleported'`);
            let payloadToEmit = null;
            try {
                if (this.resetLastTeleportedPayload !== '') {
                    payloadToEmit = JSON.parse(this.resetLastTeleportedPayload);
                    if (!payloadToEmit || typeof payloadToEmit.playerId !== 'number') {
                        console.log('!!! TimerManager WARN: Invalid payload for resetLastTeleported:', payloadToEmit);
                        payloadToEmit = null;
                    }
                }
                else {
                    /* ... warning ... */
                }
                eventManager.emit('resetLastTeleported', payloadToEmit || {}); // Use new event name
                console.log(`TimerManager onStep: Emitted 'resetLastTeleported' with payload:`, payloadToEmit);
            }
            catch (e) {
                console.log('!!! TimerManager onStep ERROR parsing/emitting resetLastTeleported:', e);
            }
            this.resetLastTeleportedTimerTargetStep = 0; // Deactivate timer
            this.resetLastTeleportedPayload = '';
            console.log(`TimerManager onStep: Deactivated 'resetLastTeleported' timer.`);
        }
    }
    // --- Public Methods ---
    /** Sets a one-shot timer by type. */
    setTimer(
    // *** Update allowed types ***
    type, delaySeconds, payload) {
        // Manual step calculation (avoids Math object)
        let delaySteps = 1;
        if (delaySeconds > 0) {
            if (delaySeconds <= 1) {
                delaySteps = 1;
            }
            else {
                let wholeSteps = 0;
                let tempVal = delaySeconds;
                while (tempVal >= 1) {
                    wholeSteps = wholeSteps + 1;
                    tempVal = tempVal - 1;
                }
                delaySteps = delaySeconds > wholeSteps ? wholeSteps + 1 : wholeSteps;
                if (delaySteps < 1) {
                    delaySteps = 1;
                }
            }
        }
        const targetStep = this.currentStep + delaySteps;
        // Set the specific timer property
        switch (type) {
            case 'countdown':
                this.countdownTimerTargetStep = targetStep;
                try {
                    // Store JUST the number, converted to string via concatenation
                    if (payload && typeof payload.countdownNextValue === 'number') {
                        this.countdownPayload = '' + payload.countdownNextValue;
                    }
                    else {
                        this.countdownPayload = '';
                        console.log('!!! TimerManager setTimer WARN: Invalid or missing payload for countdown.');
                    }
                }
                catch (e) {
                    console.log('!!! TimerManager setTimer ERROR storing countdown payload:', e);
                    this.countdownPayload = '';
                }
                console.log(`TimerManager: Set timer 'countdown' for step ${this.countdownTimerTargetStep} with payload string '${this.countdownPayload}'`);
                break;
            case 'startGameplay':
                this.startGameplayTimerTargetStep = targetStep;
                console.log(`TimerManager: Set timer 'startGameplay' for step ${targetStep}`);
                break;
            case 'nextLevel':
                this.nextLevelTimerTargetStep = targetStep;
                console.log(`TimerManager: Set timer 'nextLevel' for step ${targetStep}`);
                break;
            case 'resetLastTeleported':
                this.resetLastTeleportedTimerTargetStep = targetStep;
                try {
                    // Store the whole payload {playerId: number} as a string
                    const playerCheck = playerManager.getPlayerIds();
                    if (!playerCheck.includes(payload.playerId))
                        return;
                    this.resetLastTeleportedPayload = payload
                        ? JSON.stringify(payload)
                        : '';
                    if (!this.resetLastTeleportedPayload) {
                        console.log('!!! TimerManager setTimer WARN: Missing payload for resetLastTeleported.');
                    }
                }
                catch (e) {
                    console.log('!!! TimerManager setTimer ERROR storing resetLastTeleported payload:', e);
                    this.resetLastTeleportedPayload = '';
                }
                break;
            default:
                console.log(`!!! TimerManager setTimer ERROR: Unknown timer type '${type}'`);
        }
    }
    /** Sets the repeating interval timer for live score updates */
    setInterval(type, intervalSeconds) {
        if (type !== 'gameplayUpdate') {
            console.log(`!!! TimerManager setInterval ERROR: Unknown interval type '${type}'`);
            return;
        }
        // Manual step calculation
        let intervalSteps = 1;
        if (intervalSeconds > 0) {
            if (intervalSeconds <= 1) {
                intervalSteps = 1;
            }
            else {
                let wholeSteps = 0;
                let tempVal = intervalSeconds;
                while (tempVal >= 1) {
                    wholeSteps++;
                    tempVal--;
                }
                intervalSteps =
                    intervalSeconds > wholeSteps ? wholeSteps + 1 : wholeSteps;
                if (intervalSteps < 1) {
                    intervalSteps = 1;
                }
            }
        }
        const initialTargetStep = this.currentStep + intervalSteps;
        this.gameplayUpdateIntervalTargetStep = initialTargetStep;
        console.log(`TimerManager: Set interval 'gameplayUpdate' for initial step ${this.gameplayUpdateIntervalTargetStep}, repeating every ${intervalSteps} steps`);
    }
    /** Clears a timer by its type */
    clearTimer(type) {
        switch (type) {
            case 'countdown':
                if (this.countdownTimerTargetStep > 0)
                    console.log(`TimerManager: Clearing timer 'countdown'`);
                this.countdownTimerTargetStep = 0;
                this.countdownPayload = '';
                break;
            case 'startGameplay':
                if (this.startGameplayTimerTargetStep > 0)
                    console.log(`TimerManager: Clearing timer 'startGameplay'`);
                this.startGameplayTimerTargetStep = 0;
                break;
            case 'nextLevel':
                if (this.nextLevelTimerTargetStep > 0)
                    console.log(`TimerManager: Clearing timer 'nextLevel'`);
                this.nextLevelTimerTargetStep = 0;
                break;
            case 'gameplayUpdate':
                if (this.gameplayUpdateIntervalTargetStep > 0)
                    console.log(`TimerManager: Clearing interval 'gameplayUpdate'`);
                this.gameplayUpdateIntervalTargetStep = 0;
                break;
            case 'resetLastTeleported':
                if (this.resetLastTeleportedTimerTargetStep > 0)
                    console.log(`TimerManager: Clearing timer 'resetLastTeleported'`);
                this.resetLastTeleportedTimerTargetStep = 0;
                this.resetLastTeleportedPayload = '';
                break;
            default:
                console.log(`!!! TimerManager clearTimer ERROR: Unknown timer type '${type}'`);
        }
    }
} // End class TimerManager
