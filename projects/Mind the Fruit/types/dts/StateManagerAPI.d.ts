export declare type setVariable = <VariableId extends keyof VariableTypeById = VariableIdType>(
  variableId: VariableId,
  newValue: VariableTypeById[VariableId],
) => void;

export declare type getVariable = <VariableId extends keyof VariableTypeById = VariableIdType>(
  variableId: VariableId,
) => VariableTypeById[VariableId];

export type stateManager = {
  /**
   * Sets the value of a variable identified by its ID.
   *
   * @template VariableId
   * @typedef {Function} setVariable
   * @param {VariableId} variableId - The ID of the variable to set.
   * @param {VariableTypeById[VariableId]} newValue - The new value to assign to the variable.
   */
  setVariable: setVariable;

  /**
   * Retrieves the value of a variable identified by its ID.
   *
   * @template VariableId
   * @typedef {Function} getVariable
   * @param {VariableIdType} variableId - The ID of the variable to retrieve.
   * @returns {number} The value of the specified variable.
   */
  getVariable: getVariable;
};

export type ValidVariableId<T> = T extends keyof VariableTypeById ? T : never;

declare global {
  export type ValidVariableId<T> = T extends keyof VariableTypeById ? T : never;

  /**
   * Manages state-related operations, including setting and retrieving variables.
   *
   * @typedef {Object} stateManager
   * @property {setVariable} setVariable - Sets the value of a variable.
   * @property {getVariable} getVariable - Retrieves the value of a variable.
   */
  export declare type stateManager = {
    /**
     * Sets the value of a variable identified by its ID.
     *
     * @template VariableId
     * @typedef {Function} setVariable
     * @param {VariableId} variableId - The ID of the variable to set.
     * @param {VariableTypeById[VariableId]} newValue - The new value to assign to the variable.
     */
    setVariable: setVariable;

    /**
     * Retrieves the value of a variable identified by its ID.
     *
     * @template VariableId
     * @typedef {Function} getVariable
     * @param {VariableIdType} variableId - The ID of the variable to retrieve.
     * @returns {number} The value of the specified variable.
     */
    getVariable: getVariable;
  };
  /**
   * The `stateManager` provides methods for managing state, allowing for the setting and retrieval of variables.
   *
   * @global
   * @const {stateManager} stateManager
   */
  export const stateManager: stateManager;
}

export {}; // Required to make this file a module

export const stateManager: stateManager;
