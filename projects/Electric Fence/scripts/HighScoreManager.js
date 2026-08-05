"use strict";
class HighScoreManager extends SystemScript {
    // Declare properties
    highScoreText = null;
    worldWidth;
    worldHeight;
    // Use two parallel arrays, indexed by level number.
    scores; // Conceptually number[]
    players; // Conceptually string[]
    wallManager;
    /** Constructor: Init primitives */
    constructor() {
        console.log('HighScoreManager Constructor: Initializing...');
        this.worldWidth = 1000;
        this.worldHeight = 1000;
        // Initialize as empty arrays
        this.scores = [];
        this.players = []; // Will store usernames
        console.log('HighScoreManager Constructor: Initialized.');
    }
    /**
     * onInit: Creates sprite, loads scores from cloud, and initializes display.
     */
    async onInit() {
        scriptManager.attachSystem({ scriptId: 'WallManager' });
        this.wallManager = scriptManager.getSystem({
            systemName: 'WallManager',
        });
        console.log('HighScoreManager onInit: Starting initialization process...');
        //this.populateTempHighScores();
        // --- Create Sprite ---
        try {
            const highScoreSpriteOptions = {
                uniqueId: 'highScoreText',
                positionX: 110,
                positionY: (this.worldHeight / 5) * 3,
                fontSize: 20,
                alignment: 'center',
                fontColor: '#FFFFFF',
                text: 'Loading Scores...', // Updated initial text
                anchor: { x: 0, y: 0 },
            };
            const sprite = spriteManager.addSprite('highScoreText', highScoreSpriteOptions);
            if (sprite) {
                console.log('HighScoreManager SUCCESS: Score text sprite created.');
                this.highScoreText = sprite; // Assign sprite reference
                await this.loadHighScores(); // Wait for scores to load
            }
            else {
                console.log('!!! HighScoreManager FAILURE: Failed to create score text sprite!');
                await this.loadHighScores(); // Still load scores
            }
        }
        catch (e) {
            console.log('!!! HighScoreManager CRITICAL ERROR during sprite creation:', e);
        }
        this.toggleHighScoreDisplay(false);
        console.log('HighScoreManager onInit completed.');
    }
    toggleHighScoreDisplay(active) {
        if (active) {
            this.updateDisplay();
        }
        else {
            this.displayMessage('');
        }
    }
    // --- Private Helper Methods ---
    /**
     * Updates the high score text sprite using the parallel scores and players arrays.
     * Uses playerName (string) directly from the players array.
     */
    updateDisplay() {
        if (!this.highScoreText) {
            console.log('HighScoreManager updateDisplay: No text sprite to update.');
            return;
        }
        console.log('HighScoreManager.updateDisplay: Starting update.');
        let displayText = '';
        switch (this.wallManager.startingLevel) {
            case 0:
                displayText = 'High Scores - Easy Levels:\n----------\n';
                break;
            case 5:
                displayText = 'High Scores - Medium Levels:\n----------\n';
                break;
            case 10:
                displayText = 'High Scores - Hard Levels:\n----------\n';
                break;
            case 15:
                displayText = 'High Scores - Extreme Levels:\n----------\n';
                break;
            case 20:
                displayText = 'High Scores - Impossible Levels:\n----------\n';
                break;
        }
        let foundScores = false;
        const maxIndex = this.wallManager.startingLevel + 5;
        console.log('HighScoreManager.updateDisplay: Checking levels up to index ' +
            (maxIndex - 1));
        const scoreArray = this.scores.toArray();
        const playersArray = this.players.toArray();
        for (let level = this.wallManager.startingLevel; level < maxIndex; level++) {
            console.log("level", this.scores);
            const scoreValue = scoreArray[level];
            const playerName = playersArray[level];
            console.log("scoreValue", scoreValue);
            // Check if *both* a score and player name exist for this level index
            if (scoreValue !== undefined && playerName !== undefined) {
                if (typeof scoreValue === 'number' && typeof playerName === 'string') {
                    console.log('HighScoreManager.updateDisplay: Found data for level ' +
                        level +
                        ': Score=' +
                        scoreValue +
                        ', Player=' + // Changed from PlayerId
                        playerName);
                    displayText +=
                        'Level ' +
                            (level + 1) + // Display level + 1
                            ': ' +
                            scoreValue +
                            ' by ' +
                            playerName + // Use stored name
                            '\n';
                    foundScores = true;
                }
                else {
                    console.log('!!! HighScoreManager WARNING: Invalid data types found for level ' +
                        level +
                        ' (Score type: ' +
                        typeof scoreValue +
                        ', Player type: ' + // Changed from PlayerId
                        typeof playerName + // Check type of playerName
                        ')');
                }
            }
        }
        if (!foundScores) {
            console.log('HighScoreManager.updateDisplay: No valid scores found to display.');
            displayText = 'No high scores recorded yet.';
        }
        this.displayMessage(displayText.trim()); // Update the sprite text
    }
    /**
     * Loads high scores from the cloud data object and populates local arrays.
     * Expects 'playerName' (string) instead of 'playerId' (number) in cloud data.
     */
    async loadHighScores() {
        console.log('HighScoreManager: Attempting to load high scores from cloud...');
        const interactivePublicKey = stateManager.getVariable('PublicKey');
        if (!interactivePublicKey) {
            console.log('!!! HighScoreManager CRITICAL ERROR: Cannot load scores, PublicKey is missing from stateManager.');
            this.updateDisplay();
            return;
        }
        try {
            const dataObject = await integrationsManager.getDataObject({
                interactivePublicKey: interactivePublicKey,
                scope: 'WORLD',
            });
            console.log('HighScoreManager: Retrieved dataObject for loading:', dataObject);
            if (!dataObject ||
                typeof dataObject !== 'object' ||
                !dataObject.highScores ||
                typeof dataObject.highScores !== 'object') {
                console.log('HighScoreManager: No existing high scores found in dataObject or structure is invalid.');
                this.scores = []; // Ensure reset
                this.players = [];
                return; // Exit early
            }
            const highScoresData = dataObject.highScores;
            const loadedScores = [];
            const loadedPlayers = []; // Will store usernames
            console.log('HighScoreManager: Processing loaded highScoresData:', highScoresData);
            for (const levelKey in highScoresData) {
                if (levelKey.indexOf('level_') !== -1) {
                    console.log(`HighScoreManager: Processing loaded key '${levelKey}'`);
                    const levelNumStr = levelKey.substring('level_'.length);
                    const levelNumber = parseInt(levelNumStr, 10);
                    if (levelNumber < 0) {
                        console.log(`HighScoreManager: Invalid level number parsed from key '${levelKey}'. Skipping.`);
                        continue;
                    }
                    const scoreData = highScoresData[levelKey];
                    if (!scoreData ||
                        typeof scoreData !== 'object' ||
                        // typeof scoreData.playerId !== 'number' || // REMOVED check for playerId
                        typeof scoreData.playerName !== 'string' || // ADDED check for playerName string
                        typeof scoreData.score !== 'number') {
                        console.log(`HighScoreManager: Invalid score data structure or types for key '${levelKey}':`, scoreData, '. Skipping.');
                        continue;
                    }
                    console.log(`HighScoreManager: Loading data for level index ${levelNumber}: Player='${scoreData.playerName}', Score=${scoreData.score}`);
                    loadedScores[levelNumber] = scoreData.score;
                    loadedPlayers[levelNumber] = scoreData.playerName;
                }
                else {
                    console.log(`HighScoreManager: Skipping key '${levelKey}' (not own property or doesn't match format).`);
                }
            }
            this.scores = loadedScores;
            this.players = loadedPlayers; // Assign loaded usernames
            console.log('HighScoreManager: Finished loading scores.');
        }
        catch (error) {
            console.log('!!! HighScoreManager ERROR during loadHighScores operation:', error);
            this.scores = []; // Reset on error
            this.players = [];
        }
        finally {
            console.log('HighScoreManager: Calling updateDisplay after load attempt.');
            this.updateDisplay(); // Update display regardless
        }
    }
    /**
     * Posts the high score for a given level to the cloud data object.
     * Saves playerName (string) instead of playerId (number).
     * @param playerName The username string of the player. <-- CHANGED
     * @param score The high score value.
     * @param level The level number.
     */
    async postHighScore(playerName, score, level) {
        console.log(`HighScoreManager: Attempting to post high score for level ${level} - Player: '${playerName}', Score: ${score}`);
        const interactivePublicKey = stateManager.getVariable('PublicKey');
        if (!interactivePublicKey) {
            console.log('!!! HighScoreManager CRITICAL ERROR: Cannot post score, PublicKey is missing from stateManager.');
            return;
        }
        try {
            let dataObject = await integrationsManager.getDataObject({
                interactivePublicKey: interactivePublicKey,
                scope: 'WORLD',
            });
            console.log('HighScoreManager: Retrieved existing dataObject:', dataObject);
            const levelKey = 'level_' + level;
            const scoreData = { playerName: playerName, score: score }; // Use playerName string
            if (!dataObject) {
                console.log('HighScoreManager: No existing dataObject found. Creating new structure.');
                dataObject = {
                    highScores: { [levelKey]: scoreData },
                };
            }
            else {
                if (!dataObject.highScores ||
                    typeof dataObject.highScores !== 'object') {
                    console.log("HighScoreManager: dataObject found, but 'highScores' property missing or invalid. Initializing.");
                    dataObject.highScores = {};
                }
                console.log(`HighScoreManager: Updating high score for key ${levelKey}`);
                dataObject.highScores[levelKey] = scoreData; // Save object with playerName
            }
            console.log(
            // Kept original log level
            'HighScoreManager: Saving updated dataObject:', JSON.stringify(dataObject));
            this.triggerHighScoreActivity();
            await integrationsManager.updateDataObject({
                interactivePublicKey: interactivePublicKey,
                scope: 'WORLD',
                payload: dataObject,
            });
            console.log(
            // Kept original log level
            `HighScoreManager: Successfully posted high score for level ${level}.`);
        }
        catch (error) {
            // Using log level from your code
            console.log('!!! HighScoreManager ERROR during postHighScore operation:', error);
        }
    }
    // --- Methods Called Externally (e.g., by GameManager) ---
    /**
     * Displays a raw message string on the high score text sprite.
     */
    displayMessage(message) {
        if (!this.highScoreText) {
            console.log('HighScoreManager displayMessage: No text sprite available.');
            return;
        }
        console.log('HighScoreManager: Displaying message on sprite - "' + message + '"');
        try {
            spriteManager.updateSprite(this.highScoreText.uniqueId, {
                text: message,
            });
        }
        catch (e) {
            console.log('!!! HighScoreManager ERROR updating sprite text (message):', e);
        }
    }
    /**
     * Adds a score for a specific player and level, updates if it's a new high score.
     * Stores playerName (string) locally and initiates cloud save with playerName.
     * @param playerId The ID of the player (number, used ONLY to get username). <-- CLARIFIED PARAM
     * @param score The score achieved (number).
     * @param level The level number (integer >= 0).
     */
    addScore(playerId, score, level) {
        //level -= 1;
        const playerCheck = playerManager.getPlayerIds();
        //if (!playerCheck.includes(playerId)) return;
        console.log('HighScoreManager.addScore received: player=' +
            playerId + // Still log incoming playerId
            ', score=' +
            score +
            ' (type: ' +
            typeof score +
            ')' +
            ', level=' +
            level +
            ' (type: ' +
            typeof level +
            ')');
        // --- Get Current Score  ---
        let currentScore = 0;
        let tempArray = this.scores.toArray ? this.scores.toArray() : this.scores;
        if (tempArray[level] !== undefined)
            currentScore = tempArray[level] ?? 0;
        console.log('HighScoreManager.addScore: Current score for level ' +
            level +
            ' is: ' +
            currentScore +
            ' (type: ' +
            typeof currentScore +
            ')');
        let shouldUpdate = false;
        if (tempArray[level] === undefined) {
            console.log('HighScoreManager.addScore: No existing score defined for level ' +
                level +
                '. Setting new score.');
            shouldUpdate = true;
        }
        else if ((typeof currentScore === 'number' && score < currentScore) ||
            currentScore == 0) {
            console.log('HighScoreManager.addScore: New score (' +
                score +
                ') is lower than existing (' +
                currentScore +
                ') for level ' +
                level +
                '. Updating.');
            shouldUpdate = true;
        }
        else {
            console.log('HighScoreManager.addScore: New score (' +
                score +
                ') is not lower than existing (' +
                currentScore +
                ') for level ' +
                level +
                '. No update needed.');
        }
        // Perform update if needed
        if (shouldUpdate) {
            // --- Get Player Name String ---
            const playerName = playerManager.getPlayerDetails(playerId).username ||
                'Player ' + playerId; // Use default if lookup fails
            console.log(`HighScoreManager.addScore: Using player name: '${playerName}'`);
            // --- End Get Player Name ---
            try {
                if (this.scores.length > level) {
                    console.log('updating without push... scores.length = ' + this.scores.length);
                    this.scores[level] = score;
                    this.players[level] = playerName; // Store username string
                }
                else {
                    console.log('using push... scores.length = ' + this.scores.length);
                    this.scores.push(score);
                    this.players.push(playerName); // Store username string
                }
                // --- End Update Local Arrays ---
                console.log('HighScoreManager.addScore: Updated arrays. scores[' +
                    level +
                    ']=' +
                    this.scores[level] +
                    ', players[' +
                    level +
                    ']=' +
                    this.players[level]);
                // --- Post to Cloud (using playerName) ---
                this.postHighScore(playerName, score, level); // Pass username string
                // --- End Post to Cloud ---
                this.updateDisplay(); // Call updateDisplay AFTER attempting the update
            }
            catch (e) {
                console.log('!!! HighScoreManager CRITICAL ERROR during array assignment for level ' +
                    level +
                    ': ', e);
            }
        }
        console.log('HighScoreManager.addScore completed for level ' + level);
    } // End addScore
    triggerHighScoreActivity() {
        try {
            const interactivePublicKey = stateManager.getVariable('PublicKey');
            if (!interactivePublicKey)
                return;
            integrationsManager.setWorldActivity({
                type: 'GAME_HIGH_SCORE',
                interactivePublicKey: interactivePublicKey,
            });
        }
        catch (e) {
            console.log('HighScoreManager: Failed to trigger world activity', e);
        }
    }
    // --- Add this new public method to your HighScoreManager class ---
    /**
     * TEMPORARY FUNCTION: Populates the cloud data object with placeholder high scores
     * for levels 0 through 9 (10 levels total).
     * This will OVERWRITE any existing scores for levels 0-9 in the cloud.
     * It does NOT update the local this.scores/this.players arrays directly.
     * Call loadHighScores() after running this to see changes locally.
     */
    async populateTempHighScores() {
        console.log('HighScoreManager: --- RUNNING TEMPORARY HIGH SCORE POPULATION (Levels 0-9) ---'); // Warn that it's temporary
        const interactivePublicKey = stateManager.getVariable('PublicKey');
        if (!interactivePublicKey) {
            console.log('!!! HighScoreManager CRITICAL ERROR: Cannot populate temp scores, PublicKey is missing from stateManager.');
            return; // Stop if key is missing
        }
        try {
            // 1. Get the current data object (or null if none exists)
            let dataObject = await integrationsManager.getDataObject({
                interactivePublicKey: interactivePublicKey,
                scope: 'WORLD',
            });
            console.log('HighScoreManager (Temp Populate): Retrieved existing dataObject:', dataObject);
            // 2. Ensure dataObject and dataObject.highScores exist, initialize if needed
            if (!dataObject || typeof dataObject !== 'object') {
                console.log('HighScoreManager (Temp Populate): No existing dataObject found. Creating new one.');
                dataObject = { highScores: {} }; // Create base structure needed
            }
            else if (!dataObject.highScores ||
                typeof dataObject.highScores !== 'object') {
                console.log("HighScoreManager (Temp Populate): Existing dataObject missing 'highScores'. Initializing 'highScores'.");
                dataObject.highScores = {}; // Add the highScores property if missing
            }
            else {
                console.log('HighScoreManager (Temp Populate): Existing dataObject and highScores found. Proceeding.');
            }
            // 3. Define placeholder data
            const tempPlayerName = 'Dalton';
            const tempScore = 500.001;
            // 4. Loop through levels 0 to 9 and add/overwrite placeholder data
            console.log(`HighScoreManager (Temp Populate): Setting scores for levels 0-9 to ${tempScore} by '${tempPlayerName}'...`);
            for (let level = 0; level < 25; level++) {
                // Includes level 0 through 25
                const levelKey = 'level_' + level; // e.g., "level_0", "level_1", ..., "level_9"
                const tempData = { playerName: tempPlayerName, score: tempScore };
                // Assign directly - this adds or overwrites
                dataObject.highScores[levelKey] = tempData;
            }
            console.log('HighScoreManager (Temp Populate): Finished setting temp data in object.');
            // 5. Save the modified data object back to the cloud
            console.log('HighScoreManager (Temp Populate): Saving updated dataObject with temp scores:', JSON.stringify(dataObject));
            await integrationsManager.updateDataObject({
                interactivePublicKey: interactivePublicKey,
                scope: 'WORLD',
                payload: dataObject, // Send the object containing the temp scores
            });
            console.log('HighScoreManager: --- Successfully populated cloud with temp high scores (Levels 0-9) ---'); // Warn on success too
        }
        catch (error) {
            console.log('!!! HighScoreManager ERROR during populateTempHighScores operation:', error);
        }
    }
} // End of HighScoreManager class
