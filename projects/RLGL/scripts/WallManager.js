"use strict";
class WallManager extends SystemScript {
    wallSprites;
    worldWidth;
    worldHeight;
    playingFieldTop;
    playingFieldBottom;
    gridColumns;
    gridRows;
    cellWidth;
    cellHeight;
    obstacleSprite1;
    obstacleSprite2;
    obstacleSprite3;
    obstacleColliderSprite1;
    obstacleColliderSprite2;
    obstacleColliderSprite3;
    obstacleWidth1;
    obstacleWidth2;
    obstacleWidth3;
    emptyMazeRow;
    mazeLayout;
    obstacleGenerationType;
    colliderYOffset;
    endOfRowWideObstacleShiftX;
    randomLayoutRound;
    constructor() {
        if (!playerManager.isHost)
            return;
        this.wallSprites = [];
        this.worldWidth = 1500;
        this.worldHeight = 1500;
        this.playingFieldTop = 50;
        this.playingFieldBottom = 1250;
        this.gridColumns = 20;
        this.gridRows = 20;
        this.cellWidth = this.worldWidth / this.gridColumns;
        this.cellHeight = (this.playingFieldBottom - this.playingFieldTop) / this.gridRows;
        this.obstacleSprite1 = "obstacleWall1";
        this.obstacleSprite2 = "obstacleWall2";
        this.obstacleSprite3 = "obstacleWall3";
        this.obstacleColliderSprite1 = "obstacleWallCollider1";
        this.obstacleColliderSprite2 = "obstacleWallCollider2";
        this.obstacleColliderSprite3 = "obstacleWallCollider3";
        this.obstacleWidth1 = 78;
        this.obstacleWidth2 = 133;
        this.obstacleWidth3 = 134;
        this.emptyMazeRow = "                    ";
        this.obstacleGenerationType = "set";
        this.colliderYOffset = 50;
        this.endOfRowWideObstacleShiftX = 60;
        this.randomLayoutRound = 0;
        this.mazeLayout = [];
    }
    onInit() {
        this.mazeLayout = this.getSetMazeLayout();
    }
    spawnWalls(obstacleGenerationType = "set") {
        this.obstacleGenerationType = obstacleGenerationType === "random" ? "random" : "set";
        this.clearWalls();
        if (this.obstacleGenerationType === "random") {
            this.spawnRandomWalls();
            return;
        }
        this.mazeLayout = this.getSetMazeLayout();
        this.spawnSetWalls();
    }
    spawnSetWalls() {
        for (let row = 0; row < this.mazeLayout.length; row++) {
            const rowString = this.mazeLayout[row];
            let col = 0;
            while (col < rowString.length && col < this.gridColumns) {
                const layoutCharacter = rowString[col];
                const obstacleSpriteKey = this.getObstacleSpriteKey(layoutCharacter);
                const obstacleColliderSpriteKey = this.getObstacleColliderSpriteKey(layoutCharacter);
                if (!obstacleSpriteKey || !obstacleColliderSpriteKey) {
                    col++;
                    continue;
                }
                let runLength = 1;
                while (col + runLength < rowString.length &&
                    col + runLength < this.gridColumns &&
                    rowString[col + runLength] === layoutCharacter) {
                    runLength++;
                }
                const isEndOfRowRun = col + runLength === this.gridColumns;
                const positionY = this.playingFieldTop + row * this.cellHeight;
                const shouldMergeCollider = this.shouldMergeColliderRun(layoutCharacter, runLength);
                const shouldShiftEndOfRow = isEndOfRowRun && this.shouldShiftEndOfRowObstacle(layoutCharacter);
                let baseColliderPositionX = col * this.cellWidth;
                let baseColliderWidth = this.getRunColliderWidth(layoutCharacter, runLength, shouldMergeCollider);
                if (shouldShiftEndOfRow) {
                    if (runLength === 1) {
                        baseColliderPositionX -= this.endOfRowWideObstacleShiftX;
                    }
                    else {
                        baseColliderWidth -= this.endOfRowWideObstacleShiftX;
                    }
                }
                const runVariation = this.getRunVariation(baseColliderPositionX, baseColliderWidth, runLength);
                for (let runOffset = 0; runOffset < runLength; runOffset++) {
                    const spriteCol = col + runOffset;
                    let spritePositionX = spriteCol * this.cellWidth;
                    if (shouldShiftEndOfRow && runOffset === runLength - 1) {
                        spritePositionX -= this.endOfRowWideObstacleShiftX;
                    }
                    spritePositionX += runVariation.wholeShiftX;
                    if (runOffset === 0) {
                        spritePositionX += runVariation.leftEdgeShiftX;
                    }
                    if (runOffset === runLength - 1) {
                        spritePositionX += runVariation.rightEdgeShiftX;
                    }
                    const wallSprite = spriteManager.addSprite(obstacleSpriteKey, {
                        uniqueId: `wall_${row}_${spriteCol}`,
                        positionX: spritePositionX,
                        positionY: positionY,
                        checkCollisions: false,
                    });
                    if (wallSprite) {
                        this.wallSprites.push(wallSprite);
                    }
                }
                // only merge runs of the same letter
                const colliderOptions = {
                    uniqueId: `wallCollider_${row}_${col}`,
                    positionX: baseColliderPositionX + runVariation.wholeShiftX + runVariation.leftEdgeShiftX,
                    positionY: positionY + this.colliderYOffset,
                    checkCollisions: true,
                    isImpassable: true,
                    opacity: 0,
                    fill: this.getRandomDebugColor(),
                    //height: 100,
                };
                if (shouldMergeCollider) {
                    colliderOptions.width = baseColliderWidth + runVariation.rightEdgeShiftX - runVariation.leftEdgeShiftX;
                }
                const wallColliderSprite = spriteManager.addSprite(obstacleColliderSpriteKey, colliderOptions);
                if (wallColliderSprite) {
                    this.wallSprites.push(wallColliderSprite);
                }
                else {
                    console.log("[RLGL] Failed to create obstacle collider sprite", obstacleColliderSpriteKey, "at row", row, "col", col);
                }
                col += runLength;
            }
        }
    }
    getObstacleSpriteKey(layoutCharacter) {
        if (layoutCharacter === "W")
            return this.obstacleSprite1;
        if (layoutCharacter === "A")
            return this.obstacleSprite2;
        if (layoutCharacter === "S")
            return this.obstacleSprite3;
        return null;
    }
    getObstacleColliderSpriteKey(layoutCharacter) {
        if (layoutCharacter === "W")
            return this.obstacleColliderSprite1;
        if (layoutCharacter === "A")
            return this.obstacleColliderSprite2;
        if (layoutCharacter === "S")
            return this.obstacleColliderSprite3;
        return null;
    }
    getObstacleWidth(layoutCharacter) {
        if (layoutCharacter === "W")
            return this.obstacleWidth1;
        if (layoutCharacter === "A")
            return this.obstacleWidth2;
        return this.obstacleWidth3;
    }
    getMergedColliderWidth(layoutCharacter, runLength) {
        const obstacleWidth = this.getObstacleWidth(layoutCharacter);
        return obstacleWidth + this.cellWidth * (runLength - 1);
    }
    getRunColliderWidth(layoutCharacter, runLength, shouldMergeCollider) {
        if (shouldMergeCollider) {
            return this.getMergedColliderWidth(layoutCharacter, runLength);
        }
        return this.getObstacleWidth(layoutCharacter);
    }
    shouldMergeColliderRun(layoutCharacter, runLength) {
        return runLength > 1 && this.getObstacleWidth(layoutCharacter) > this.cellWidth;
    }
    shouldShiftEndOfRowObstacle(layoutCharacter) {
        return this.getObstacleWidth(layoutCharacter) >= 130;
    }
    getRunVariation(basePositionX, baseWidth, runLength) {
        const variation = {
            wholeShiftX: 0,
            leftEdgeShiftX: 0,
            rightEdgeShiftX: 0,
        };
        if (this.obstacleGenerationType !== "random") {
            return variation;
        }
        if (runLength <= 1) {
            variation.wholeShiftX = this.getWholeRunShiftX(basePositionX, baseWidth);
            return variation;
        }
        const variationMode = this.getRandomInteger(0, 2);
        if (variationMode === 0) {
            variation.wholeShiftX = this.getWholeRunShiftX(basePositionX, baseWidth);
            return variation;
        }
        if (variationMode === 1) {
            if (this.getRandomInteger(0, 1) === 0) {
                variation.leftEdgeShiftX = this.getLeftEdgeShiftX(basePositionX, baseWidth);
            }
            else {
                variation.rightEdgeShiftX = this.getRightEdgeShiftX(basePositionX, baseWidth);
            }
            return variation;
        }
        variation.leftEdgeShiftX = this.getLeftEdgeShiftX(basePositionX, baseWidth);
        variation.rightEdgeShiftX = this.getRightEdgeShiftX(basePositionX, baseWidth);
        return variation;
    }
    getWholeRunShiftX(basePositionX, baseWidth) {
        const maxShift = 10;
        const availableLeft = this.getAvailableLeftShift(basePositionX, maxShift);
        const availableRight = this.getAvailableRightShift(basePositionX, baseWidth, maxShift);
        if (availableLeft <= 0 && availableRight <= 0)
            return 0;
        if (availableLeft <= 0)
            return this.getRandomInteger(1, availableRight);
        if (availableRight <= 0)
            return -this.getRandomInteger(1, availableLeft);
        if (this.getRandomInteger(0, 1) === 0)
            return -this.getRandomInteger(1, availableLeft);
        return this.getRandomInteger(1, availableRight);
    }
    getLeftEdgeShiftX(basePositionX, baseWidth) {
        const maxShift = 10;
        const availableLeft = this.getAvailableLeftShift(basePositionX, maxShift);
        const maximumInset = this.getMaximumInsetShift(baseWidth, maxShift);
        if (availableLeft <= 0 && maximumInset <= 0)
            return 0;
        if (availableLeft <= 0)
            return this.getRandomInteger(1, maximumInset);
        if (maximumInset <= 0)
            return -this.getRandomInteger(1, availableLeft);
        if (this.getRandomInteger(0, 1) === 0)
            return -this.getRandomInteger(1, availableLeft);
        return this.getRandomInteger(1, maximumInset);
    }
    getRightEdgeShiftX(basePositionX, baseWidth) {
        const maxShift = 10;
        const availableRight = this.getAvailableRightShift(basePositionX, baseWidth, maxShift);
        const maximumInset = this.getMaximumInsetShift(baseWidth, maxShift);
        if (availableRight <= 0 && maximumInset <= 0)
            return 0;
        if (availableRight <= 0)
            return -this.getRandomInteger(1, maximumInset);
        if (maximumInset <= 0)
            return this.getRandomInteger(1, availableRight);
        if (this.getRandomInteger(0, 1) === 0)
            return -this.getRandomInteger(1, maximumInset);
        return this.getRandomInteger(1, availableRight);
    }
    getAvailableLeftShift(basePositionX, maxShift) {
        if (basePositionX <= 0)
            return 0;
        if (basePositionX < maxShift)
            return Math.floor(basePositionX);
        return maxShift;
    }
    getAvailableRightShift(basePositionX, baseWidth, maxShift) {
        const availableRight = this.worldWidth - (basePositionX + baseWidth);
        if (availableRight <= 0)
            return 0;
        if (availableRight < maxShift)
            return Math.floor(availableRight);
        return maxShift;
    }
    getMaximumInsetShift(baseWidth, maxShift) {
        const availableInset = baseWidth - this.cellWidth;
        if (availableInset <= 0)
            return 0;
        if (availableInset < maxShift)
            return Math.floor(availableInset);
        return maxShift;
    }
    getRandomDebugColor() {
        const debugColors = ["#ff4d4d", "#4dd2ff", "#ffd24d", "#66ff66", "#ff66d9", "#ff944d", "#b84dff", "#4dffb8"];
        const randomIndex = Math.floor(Math.random() * debugColors.length);
        return debugColors[randomIndex];
    }
    spawnRandomWalls() {
        this.mazeLayout = this.generateRandomMazeLayout();
        this.spawnSetWalls();
    }
    generateRandomMazeLayout() {
        const mazeLayout = [];
        for (let row = 0; row < this.gridRows; row++) {
            if (row < 2 || row === this.gridRows - 1) {
                mazeLayout.push(this.emptyMazeRow);
                continue;
            }
            mazeLayout.push(this.buildRandomMazeRow());
        }
        return mazeLayout;
    }
    buildRandomMazeRow() {
        let rowString = "";
        let currentColumn = 0;
        let placingWalls = Math.random() < 0.5;
        while (currentColumn < this.gridColumns) {
            let segmentLength = placingWalls ? this.getRandomInteger(2, 6) : this.getRandomInteger(4, 7);
            const remainingColumns = this.gridColumns - currentColumn;
            if (segmentLength > remainingColumns) {
                segmentLength = remainingColumns;
            }
            if (placingWalls) {
                const obstacleCharacter = this.getRandomObstacleCharacter();
                rowString += this.buildRepeatedCharacter(obstacleCharacter, segmentLength);
            }
            else {
                rowString += this.buildRepeatedCharacter(" ", segmentLength);
            }
            currentColumn += segmentLength;
            placingWalls = !placingWalls;
        }
        return rowString;
    }
    getRandomObstacleCharacter() {
        const obstacleIndex = this.getRandomInteger(0, 2);
        if (obstacleIndex === 0)
            return "W";
        if (obstacleIndex === 1)
            return "A";
        return "S";
    }
    buildRepeatedCharacter(character, count) {
        let result = "";
        for (let i = 0; i < count; i++) {
            result += character;
        }
        return result;
    }
    getRandomInteger(minValue, maxValue) {
        return minValue + Math.floor(Math.random() * (maxValue - minValue + 1));
    }
    getSetMazeLayout() {
        const mazes = [
            [
                "                    ",
                "                    ",
                "                    ",
                "    WWW             ",
                "                 WW ",
                "                    ",
                "         WWWWWWW    ",
                "                    ",
                "  AA                ",
                "                AA  ",
                "                    ",
                "      WWWWWWWWW     ",
                "                    ",
                "                    ",
                "                  AA",
                "     AAA            ",
                "                    ",
                "                    ",
                "                    ",
                "                    ",
            ],
            [
                "                    ",
                "                    ",
                "                    ",
                "     WWWWW          ",
                "                    ",
                "WWWW                ",
                "        WWW   WW    ",
                "                    ",
                "  AAAA              ",
                "                AA  ",
                "                    ",
                "         WWWWWW     ",
                "                    ",
                "                    ",
                "     AAAA       AA  ",
                "                    ",
                "                    ",
                "                    ",
                "                    ",
                "                    ",
            ],
            [
                "                    ",
                "                    ",
                "                    ",
                "                    ",
                "AA     AA           ",
                "                    ",
                "        WWWWWWWW    ",
                "                    ",
                "                    ",
                "    WWWWW           ",
                "                    ",
                "                    ",
                "           AAAA     ",
                "                    ",
                "     AAA          AA",
                "                    ",
                "          WWWWW     ",
                "                    ",
                "                    ",
                "                    ",
            ]
        ];
        const randomIndex = Math.floor(Math.random() * mazes.length);
        const randomChoice = mazes[randomIndex];
        return randomChoice;
    }
    clearWalls() {
        for (let i = 0; i < this.wallSprites.length; i++) {
            const wall = this.wallSprites[i];
            if (wall && wall.uniqueId) {
                spriteManager.removeSprite(wall.uniqueId);
            }
        }
        this.wallSprites = [];
    }
    getWallCount() {
        return this.wallSprites.length;
    }
}
