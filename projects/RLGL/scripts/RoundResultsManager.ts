class RoundResultsManager extends SystemScript {
  finishOrder: number[];
  maxFinishers: number;
  worldWidth: number;
  worldHeight: number;
  selectionSummarySprite: PseudoSprite | null;
  selectionSummaryBackgroundSprite: PseudoSprite | null;
  selectionArrowSprite: PseudoSprite | null;
  selectionArrowBackgroundSprite: PseudoSprite | null;
  selectionArrowAnimation: PseudoAnimation | null;
  selectionAnimationToken: number;
  selectionNameSprites: PseudoSprite[];
  selectionNameBackgroundSprites: PseudoSprite[];
  selectionCandidateIds: number[];
  selectionCandidateCenterXs: number[];
  selectedLeaderId: number;
  selectionActive: boolean;
  selectionComplete: boolean;
  selectionCompleteAtMs: number;
  selectionElapsedMs: number;
  selectionCurrentPathIndex: number;
  selectionPathIndices: number[];
  selectionSummaryY: number;
  selectionArrowY: number;
  selectionNameY: number;
  selectionNameContainerWidth: number;
  selectionArrowContainerWidth: number;
  selectionSpinDurationMs: number;
  selectionLoopDurationMs: number;
  selectionResultDisplayDurationMs: number;
  selectionEasePower: number;
  selectionEasePowerWeight: number;

  constructor() {}

  onInit() {
    if (!playerManager.isHost) return;

    this.finishOrder = [];
    this.maxFinishers = 3;
    this.worldWidth = 1500;
    this.worldHeight = 1500;
    this.selectionSummarySprite = null;
    this.selectionSummaryBackgroundSprite = null;
    this.selectionArrowSprite = null;
    this.selectionArrowBackgroundSprite = null;
    this.selectionArrowAnimation = null;
    this.selectionAnimationToken = 0;
    this.selectionNameSprites = [];
    this.selectionNameBackgroundSprites = [];
    this.selectionCandidateIds = [];
    this.selectionCandidateCenterXs = [];
    this.selectedLeaderId = 0;
    this.selectionActive = false;
    this.selectionComplete = false;
    this.selectionCompleteAtMs = 0;
    this.selectionElapsedMs = 0;
    this.selectionCurrentPathIndex = 0;
    this.selectionPathIndices = [];
    this.selectionSummaryY = 170;
    this.selectionNameY = this.worldHeight / 2;
    this.selectionArrowY = this.selectionNameY - 100;
    this.selectionNameContainerWidth = 280;
    this.selectionArrowContainerWidth = 300;
    this.selectionSpinDurationMs = 9000;
    this.selectionLoopDurationMs = 100;
    this.selectionResultDisplayDurationMs = 4000;
    this.selectionEasePower = 8;
    this.selectionEasePowerWeight = 0.5;
  }

  onPlayerLeft({ playerId }) {
    if (!playerManager.isHost) return;
    this.removeFinisher(playerId);
  }

  startRound() {
    if (!playerManager.isHost) return;

    this.stopLeaderSelectionAnimation();
    this.hideLeaderSelectionSprites();
    this.finishOrder = [];
    this.clearLeaderSelection();
  }

  resetRoundResults() {
    if (!playerManager.isHost) return;

    this.stopLeaderSelectionAnimation();
    this.hideLeaderSelectionSprites();
    this.finishOrder = [];
    this.clearLeaderSelection();
  }

  isPlayerFinisher(playerId: number): boolean {
    for (let i = 0; i < this.finishOrder.length; i++) {
      if (this.finishOrder[i] === playerId) return true;
    }

    return false;
  }

  recordFinisher(playerId: number): number {
    if (!playerManager.isHost) return 0;
    if (!playerId) return 0;
    if (this.isPlayerFinisher(playerId)) return 0;

    this.finishOrder.push(playerId);
    return this.finishOrder.length;
  }

  removeFinisher(playerId: number) {
    if (!playerId) return;

    for (let i = 0; i < this.finishOrder.length; i++) {
      if (this.finishOrder[i] !== playerId) continue;
      this.finishOrder.splice(i, 1);
      return;
    }
  }

  getFinishOrder(): number[] {
    const finishOrderCopy: number[] = [];

    for (let i = 0; i < this.finishOrder.length; i++) {
      finishOrderCopy.push(this.finishOrder[i]);
    }

    return finishOrderCopy;
  }

  getFinisherCount(): number {
    return this.finishOrder.length;
  }

  buildNextLeaderCandidateIds(currentLeaderId: number): number[] {
    const candidateIds: number[] = [];
    const finishOrder = this.getFinishOrder();

    if (finishOrder.length === 0) return candidateIds;

    if (finishOrder.length === 1) {
      if (this.isPlayerConnected(finishOrder[0])) {
        candidateIds.push(finishOrder[0]);
      }

      if (currentLeaderId && currentLeaderId !== finishOrder[0] && this.isPlayerConnected(currentLeaderId)) {
        candidateIds.push(currentLeaderId);
      }

      return candidateIds;
    }

    const maxCandidateCount = finishOrder.length < this.maxFinishers ? finishOrder.length : this.maxFinishers;

    for (let i = 0; i < maxCandidateCount; i++) {
      const candidateId = finishOrder[i];
      if (!this.isPlayerConnected(candidateId)) continue;
      if (this.containsPlayerId(candidateIds, candidateId)) continue;
      candidateIds.push(candidateId);
    }

    return candidateIds;
  }

  beginLeaderSelection(candidateIds: number[]): number {
    if (!playerManager.isHost) return 0;

    this.clearLeaderSelection();
    this.selectionEasePowerWeight = this.getRandomSelectionEasePowerWeight();
    this.selectionCandidateIds = this.getUniqueConnectedCandidateIds(candidateIds);

    if (this.selectionCandidateIds.length === 0) {
      this.selectionComplete = true;
      this.selectionCompleteAtMs = 0;
      this.selectedLeaderId = 0;
      return 0;
    }

    this.selectedLeaderId = this.selectionCandidateIds[Math.floor(Math.random() * this.selectionCandidateIds.length)];

    this.createLeaderSelectionSprites();

    if (this.selectionCandidateIds.length === 1) {
      this.placeArrowAtCandidateIndex(0);
      this.markSelectionComplete();
      return this.selectedLeaderId;
    }

    this.selectionPathIndices = this.buildSelectionPathIndices(
      this.selectionCandidateIds.length,
      this.getSelectedCandidateIndex(),
    );
    this.selectionActive = true;
    this.selectionComplete = false;
    this.selectionElapsedMs = 0;
    this.selectionCurrentPathIndex = 0;

    this.placeArrowAtCandidateIndex(this.selectionPathIndices[0]);
    this.startLeaderSelectionAnimation();

    return this.selectedLeaderId;
  }

  beginWinnerSummaryDisplay() {
    if (!playerManager.isHost) return;

    this.clearLeaderSelection();
    this.createWinnerSummarySprite();
    this.selectionActive = false;
    this.selectionComplete = true;
    this.selectionCompleteAtMs = Date.now();
    this.selectionElapsedMs = 0;
    this.selectionCurrentPathIndex = 0;
    this.selectionPathIndices = [];
    this.selectedLeaderId = 0;
  }

  isLeaderSelectionComplete(): boolean {
    return this.selectionComplete;
  }

  isLeaderSelectionReadyToAdvance(): boolean {
    if (!this.selectionComplete) return false;
    if (!this.selectionCompleteAtMs) return true;

    return Date.now() - this.selectionCompleteAtMs >= this.selectionResultDisplayDurationMs;
  }

  getSelectedLeaderId(): number {
    return this.selectedLeaderId;
  }

  clearLeaderSelection() {
    if (!playerManager.isHost) return;

    this.stopLeaderSelectionAnimation();
    this.hideLeaderSelectionSprites();

    if (this.selectionSummarySprite) {
      spriteManager.removeSprite(this.selectionSummarySprite.uniqueId);
      this.selectionSummarySprite = null;
    }
    this.removeLeaderSelectionSpriteByUniqueId("roundWinnersSummary");
    if (this.selectionSummaryBackgroundSprite) {
      spriteManager.removeSprite(this.selectionSummaryBackgroundSprite.uniqueId);
      this.selectionSummaryBackgroundSprite = null;
    }
    this.removeLeaderSelectionSpriteByUniqueId("roundWinnersSummaryBackground");

    if (this.selectionArrowSprite) {
      spriteManager.removeSprite(this.selectionArrowSprite.uniqueId);
      this.selectionArrowSprite = null;
    }
    this.removeLeaderSelectionSpriteByUniqueId("nextLightLeaderArrow");
    if (this.selectionArrowBackgroundSprite) {
      spriteManager.removeSprite(this.selectionArrowBackgroundSprite.uniqueId);
      this.selectionArrowBackgroundSprite = null;
    }
    this.removeLeaderSelectionSpriteByUniqueId("nextLightLeaderArrowBackground");

    for (let i = 0; i < this.selectionNameSprites.length; i++) {
      if (!this.selectionNameSprites[i]) continue;
      spriteManager.removeSprite(this.selectionNameSprites[i].uniqueId);
    }

    for (let i = 0; i < this.selectionNameBackgroundSprites.length; i++) {
      if (!this.selectionNameBackgroundSprites[i]) continue;
      spriteManager.removeSprite(this.selectionNameBackgroundSprites[i].uniqueId);
    }

    for (let i = 0; i < this.maxFinishers; i++) {
      this.removeLeaderSelectionSpriteByUniqueId("roundLeaderCandidateName_" + i.toString());
      this.removeLeaderSelectionSpriteByUniqueId("roundLeaderCandidateNameBackground_" + i.toString());
    }

    this.selectionNameSprites = [];
    this.selectionNameBackgroundSprites = [];
    this.selectionCandidateIds = [];
    this.selectionCandidateCenterXs = [];
    this.selectionPathIndices = [];
    this.selectionActive = false;
    this.selectionComplete = false;
    this.selectionCompleteAtMs = 0;
    this.selectionElapsedMs = 0;
    this.selectionCurrentPathIndex = 0;
    this.selectedLeaderId = 0;
  }

  startLeaderSelectionAnimation() {
    if (!playerManager.isHost) return;
    if (!this.selectionArrowSprite) {
      this.markSelectionComplete();
      return;
    }
    if (this.selectionPathIndices.length === 0) {
      this.markSelectionComplete();
      return;
    }

    this.stopLeaderSelectionAnimation();
    this.selectionAnimationToken += 1;
    const selectionAnimationToken = this.selectionAnimationToken;

    this.selectionArrowAnimation = timerManager.animate({
      targets: [this.selectionArrowSprite],
      keyframes: {
        0: { topAdjust: "+=1" },
        100: { topAdjust: "+=-1" },
      },
      duration: this.selectionLoopDurationMs,
      loop: true,
      alternate: false,
      playbackEase: "Linear",
      onBegin: () => {
        if (this.selectionAnimationToken !== selectionAnimationToken) return;
        this.selectionElapsedMs = 0;
        this.selectionCurrentPathIndex = 0;
        this.placeArrowAtCandidateIndex(this.selectionPathIndices[0]);
      },
      onLoop: () => {
        if (!playerManager.isHost) return;
        if (this.selectionAnimationToken !== selectionAnimationToken) return;
        this.runLeaderSelectionAnimationStep();
      },
    });
  }

  stopLeaderSelectionAnimation() {
    this.selectionAnimationToken += 1;

    if (!this.selectionArrowAnimation) return;

    this.selectionArrowAnimation.pause();
    this.selectionArrowAnimation.destroy();
    this.selectionArrowAnimation = null;
  }

  runLeaderSelectionAnimationStep() {
    if (!this.selectionActive) return;
    if (!this.selectionArrowSprite) {
      this.stopLeaderSelectionAnimation();
      this.markSelectionComplete();
      return;
    }
    if (this.selectionPathIndices.length === 0) {
      this.stopLeaderSelectionAnimation();
      this.markSelectionComplete();
      return;
    }

    this.selectionElapsedMs += this.selectionLoopDurationMs;

    const rawProgress = this.clamp01(this.selectionElapsedMs / this.selectionSpinDurationMs);
    const nextPathIndex = this.getSelectionPathIndexFromProgress(rawProgress, this.selectionPathIndices.length);

    if (nextPathIndex !== this.selectionCurrentPathIndex) {
      this.selectionCurrentPathIndex = nextPathIndex;
      this.placeArrowAtCandidateIndex(this.selectionPathIndices[nextPathIndex]);
    }

    if (rawProgress >= 1) {
      this.placeArrowAtCandidateIndex(this.getSelectedCandidateIndex());
      this.markSelectionComplete();
      this.stopLeaderSelectionAnimation();
    }
  }

  hideLeaderSelectionSprites() {
    if (!playerManager.isHost) return;

    this.hideLeaderSelectionSpriteByUniqueId("roundWinnersSummary");
    this.hideLeaderSelectionSpriteByUniqueId("nextLightLeaderArrow");

    for (let i = 0; i < this.maxFinishers; i++) {
      this.hideLeaderSelectionSpriteByUniqueId("roundLeaderCandidateName_" + i.toString());
    }
  }

  hideLeaderSelectionSpriteByUniqueId(uniqueId: string) {
    if (!spriteManager.getSprite(uniqueId)) return;

    spriteManager.updateSprite(uniqueId, {
      opacity: 0,
    });
  }

  removeLeaderSelectionSpriteByUniqueId(uniqueId: string) {
    if (!spriteManager.getSprite(uniqueId)) return;

    spriteManager.removeSprite(uniqueId);
  }

  createLeaderSelectionSprites() {
    if (!playerManager.isHost) return;

    this.createWinnerSummarySprite();

    this.selectionCandidateCenterXs = [];
    this.selectionNameSprites = [];
    this.selectionNameBackgroundSprites = [];

    for (let i = 0; i < this.selectionCandidateIds.length; i++) {
      const centerX = this.getCandidateCenterX(i, this.selectionCandidateIds.length);
      const candidateName = this.getPlayerName(this.selectionCandidateIds[i]);
      const candidateNamePositionX = this.getCenteredSpritePositionX(centerX, this.selectionNameContainerWidth);
      let candidateNameBackgroundWidth = candidateName.length * 38 * 0.63 + 40;
      if (candidateNameBackgroundWidth > this.selectionNameContainerWidth) {
        candidateNameBackgroundWidth = this.selectionNameContainerWidth;
      }
      const candidateNameBackgroundSprite = spriteManager.addSprite("baseRect", {
        uniqueId: "roundLeaderCandidateNameBackground_" + i.toString(),
        positionX: centerX - candidateNameBackgroundWidth / 2,
        positionY: this.selectionNameY - 8,
        width: candidateNameBackgroundWidth,
        height: 58,
        fill: "rgba(18, 22, 14, 1)",
        borderRadius: 16,
        topAdjust: 1000,
      });
      const candidateNameSprite = spriteManager.addSprite("countdownText", {
        uniqueId: "roundLeaderCandidateName_" + i.toString(),
        positionX: candidateNamePositionX,
        positionY: this.selectionNameY,
        text: candidateName,
        fontSize: 38,
        align: "center",
        containerWidth: this.selectionNameContainerWidth,
        strokeColor: "#000000",
        topAdjust: 2000,
      });

      this.selectionCandidateCenterXs.push(centerX);
      if (candidateNameBackgroundSprite) {
        this.selectionNameBackgroundSprites.push(candidateNameBackgroundSprite);
      }
      if (candidateNameSprite) {
        this.selectionNameSprites.push(candidateNameSprite);
      }
    }

    const initialArrowCenterX =
      this.selectionCandidateCenterXs.length > 0 ? this.selectionCandidateCenterXs[0] : this.worldWidth / 2;
    const initialArrowPositionX = this.getCenteredSpritePositionX(initialArrowCenterX, this.selectionArrowContainerWidth);

    this.selectionArrowBackgroundSprite = spriteManager.addSprite("baseRect", {
      uniqueId: "nextLightLeaderArrowBackground",
      positionX: initialArrowPositionX,
      positionY: this.selectionArrowY - 6,
      width: this.selectionArrowContainerWidth,
      height: 50,
      fill: "rgba(18, 22, 14, 1)",
      borderRadius: 14,
      topAdjust: 1000,
    });

    this.selectionArrowSprite = spriteManager.addSprite("countdownText", {
      uniqueId: "nextLightLeaderArrow",
      positionX: initialArrowPositionX,
      positionY: this.selectionArrowY,
      text: "Next Light Leader v",
      fontSize: 30,
      align: "center",
      containerWidth: this.selectionArrowContainerWidth,
      strokeColor: "#000000",
      topAdjust: 2000,
    });
  }

  createWinnerSummarySprite() {
    if (!playerManager.isHost) return;

    const winnerSummaryText = this.buildWinnerSummaryText();
    const winnerSummaryBackgroundDimensions = this.getTextBackgroundDimensions(winnerSummaryText, 42, 30, 10);

    this.selectionSummaryBackgroundSprite = spriteManager.addSprite("baseRect", {
      uniqueId: "roundWinnersSummaryBackground",
      positionX: (this.worldWidth - winnerSummaryBackgroundDimensions.width) / 2,
      positionY: this.selectionSummaryY - 10,
      width: winnerSummaryBackgroundDimensions.width,
      height: winnerSummaryBackgroundDimensions.height,
      fill: "rgba(18, 22, 14, 1)",
      borderRadius: 18,
      topAdjust: 1000,
    });

    this.selectionSummarySprite = spriteManager.addSprite("countdownText", {
      uniqueId: "roundWinnersSummary",
      positionX: 0,
      positionY: this.selectionSummaryY,
      text: winnerSummaryText,
      fontSize: 42,
      align: "center",
      containerWidth: this.worldWidth,
      strokeColor: "#000000",
      strokeThickness: 6,
      topAdjust: 2000,
    });
  }

  buildWinnerSummaryText(): string {
    const finishOrder = this.getFinishOrder();

    if (finishOrder.length === 0) {
      return "Round Complete";
    }

    const summaryLines: string[] = [];
    summaryLines.push(finishOrder.length === 1 ? "Round Winner" : "Round Winners");

    for (let i = 0; i < finishOrder.length && i < this.maxFinishers; i++) {
      summaryLines.push(this.getPlacementLabel(i + 1) + ": " + this.getPlayerName(finishOrder[i]));
    }

    return summaryLines.join("\n");
  }

  buildSelectionPathIndices(candidateCount: number, targetIndex: number): number[] {
    const pathIndices: number[] = [0];

    if (candidateCount <= 1) return pathIndices;

    let currentIndex = 0;
    const warmupHops = candidateCount === 2 ? 6 : 8;

    for (let i = 0; i < warmupHops; i++) {
      currentIndex = (currentIndex + 1) % candidateCount;
      pathIndices.push(currentIndex);
    }

    while (currentIndex !== targetIndex) {
      currentIndex = (currentIndex + 1) % candidateCount;
      pathIndices.push(currentIndex);
    }

    return pathIndices;
  }

  getSelectedCandidateIndex(): number {
    for (let i = 0; i < this.selectionCandidateIds.length; i++) {
      if (this.selectionCandidateIds[i] === this.selectedLeaderId) return i;
    }

    return 0;
  }

  placeArrowAtCandidateIndex(candidateIndex: number) {
    if (!this.selectionArrowSprite) return;
    if (candidateIndex < 0 || candidateIndex >= this.selectionCandidateCenterXs.length) return;

    this.updateArrowCenterX(this.selectionCandidateCenterXs[candidateIndex]);
  }

  updateArrowCenterX(centerX: number) {
    if (!this.selectionArrowSprite) return;

    const positionX = this.getCenteredSpritePositionX(centerX, this.selectionArrowContainerWidth);

    if (this.selectionArrowBackgroundSprite) {
      spriteManager.updateSprite(this.selectionArrowBackgroundSprite.uniqueId, {
        positionX: positionX,
        positionY: this.selectionArrowY - 6,
      });
    }

    spriteManager.updateSprite(this.selectionArrowSprite.uniqueId, {
      positionX: positionX,
      positionY: this.selectionArrowY,
    });
  }

  markSelectionComplete() {
    this.selectionActive = false;
    this.selectionComplete = true;
    this.selectionCompleteAtMs = Date.now();

    if (this.selectionSummarySprite && this.selectedLeaderId) {
      const winnerSummaryText = this.buildWinnerSummaryText() + "\n\nNext Light Leader: " + this.getPlayerName(this.selectedLeaderId);
      this.updateWinnerSummaryBackground(winnerSummaryText);
      spriteManager.updateSprite(this.selectionSummarySprite.uniqueId, {
        text: winnerSummaryText,
      });
    }
  }

  updateWinnerSummaryBackground(text: string) {
    if (!this.selectionSummaryBackgroundSprite) return;

    const backgroundDimensions = this.getTextBackgroundDimensions(text, 42, 30, 10);
    spriteManager.updateSprite(this.selectionSummaryBackgroundSprite.uniqueId, {
      positionX: (this.worldWidth - backgroundDimensions.width) / 2,
      positionY: this.selectionSummaryY - 10,
      width: backgroundDimensions.width,
      height: backgroundDimensions.height,
    });
  }

  getTextBackgroundDimensions(text: string, fontSize: number, horizontalPadding: number, verticalPadding: number): { width: number; height: number } {
    let longestLineLength = 0;
    let currentLineLength = 0;
    let lineCount = 1;

    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) === "\n") {
        if (currentLineLength > longestLineLength) longestLineLength = currentLineLength;
        currentLineLength = 0;
        lineCount++;
      } else {
        currentLineLength++;
      }
    }

    if (currentLineLength > longestLineLength) longestLineLength = currentLineLength;

    return {
      width: longestLineLength * fontSize * 0.63 + horizontalPadding * 2,
      height: lineCount * fontSize * 1.2 + verticalPadding * 2,
    };
  }

  clamp01(value: number): number {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  easeOutPower(value: number): number {
    return 1 - Math.pow(1 - value, this.selectionEasePower);
  }

  getBlendedSelectionProgress(rawProgress: number): number {
    const easedProgress = this.easeOutPower(rawProgress);
    const linearWeight = 1 - this.selectionEasePowerWeight;

    return easedProgress * this.selectionEasePowerWeight + rawProgress * linearWeight;
  }

  getRandomSelectionEasePowerWeight(): number {
    return 0.1 + Math.random() * 0.8;
  }

  getSelectionPathIndexFromProgress(rawProgress: number, pathPositionCount: number): number {
    if (pathPositionCount <= 1) return 0;

    const suspensePathPositionCount = pathPositionCount - 1;
    if (suspensePathPositionCount <= 1) return 0;

    const easedProgress = this.getBlendedSelectionProgress(rawProgress);
    return Math.min(Math.floor(easedProgress * suspensePathPositionCount), suspensePathPositionCount - 1);
  }

  getCandidateCenterX(candidateIndex: number, candidateCount: number): number {
    const worldCenterX = this.worldWidth / 2;

    if (candidateCount <= 1) return worldCenterX;

    if (candidateCount === 2) {
      return candidateIndex === 0 ? worldCenterX - 240 : worldCenterX + 240;
    }

    return worldCenterX - 320 + candidateIndex * 320;
  }

  getCenteredSpritePositionX(centerX: number, containerWidth: number): number {
    return centerX - containerWidth / 2;
  }

  getPlayerName(playerId: number): string {
    if (!playerId) return "Unknown";

    const playerDetails = playerManager.getPlayerDetails(playerId);
    if (!playerDetails || !playerDetails.username) return "Player " + playerId.toString();

    return playerDetails.username;
  }

  getPlacementLabel(placement: number): string {
    if (placement === 1) return "1st";
    if (placement === 2) return "2nd";
    if (placement === 3) return "3rd";
    return placement.toString() + "th";
  }

  getUniqueConnectedCandidateIds(candidateIds: number[]): number[] {
    const uniqueCandidateIds: number[] = [];

    for (let i = 0; i < candidateIds.length; i++) {
      const candidateId = candidateIds[i];
      if (!candidateId) continue;
      if (!this.isPlayerConnected(candidateId)) continue;
      if (this.containsPlayerId(uniqueCandidateIds, candidateId)) continue;
      uniqueCandidateIds.push(candidateId);
    }

    return uniqueCandidateIds;
  }

  containsPlayerId(playerIds: number[], targetPlayerId: number): boolean {
    for (let i = 0; i < playerIds.length; i++) {
      if (playerIds[i] === targetPlayerId) return true;
    }

    return false;
  }

  isPlayerConnected(playerId: number): boolean {
    if (!playerId) return false;

    const connectedPlayerIds = playerManager.getPlayerIds();

    for (let i = 0; i < connectedPlayerIds.length; i++) {
      if (connectedPlayerIds[i] === playerId) return true;
    }

    return false;
  }
}
