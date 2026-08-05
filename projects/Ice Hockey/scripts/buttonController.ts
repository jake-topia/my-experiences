class buttonController extends ComponentScript {

  onInit(){
  };

  onClicked(){
    eventManager.emit("playerStartInput", {});
  }

}
