class uiSpriteManager extends SystemScript {
  lastStateMap: any;

  onInit() {
    this.lastStateMap = {};
  }

  ensureText(uniqueId: string, options: any) {
    const existingSprite = spriteManager.getSprite(uniqueId);
    if (this.isCasedSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug-CASED][uiSpriteManager.ensureText] ENTER " +
          uniqueId +
          " existedBefore=" +
          (!!existingSprite).toString() +
          " requestedOptions=",
        options,
        " existingSprite=",
        existingSprite,
      );
    }
    if (existingSprite) {
      if (this.isNightResultSpriteId(uniqueId)) {
        console.log(
          "[sprite-debug][uiSpriteManager.ensureText] SKIP existing " +
            uniqueId +
            " sprite=",
          existingSprite,
        );
      }
      if (this.isCasedSpriteId(uniqueId)) {
        console.log(
          "[sprite-debug-CASED][uiSpriteManager.ensureText] SKIP existing " +
            uniqueId +
            " sprite=",
          existingSprite,
        );
      }
      return;
    }

    const spriteOptions: any = {
      uniqueId: uniqueId,
      positionX: this.valueOr(options.positionX, 0),
      positionY: this.valueOr(options.positionY, 0),
      containerWidth: this.valueOr(options.containerWidth, 300),
      align: options.align || "center",
      text: options.text || "",
      fontSize: this.valueOr(options.fontSize, 24),
      fontWeight: options.fontWeight || "normal",
      fontColor: options.fontColor || "#fff7df",
      isInteractive: options.isInteractive === true,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: options.displayLayer || "top",
      topAdjust: this.valueOr(options.topAdjust, 1000),
    };

    if (options.opacity !== undefined) spriteOptions.opacity = options.opacity;
    if (options.strokeColor !== undefined) {
      spriteOptions.strokeColor = options.strokeColor;
    }
    if (options.strokeWeight !== undefined) {
      spriteOptions.strokeWeight = options.strokeWeight;
    }

    if (this.isNightResultSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug][uiSpriteManager.ensureText] ADD attempt " +
          uniqueId +
          " options=",
        spriteOptions,
      );
    }
    if (this.isCasedSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug-CASED][uiSpriteManager.ensureText] BEFORE addSprite " +
          uniqueId +
          " completeSpriteOptions=",
        spriteOptions,
      );
    }
    spriteManager.addSprite("baseText", spriteOptions);
    this.lastStateMap[uniqueId] = this.clone(options);
    if (this.isNightResultSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug][uiSpriteManager.ensureText] ADD returned " +
          uniqueId +
          " spriteAfterAdd=",
        spriteManager.getSprite(uniqueId),
      );
    }
    if (this.isCasedSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug-CASED][uiSpriteManager.ensureText] AFTER addSprite " +
          uniqueId +
          " spriteAfterAdd=",
        spriteManager.getSprite(uniqueId),
      );
    }
  }

  ensureRect(uniqueId: string, options: any) {
    if (spriteManager.getSprite(uniqueId)) return;

    const spriteOptions: any = {
      uniqueId: uniqueId,
      positionX: this.valueOr(options.positionX, 0),
      positionY: this.valueOr(options.positionY, 0),
      width: this.valueOr(options.width, 1),
      height: this.valueOr(options.height, 1),
      fill: options.fill || "#ffffff",
      isInteractive: options.isInteractive === true,
      allowSpectatorInteraction: true,
      isPlayerControlled: true,
      displayLayer: options.displayLayer || "top",
      topAdjust: this.valueOr(options.topAdjust, 0),
      isStatic: true,
    };

    if (options.opacity !== undefined) spriteOptions.opacity = options.opacity;
    if (options.strokeColor !== undefined) {
      spriteOptions.strokeColor = options.strokeColor;
    }
    if (options.strokeWeight !== undefined) {
      spriteOptions.strokeWeight = options.strokeWeight;
    }
    if (options.borderRadius !== undefined) {
      spriteOptions.borderRadius = options.borderRadius;
    }
    if (options.checkCollisions !== undefined) {
      spriteOptions.checkCollisions = options.checkCollisions;
    }
    if (options.isImpassable !== undefined) {
      spriteOptions.isImpassable = options.isImpassable;
    }

    spriteManager.addSprite("baseRect", spriteOptions);
    this.lastStateMap[uniqueId] = this.clone(options);
  }

  updateText(uniqueId: string, options: any) {
    const spriteBeforeUpdate = spriteManager.getSprite(uniqueId);
    if (this.isNightResultSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug][uiSpriteManager.updateText] ENTER " +
          uniqueId +
          " existedBefore=" +
          (!!spriteBeforeUpdate).toString() +
          " options=",
        options,
      );
    }
    if (this.isCasedSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug-CASED][uiSpriteManager.updateText] ENTER " +
          uniqueId +
          " existedBefore=" +
          (!!spriteBeforeUpdate).toString() +
          " requestedOptions=",
        options,
        " spriteBeforeUpdate=",
        spriteBeforeUpdate,
      );
    }
    if (!spriteBeforeUpdate) this.ensureText(uniqueId, options);
    const spriteAfterEnsure = spriteManager.getSprite(uniqueId);
    if (!spriteAfterEnsure) {
      if (this.isNightResultSpriteId(uniqueId)) {
        console.log(
          "[sprite-debug][uiSpriteManager.updateText] ABORT " +
            uniqueId +
            " still missing after ensureText",
          );
        }
      if (this.isCasedSpriteId(uniqueId)) {
        console.log(
          "[sprite-debug-CASED][uiSpriteManager.updateText] ABORT " +
            uniqueId +
            " still missing after ensureText requestedOptions=",
          options,
        );
      }
      return;
    }
    this.updateSpriteIfChanged(uniqueId, options);
    if (this.isNightResultSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug][uiSpriteManager.updateText] COMPLETE " +
          uniqueId +
          " sprite=",
        spriteManager.getSprite(uniqueId),
      );
    }
    if (this.isCasedSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug-CASED][uiSpriteManager.updateText] COMPLETE " +
          uniqueId +
          " requestedOptions=",
        options,
        " spriteAfterUpdate=",
        spriteManager.getSprite(uniqueId),
      );
    }
  }

  updateRect(uniqueId: string, options: any) {
    if (!spriteManager.getSprite(uniqueId)) this.ensureRect(uniqueId, options);
    if (!spriteManager.getSprite(uniqueId)) return;
    this.updateSpriteIfChanged(uniqueId, options);
  }

  updateSpriteIfChanged(uniqueId: string, options: any) {
    const previousState = this.lastStateMap[uniqueId] || {};
    const nextState = this.clone(previousState);
    const keys = Object.keys(options);
    let hasChanges = false;

    for (let i = 0; i < keys.length; i++) {
      if (nextState[keys[i]] !== options[keys[i]]) {
        nextState[keys[i]] = options[keys[i]];
        hasChanges = true;
      }
    }

    if (!hasChanges) return;
    this.lastStateMap[uniqueId] = nextState;
    spriteManager.updateSprite(uniqueId, options);
  }

  hideText(uniqueId: string) {
    if (!spriteManager.getSprite(uniqueId)) return;
    this.updateText(uniqueId, {
      text: "",
      opacity: 0,
      isInteractive: false,
    });
  }

  remove(uniqueId: string) {
    if (this.isNightResultSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug][uiSpriteManager.remove] " +
          uniqueId +
          " existedBefore=" +
          (!!spriteManager.getSprite(uniqueId)).toString(),
        );
    }
    if (this.isCasedSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug-CASED][uiSpriteManager.remove] BEFORE " +
          uniqueId +
          " sprite=",
        spriteManager.getSprite(uniqueId),
      );
    }
    if (spriteManager.getSprite(uniqueId)) {
      spriteManager.removeSprite(uniqueId);
    }
    delete this.lastStateMap[uniqueId];
    if (this.isCasedSpriteId(uniqueId)) {
      console.log(
        "[sprite-debug-CASED][uiSpriteManager.remove] AFTER " +
          uniqueId +
          " sprite=",
        spriteManager.getSprite(uniqueId),
      );
    }
  }

  removeMany(uniqueIds: string[]) {
    for (let i = 0; i < uniqueIds.length; i++) {
      this.remove(uniqueIds[i]);
    }
  }

  wrapText(text: string, maxWidth: number, fontSize: number): string {
    const paragraphs = text.split("\n");
    const lines: string[] = [];

    for (let i = 0; i < paragraphs.length; i++) {
      if (!paragraphs[i]) {
        lines.push("");
        continue;
      }

      const words = paragraphs[i].split(" ");
      let currentLine = "";

      for (let j = 0; j < words.length; j++) {
        const nextLine = currentLine
          ? currentLine + " " + words[j]
          : words[j];

        if (
          currentLine &&
          this.estimateTextWidth(nextLine, fontSize) > maxWidth
        ) {
          lines.push(currentLine);
          currentLine = words[j];
        } else {
          currentLine = nextLine;
        }
      }

      if (currentLine) lines.push(currentLine);
    }

    return lines.join("\n");
  }

  estimateTextWidth(text: string, fontSize: number): number {
    if (!text) return 0;
    return Math.round(text.length * fontSize * 0.56);
  }

  valueOr(value: any, fallbackValue: any) {
    return value === undefined || value === null ? fallbackValue : value;
  }

  isNightResultSpriteId(uniqueId: string): boolean {
    return (
      uniqueId === "ui_night_result" ||
      uniqueId === "ui_night_result_detail"
    );
  }

  isCasedSpriteId(uniqueId: string): boolean {
    return uniqueId.indexOf("ui_cased_") === 0;
  }

  clone(source: any) {
    const cloned: any = {};
    if (!source) return cloned;
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) cloned[keys[i]] = source[keys[i]];
    return cloned;
  }
}
