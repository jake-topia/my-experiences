class utils extends SystemScript {

 
  makeText({
    text,
    align,
    justify,
    onClick,
    allowSpectatorInteraction,
    uniqueId,
    maxWrapAt,
  } : {
    uniqueId?: string;
    text?: string;
    align?: 'start' | 'center' | 'end';
    justify?: 'start' | 'center' | 'end' | "above-center" | "below-center" | "below-end" | "above-end";
    onClick?: any;
    allowSpectatorInteraction?: boolean;
    maxWrapAt?:number,
  }) {

    
    const sprite = spriteManager.addSprite('text', {
      displayLayer: 'top',
      text,
      uniqueId,
      opacity: 0,
      containerWidth:50
    });
    
    const component = sprite.attachComponent({
      scriptId: 'textBehavior',
      props: {
        text,
        align,
        justify,
        onClick,
        allowSpectatorInteraction,
        maxWrapAt,
      },
    });
    
    return sprite;
  }


  pseudoListRemove({ list, element } : { list : PseudoList, element : any }) : PseudoList {
    var arr = list.toArray();
    arr = arr.filter(item => item !== element);
    
    const pList : PseudoList = [];

    for (const el of arr) {
      pList.push(el);
    }
    return pList;
  }

  pseudoListInsert({ list, element, idx } : { list : PseudoList, element : any, idx : number }) : PseudoList {
    var arr = list.toArray();
    arr[idx] = element;

    const pList : PseudoList = [];
    for (const el of arr) {
      pList.push(el);
    }
    return pList;
  }

  getPlayerData(playerAssignment: number) : Record<string, any> {
    switch (playerAssignment) {
      case 1:
        return stateManager.getVariable("player1Data");
      case 2:
        return stateManager.getVariable("player2Data");
      case 3:
        return stateManager.getVariable("player3Data");
      case 4:
        return stateManager.getVariable("player4Data");
      case 5:
        return stateManager.getVariable("player5Data");
      case 6:
        return stateManager.getVariable("player6Data");
      case 7:
        return stateManager.getVariable("player7Data");
      case 8:
        return stateManager.getVariable("player8Data");
      default:
        throw new Error(`Invalid playerAssignment: ${playerAssignment}`);
    }
  }

  findPlayerAssignment(playerId: number): number {
    var playerData : Record<string,any>;
    playerData = stateManager.getVariable("player1Data");
    if (playerId in playerData) return 1;
    playerData = stateManager.getVariable("player2Data");
    if (playerId in playerData) return 2;
    playerData = stateManager.getVariable("player3Data");
    if (playerId in playerData) return 3;
    playerData = stateManager.getVariable("player4Data");
    if (playerId in playerData) return 4;
    playerData = stateManager.getVariable("player5Data");
    if (playerId in playerData) return 5;
    playerData = stateManager.getVariable("player6Data");
    if (playerId in playerData) return 6;
    playerData = stateManager.getVariable("player7Data");
    if (playerId in playerData) return 7;
    playerData = stateManager.getVariable("player8Data");
    if (playerId in playerData) return 8;
    throw new Error(`Player ID ${playerId} not found`);
  }

  deletePlayerData(playerSlot: number): void {
    const playerData: Record<string, any> = {};
    switch (playerSlot) {
      case 1:
        stateManager.setVariable("player1Data", playerData);
        break;
      case 2:
        stateManager.setVariable("player2Data", playerData);
        break;
      case 3:
        stateManager.setVariable("player3Data", playerData);
        break;
      case 4:
        stateManager.setVariable("player4Data", playerData);
        break;
      case 5:
        stateManager.setVariable("player5Data", playerData);
        break;
      case 6:
        stateManager.setVariable("player6Data", playerData);
        break;
      case 7:
        stateManager.setVariable("player7Data", playerData);
        break;
      case 8:
        stateManager.setVariable("player8Data", playerData);
        break;
      default:
        console.warn(`deletePlayerData: invalid slot ${playerSlot}`);
    }
  }



  setPlayerData(playerAssignment: number, playerId: string, boatId: number) {
    switch (playerAssignment) {
      case 1:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player1Data", playerData);
        break;

      case 2:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player2Data", playerData);
        break;

      case 3:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player3Data", playerData);
        break;

      case 4:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player4Data", playerData);
        break;

      case 5:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player5Data", playerData);
        break;

      case 6:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player6Data", playerData);
        break;

      case 7:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player7Data", playerData);
        break;

      case 8:
        var playerData: Record<string, any> = {};
        playerData[playerId] = {};
        playerData[playerId].hasLoaded = false;
        playerData[playerId].hasCompleted = false;
        playerData[playerId].position = 0;
        playerData[playerId].time = 999;
        playerData[playerId].finishRank = 0;
        playerData[playerId].boatId = boatId;
        stateManager.setVariable("player8Data", playerData);
        break;

      default:
        throw new Error(`Invalid playerAssignment: ${playerAssignment}`);
    }
  }


  // finishRank is assigned by the host in the order it received completions.
  // It is the only thing the leaderboard orders by, so it must never be
  // recomputed from times on either side of the wire.
  async setCompleted(playerAssignment : number, time : number, finishRank : number ) : Promise<void> {
    console.log("inside setCompleted for " + playerAssignment);
    switch (playerAssignment) {
      case 1:
        console.log("inside setCompleted case 1");
        const playerData1: Record<string, any> = stateManager.getVariable("player1Data");
        const playerId1 = Object.keys(playerData1)[0];
        playerData1[playerId1].hasCompleted = true;
        playerData1[playerId1].time = time;
        playerData1[playerId1].finishRank = finishRank;
        await stateManager.setVariable("player1Data", playerData1);
        break;

      case 2:
        console.log("inside setCompleted case 2");
        const playerData2: Record<string, any> = stateManager.getVariable("player2Data");
        const playerId2 = Object.keys(playerData2)[0];
        playerData2[playerId2].hasCompleted = true;
        playerData2[playerId2].time = time;
        playerData2[playerId2].finishRank = finishRank;
        await stateManager.setVariable("player2Data", playerData2);
        break;

      case 3:
        const playerData3: Record<string, any> = stateManager.getVariable("player3Data");
        const playerId3 = Object.keys(playerData3)[0];
        playerData3[playerId3].hasCompleted = true;
        playerData3[playerId3].time = time;
        playerData3[playerId3].finishRank = finishRank;
        await stateManager.setVariable("player3Data", playerData3);
        break;

      case 4:
        const playerData4: Record<string, any> = stateManager.getVariable("player4Data");
        const playerId4 = Object.keys(playerData4)[0];
        playerData4[playerId4].hasCompleted = true;
        playerData4[playerId4].time = time;
        playerData4[playerId4].finishRank = finishRank;
        await stateManager.setVariable("player4Data", playerData4);
        break;

      case 5:
        const playerData5: Record<string, any> = stateManager.getVariable("player5Data");
        const playerId5 = Object.keys(playerData5)[0];
        playerData5[playerId5].hasCompleted = true;
        playerData5[playerId5].time = time;
        playerData5[playerId5].finishRank = finishRank;
        await stateManager.setVariable("player5Data", playerData5);
        break;

      case 6:
        const playerData6: Record<string, any> = stateManager.getVariable("player6Data");
        const playerId6 = Object.keys(playerData6)[0];
        playerData6[playerId6].hasCompleted = true;
        playerData6[playerId6].time = time;
        playerData6[playerId6].finishRank = finishRank;
        await stateManager.setVariable("player6Data", playerData6);
        break;

      case 7:
        const playerData7: Record<string, any> = stateManager.getVariable("player7Data");
        const playerId7 = Object.keys(playerData7)[0];
        playerData7[playerId7].hasCompleted = true;
        playerData7[playerId7].time = time;
        playerData7[playerId7].finishRank = finishRank;
        await stateManager.setVariable("player7Data", playerData7);
        break;

      case 8:
        const playerData8: Record<string, any> = stateManager.getVariable("player8Data");
        const playerId8 = Object.keys(playerData8)[0];
        playerData8[playerId8].hasCompleted = true;
        playerData8[playerId8].time = time;
        playerData8[playerId8].finishRank = finishRank;
        await stateManager.setVariable("player8Data", playerData8);
        break;

      default:
        throw new Error(`Invalid playerAssignment: ${playerAssignment}`);
    }
  }

  findExistingSlotOnly(playerId: number) : { slot: number, hasCompleted: boolean } {
    const player1Data: Record<string, any> = stateManager.getVariable("player1Data");
    if (Object.keys(player1Data)[0] === playerId.toString()) return {slot: 1, hasCompleted: player1Data[playerId.toString()].hasCompleted};
    const player2Data: Record<string, any> = stateManager.getVariable("player2Data");
    if (Object.keys(player2Data)[0] === playerId.toString()) return {slot: 2, hasCompleted: player2Data[playerId.toString()].hasCompleted};
    const player3Data: Record<string, any> = stateManager.getVariable("player3Data");
    if (Object.keys(player3Data)[0] === playerId.toString()) return {slot: 3, hasCompleted: player3Data[playerId.toString()].hasCompleted};
    const player4Data: Record<string, any> = stateManager.getVariable("player4Data");
    if (Object.keys(player4Data)[0] === playerId.toString()) return {slot: 4, hasCompleted: player4Data[playerId.toString()].hasCompleted};
    const player5Data: Record<string, any> = stateManager.getVariable("player5Data");
    if (Object.keys(player5Data)[0] === playerId.toString()) return {slot: 5, hasCompleted: player5Data[playerId.toString()].hasCompleted};
    const player6Data: Record<string, any> = stateManager.getVariable("player6Data");
    if (Object.keys(player6Data)[0] === playerId.toString()) return {slot: 6, hasCompleted: player6Data[playerId.toString()].hasCompleted};
    const player7Data: Record<string, any> = stateManager.getVariable("player7Data");
    if (Object.keys(player7Data)[0] === playerId.toString()) return {slot: 7, hasCompleted: player7Data[playerId.toString()].hasCompleted};
    const player8Data: Record<string, any> = stateManager.getVariable("player8Data");
    if (Object.keys(player8Data)[0] === playerId.toString()) return {slot: 8, hasCompleted: player8Data[playerId.toString()].hasCompleted};
    return null;
  }
};
