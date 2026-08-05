class roleManager extends SystemScript {
  coreRoles: string[];
  additionalRoles: string[];
  overflowTownsfolkRoles: string[];

  onInit() {
    this.coreRoles = [
      "DETECTIVE",
      "WATCHER",
      "TRICKSTER",
      "GUARD",
      "JOKER",
    ];
    this.additionalRoles = ["SABOTEUR", "FRAMER", "SLEEPER"];
    this.overflowTownsfolkRoles = [
      "DETECTIVE",
      "WATCHER",
      "GUARD",
      "SLEEPER",
    ];
  }

  assignRoles(playerIds: number[]) {
    const roleMap: any = {};
    const shuffledPlayerIds = this.shufflePlayerIds(playerIds);
    const roleDeck = this.buildRoleDeck(playerIds.length);

    for (let i = 0; i < shuffledPlayerIds.length; i++) {
      roleMap[shuffledPlayerIds[i].toString()] = roleDeck[i];
    }

    return roleMap;
  }

  buildRoleDeck(playerCount: number): string[] {
    const roleDeck: string[] = [];

    for (let i = 0; i < this.coreRoles.length && roleDeck.length < playerCount; i++) {
      if (playerCount === 4 && this.coreRoles[i] === "JOKER") continue;
      roleDeck.push(this.coreRoles[i]);
    }

    for (
      let i = 0;
      i < this.additionalRoles.length && roleDeck.length < playerCount;
      i++
    ) {
      roleDeck.push(this.additionalRoles[i]);
    }

    let overflowIndex = 0;
    while (roleDeck.length < playerCount) {
      roleDeck.push(
        this.overflowTownsfolkRoles[
          overflowIndex % this.overflowTownsfolkRoles.length
        ],
      );
      overflowIndex += 1;
    }

    return roleDeck;
  }

  shufflePlayerIds(playerIds: number[]): number[] {
    const availablePlayerIds = playerIds.slice();
    const shuffledPlayerIds: number[] = [];

    while (availablePlayerIds.length > 0) {
      const randomIndex = Math.floor(Math.random() * availablePlayerIds.length);
      shuffledPlayerIds.push(availablePlayerIds[randomIndex]);
      availablePlayerIds.splice(randomIndex, 1);
    }

    return shuffledPlayerIds;
  }

  getTeamForRole(roleName: string): string {
    if (
      roleName === "TRICKSTER" ||
      roleName === "SABOTEUR" ||
      roleName === "FRAMER"
    ) {
      return "TRICKSTERS";
    }

    if (roleName === "JOKER") return "JOKER";
    return "TOWNSFOLK";
  }

  isTricksterTeamRole(roleName: string): boolean {
    return this.getTeamForRole(roleName) === "TRICKSTERS";
  }

  getNightActionName(
    playerId: number,
    roleMap: any,
    tricksterCaseTargetMap: any,
    requestedActionName: string,
  ): string {
    const playerIdKey = playerId.toString();
    const roleName = roleMap ? roleMap[playerIdKey] : "";

    if (roleName === "SLEEPER") return "SLEEP";

    if (roleName === "DETECTIVE") return "INVESTIGATE";
    if (roleName === "WATCHER") return "WATCH";
    if (roleName === "GUARD") return "GUARD";
    if (roleName === "JOKER") return "VISIT";
    if (roleName === "SABOTEUR") return "DISTRACT";
    if (roleName === "FRAMER") return "FRAME";

    if (roleName === "TRICKSTER") {
      if (
        requestedActionName === "CASE" ||
        requestedActionName === "ELIMINATE"
      ) {
        return requestedActionName;
      }
      return "";
    }

    return "";
  }

  isValidNightTarget(
    actorPlayerId: number,
    targetPlayerId: number,
    actionName: string,
    roleMap: any,
    aliveMap: any,
    tricksterCaseTargetMap: any,
  ): boolean {
    const actorKey = actorPlayerId.toString();
    const targetKey = targetPlayerId.toString();

    if (!roleMap || !aliveMap) return false;
    if (!roleMap[actorKey] || !roleMap[targetKey]) return false;
    if (aliveMap[actorKey] !== true || aliveMap[targetKey] !== true) return false;
    if (actorPlayerId === targetPlayerId) return false;

    const actorRole = roleMap[actorKey];
    const targetRole = roleMap[targetKey];

    if (
      actionName === "CASE" ||
      actionName === "ELIMINATE" ||
      actionName === "DISTRACT"
    ) {
      if (this.isTricksterTeamRole(targetRole)) return false;
    }

    if (actionName === "ELIMINATE") {
      return (
        actorRole === "TRICKSTER" &&
        tricksterCaseTargetMap &&
        !!tricksterCaseTargetMap[targetKey]
      );
    }

    return actionName !== "";
  }
}
