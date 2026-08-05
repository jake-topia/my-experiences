/**
 * Generates a random integer between the specified minimum and maximum values, inclusive.
 *
 * @typedef {Function} mathRandomInt
 * @param {number} min - The minimum value of the range.
 * @param {number} max - The maximum value of the range.
 * @returns {number} A random integer between min and max.
 */
export declare type mathRandomInt = (min: number, max: number) => number;

/**
 * Generates a random universally unique identifier (UUID).
 *
 * @typedef {Function} getRandomUUID
 * @returns {string} A randomly generated UUID.
 */
export declare type getRandomUUID = () => string;

/**
 * Generates a random colour in a specified format (e.g., hex, RGB).
 *
 * @typedef {Function} colourRandom
 * @returns {string} A randomly generated colour.
 */
export declare type colourRandom = () => string;

/**
 * Selects a random item from the provided array.
 *
 * @template ElementType
 * @typedef {Function} listsGetRandomItem
 * @param {ElementType[]} array - The array to select a random item from.
 * @returns {ElementType} A randomly selected item from the array.
 */
export declare type listsGetRandomItem = <ElementType>(array: ElementType[]) => ElementType;

/**
 * Sets the maximum number of client connections allowed.
 *
 * @typedef {Function} setMaxClientConnections
 * @param {number} maxConnections - The maximum number of allowed connections.
 */
export declare type setMaxClientConnections = (maxConnections: number) => void;

declare global {
  /**
   * Generates a random integer between the specified minimum and maximum values, inclusive.
   *
   * @global
   * @const {mathRandomInt} mathRandomInt
   */
  const mathRandomInt: mathRandomInt;

  /**
   * Generates a random universally unique identifier (UUID).
   *
   * @global
   * @const {getRandomUUID} getRandomUUID
   */
  const getRandomUUID: getRandomUUID;

  /**
   * Generates a random colour in a specified format (e.g., hex, RGB).
   *
   * @global
   * @const {colourRandom} colourRandom
   */
  const colourRandom: colourRandom;

  /**
   * Selects a random item from the provided array.
   *
   * @global
   * @const {listsGetRandomItem} listsGetRandomItem
   */
  const listsGetRandomItem: listsGetRandomItem;

  /**
   * Sets the maximum number of client connections allowed.
   *
   * @global
   * @const {setMaxClientConnections} setMaxClientConnections
   */
  const setMaxClientConnections: setMaxClientConnections;
}

export {}; // Required to make this file a module
export const mathRandomInt: mathRandomInt;
export const getRandomUUID: getRandomUUID;
export const colourRandom: colourRandom;
export const listsGetRandomItem: listsGetRandomItem;
export const setMaxClientConnections: setMaxClientConnections;
