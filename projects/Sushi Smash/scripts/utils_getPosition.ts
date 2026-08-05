class utils_getPosition extends SystemScript {
  async getPosition({
    isPlayer1,
    occupiedPositions = {},
  }: {
    isPlayer1: boolean;
    occupiedPositions: Record<string, boolean>;
  }) {
    const col1 = 200;
    const col2 = 310;
    const col3 = 420;
    const col4 = 670;
    const col5 = 780;
    const col6 = 890;
    const row1 = 335;
    const row2 = 435;
    const row3 = 535;

    let positions;
    if (isPlayer1) {
      positions = {
        1: { x: col1, y: row1 },
        2: { x: col2, y: row1 },
        3: { x: col3, y: row1 },
        4: { x: col1, y: row2 },
        5: { x: col2, y: row2 },
        6: { x: col3, y: row2 },
        7: { x: col1, y: row3 },
        8: { x: col2, y: row3 },
        9: { x: col3, y: row3 },
      };
    } else {
      positions = {
        1: { x: col4, y: row1 },
        2: { x: col5, y: row1 },
        3: { x: col6, y: row1 },
        4: { x: col4, y: row2 },
        5: { x: col5, y: row2 },
        6: { x: col6, y: row2 },
        7: { x: col4, y: row3 },
        8: { x: col5, y: row3 },
        9: { x: col6, y: row3 },
      };
    }

    let position;
    do {
      position = mathRandomInt(1, 9);
    } while (occupiedPositions[position]);
    
    return { position, x: positions[position].x, y: positions[position].y };
  }
}