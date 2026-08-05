"use strict";
class main extends SystemScript {
    timer; // time for the game to start and reset
    safeZone; // safe zone for players to teleport to when they enter the game or get eliminated
    waitMessage; // tells the players to wait until the host starts
    directions; // directions to tell players to move away from the safezone
    topBorder; // impassable border
    rightBorder; // impassable border
    leftBorder; // impassable border
    playersInGame; // holds the total number of players playing in the game
    start; // the start button
    startBg; // the rect background for the start button
    hostStart; // start button that follows the host around
    hostStartBg; // rect background for the host-following start button
    winningText; // displays the player that wins
    numPlayers; // holds the total number of players in the experience
    inGame; // true when the game is in play
    gameInitialized; // used to declare the start of the first game
    utils; // used for text centering
    hostId; // holds the hostId
    threat; // threat
    pod; // pod the threat will come from
    onInit() {
        gameLoopManager.setSyncParameters({
            inputUpdatesPerSecond: 1, syncsPerSecond: 30, fullUpdatePerSecond: 4
        });
    }
    onHostStart() {
        if (!playerManager.isHost)
            return;
        // Initializing all variables
        this.gameInitialized = false;
        scriptManager.attachSystem({ scriptId: 'utils' }); // used for text centering            
        this.utils = scriptManager.getSystem({ systemName: 'utils' });
        this.numPlayers = 1;
        this.playersInGame = spriteManager.addSprite('playersInGame', { uniqueId: 'playersInGame', positionX: 1030, positionY: 1430, text: `Players in Game: ${this.numPlayers}` });
        this.inGame = false;
        this.start = null;
        this.startBg = null;
        this.hostStart = null;
        this.hostStartBg = null;
        this.hostId = playerManager.getMyPlayerId();
        playerManager.setNameplate(this.hostId, '✅' + playerManager.getPlayerDetails(this.hostId).username + '✅');
        this.safeZone = spriteManager.addSprite('safeZone', { uniqueId: 'safeZone', positionX: 0, positionY: 1300, checkCollisions: true, collisionGroup: "threat" });
        this.topBorder = spriteManager.addSprite('border', { uniqueId: 'topBorder', positionX: 0, positionY: 40, checkCollisions: true, isImpassable: true, height: 10, width: 1500 });
        this.leftBorder = spriteManager.addSprite('border', { uniqueId: 'leftBorder', positionX: 40, positionY: 0, height: 1300, width: 10, checkCollisions: true, isImpassable: true });
        this.rightBorder = spriteManager.addSprite('border', { uniqueId: 'rightBorder', positionX: 1460, positionY: 0, height: 1300, width: 10, checkCollisions: true, isImpassable: true });
        // Adding art
        spriteManager.addSprite('gameZone', { uniqueId: 'gameZone', positionX: 0, positionY: 0, collisionGroup: "threat" });
        spriteManager.addSprite('bottomFrame', { uniqueId: 'bottomFrame', positionX: -145, positionY: 780, width: 1790, height: 200 });
        spriteManager.addSprite('topFrame', { uniqueId: 'topFrame', positionX: -145, positionY: -95, width: 1790, height: 200 });
        // Show that at least two players are required
        this.addPlayerNeededMessage();
    }
    /*
     *  When a player joins, teleport them to the safe/waiting zone. If the game has already started, put them in the queue.
     *  If the game has not started, go to the player_added event in this script to add them to the game
     */
    onPlayerJoined({ playerId }) {
        if (!playerManager.isHost)
            return;
        if (playerId !== this.hostId) {
            const teleportOptions = {
                distributionType: 'area',
                positionX: 740,
                positionY: 1400,
                height: 0,
                width: 0,
            };
            playerManager.teleportPlayers([playerId], teleportOptions); // teleporting player
        }
        if (this.inGame) {
            playerManager.setNameplate(playerId, 'In Queue...'); // putting player in the queue    
            playerManager.tintPlayer(playerId, 'yellow');
        }
        else {
            if (!this.inGame && !(playerId === this.hostId)) { // going to the playerAdded event, unless the user is the host
                playerManager.setNameplate(playerId, '✅' + playerManager.getPlayerDetails(playerId).username + '✅');
                eventManager.emit("playerAdded", {});
            }
        }
    }
    /*
     *  When a player leaves the game, update the player count by going to the playerRemoved event if the game is not in play.
     *  If the game is in play, check if the player is in the game or queue by going to the checkPlayerInGame event located in the bounce manager.
     */
    onPlayerLeft({ playerId }) {
        if (!playerManager.isHost)
            return;
        if (this.inGame) {
            eventManager.emit("checkPlayerInGame", { playerID: playerId });
        }
        else {
            eventManager.emit("playerRemoved", {});
        }
    }
    /*
     *  This event is triggered from the timerManager script.
     *  It starts the game by removing the timer, directions, pod, and adding the threat to the game
     */
    onEvent_startGame() {
        if (!playerManager.isHost)
            return;
        spriteManager.removeSprite(this.timer.uniqueId);
        spriteManager.removeSprite(this.directions.uniqueId);
        spriteManager.removeSprite(this.pod.uniqueId);
        spriteManager.updateSprite(this.threat.uniqueId, { opacity: 1 });
        this.threat.attachComponent({ scriptId: "bounceManager" });
        this.setWorldActivity('GAME_ON');
    }
    /*
     *  When the start button gets clicked, the timer for the game to start will appear and countdown will start.
     *  Directions will show, and the safe zone will no longer allow players to collide
     */
    onEvent_startBtnClicked() {
        if (!playerManager.isHost)
            return;
        this.inGame = true;
        this.directions = spriteManager.addSprite('directions', { uniqueId: 'directions', positionX: 220, positionY: 700, text: 'Move away from the safe zone at the bottom!' });
        // Removing unneeded sprites
        spriteManager.removeSprite(this.waitMessage.uniqueId);
        this.removeStartButtons();
        this.timer = spriteManager.addSprite('timerSprite', { uniqueId: 'timerSprite', positionX: 525, positionY: 600, text: "Game starting in: 5" });
        this.timer.attachComponent({ scriptId: "timerManager" });
        // Assigning players a new nameplate to show that they are in the game
        const playerIDs = playerManager.getPlayerIds();
        for (const playerID of playerIDs) {
            playerManager.setNameplate(playerID, '\u26a1' + playerManager.getPlayerDetails(playerID).username + '\u26a1');
        }
        // If the game is not initialzed, attack the safezone manager, otherwise the game is resetting so just reset the collisions 
        if (!this.gameInitialized) {
            this.safeZone.attachComponent({ scriptId: "safezoneManager" });
            this.gameInitialized = true;
        }
        else {
            eventManager.emit("resetSafezoneCollisions", {});
        }
        // add the threat
        this.addThreat();
    }
    /*
     *  Triggered from the bounceManager script, it will show the winning message and change the winners name plate
     *  This event will also start the reset countdown
     */
    onEvent_playerWins({ playerID, spriteID }) {
        if (!playerManager.isHost)
            return;
        const hasWinner = playerID !== undefined && playerID !== null && playerID !== '';
        const winnerDetails = hasWinner ? playerManager.getPlayerDetails(playerID) : null;
        const winningMessage = winnerDetails
            ? ` ${winnerDetails.username} wins!`
            : ' No winner this round!';
        this.winningText = this.utils.makeText({
            spriteName: 'winningText',
            text: winningMessage,
            align: 'center',
            justify: 'center'
        });
        spriteManager.updateSprite(this.winningText.uniqueId, { positionY: 500 });
        spriteManager.removeSprite(spriteID);
        if (winnerDetails) {
            playerManager.tintPlayer(playerID, 'green');
            playerManager.setNameplate(playerID, '🏅' + winnerDetails.username + '🏅');
        }
        spriteManager.updateSprite(this.safeZone.uniqueId, { checkCollisions: false });
        this.inGame = false;
        this.timer = spriteManager.addSprite('timerSprite', { uniqueId: 'timerSprite', positionX: 475, positionY: 700, text: "Game Resetting in: 7" });
        this.timer.attachComponent({ scriptId: "resetManager" });
    }
    /*
     *  Triggered from the onPlayerJoined function. This updates the playersInGame text and shows the start button when there are 2 players joined
     */
    onEvent_playerAdded() {
        if (!playerManager.isHost)
            return;
        if (this.playersInGame)
            spriteManager.updateSprite(this.playersInGame.uniqueId, { text: `Players in Game: ${++this.numPlayers}` });
        if (this.numPlayers === 2 && !this.inGame) {
            this.createStartButtons();
            this.addWaitMessage();
        }
    }
    /*
     *  Triggered from the onPlayerLeft function. This updates the playersInGame test and shows the wait message if there is only one player left
     *  It also removes the start button if it was previously shown
     */
    onEvent_playerRemoved() {
        if (!playerManager.isHost)
            return;
        console.log('in playerRemoved');
        spriteManager.updateSprite(this.playersInGame.uniqueId, { text: `Players in Game: ${--this.numPlayers}` });
        if (this.numPlayers === 1 && !this.inGame) {
            this.removeStartButtons();
            this.addPlayerNeededMessage();
        }
    }
    /*
     *  Triggered by the resetManager when the countdown finishes. This event resets all players name plates and adds in any players in the queue.
     *  It also removes unneeded sprites and checks if there are enough players to restart the game.
     */
    onEvent_resetGame() {
        if (!playerManager.isHost)
            return;
        spriteManager.removeSprite(this.winningText.uniqueId);
        spriteManager.removeSprite(this.timer.uniqueId);
        const playerIDs = playerManager.getPlayerIds();
        // change nameplates back
        for (const id of playerIDs) {
            playerManager.setNameplate(id, '✅' + playerManager.getPlayerDetails(id).username + '✅');
            playerManager.tintPlayer(id, null);
        }
        this.numPlayers = playerIDs.length;
        spriteManager.updateSprite(this.playersInGame.uniqueId, { text: `Players in Game: ${this.numPlayers}` });
        // if there are 2 or more players, show the start button, else show that more players are needed
        if (playerIDs.length > 1) {
            this.createStartButtons();
            this.addWaitMessage();
        }
        else {
            this.addPlayerNeededMessage();
        }
    }
    onPhysicsStep() {
        if (!playerManager.isHost)
            return;
        if (this.inGame)
            return;
        if (!this.start && !this.hostStart)
            return;
        this.updateHostStartButtonPosition();
    }
    /*
     *  Shared text for the center start button and the host-following start button.
     */
    getStartButtonText() {
        return 'Click here to start!';
    }
    /*
     *  Positions the host-following start button near the host and keeps it within the world bounds.
     */
    getHostStartButtonPosition() {
        if (!playerManager.isHost)
            return null;
        if (!this.hostId)
            return null;
        const hostDetails = playerManager.getPlayerDetails(this.hostId);
        if (!hostDetails)
            return null;
        const buttonWidth = 400;
        const buttonHeight = 85;
        let backgroundX = hostDetails.x - 420;
        let backgroundY = hostDetails.y + 10;
        if (backgroundX < 0)
            backgroundX = 0;
        if (backgroundX > 1500 - buttonWidth)
            backgroundX = 1500 - buttonWidth;
        if (backgroundY < 0)
            backgroundY = 0;
        if (backgroundY > 1500 - buttonHeight)
            backgroundY = 1500 - buttonHeight;
        return {
            backgroundX: backgroundX,
            backgroundY: backgroundY,
            textX: backgroundX + 20,
            textY: backgroundY + 10,
        };
    }
    /*
     *  Adds the center start button and makes sure the host-following button is present too.
     */
    createStartButtons() {
        if (!playerManager.isHost)
            return;
        this.removeStartButtons();
        this.startBg = spriteManager.addSprite('button', { uniqueId: 'button', positionX: 530, positionY: 690, width: 410, height: 85, isPlayerControlled: true });
        this.start = spriteManager.addSprite('startBtn', { uniqueId: 'startBtn', positionX: 0, positionY: 700, text: this.getStartButtonText(), isInteractive: true, isPlayerControlled: true, containerWidth: 1500 });
        this.start.attachComponent({ scriptId: "startController" });
        this.ensureHostStartButton();
    }
    /*
     *  Creates or updates the start button that follows the host around.
     */
    ensureHostStartButton() {
        if (!playerManager.isHost)
            return;
        if (!this.start)
            return;
        const hostButtonPosition = this.getHostStartButtonPosition();
        if (!hostButtonPosition)
            return;
        if (!this.hostStart) {
            this.hostStart = spriteManager.addSprite('startBtn', {
                uniqueId: 'hostStartButton',
                positionX: hostButtonPosition.textX,
                positionY: hostButtonPosition.textY,
                text: this.getStartButtonText(),
                isInteractive: true,
                isPlayerControlled: true
            });
            this.hostStart.attachComponent({ scriptId: "startController" });
            return;
        }
        spriteManager.updateSprite(this.hostStart.uniqueId, {
            positionX: hostButtonPosition.textX,
            positionY: hostButtonPosition.textY,
            text: this.getStartButtonText(),
            isInteractive: true,
        });
    }
    /*
     *  Keeps the host-following start button aligned with the host while the game is waiting to start.
     */
    updateHostStartButtonPosition() {
        if (!playerManager.isHost)
            return;
        if (!this.start)
            return;
        if (!this.hostStart || !this.hostStartBg) {
            this.ensureHostStartButton();
            return;
        }
        const hostButtonPosition = this.getHostStartButtonPosition();
        if (!hostButtonPosition)
            return;
        spriteManager.updateSprite(this.hostStart.uniqueId, {
            positionX: hostButtonPosition.textX,
            positionY: hostButtonPosition.textY,
            text: this.getStartButtonText(),
            isInteractive: true,
        });
    }
    /*
     *  Removes both the center start button and the host-following start button.
     */
    removeStartButtons() {
        if (!playerManager.isHost)
            return;
        if (this.start) {
            spriteManager.removeSprite(this.start.uniqueId);
            this.start = null;
        }
        if (this.startBg) {
            spriteManager.removeSprite(this.startBg.uniqueId);
            this.startBg = null;
        }
        if (this.hostStart) {
            spriteManager.removeSprite(this.hostStart.uniqueId);
            this.hostStart = null;
        }
        if (this.hostStartBg) {
            spriteManager.removeSprite(this.hostStartBg.uniqueId);
            this.hostStartBg = null;
        }
    }
    /*
     *  Function to add the threat to the game. The threat will be randomly positioned in one of the four corners of the gamezone.
     */
    addThreat() {
        if (!playerManager.isHost)
            return;
        let podSize = 150;
        let xpos = 0;
        let ypos = 0;
        let xposPod = 0;
        let yposPod = 0;
        let xvel = 0;
        let yvel = 0;
        let size = 125;
        if (this.numPlayers >= 5 && this.numPlayers < 10) {
            size = 100;
        }
        else if (this.numPlayers > 10) {
            size = 75;
        }
        const startDir = mathRandomInt(0, 3);
        switch (startDir) {
            case 0: // start at top left, all positions stay at 0
                xvel = 0;
                yvel = 5;
                console.log('case 0');
                break;
            case 1: // start at top right
                console.log('case 1');
                xpos = 1500 - size;
                xposPod = 1500 - podSize;
                xvel = -5;
                yvel = -5;
                break;
            case 2: // start at bottom left
                console.log('case 2');
                ypos = 1300 - size;
                yposPod = 1300 - podSize;
                xvel = 5;
                yvel = -5;
                break;
            case 3: // start at bottom right
                console.log('case 3');
                xpos = 1500 - size;
                xposPod = 1500 - podSize;
                ypos = 1300 - size;
                yposPod = 1300 - podSize;
                xvel = -5;
                yvel = 5;
        }
        // Only the pod will be shown. When the game starts the pod will be removed and the threat will be shown
        this.pod = spriteManager.addSprite('pod', { uniqueId: 'pod', height: podSize, width: podSize, checkCollisions: true, positionX: xposPod, positionY: yposPod });
        this.threat = spriteManager.addSprite('spikeBall', { uniqueId: 'spikeBall', height: size, width: size, checkCollisions: true, positionX: xpos, positionY: ypos, velocityX: xvel, velocityY: yvel, opacity: 0 });
    }
    /*
     *  Function to add the centered wait message
     */
    addWaitMessage() {
        if (!playerManager.isHost)
            return;
        if (this.waitMessage)
            spriteManager.removeSprite(this.waitMessage.uniqueId);
        this.waitMessage = this.utils.makeText({
            text: `Waiting for ${playerManager.getPlayerDetails(this.hostId).username} to start the game...`,
            align: 'center',
            justify: 'center'
        });
        spriteManager.updateSprite(this.waitMessage.uniqueId, { positionY: 450 });
    }
    /*
     *  Function to add the playerNeeded message
     */
    addPlayerNeededMessage() {
        if (!playerManager.isHost)
            return;
        if (this.waitMessage)
            spriteManager.removeSprite(this.waitMessage.uniqueId);
        this.waitMessage = spriteManager.addSprite('waitMessage', { positionX: 270, positionY: 570, text: 'This game requires at least 2 players...' });
        this.setWorldActivity('GAME_WAITING');
    }
    getActivityPublicKey() {
        let publicKey = '';
        try {
            publicKey = stateManager.getVariable('PublicKey');
        }
        catch (e) { }
        if (!publicKey) {
            try {
                publicKey = stateManager.getVariable('publicKey');
            }
            catch (e) { }
        }
        if (!publicKey) {
            try {
                publicKey = stateManager.getVariable('interactivePublicKey');
            }
            catch (e) { }
        }
        return publicKey;
    }
    setWorldActivity(type) {
        try {
            if (!playerManager.isHost)
                return;
            const publicKey = this.getActivityPublicKey();
            if (!publicKey)
                return;
            integrationsManager.setWorldActivity({
                type: type,
                interactivePublicKey: publicKey,
            });
        }
        catch (e) { }
    }
}
