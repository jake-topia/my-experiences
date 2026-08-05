class safezoneManager extends ComponentScript {
  allPlayers: any;  // stores a copy of all the players in the game 

  /*
   *  Teleports players into a random spot in the gamezone if they are inside the safezone
   */
  constructor(){
    this.allPlayers = [];
    if (!playerManager.isHost) return;

    this.allPlayers = playerManager.getPlayerIds(); 
    for(const id of this.allPlayers){
      const playerY = playerManager.getPlayerDetails(id).y
      const playerHeight = playerManager.getPlayerDetails(id).height
      if((playerY + playerHeight) > 1300){ 
        const teleportOptions = {
         distributionType: 'area' as const,
         positionX: 50,
         positionY: 50,
         height: 1100,
         width: 1100,//1400,
       };
      playerManager.teleportPlayers([id], teleportOptions);
      }
    }
  };
  
  onInit(){
    // hello world
  };

  /*
   *  This event is triggered by the main script when the game resets. It essentially does the same thing as the constructor and teleports all players
   *  to a random spot in the gamezone
   */ 
  onEvent_resetSafezoneCollisions(){
    if (!playerManager.isHost) return;

    this.allPlayers = playerManager.getPlayerIds();
    for(const id of this.allPlayers){
      const playerY = playerManager.getPlayerDetails(id).y
      const playerHeight = playerManager.getPlayerDetails(id).height
      if((playerY + playerHeight) > 1300){ 
        const teleportOptions = {
         distributionType: 'area' as const,
         positionX: 50,
         positionY: 50,
         height: 1100,
         width: 1100,//1400,
       };
      playerManager.teleportPlayers([id], teleportOptions);
      }
    }
    this.sprite.checkCollisions = true;
  }

  /*
   *  When a player collides with the safezone, it will teleport them back so they cannot keep colliding 
   */
  onSpriteCollisionStart({ collisionX, collisionY, sprite }) {
    if (!playerManager.isHost) return;
    if (sprite.playerId === undefined) return;
    const id = sprite.playerId;
    const playerDetails = playerManager.getPlayerDetails(id);
    const playerY = playerDetails.y;
    const playerX = playerDetails.x;
    const playerHeight = playerDetails.height;
    const playerWidth = playerDetails.width;
    let teleportX = 500;
    let teleportY = 500;

    // guard: skip if we've already handled this player
    if(!this.allPlayers.includes(id)) return;
    teleportX = playerX + playerWidth/2;
    teleportY = playerY - 110;
    const teleportOptions = {
      distributionType: 'area' as const,
      positionX: teleportX,
      positionY: teleportY,
      height: 0,
      width: 0,
    };
    playerManager.teleportPlayers([id], teleportOptions);
  }

  /*
   *  Removes a player from the local allPlayers list 
   */
  onEvent_removeFromCollidedPlayers({playerID}){
    if (!playerManager.isHost) return;
    if (this.allPlayers.indexOf(playerID) === -1) {
      this.allPlayers.push(playerID);
    }
  }

  /*
   *  Change an eliminated player's nameplate and color 
   */
  onEvent_changePlayerProperties({playerID}){
    if (!playerManager.isHost) return;

    this.allPlayers = this.allPlayers.filter(playerId => playerId !== playerID);
      playerManager.tintPlayer(playerID, 'red');
      eventManager.emit("playerOut", {playerID: playerID, stillJoined: true});
  }


};
