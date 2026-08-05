const ITEM_NAME = "Rewind";

class inventoryDemo extends ComponentScript {
  clickAction: string;
  lastQuantity: number;
  lastItemId: string;

  constructor({
    clickAction,
    isHydration,
  }: {
    clickAction?: string;
    isHydration: boolean;
  }) {
    this.clickAction = clickAction || "grant";
    this.lastQuantity = 0;
    this.lastItemId = "";
    if (isHydration) return;
  }

  onInit() {
    this.sprite.isInteractive = 1;
    console.log("inventoryDemo loaded", {
      item: ITEM_NAME,
      clickAction: this.clickAction,
    });
  }

  onPlayerStart() {
    console.log("Click me to update " + ITEM_NAME, {
      action: this.clickAction,
    });
  }

  onClicked() {
    eventManager.emit("playerRequestsRewindInventoryChange", {
      fromPlayerId: playerManager.getMyPlayerId(),
      action: this.clickAction,
    });
  }

  onEvent_USER_INVENTORY_ITEM_UPDATE(payload: {
    itemId: string;
    name: string;
    quantity: number;
    grantedByPlayerId: string;
    playerId: string;
    droppedAssetId: string;
  }) {
    if (payload.name !== ITEM_NAME) return;

    this.lastItemId = payload.itemId;
    this.lastQuantity = payload.quantity;
    console.log("Inventory updated in-world!", payload);
  }
}
