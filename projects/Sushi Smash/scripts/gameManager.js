"use strict";
class gameManager extends SystemScript {
    theme;
    player1_id;
    player2_id;
    player1_profileId;
    player2_profileId;
    player1_score;
    player2_score;
    player1_occupiedPositions;
    player2_occupiedPositions;
    isGameInProress;
    isEndGameRunning;
    interactivePublicKey;
    endGameTimer;
    nextGameTimer;
    isNextGamePreped;
    constructor() {
        this.player1_occupiedPositions = {};
        this.player2_occupiedPositions = {};
        this.theme = 'sushi';
        this.isEndGameRunning = false;
        this.endGameTimer = 10;
        this.isNextGamePreped = false;
        this.interactivePublicKey = '';
        scriptManager.attachSystem({ scriptId: 'utils_getPosition' });
    }
    onInit() {
        this.resetGame();
    }
    getInteractivePublicKey() {
        let interactivePublicKey = stateManager.getVariable('PublicKey');
        if (!interactivePublicKey) {
            interactivePublicKey = stateManager.getVariable('interactivePublicKey');
        }
        this.interactivePublicKey = interactivePublicKey || '';
        return this.interactivePublicKey;
    }
    sendAnalytics(analytics) {
        try {
            const interactivePublicKey = this.getInteractivePublicKey();
            if (!interactivePublicKey)
                return;
            integrationsManager.putPublicKeyAnalytics({
                interactivePublicKey: interactivePublicKey,
                analytics: analytics,
            });
        }
        catch (e) { }
    }
    // // *** Queue
    async onPlayerJoined({ playerId }) {
        const profileId = playerManager.getPlayerDetails(playerId)?.profileId;
        this.sendAnalytics([
            {
                analyticName: `joins`,
                profileId,
                uniqueKey: profileId,
            },
        ]);
        this.setWorldActivity('GAME_WAITING');
        if (!this.player1_id) {
            this.player1_id = playerId;
            this.player1_profileId = profileId;
            return;
        }
        let playerQueue = stateManager.getVariable('playerQueue');
        if (playerQueue.indexOf(playerId) === -1)
            playerQueue.push(playerId);
        if (this.player2_id && playerQueue.indexOf(this.player2_id) !== -1) {
            // move player 2 to end of queue
            playerQueue = playerQueue.filter((num) => num !== this.player2_id);
            playerQueue.push(this.player2_id);
        }
        stateManager.setVariable('playerQueue', playerQueue);
        if (!this.player2_id && !this.isGameInProress)
            this.prepForNextGame();
        if (playerQueue.length > 1) {
            this.sendAnalytics([
                {
                    analyticName: `addedToQueue`,
                    profileId,
                    uniqueKey: profileId,
                },
            ]);
        }
    }
    async onPlayerLeft({ playerId }) {
        await this.removeFromQueue({ playerId });
        if (this.player2_id === playerId) {
            this.player2_id = null;
            this.player2_profileId = null;
            this.player2_score = null;
            this.player2_occupiedPositions = null;
        }
    }
    async removeFromQueue({ playerId, shouldMoveToBottom = false, }) {
        let playerQueue = stateManager.getVariable('playerQueue');
        playerQueue = playerQueue.filter((num) => num !== playerId);
        if (shouldMoveToBottom && playerQueue.indexOf(playerId) === -1) {
            playerQueue.push(playerId);
        }
        stateManager.setVariable('playerQueue', playerQueue);
    }
    // *** Timer
    async onStep() {
        if (!playerManager.isHost)
            return;
        const gameTimer = stateManager.getVariable('gameTimer');
        const { isGameInProress, nextGameTimer, endGameTimer, isNextGamePreped, player1_id, player2_id, } = this;
        if (!isGameInProress) {
            if (endGameTimer > 0) {
                this.endGameTimer = endGameTimer - 1;
            }
            else if (endGameTimer === 0 && !isNextGamePreped) {
                this.prepForNextGame();
            }
            else if (nextGameTimer === 0) {
                this.startGame();
            }
            else {
                spriteManager.updateSprite('timer', {
                    text: `Next game starts in ${nextGameTimer}`,
                });
                this.nextGameTimer = nextGameTimer - 1;
            }
        }
        else if (gameTimer === 0) {
            this.endGame();
        }
        else {
            // if (gameTimer === 40 || gameTimer === 20) {
            //   await this.addItem({ isPlayer1: true, playerId: this.player1_id });
            //   if (this.player2_id) {
            //     await this.addItem({ isPlayer1: false, playerId: this.player2_id });
            //   }
            // }
            spriteManager.updateSprite('timer', {
                text: `Time Remaining: ${gameTimer}`,
            });
            stateManager.setVariable('gameTimer', gameTimer - 1);
        }
    }
    // *** Game State
    async startGame() {
        this.resetGame();
        // only moving players and not spectators
        // let playerIds = playerManager.getPlayerIds();
        // playerIds = playerIds.filter(
        //   (number) => number !== this.player1_id && number !== this.player2_id,
        // );
        // console.log("playerIds",playerIds)
        // playerManager.teleportPlayers(playerIds, {
        //   distributionType: 'area',
        //   positionX: 100,
        //   positionY: 20,
        //   height: 50,
        //   width: 50,
        // });
        stateManager.setVariable('gameTimer', 40);
        let playerQueue = stateManager.getVariable('playerQueue');
        if (playerQueue.length > 0) {
            this.sendAnalytics([{ analyticName: `gamesWith2Players` }]);
        }
        else {
            this.sendAnalytics([{ analyticName: `gamesWith1Player` }]);
        }
        this.isGameInProress = true;
        this.setWorldActivity('GAME_ON');
        playerManager.teleportPlayers([this.player1_id], {
            distributionType: 'radius',
            positionX: 570,
            positionY: 410,
            radius: 10,
            height: 10,
            width: 10,
        });
        await this.addItem({ isPlayer1: true, playerId: this.player1_id });
        this.sendAnalytics([
            {
                analyticName: `starts`,
                profileId: `${this.player1_profileId}`,
                uniqueKey: `${this.player1_profileId}`,
            },
        ]);
        if (this.player2_id) {
            playerManager.teleportPlayers([this.player2_id], {
                distributionType: 'radius',
                positionX: 620,
                positionY: 560,
                radius: 10,
                height: 10,
                width: 10,
            });
            await this.addItem({ isPlayer1: false, playerId: this.player2_id });
            this.sendAnalytics([
                {
                    analyticName: `starts`,
                    profileId: `${this.player2_profileId}`,
                    uniqueKey: `${this.player2_profileId}`,
                },
            ]);
        }
    }
    async endGame() {
        if (this.isEndGameRunning)
            return;
        this.isEndGameRunning = true;
        this.isGameInProress = false;
        this.endGameTimer = 5;
        spriteManager.updateSprite('timer', { text: `Time Remaining: 0` });
        let text = 'Good game!';
        let winnerId;
        const interactivePublicKey = this.getInteractivePublicKey();
        const player1 = playerManager.getPlayerDetails(this.player1_id);
        const p1profileId = player1.profileId;
        let dataObject = integrationsManager.getDataObject({
            interactivePublicKey: interactivePublicKey,
            scope: 'WORLD',
        });
        if (!dataObject.profiles) {
            dataObject = {
                profiles: {
                    [p1profileId]: {
                        highScore: this.player1_score,
                        username: player1.nameplate || player1.username,
                    },
                },
            };
        }
        else if (!dataObject.profiles[p1profileId] ||
            dataObject.profiles[p1profileId].highScore < this.player1_score) {
            dataObject.profiles[p1profileId] = {
                highScore: this.player1_score,
                username: player1.nameplate || player1.username,
            };
        }
        if (this.player2_id) {
            const player2 = playerManager.getPlayerDetails(this.player2_id);
            const p2profileId = player2.profileId;
            if (!dataObject.profiles[p2profileId] ||
                dataObject.profiles[p2profileId].highScore < this.player2_score) {
                dataObject.profiles[p2profileId] = {
                    highScore: this.player2_score,
                    username: player2.nameplate || player2.username,
                };
            }
            if (this.player2_score == this.player1_score) {
                text = "It's a tie!";
            }
            else if (this.player2_score > this.player1_score) {
                winnerId = this.player2_id;
            }
            else {
                winnerId = this.player1_id;
            }
            if (winnerId) {
                text = `${playerManager.getPlayerDetails(winnerId).nameplate} wins!`;
                integrationsManager.triggerParticleEffect({
                    interactivePublicKey: interactivePublicKey,
                    duration: 4,
                    playerId: winnerId,
                    followPlayerId: winnerId,
                    particleId: stateManager.getVariable('particleId'),
                });
            }
            this.sendAnalytics([
                {
                    analyticName: `completions`,
                    profileId: `${this.player2_profileId}`,
                    uniqueKey: `${this.player2_profileId}`,
                },
                {
                    analyticName: `scoreOf${this.player2_score}`,
                },
            ]);
        }
        spriteManager.updateSprite('gameText', { text });
        this.sendAnalytics([
            {
                analyticName: `completions`,
                profileId: `${this.player1_profileId}`,
                uniqueKey: `${this.player1_profileId}`,
            },
            { analyticName: `scoreOf${this.player1_score}` },
        ]);
        integrationsManager.updateDataObject({
            interactivePublicKey: interactivePublicKey,
            scope: 'WORLD',
            payload: dataObject,
        });
        this.isNextGamePreped = false;
        this.isEndGameRunning = false;
    }
    async prepForNextGame() {
        // 5 seconds before next game counter starts or when 2nd player joins
        spriteManager.updateSprite('player2_name', {
            text: ' ',
        });
        let playerQueue = stateManager.getVariable('playerQueue');
        if (playerQueue.length > 0) {
            const playerIds = playerManager.getPlayerIds();
            playerQueue.forEach((id, index) => {
                if (playerIds.indexOf(id) === -1) {
                    playerQueue.splice(index, 1);
                }
            });
            this.player2_id = playerQueue[0];
            this.player2_profileId = playerManager.getPlayerDetails(playerQueue[0])?.profileId;
            spriteManager.updateSprite('player2_name', {
                text: `${playerManager.getPlayerDetails(this.player2_id).nameplate}`,
            });
        }
        if (playerQueue.length > 1) {
            await this.removeFromQueue({
                playerId: playerQueue[0],
                shouldMoveToBottom: true,
            });
        }
        spriteManager.updateSprite('gameText', {
            text: ' ',
        });
        spriteManager.updateSprite('player1_score', {
            text: `Score: 0`,
        });
        if (this.player2_id) {
            spriteManager.updateSprite('player2_score', {
                text: `Score: 0`,
            });
        }
        stateManager.setVariable('gameTimer', 5);
        this.endGameTimer = 0;
        this.nextGameTimer = 5;
        this.isNextGamePreped = true;
    }
    resetGame() {
        this.player1_score = 0;
        this.player2_score = 0;
        this.isGameInProress = false;
        this.player1_occupiedPositions = {
            1: false,
            2: false,
            3: false,
            4: false,
            5: false,
            6: false,
            7: false,
            8: false,
            9: false,
        };
        this.player2_occupiedPositions = {
            1: false,
            2: false,
            3: false,
            4: false,
            5: false,
            6: false,
            7: false,
            8: false,
            9: false,
        };
    }
    // *** Items
    async addItem({ isPlayer1, playerId, lastItemIsBad, }) {
        const gameTimer = stateManager.getVariable('gameTimer');
        if (!this.isGameInProress || gameTimer === 0)
            return;
        const occupiedPositions = isPlayer1
            ? this.player1_occupiedPositions.toObject()
            : this.player2_occupiedPositions.toObject();
        let count = 0;
        for (var key in occupiedPositions) {
            if (occupiedPositions[key] === true)
                count = count + 1;
        }
        if (count > 3)
            return;
        const spriteId = mathRandomInt(1, lastItemIsBad ? 8 : 12);
        const uniqueId = getRandomUUID();
        const { position, x, y } = scriptManager
            .getSystem({ systemName: 'utils_getPosition' })
            .getPosition({ isPlayer1, occupiedPositions });
        spriteManager.addSprite(`${this.theme}${spriteId}`, {
            uniqueId,
            applyPhysics: true,
            isInteractive: true,
            positionX: x,
            positionY: y,
        });
        scriptManager.attachComponent({
            objectUniqueId: uniqueId,
            componentName: 'itemManager',
            scriptId: 'itemManager',
        });
        const item = scriptManager.getComponent({
            objectUniqueId: uniqueId,
            componentName: 'itemManager',
        });
        item.playerId = playerId;
        item.itemPosition = position;
        item.isBad = spriteId > 8 ? true : false;
        item.isPlayer1 = isPlayer1;
        occupiedPositions[position] = true;
        if (isPlayer1) {
            this.player1_occupiedPositions = occupiedPositions;
            // this.player1_occupiedPositions[position] = true;
        }
        else {
            this.player2_occupiedPositions = occupiedPositions;
            // this.player2_occupiedPositions[position] = true;
        }
    }
    async removeItem({ itemId, itemPosition, isPlayer1, playerId, }) {
        spriteManager.removeSprite(itemId);
        const occupiedPositions = isPlayer1
            ? this.player1_occupiedPositions.toObject()
            : this.player2_occupiedPositions.toObject();
        occupiedPositions[itemPosition] = false;
        if (isPlayer1) {
            this.player1_occupiedPositions = occupiedPositions;
            // this.player1_occupiedPositions[itemPosition] = false;
        }
        else {
            this.player2_occupiedPositions = occupiedPositions;
            // this.player2_occupiedPositions[itemPosition] = false;
        }
        let count = 0;
        for (var key in occupiedPositions) {
            if (occupiedPositions[key] === true)
                count = count + 1;
        }
        if (count === 0)
            await this.addItem({ isPlayer1, playerId });
    }
    async itemClicked({ itemId, isBad, isPlayer1, playerId, itemPosition, }) {
        if (isPlayer1) {
            if (isBad)
                this.player1_score = this.player1_score - 1;
            else
                this.player1_score++;
            spriteManager.updateSprite('player1_score', {
                text: `Score: ${this.player1_score}`,
            });
        }
        else {
            if (isBad)
                this.player2_score = this.player2_score - 1;
            else
                this.player2_score++;
            spriteManager.updateSprite('player2_score', {
                text: `Score: ${this.player2_score}`,
            });
        }
        await this.removeItem({ itemId, itemPosition, isPlayer1, playerId });
        await this.addItem({ isPlayer1, playerId, lastItemIsBad: isBad });
    }
    setWorldActivity(type) {
        try {
            if (!playerManager.isHost)
                return;
            const interactivePublicKey = this.getInteractivePublicKey();
            if (!interactivePublicKey)
                return;
            integrationsManager.setWorldActivity({
                type: type,
                interactivePublicKey: interactivePublicKey,
            });
        }
        catch (e) { }
    }
}
