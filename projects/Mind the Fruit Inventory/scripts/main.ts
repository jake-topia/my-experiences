class main extends SystemScript {
  onInit() {
    gameLoopManager.setSyncParameters({
      syncsPerSecond: 8,
      fullUpdatePerSecond: 2,
    });

    this.ensureClientUiManager();
    this.ensureInventoryDemoButton();
  }

  onPlayerStart() {
    this.ensureClientUiManager();
  }

  onSpectatorStart() {
    this.ensureClientUiManager();
  }

  ensureClientUiManager() {
    if (scriptManager.getSystem({ systemName: "clientUiManager" })) return;

    scriptManager.attachSystem({
      scriptId: "clientUiManager",
      isPlayerControlled: true,
    });
  }

  onHostStart() {
    this.ensureInventoryDemoButton();
    if (!scriptManager.getSystem({ systemName: "arenaManager" })) {
      scriptManager.attachSystem({ scriptId: "arenaManager" });
    }
    if (!scriptManager.getSystem({ systemName: "tileManager" })) {
      scriptManager.attachSystem({ scriptId: "tileManager" });
    }
    if (!scriptManager.getSystem({ systemName: "gameManager" })) {
      scriptManager.attachSystem({ scriptId: "gameManager" });
    }
  }

  ensureInventoryDemoButton() {
    if (!playerManager.isHost) return;

    if (!spriteManager.getSprite("inventoryDemoButton")) {
      spriteManager.addSprite("displayRect", {
        uniqueId: "inventoryDemoButton",
        positionX: 1110,
        positionY: 12,
        width: 280,
        height: 58,
        fill: "#f5c542",
        strokeColor: "#8b5e00",
        strokeWeight: 4,
        borderRadius: 12,
        displayLayer: "bottom",
        bottomAdjust: "BRING_TO_FRONT",
        opacity: 0.96,
        isInteractive: true,
      });
    }

    spriteManager.updateSprite("inventoryDemoButton", {
      positionX: 1110,
      positionY: 12,
      width: 280,
      height: 58,
      fill: "#f5c542",
      strokeColor: "#8b5e00",
      strokeWeight: 4,
      borderRadius: 12,
      displayLayer: "bottom",
      bottomAdjust: "BRING_TO_FRONT",
      opacity: 0.96,
      isInteractive: true,
    });

    if (!spriteManager.getSprite("inventoryDemoButtonLabel")) {
      spriteManager.addSprite("basicText", {
        uniqueId: "inventoryDemoButtonLabel",
        positionX: 1110,
        positionY: 26,
        containerWidth: 280,
        align: "center",
        text: "Add Rewind",
        fontSize: 25,
        fontWeight: "bold",
        fontColor: "#4d3200",
        displayLayer: "top",
        topAdjust: 125,
        opacity: 1,
      });
    }

    spriteManager.updateSprite("inventoryDemoButtonLabel", {
      positionX: 1110,
      positionY: 26,
      containerWidth: 280,
      align: "center",
      text: "Add Rewind",
      fontSize: 25,
      fontWeight: "bold",
      fontColor: "#4d3200",
      displayLayer: "top",
      topAdjust: 125,
      opacity: 1,
    });

    if (!spriteManager.getSprite("inventoryRemoveButton")) {
      spriteManager.addSprite("displayRect", {
        uniqueId: "inventoryRemoveButton",
        positionX: 1110,
        positionY: 78,
        width: 280,
        height: 58,
        fill: "#d84848",
        strokeColor: "#7d1111",
        strokeWeight: 4,
        borderRadius: 12,
        displayLayer: "bottom",
        bottomAdjust: "BRING_TO_FRONT",
        opacity: 0.96,
        isInteractive: true,
      });
    }

    spriteManager.updateSprite("inventoryRemoveButton", {
      positionX: 1110,
      positionY: 78,
      width: 280,
      height: 58,
      fill: "#d84848",
      strokeColor: "#7d1111",
      strokeWeight: 4,
      borderRadius: 12,
      displayLayer: "bottom",
      bottomAdjust: "BRING_TO_FRONT",
      opacity: 0.96,
      isInteractive: true,
    });

    if (!spriteManager.getSprite("inventoryRemoveButtonLabel")) {
      spriteManager.addSprite("basicText", {
        uniqueId: "inventoryRemoveButtonLabel",
        positionX: 1110,
        positionY: 92,
        containerWidth: 280,
        align: "center",
        text: "Remove Rewind",
        fontSize: 25,
        fontWeight: "bold",
        fontColor: "#ffffff",
        displayLayer: "top",
        topAdjust: 125,
        opacity: 1,
      });
    }

    spriteManager.updateSprite("inventoryRemoveButtonLabel", {
      positionX: 1110,
      positionY: 92,
      containerWidth: 280,
      align: "center",
      text: "Remove Rewind",
      fontSize: 25,
      fontWeight: "bold",
      fontColor: "#ffffff",
      displayLayer: "top",
      topAdjust: 125,
      opacity: 1,
    });


    if (
      !scriptManager.getComponent({
        objectUniqueId: "inventoryDemoButton",
        componentName: "inventoryDemo",
      })
    ) {
      scriptManager.attachComponent({
        objectUniqueId: "inventoryDemoButton",
        componentName: "inventoryDemo",
        scriptId: "inventoryDemo",
        props: {
          clickAction: "grant",
        },
      });
    }

    if (
      !scriptManager.getComponent({
        objectUniqueId: "inventoryRemoveButton",
        componentName: "inventoryDemo",
      })
    ) {
      scriptManager.attachComponent({
        objectUniqueId: "inventoryRemoveButton",
        componentName: "inventoryDemo",
        scriptId: "inventoryDemo",
        props: {
          clickAction: "remove",
        },
      });
    }
  }
}
