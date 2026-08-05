class Collider extends ComponentScript {
  uniqueId: string;
  playerId: number;
  constructor() {
    // load state (no async!)
  }

  onInit(props) {
    this.uniqueId = props.uniqueId;
    this.playerId = props.playerId;
  }

  testFunction() {
    return this.playerId;
  }
}
