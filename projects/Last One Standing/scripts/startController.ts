class startController extends ComponentScript {

  constructor(){
    // load state (no async!)
  };
  
  onInit(){
    // hello world
  };

  onClicked(){
    if (!playerManager.isHost) return;

    this.sprite.text = ' ';
    this.sprite.isInteractive = true;
    eventManager.emit("startBtnClicked");
  }
};
