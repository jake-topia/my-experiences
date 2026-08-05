export declare type SetIsAcceptingPlayers = (isAcceptingPlayers: boolean) => void;

export declare type GameStateManager = {
  /**
   * A function that sets whether the system is accepting players.
   *
   * @param {boolean} isAcceptingPlayers - A boolean indicating if the system is accepting players.
   */
  setIsAcceptingPlayers: SetIsAcceptingPlayers;
};

declare global {
  /**
   * Utility for interacting with the public experience state.
   */
  const gameStateManager: GameStateManager;
}

export {}; // Required to make this file a module

export const gameStateManager: GameStateManager;
