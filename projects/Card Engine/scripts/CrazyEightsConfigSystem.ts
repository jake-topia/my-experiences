class CrazyEightsConfigSystem extends SystemScript {
    private _config: any;

    constructor() {
        this._config = {
            minPlayers: 2,
            maxPlayers: 8,
            initialHandSize: 5,
            deck: {
                type: 'standardWithJokers',
                jokerCount: 10,
            },
        };
    }
    
    // The engine will call this method to get the configuration.
    public getConfig() {
        return this._config;
    }
}