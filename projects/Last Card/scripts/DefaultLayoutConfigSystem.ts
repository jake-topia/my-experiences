class DefaultLayoutConfigSystem extends SystemScript {
    private _layout: any;

    constructor() {
        this._layout = {
            screen: { width: 1000, height: 1000 },
            card: { width: 80, height: 130 },
            myHand: {
                y: 400,
                spacing: 10,
            },
            playPile: { x: 210, y: 185 },
            drawPile: { x: 290, y: 185 },
            opponentCard: {
                width: 40,
                height: 65,
                spacing: 5,
            },
            opponentPositions: {
                2: [{ x: 250, y: 50, rotation: 0 }],
                3: [
                    { x: 50, y: 250, rotation: 90 },
                    { x: 450, y: 250, rotation: -90 },
                ],
                4: [
                    { x: 50, y: 250, rotation: 90 },
                    { x: 250, y: 50, rotation: 0 },
                    { x: 450, y: 250, rotation: -90 },
                ],
            },
        };
    }

    public getLayout() {
        return this._layout;
    }
}