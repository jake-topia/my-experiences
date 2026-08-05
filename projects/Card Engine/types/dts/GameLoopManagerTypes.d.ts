export declare type SetSyncParameters = (options: { syncsPerSecond?: number; fullUpdatePerSecond?: number }) => void;

export declare type GameLoopManager = {
  /**
   * Sets the synchronization parameters for the system.
   * Updates the sync threshold and full update threshold based on the input values.
   *
   * @param {Object} params - The parameters for synchronization.
   * @param {number} [params.syncsPerSecond] - The number of syncs per second. Determines the sync threshold.
   * @param {number} [params.fullUpdatePerSecond] - The number of full updates per second. Determines the full update threshold.
   */
  setSyncParameters: SetSyncParameters;
};

declare global {
  /**
   * Utility for interacting with the public experience state.
   */
  const gameLoopManager: GameLoopManager;
}

export {}; // Required to make this file a module

export const gameLoopManager: GameLoopManager;
