/**
 * A function that logs a message and associated payload.
 *
 * @typedef {Function} log
 * @param {string} text - The log message.
 * @param {any} payload - The associated payload.
 */
export declare type log = (text: string, payload: any) => void;

declare global {
  /**
   * A function that triggers an alert with a message and associated payload.
   *
   * @typedef {Function} alert
   * @param {string} text - The alert message.
   * @param {any} payload - The associated payload.
   */
  // @ts-expect-error - we're simulating an existing global
  let alert: (text: string, payload: any) => void;
}

/**
 * A console object that provides logging functionality.
 *
 * @typedef {Object} Console
 * @property {log} log - Logs a message and associated payload.
 */
export declare type Console = {
  /**
   * A function that logs a message and associated payload.
   *
   * @typedef {Function} log
   * @param {string} text - The log message.
   * @param {any} payload - The associated payload.
   */
  log: log;
};

declare global {
  /**
   * A console object that provides logging functionality.
   *
   * @global
   * @const {Console} console
   * @property {log} log - Logs a message and associated payload.
   */
  // @ts-expect-error - we're simulating an existing global
  let console: Console;
}

export const console: Console; // Required to make this file a module
