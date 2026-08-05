/**
 * Emits an event with the specified ID and payload.
 *
 * @typedef {Function} Emit
 * @param {string} eventId - The ID of the event to emit.
 * @param {Record<string, any>} [payload] - The payload to send with the event.
 */
export type Emit = (eventId: string, payload?: Record<string, any>) => void;

/**
 * Configuration options for a timeout.
 *
 * @typedef {Object} TimeoutOptions
 * @property {string} timeoutId - The unique ID for the timeout.
 * @property {number} timeoutSeconds - The duration of the timeout in seconds.
 */
export type TimeoutOptions = {
  timeoutId: string;
  timeoutSeconds: number;
};

/**
 * Emits an event with the specified ID and payload after a timeout.
 *
 * @typedef {Function} EmitWithTimeout
 * @param {string} eventId - The ID of the event to emit.
 * @param {Record<string, any>} payload - The payload to send with the event.
 * @param {TimeoutOptions} timeoutConfig - The configuration options for the timeout.
 */
export type EmitWithTimeout = (eventId: string, payload: Record<string, any>, timeoutConfig: TimeoutOptions) => void;

/**
 * Configuration options for an interval.
 *
 * @typedef {Object} IntervalOptions
 * @property {string} timedActionId - The unique ID for the timed action.
 * @property {number} intervalSeconds - The interval duration in seconds.
 */
export type IntervalOptions = {
  timedActionId: string;
  intervalSeconds: number;
};

/**
 * Emits an event with the specified ID and payload on a recurring interval.
 *
 * @typedef {Function} EmitOnInterval
 * @param {string} eventId - The ID of the event to emit.
 * @param {Record<string, any>} payload - The payload to send with the event.
 * @param {IntervalOptions} intervalConfig - The configuration options for the interval.
 */
export type EmitOnInterval = (eventId: string, payload: Record<string, any>, intervalConfig: IntervalOptions) => void;

/**
 * Manages event-related operations, including emitting events with optional timeout and interval configurations.
 *
 * @typedef {Object} EventManager
 * @property {Emit} emit - Emits an event with the specified ID and payload.
 * @property {EmitWithTimeout} emitWithTimeout - Emits an event with a timeout configuration.
 * @property {EmitOnInterval} emitOnInterval - Emits an event on a recurring interval.
 */
export type EventManager = {
  /**
   * Emits an event with the specified ID and payload.
   *
   * @typedef {Function} Emit
   * @param {string} eventId - The ID of the event to emit.
   * @param {Record<string, any>} payload - The payload to send with the event.
   */
  emit: Emit;
  /**
   * Emits an event with the specified ID and payload after a timeout.
   *
   * @typedef {Function} EmitWithTimeout
   * @param {string} eventId - The ID of the event to emit.
   * @param {Record<string, any>} payload - The payload to send with the event.
   * @param {TimeoutOptions} timeoutConfig - The configuration options for the timeout.
   */
  emitWithTimeout: EmitWithTimeout;
  /**
   * Emits an event with the specified ID and payload on a recurring interval.
   *
   * @typedef {Function} EmitOnInterval
   * @param {string} eventId - The ID of the event to emit.
   * @param {Record<string, any>} payload - The payload to send with the event.
   * @param {IntervalOptions} intervalConfig - The configuration options for the interval.
   */
  emitOnInterval: EmitOnInterval;
};

declare global {
  /**
   * The `eventManager` provides methods for managing events, including emitting events with time-based configurations.
   *
   * @global
   * @const {EventManager} eventManager
   */
  const eventManager: EventManager;
}

export {};

export const eventManager: EventManager;
