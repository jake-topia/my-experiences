import { StageIdType } from "./GeneratedTypes";

export declare type setCurrentStage = (stageId: StageIdType) => void;

export declare type getCurrentStage = () => string;

/**
 * Manages stage-related operations.
 *
 * @typedef {Object} stageManager
 * @property {setCurrentStage} setCurrentStage - Sets the current stage.
 * @property {getCurrentStage} getCurrentStage - Retrieves the current stage.
 */
export declare type stageManager = {
  /**
   * Sets the current stage to the specified stage ID.
   *
   * @typedef {Function} setCurrentStage
   * @param {StageIdType} stageId - The ID of the stage to set as the current stage.
   */
  setCurrentStage: setCurrentStage /**
   * Retrieves the ID of the current stage.
   *
   * @typedef {Function} getCurrentStage
   * @returns {string} The ID of the current stage.
   */;
  getCurrentStage: getCurrentStage;
};

declare global {
  /**
   * The `stageManager` provides methods for managing stages in the system.
   *
   * @global
   * @const {stageManager} stageManager
   */
  const stageManager: stageManager;
}

export {}; // Required to make this file a module

export const stageManager: stageManager;
