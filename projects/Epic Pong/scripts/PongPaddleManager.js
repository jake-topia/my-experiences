"use strict";
class PongPaddleManager extends SystemScript {
    systemName;
    config;
    // Movement + bookkeeping rely on simple arrays to stay compatible with Topia runtime
    movingSpriteIds;
    movingDirections;
    paddleSpriteIds;
    buttonSpriteIds;
    // Body Paddle mode tracking
    bodyPaddlePlayerIds; // Player IDs using body paddle mode
    bodyPaddleTeams; // playerId -> teamId
    gameManager; // Reference to PongGameManager
    // Button flash animation state
    buttonFlashActive; // Is flash animation currently running
    hasId(list, id) {
        if (!list)
            return false;
        let idx = 0;
        while (idx < list.length) {
            if (list[idx] === id) {
                return true;
            }
            idx++;
        }
        return false;
    }
    addTrackedId(list, id) {
        if (!list)
            return;
        if (this.hasId(list, id))
            return;
        list.push(id);
    }
    removeTrackedId(list, id) {
        if (!list)
            return [];
        const next = [];
        let idx = 0;
        while (idx < list.length) {
            if (list[idx] !== id) {
                next.push(list[idx]);
            }
            idx++;
        }
        return next;
    }
    findIndex(list, id) {
        if (!list)
            return -1;
        let idx = 0;
        while (idx < list.length) {
            if (list[idx] === id) {
                return idx;
            }
            idx++;
        }
        return -1;
    }
    removeMovingSprite(spriteId) {
        const nextIds = [];
        const nextDir = [];
        let idx = 0;
        while (idx < this.movingSpriteIds.length) {
            const currentId = this.movingSpriteIds[idx];
            if (currentId !== spriteId) {
                nextIds.push(currentId);
                nextDir.push(this.movingDirections[idx]);
            }
            idx++;
        }
        this.movingSpriteIds = nextIds;
        this.movingDirections = nextDir;
    }
    onInit() {
        this.systemName = 'PongPaddleManager';
        scriptManager.attachSystem({ scriptId: 'PongConfigSystem' });
        this.config = scriptManager.getSystem({ systemName: 'PongConfigSystem' });
        this.movingSpriteIds = [];
        this.movingDirections = [];
        this.paddleSpriteIds = [];
        this.buttonSpriteIds = [];
        this.bodyPaddlePlayerIds = [];
        this.bodyPaddleTeams = {};
        this.gameManager = null;
        // Button flash state
        this.buttonFlashActive = false;
    }
    /**
     * Create a paddle for a player
     * Sprite ID = paddle_{playerId}_{h|v}
     */
    createPaddle(playerId, teamId, playerCount) {
        if (!playerManager.isHost)
            return;
        const paddleInfo = this.config.getPaddlePosition(teamId, playerCount);
        const color = this.config.getTeamColor(teamId);
        const hexColor = '#' + ('000000' + color.toString(16)).slice(-6);
        const isHorizontal = paddleInfo.orientation === 'horizontal';
        const orientation = isHorizontal ? 'horizontal' : 'vertical';
        const spriteId = 'paddle_' + playerId + '_' + (isHorizontal ? 'h' : 'v');
        const borderSpriteId = 'paddle_border_' + playerId + '_' + (isHorizontal ? 'h' : 'v');
        // Clean up any existing paddle/buttons for this player
        if (spriteManager.getSprite(spriteId)) {
            spriteManager.removeSprite(spriteId);
        }
        if (spriteManager.getSprite(borderSpriteId)) {
            spriteManager.removeSprite(borderSpriteId);
        }
        this.paddleSpriteIds = this.removeTrackedId(this.paddleSpriteIds, spriteId);
        this.paddleSpriteIds = this.removeTrackedId(this.paddleSpriteIds, borderSpriteId);
        this.removeMovingSprite(spriteId);
        this.removeButtonsForPlayer(playerId);
        // Create paddle dimensions
        const width = isHorizontal
            ? this.config.paddleHeight
            : this.config.paddleWidth;
        const height = isHorizontal
            ? this.config.paddleWidth
            : this.config.paddleHeight;
        const borderWidth = 4; // Border thickness
        const borderColor = '#FFFFFF'; // Default to white, will update dynamically
        // Determine game mode from config
        const roundMode = this.config.roundMode || 'button';
        const isBodyPaddleMode = roundMode === 'bodypaddle' || this.config.bodyPaddleMode;
        const isCoordinateMode = roundMode === 'coordinate';
        if (isBodyPaddleMode) {
            // Round 3: Body Paddle mode - paddle follows player avatar, positioned above player
            // Track this player for body paddle updates
            if (!this.hasId(this.bodyPaddlePlayerIds, String(playerId))) {
                this.bodyPaddlePlayerIds.push(String(playerId));
            }
            this.bodyPaddleTeams[String(playerId)] = teamId;
            // Get game manager reference
            if (!this.gameManager) {
                this.gameManager = scriptManager.getSystem({
                    systemName: 'PongGameManager',
                });
            }
            // Create border sprite (slightly larger than paddle)
            // Initially hidden (opacity 0) until player enters zone
            spriteManager.addSprite('rect', {
                uniqueId: borderSpriteId,
                positionX: paddleInfo.x - borderWidth / 2,
                positionY: paddleInfo.y - borderWidth / 2,
                width: width + borderWidth,
                height: height + borderWidth,
                fill: borderColor,
                checkCollisions: false,
                topAdjust: 50, // Layer above player
                opacity: 0, // Hidden until player enters zone
            });
            this.addTrackedId(this.paddleSpriteIds, borderSpriteId);
            // Create paddle sprite (on top of border)
            // Initially hidden until player enters zone
            spriteManager.addSprite('rect', {
                uniqueId: spriteId,
                positionX: paddleInfo.x,
                positionY: paddleInfo.y,
                width: width,
                height: height,
                fill: hexColor,
                checkCollisions: true,
                topAdjust: 50, // Layer above player
                opacity: 0, // Hidden until player enters zone
            });
            this.addTrackedId(this.paddleSpriteIds, spriteId);
            // NO buttons in Body Paddle mode
        }
        else if (isCoordinateMode) {
            // Round 1: Coordinate Tracking mode - player X/Y controls paddle (no buttons)
            // Create border sprite (slightly larger than paddle)
            spriteManager.addSprite('rect', {
                uniqueId: borderSpriteId,
                positionX: paddleInfo.x - borderWidth / 2,
                positionY: paddleInfo.y - borderWidth / 2,
                width: width + borderWidth,
                height: height + borderWidth,
                fill: borderColor,
                checkCollisions: false,
            });
            this.addTrackedId(this.paddleSpriteIds, borderSpriteId);
            // Create paddle sprite (on top of border)
            spriteManager.addSprite('rect', {
                uniqueId: spriteId,
                positionX: paddleInfo.x,
                positionY: paddleInfo.y,
                width: width,
                height: height,
                fill: hexColor,
                checkCollisions: true,
            });
            this.addTrackedId(this.paddleSpriteIds, spriteId);
            // NO buttons in Coordinate mode - paddles track player position
        }
        else {
            // Round 2: Standard button control mode
            // Create border sprite (slightly larger than paddle)
            spriteManager.addSprite('rect', {
                uniqueId: borderSpriteId,
                positionX: paddleInfo.x - borderWidth / 2,
                positionY: paddleInfo.y - borderWidth / 2,
                width: width + borderWidth,
                height: height + borderWidth,
                fill: borderColor,
                checkCollisions: false,
            });
            this.addTrackedId(this.paddleSpriteIds, borderSpriteId);
            // Create paddle sprite (on top of border)
            spriteManager.addSprite('rect', {
                uniqueId: spriteId,
                positionX: paddleInfo.x,
                positionY: paddleInfo.y,
                width: width,
                height: height,
                fill: hexColor,
                checkCollisions: true,
            });
            this.addTrackedId(this.paddleSpriteIds, spriteId);
            // Create control buttons for button mode only
            this.createControlButtons(playerId, orientation, paddleInfo.x, paddleInfo.y);
        }
    }
    /**
     * Create directional control buttons for a player
     * Buttons are positioned inside the play area, flush with edges, extending inward by one button width
     */
    createControlButtons(playerId, orientation, paddleX, paddleY) {
        // First, aggressively remove any existing buttons for this player
        const buttonIds = [
            'btn_left_' + playerId,
            'btn_right_' + playerId,
            'txt_left_' + playerId,
            'txt_right_' + playerId,
        ];
        // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
        for (let i = 0; i < buttonIds.length; i++) {
            const id = buttonIds[i];
            if (spriteManager.getSprite(id)) {
                spriteManager.removeSprite(id);
            }
            this.buttonSpriteIds = this.removeTrackedId(this.buttonSpriteIds, id);
        }
        const laneWidth = this.config.laneWidth;
        const playAreaX = this.config.playAreaX;
        const playAreaY = this.config.playAreaY;
        const playAreaWidth = this.config.playAreaWidth;
        const playAreaHeight = this.config.playAreaHeight;
        let leftX, leftY, leftWidth, leftHeight;
        let rightX, rightY, rightWidth, rightHeight;
        if (orientation === 'horizontal') {
            // Top or bottom paddle - buttons are left and right
            const isTopPaddle = paddleY < this.config.centerY;
            if (isTopPaddle) {
                // Top team (Red) - buttons at top stage edge
                // Left button: x = 150 to x = 300, y = 0 to y = 150
                leftX = playAreaX;
                leftY = 0; // Top edge of stage
                leftWidth = laneWidth;
                leftHeight = laneWidth;
                // Right button: x = 700 to x = 850, y = 0 to y = 150
                rightX = playAreaX + playAreaWidth - laneWidth;
                rightY = 0; // Top edge of stage
                rightWidth = laneWidth;
                rightHeight = laneWidth;
            }
            else {
                // Bottom team (Blue) - buttons at bottom stage edge
                // Left button: x = 150 to x = 300, y = 850 to y = 1000
                leftX = playAreaX;
                leftY = this.config.worldHeight - laneWidth; // Bottom edge of stage
                leftWidth = laneWidth;
                leftHeight = laneWidth;
                // Right button: x = 700 to x = 850, y = 850 to y = 1000
                rightX = playAreaX + playAreaWidth - laneWidth;
                rightY = this.config.worldHeight - laneWidth; // Bottom edge of stage
                rightWidth = laneWidth;
                rightHeight = laneWidth;
            }
        }
        else {
            // Left or right paddle - buttons are up and down
            const isLeftPaddle = paddleX < this.config.centerX;
            if (isLeftPaddle) {
                // Left team (Green) - buttons at left stage edge
                // Up button: x = 0 to x = 150, y = 150 to y = 300
                leftX = 0; // Left edge of stage
                leftY = playAreaY;
                leftWidth = laneWidth;
                leftHeight = laneWidth;
                // Down button: x = 0 to x = 150, y = 700 to y = 850
                rightX = 0; // Left edge of stage
                rightY = playAreaY + playAreaHeight - laneWidth;
                rightWidth = laneWidth;
                rightHeight = laneWidth;
            }
            else {
                // Right team (Yellow) - buttons at right stage edge
                // Up button: x = 850 to x = 1000, y = 150 to y = 300
                leftX = this.config.worldWidth - laneWidth; // Right edge of stage
                leftY = playAreaY;
                leftWidth = laneWidth;
                leftHeight = laneWidth;
                // Down button: x = 850 to x = 1000, y = 700 to y = 850
                rightX = this.config.worldWidth - laneWidth; // Right edge of stage
                rightY = playAreaY + playAreaHeight - laneWidth;
                rightWidth = laneWidth;
                rightHeight = laneWidth;
            }
        }
        // Create left button
        spriteManager.addSprite('rect', {
            uniqueId: 'btn_left_' + playerId,
            positionX: leftX,
            positionY: leftY,
            width: leftWidth,
            height: leftHeight,
            fill: '#444444',
            opacity: 0.5,
            isInteractive: true,
        });
        this.addTrackedId(this.buttonSpriteIds, 'btn_left_' + playerId);
        // Position text in center of left button
        const leftTextX = leftX + leftWidth / 2 - 30;
        const leftTextY = leftY + leftHeight / 2 - 30;
        spriteManager.addSprite('text', {
            uniqueId: 'txt_left_' + playerId,
            text: orientation === 'horizontal' ? '◄' : '▲',
            positionX: leftTextX,
            positionY: leftTextY,
            fontSize: 60,
            fontColor: '#FFFFFF',
            isInteractive: false,
        });
        this.addTrackedId(this.buttonSpriteIds, 'txt_left_' + playerId);
        // Create right button
        spriteManager.addSprite('rect', {
            uniqueId: 'btn_right_' + playerId,
            positionX: rightX,
            positionY: rightY,
            width: rightWidth,
            height: rightHeight,
            fill: '#444444',
            opacity: 0.5,
            isInteractive: true,
        });
        this.addTrackedId(this.buttonSpriteIds, 'btn_right_' + playerId);
        // Position text in center of right button
        const rightTextX = rightX + rightWidth / 2 - 30;
        const rightTextY = rightY + rightHeight / 2 - 30;
        spriteManager.addSprite('text', {
            uniqueId: 'txt_right_' + playerId,
            text: orientation === 'horizontal' ? '►' : '▼',
            positionX: rightTextX,
            positionY: rightTextY,
            fontSize: 60,
            fontColor: '#FFFFFF',
            isInteractive: false,
        });
        this.addTrackedId(this.buttonSpriteIds, 'txt_right_' + playerId);
        console.log('[PongPM] Created control buttons for player', playerId, 'orientation:', orientation);
    }
    /**
     * Toggle paddle movement - click once to start, click again to stop
     */
    onButtonPress(playerId, direction) {
        if (!playerManager.isHost)
            return;
        // Stop button flashing when any button is pressed
        if (this.buttonFlashActive) {
            this.stopButtonFlash();
        }
        // Find paddle sprite by ID pattern
        const spriteIdH = 'paddle_' + playerId + '_h';
        const spriteIdV = 'paddle_' + playerId + '_v';
        const spriteId = spriteManager.getSprite(spriteIdH) ? spriteIdH : spriteIdV;
        if (!spriteManager.getSprite(spriteId)) {
            console.error('[PongPM] No paddle found for player', playerId);
            return;
        }
        const dir = direction === 'left' || direction === 'up' ? -1 : 1;
        const movingIndex = this.findIndex(this.movingSpriteIds, spriteId);
        if (movingIndex !== -1) {
            const currentDir = this.movingDirections[movingIndex];
            if (currentDir === dir) {
                // Stopping - remove from moving list and reset button colors
                this.removeMovingSprite(spriteId);
                this.updateButtonColors(playerId, null);
            }
            else {
                // Changing direction
                this.movingDirections[movingIndex] = dir;
                this.updateButtonColors(playerId, direction);
            }
            return;
        }
        // Starting to move
        this.movingSpriteIds.push(spriteId);
        this.movingDirections.push(dir);
        this.updateButtonColors(playerId, direction);
    }
    /**
     * Update button colors to show which is active
     * @param playerId - player ID
     * @param activeDirection - 'left', 'right', or null for both inactive
     */
    updateButtonColors(playerId, activeDirection) {
        if (!playerManager.isHost)
            return;
        const leftButtonId = 'btn_left_' + playerId;
        const rightButtonId = 'btn_right_' + playerId;
        const activeColor = '#00AA00'; // Bright green when active
        const inactiveColor = '#444444'; // Dark gray when inactive
        // Update left button
        if (spriteManager.getSprite(leftButtonId)) {
            spriteManager.updateSprite(leftButtonId, {
                fill: activeDirection === 'left' ? activeColor : inactiveColor,
            });
        }
        // Update right button
        if (spriteManager.getSprite(rightButtonId)) {
            spriteManager.updateSprite(rightButtonId, {
                fill: activeDirection === 'right' ? activeColor : inactiveColor,
            });
        }
    }
    /**
     * Update paddle positions every frame
     */
    onPhysicsStep() {
        if (!playerManager.isHost)
            return;
        // Check game manager for round mode (NEW - Round 1: Coordinate Tracking)
        if (!this.gameManager) {
            this.gameManager = scriptManager.getSystem({
                systemName: 'PongGameManager',
            });
        }
        // Round 1: Coordinate Tracking mode - player X/Y controls paddle
        if (this.config.roundMode === 'coordinate') {
            this.updateCoordinatePaddles();
            return;
        }
        // Round 3: Body Paddle mode - paddle follows player avatar
        if (this.config.roundMode === 'bodypaddle' || this.config.bodyPaddleMode) {
            this.updateBodyPaddles();
            return;
        }
        // Round 2: Button mode - update button-controlled paddle movement
        const nextIds = [];
        const nextDirections = [];
        let idx = 0;
        while (idx < this.movingSpriteIds.length) {
            const spriteId = this.movingSpriteIds[idx];
            const dir = this.movingDirections[idx];
            if (spriteId !== undefined && dir !== undefined) {
                const keepMoving = this.updateMovingPaddlePosition(spriteId, dir);
                if (keepMoving) {
                    nextIds.push(spriteId);
                    nextDirections.push(dir);
                }
            }
            idx++;
        }
        this.movingSpriteIds = nextIds;
        this.movingDirections = nextDirections;
    }
    /**
     * Update Coordinate Tracking Paddles (Round 1)
     * Top/bottom paddles: paddle.x = player.x (clamped to play area)
     * Left/right paddles: paddle.y = player.y (clamped to play area)
     */
    updateCoordinatePaddles() {
        if (!this.gameManager) {
            this.gameManager = scriptManager.getSystem({
                systemName: 'PongGameManager',
            });
        }
        if (!this.gameManager)
            return;
        const activePlayers = this.gameManager.activePlayers || [];
        const playAreaX = this.config.playAreaX;
        const playAreaY = this.config.playAreaY;
        const playAreaWidth = this.config.playAreaWidth;
        const playAreaHeight = this.config.playAreaHeight;
        const playAreaRight = playAreaX + playAreaWidth;
        const playAreaBottom = playAreaY + playAreaHeight;
        // Iterate through all active players
        for (let i = 0; i < activePlayers.length; i++) {
            const playerId = activePlayers[i];
            const teamId = this.gameManager.getPlayerTeam(playerId);
            if (!teamId)
                continue;
            // Get player details
            const playerDetails = playerManager.getPlayerDetails(playerId);
            if (!playerDetails)
                continue;
            // Determine paddle sprite ID and orientation
            // IMPORTANT: Use originalPlayerCount for layout, not activePlayers.length
            // This ensures paddles stay in correct positions when players leave
            const layoutPlayerCount = this.gameManager.originalPlayerCount || activePlayers.length;
            const paddleInfo = this.config.getPaddlePosition(teamId, layoutPlayerCount);
            const isHorizontal = paddleInfo.orientation === 'horizontal';
            const spriteId = 'paddle_' + playerId + '_' + (isHorizontal ? 'h' : 'v');
            const borderSpriteId = 'paddle_border_' + playerId + '_' + (isHorizontal ? 'h' : 'v');
            const paddleSprite = spriteManager.getSprite(spriteId);
            if (!paddleSprite)
                continue;
            // Calculate paddle dimensions
            const width = isHorizontal
                ? this.config.paddleHeight
                : this.config.paddleWidth;
            const height = isHorizontal
                ? this.config.paddleWidth
                : this.config.paddleHeight;
            // Get current paddle position
            const currentPaddleX = spriteManager.getProperty(spriteId, 'positionX') || paddleInfo.x;
            const currentPaddleY = spriteManager.getProperty(spriteId, 'positionY') || paddleInfo.y;
            let newPaddleX = currentPaddleX;
            let newPaddleY = currentPaddleY;
            if (isHorizontal) {
                // Top/bottom paddles: paddle.x = player.x (clamped to play area)
                // Player X directly controls paddle X position
                newPaddleX = playerDetails.x - width / 2;
                // Clamp to play area boundaries
                if (newPaddleX < playAreaX) {
                    newPaddleX = playAreaX;
                }
                if (newPaddleX + width > playAreaRight) {
                    newPaddleX = playAreaRight - width;
                }
                // Y stays fixed at paddle's original Y position
                newPaddleY = paddleInfo.y;
            }
            else {
                // Left/right paddles: paddle.y = player.y (clamped to play area)
                // Player Y directly controls paddle Y position
                newPaddleY = playerDetails.y - height / 2;
                // Clamp to play area boundaries
                if (newPaddleY < playAreaY) {
                    newPaddleY = playAreaY;
                }
                if (newPaddleY + height > playAreaBottom) {
                    newPaddleY = playAreaBottom - height;
                }
                // X stays fixed at paddle's original X position
                newPaddleX = paddleInfo.x;
            }
            // Update paddle position
            spriteManager.updateSprite(spriteId, {
                positionX: newPaddleX,
                positionY: newPaddleY,
                opacity: 1, // Always visible
            });
            // Update border position
            if (spriteManager.getSprite(borderSpriteId)) {
                const borderWidth = 4;
                spriteManager.updateSprite(borderSpriteId, {
                    positionX: newPaddleX - borderWidth / 2,
                    positionY: newPaddleY - borderWidth / 2,
                    opacity: 1, // Always visible
                });
            }
        }
    }
    /**
     * Update Body Paddle positions to follow players
     * Paddles are always visible and follow the player
     */
    updateBodyPaddles() {
        // Iterate through all body paddle players
        for (let i = 0; i < this.bodyPaddlePlayerIds.length; i++) {
            const playerIdStr = this.bodyPaddlePlayerIds[i];
            const playerId = Number(playerIdStr);
            const teamId = this.bodyPaddleTeams[playerIdStr];
            // Get player details
            const playerDetails = playerManager.getPlayerDetails(playerId);
            if (!playerDetails)
                continue;
            // Determine paddle sprite ID
            // IMPORTANT: Use originalPlayerCount for layout, not getPlayerCount()
            // This ensures paddles stay in correct positions when players leave
            const layoutPlayerCount = this.gameManager
                ? this.gameManager.originalPlayerCount
                : this.getPlayerCount();
            const paddleInfo = this.config.getPaddlePosition(teamId, layoutPlayerCount);
            const isHorizontal = paddleInfo.orientation === 'horizontal';
            const spriteId = 'paddle_' + playerId + '_' + (isHorizontal ? 'h' : 'v');
            const borderSpriteId = 'paddle_border_' + playerId + '_' + (isHorizontal ? 'h' : 'v');
            const paddleSprite = spriteManager.getSprite(spriteId);
            if (!paddleSprite)
                continue;
            // Calculate paddle position based on player position
            const width = isHorizontal
                ? this.config.paddleHeight
                : this.config.paddleWidth;
            const height = isHorizontal
                ? this.config.paddleWidth
                : this.config.paddleHeight;
            // Center paddle on player with configurable offsets
            const paddleX = playerDetails.x - width / 2 + this.config.bodyPaddleOffsetX;
            const paddleY = playerDetails.y - height / 2 + this.config.bodyPaddleOffsetY;
            // Update paddle position (always visible)
            spriteManager.updateSprite(spriteId, {
                positionX: paddleX,
                positionY: paddleY,
                opacity: 1, // Always visible
            });
            if (spriteManager.getSprite(borderSpriteId)) {
                const borderWidth = 4;
                spriteManager.updateSprite(borderSpriteId, {
                    positionX: paddleX - borderWidth / 2,
                    positionY: paddleY - borderWidth / 2,
                    opacity: 1, // Always visible
                });
            }
        }
    }
    /**
     * Get current player count (helper for Body Paddle mode)
     */
    getPlayerCount() {
        if (!this.gameManager) {
            this.gameManager = scriptManager.getSystem({
                systemName: 'PongGameManager',
            });
        }
        return this.gameManager ? this.gameManager.getConnectedPlayerCount() : 2;
    }
    updateMovingPaddlePosition(spriteId, direction) {
        const sprite = spriteManager.getSprite(spriteId);
        if (!sprite)
            return false;
        const speed = 8;
        const currentX = spriteManager.getProperty(spriteId, 'positionX') || 0;
        const currentY = spriteManager.getProperty(spriteId, 'positionY') || 0;
        // Extract player ID from sprite ID (format: paddle_123_h or paddle_123_v)
        const parts = spriteId.split('_');
        const playerId = parts[1];
        const orientation = parts[2];
        const borderSpriteId = 'paddle_border_' + playerId + '_' + orientation;
        const borderWidth = 4;
        // Get play area boundaries (paddles must stay inside)
        const playAreaX = this.config.playAreaX;
        const playAreaY = this.config.playAreaY;
        const playAreaWidth = this.config.playAreaWidth;
        const playAreaHeight = this.config.playAreaHeight;
        const playAreaRight = playAreaX + playAreaWidth;
        const playAreaBottom = playAreaY + playAreaHeight;
        const isHorizontal = spriteId.indexOf('_h') > 0;
        if (isHorizontal) {
            // For horizontal paddles: width is paddleHeight, height is paddleWidth
            // Sprites are positioned at top-left corner, so we need the actual width
            const paddleWidth = this.config.paddleHeight;
            let newX = currentX + direction * speed;
            // Constrain to play area boundaries (sprite positioned at top-left)
            if (newX < playAreaX) {
                newX = playAreaX;
                spriteManager.updateSprite(spriteId, { positionX: newX });
                if (spriteManager.getSprite(borderSpriteId)) {
                    spriteManager.updateSprite(borderSpriteId, {
                        positionX: newX - borderWidth / 2,
                    });
                }
                return false;
            }
            if (newX + paddleWidth > playAreaRight) {
                newX = playAreaRight - paddleWidth;
                spriteManager.updateSprite(spriteId, { positionX: newX });
                if (spriteManager.getSprite(borderSpriteId)) {
                    spriteManager.updateSprite(borderSpriteId, {
                        positionX: newX - borderWidth / 2,
                    });
                }
                return false;
            }
            spriteManager.updateSprite(spriteId, { positionX: newX });
            if (spriteManager.getSprite(borderSpriteId)) {
                spriteManager.updateSprite(borderSpriteId, {
                    positionX: newX - borderWidth / 2,
                });
            }
            return true;
        }
        // For vertical paddles: width is paddleWidth, height is paddleHeight
        // Sprites are positioned at top-left corner, so we need the actual height
        const paddleHeight = this.config.paddleHeight;
        let newY = currentY + direction * speed;
        // Constrain to play area boundaries (sprite positioned at top-left)
        if (newY < playAreaY) {
            newY = playAreaY;
            spriteManager.updateSprite(spriteId, { positionY: newY });
            if (spriteManager.getSprite(borderSpriteId)) {
                spriteManager.updateSprite(borderSpriteId, {
                    positionY: newY - borderWidth / 2,
                });
            }
            return false;
        }
        if (newY + paddleHeight > playAreaBottom) {
            newY = playAreaBottom - paddleHeight;
            spriteManager.updateSprite(spriteId, { positionY: newY });
            if (spriteManager.getSprite(borderSpriteId)) {
                spriteManager.updateSprite(borderSpriteId, {
                    positionY: newY - borderWidth / 2,
                });
            }
            return false;
        }
        spriteManager.updateSprite(spriteId, { positionY: newY });
        if (spriteManager.getSprite(borderSpriteId)) {
            spriteManager.updateSprite(borderSpriteId, {
                positionY: newY - borderWidth / 2,
            });
        }
        return true;
    }
    /**
     * Check paddle collision - iterate known paddle sprites only
     */
    checkPaddleCollision(ballX, ballY, ballSize) {
        let idx = 0;
        while (idx < this.paddleSpriteIds.length) {
            const spriteId = this.paddleSpriteIds[idx];
            const collision = this.checkCollisionForPaddle(spriteId, ballX, ballY, ballSize);
            if (collision.hit) {
                return collision;
            }
            idx++;
        }
        return { hit: false };
    }
    checkCollisionForPaddle(spriteId, ballX, ballY, ballSize) {
        if (!spriteId)
            return { hit: false };
        const sprite = spriteManager.getSprite(spriteId);
        if (!sprite)
            return { hit: false };
        const isHorizontal = spriteId.indexOf('_h') > 0;
        const paddleX = spriteManager.getProperty(spriteId, 'positionX') || 0;
        const paddleY = spriteManager.getProperty(spriteId, 'positionY') || 0;
        const paddleWidth = isHorizontal
            ? this.config.paddleHeight
            : this.config.paddleWidth;
        const paddleHeight = isHorizontal
            ? this.config.paddleWidth
            : this.config.paddleHeight;
        const halfBall = ballSize / 2;
        const halfPaddleW = paddleWidth / 2;
        const halfPaddleH = paddleHeight / 2;
        const overlaps = ballX + halfBall > paddleX - halfPaddleW &&
            ballX - halfBall < paddleX + halfPaddleW &&
            ballY + halfBall > paddleY - halfPaddleH &&
            ballY - halfBall < paddleY + halfPaddleH;
        if (!overlaps)
            return { hit: false };
        const normal = { x: 0, y: 0 };
        if (isHorizontal) {
            normal.y = ballY < paddleY ? -1 : 1;
        }
        else {
            normal.x = ballX < paddleX ? -1 : 1;
        }
        return {
            hit: true,
            paddleId: spriteId,
            normal: normal,
        };
    }
    /**
     * Remove all paddles and buttons
     */
    removeAllPaddles() {
        if (!playerManager.isHost)
            return;
        // Remove all tracked paddle sprites
        let paddleIndex = 0;
        while (paddleIndex < this.paddleSpriteIds.length) {
            const paddleId = this.paddleSpriteIds[paddleIndex];
            if (paddleId && spriteManager.getSprite(paddleId)) {
                spriteManager.removeSprite(paddleId);
            }
            paddleIndex++;
        }
        // Remove all tracked button sprites
        const buttons = this.buttonSpriteIds || [];
        // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
        for (let i = 0; i < buttons.length; i++) {
            const buttonId = buttons[i];
            if (!buttonId)
                continue;
            if (spriteManager.getSprite(buttonId)) {
                spriteManager.removeSprite(buttonId);
            }
        }
        // Clear tracking arrays
        this.movingSpriteIds = [];
        this.movingDirections = [];
        this.paddleSpriteIds = [];
        this.buttonSpriteIds = [];
        // Clear Body Paddle mode tracking
        this.bodyPaddlePlayerIds = [];
        this.bodyPaddleTeams = {};
    }
    /**
     * Remove paddle and buttons for a specific player
     */
    removePaddleForPlayer(playerId) {
        if (!playerManager.isHost)
            return;
        // Both orientations possible depending on team
        const hSpriteId = 'paddle_' + playerId + '_h';
        const vSpriteId = 'paddle_' + playerId + '_v';
        const hBorderId = 'paddle_border_' + playerId + '_h';
        const vBorderId = 'paddle_border_' + playerId + '_v';
        // Remove horizontal paddle and border
        if (spriteManager.getSprite(hSpriteId)) {
            spriteManager.removeSprite(hSpriteId);
        }
        if (spriteManager.getSprite(hBorderId)) {
            spriteManager.removeSprite(hBorderId);
        }
        // Remove vertical paddle and border
        if (spriteManager.getSprite(vSpriteId)) {
            spriteManager.removeSprite(vSpriteId);
        }
        if (spriteManager.getSprite(vBorderId)) {
            spriteManager.removeSprite(vBorderId);
        }
        // Remove from tracking arrays
        this.paddleSpriteIds = this.removeTrackedId(this.paddleSpriteIds, hSpriteId);
        this.paddleSpriteIds = this.removeTrackedId(this.paddleSpriteIds, vSpriteId);
        this.paddleSpriteIds = this.removeTrackedId(this.paddleSpriteIds, hBorderId);
        this.paddleSpriteIds = this.removeTrackedId(this.paddleSpriteIds, vBorderId);
        this.removeMovingSprite(hSpriteId);
        this.removeMovingSprite(vSpriteId);
        // Remove buttons
        this.removeButtonsForPlayer(playerId);
        // Remove from body paddle tracking
        const pidStr = String(playerId);
        this.bodyPaddlePlayerIds = this.removeTrackedId(this.bodyPaddlePlayerIds, pidStr);
        delete this.bodyPaddleTeams[pidStr];
        console.log('[PongPaddle] Removed paddle for player ' + playerId);
    }
    removeButtonsForPlayer(playerId) {
        const targets = [
            'btn_left_' + playerId,
            'btn_right_' + playerId,
            'txt_left_' + playerId,
            'txt_right_' + playerId,
        ];
        const next = [];
        // eslint-disable-next-line sonarjs/prefer-for-of -- Topia runtime lacks Symbol.iterator support
        for (let i = 0; i < this.buttonSpriteIds.length; i++) {
            const spriteId = this.buttonSpriteIds[i];
            // eslint-disable-next-line sonarjs/prefer-includes -- Topia runtime targets ES5 and lacks Array.includes
            const isTarget = targets.indexOf(spriteId) >= 0;
            if (isTarget) {
                if (spriteManager.getSprite(spriteId)) {
                    spriteManager.removeSprite(spriteId);
                }
            }
            else {
                next.push(spriteId);
            }
        }
        this.buttonSpriteIds = next;
    }
    /**
     * EVENT HANDLER: Paddle button pressed
     */
    onEvent_pong_paddlePress(eventData) {
        if (!playerManager.isHost)
            return;
        this.onButtonPress(eventData.playerId, eventData.direction);
    }
    /**
     * EVENT HANDLER: Paddle button released (not used in toggle mode)
     */
    onEvent_pong_paddleRelease(eventData) {
        // Not used in toggle mode
    }
    /**
     * Flash paddle with white color briefly
     */
    flashPaddle(paddleId) {
        if (!playerManager.isHost)
            return;
        const sprite = spriteManager.getSprite(paddleId);
        if (!sprite)
            return;
        const originalColor = spriteManager.getProperty(paddleId, 'fill');
        // Flash white
        spriteManager.updateSprite(paddleId, {
            fill: '#FFFFFF',
        });
        // Return to original color after 100ms
        setTimeout(() => {
            spriteManager.updateSprite(paddleId, {
                fill: originalColor,
            });
        }, 100);
    }
    /**
     * Flash all control buttons to draw player attention (used at Round 2 start)
     * Uses timerManager.animate() for performance-friendly animation
     */
    flashControlButtons() {
        if (!playerManager.isHost)
            return;
        console.log('[PongPM] Highlighting control buttons to draw attention');
        // Don't start if already flashing
        if (this.buttonFlashActive) {
            console.log('[PongPM] Button flash already active, skipping');
            return;
        }
        // Find all button sprites (btn_left_* and btn_right_*)
        const buttonRects = [];
        let idx = 0;
        while (idx < this.buttonSpriteIds.length) {
            const spriteId = this.buttonSpriteIds[idx];
            if (spriteId && spriteId.indexOf('btn_') === 0) {
                const sprite = spriteManager.getSprite(spriteId);
                if (sprite) {
                    buttonRects.push(sprite);
                }
            }
            idx++;
        }
        if (buttonRects.length === 0) {
            console.log('[PongPM] No buttons found to flash');
            return;
        }
        this.buttonFlashActive = true;
        const self = this;
        // Use timerManager.animate() for performance-friendly animation
        // Animation duration: 3 seconds with pulsing opacity
        timerManager.animate({
            targets: buttonRects,
            keyframes: {
                0: { opacity: 0.5 },
                10: { opacity: 1 },
                20: { opacity: 0.5 },
                30: { opacity: 1 },
                40: { opacity: 0.5 },
                50: { opacity: 1 },
                60: { opacity: 0.5 },
                70: { opacity: 1 },
                80: { opacity: 0.5 },
                90: { opacity: 1 },
                100: { opacity: 0.5 },
            },
            duration: 3000,
            loop: false,
            alternate: false,
            playbackEase: 'linear',
            onComplete: function () {
                self.buttonFlashActive = false;
                console.log('[PongPM] Button flash animation complete');
            },
        });
        console.log('[PongPM] Button flash animation started (' +
            buttonRects.length +
            ' buttons)');
    }
    /**
     * Stop the button flashing animation and reset to normal colors
     */
    stopButtonFlash() {
        if (!this.buttonFlashActive)
            return;
        console.log('[PongPM] Stopping button flash animation');
        this.buttonFlashActive = false;
        // Reset buttons to normal opacity
        let idx = 0;
        while (idx < this.buttonSpriteIds.length) {
            const spriteId = this.buttonSpriteIds[idx];
            if (spriteId && spriteId.indexOf('btn_') === 0) {
                if (spriteManager.getSprite(spriteId)) {
                    spriteManager.updateSprite(spriteId, {
                        opacity: 0.5,
                    });
                }
            }
            idx++;
        }
    }
    /**
     * Update all paddle border colors based on background brightness
     * @param backgroundColor - current play area background color (e.g., '#1A1A1A')
     */
    updatePaddleBorderColors(backgroundColor) {
        if (!playerManager.isHost)
            return;
        // Determine border color based on background brightness
        // Dark backgrounds (common) get white borders, light backgrounds get black borders
        const bgBrightness = this.getColorBrightness(backgroundColor);
        const borderColor = bgBrightness < 128 ? '#FFFFFF' : '#000000';
        // Update all paddle border sprites
        let idx = 0;
        while (idx < this.paddleSpriteIds.length) {
            const spriteId = this.paddleSpriteIds[idx];
            if (spriteId && spriteId.indexOf('paddle_border_') === 0) {
                if (spriteManager.getSprite(spriteId)) {
                    spriteManager.updateSprite(spriteId, {
                        fill: borderColor,
                    });
                }
            }
            idx++;
        }
    }
    /**
     * Calculate brightness of a hex color (0-255)
     */
    getColorBrightness(hexColor) {
        // Remove # if present
        const hex = hexColor.replace('#', '');
        // Parse RGB values
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        // Calculate perceived brightness using standard formula
        return (r * 299 + g * 587 + b * 114) / 1000;
    }
}
