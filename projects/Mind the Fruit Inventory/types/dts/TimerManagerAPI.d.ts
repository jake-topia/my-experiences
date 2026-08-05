import type { EasingParam } from "animejs";

export declare type clearTimer = (timerId: string) => void;

/**
 * Options to configure a timer instance.
 */
export declare type CreateTimerOptions = {
  duration?: number | string;
  delay?: number | string;
  loopDelay?: number;
  reversed?: boolean;
  alternate?: boolean;
  loop?: boolean | number;
  autoplay?: boolean;
  frameRate?: number;
  playbackRate?: number;
  //
  onBegin?: (animation: PseudoTimer) => any;
  onComplete?: (animation: PseudoTimer) => any;
  onUpdate?: (animation: PseudoTimer) => any;
  onLoop?: (animation: PseudoTimer) => any;
  onPause?: (animation: PseudoTimer) => any;
  then?: (animation: PseudoTimer) => any;
};

type PercentageKeyframeOptions = {
  ease?: EasingParam;
};
type PercentageKeyframeParams = Record<string, string | number>;
type PercentageKeyframes = Record<string, PercentageKeyframeParams & PercentageKeyframeOptions>;
type DurationKeyframes = Array<Record<string, any>>;

/**
 * Options to configure an animation instance.
 */
export declare type AnimateOptions = {
  duration?: number | string;
  delay?: number | string;
  loopDelay?: number;
  reversed?: boolean;
  alternate?: boolean;
  loop?: boolean | number;
  autoplay?: boolean;
  frameRate?: number;
  playbackRate?: number;

  [property: string]: any; // Additional animation parameters based on AnimeJS API.

  keyframes?: PercentageKeyframes | DurationKeyframes;
  playbackEase?: EasingParam;
  //
  onBegin?: (animation: PseudoAnimation) => any;
  onComplete?: (animation: PseudoAnimation) => any;
  onUpdate?: (animation: PseudoAnimation) => any;
  onLoop?: (animation: PseudoAnimation) => any;
  onPause?: (animation: PseudoAnimation) => any;
  then?: (animation: PseudoAnimation) => any;
};

/**
 * PseudoTimer object used to manage and interact with timer instances.
 */
export interface PseudoTimer {
  play(): void; // Starts the timer.
  pause(): void; // Pauses the timer.
  restart(): void; // Restarts the timer.
  reverse(): void; // Reverses the playback direction of the timer.
  seek(progress: number): void; // Jumps to a specific progress (0-1).
  destroy(): void; // Destroys the timer instance.

  id: string; // Unique identifier for the timer.
  currentTime: number; // Current time of the timer in milliseconds.
  progress: number; // Current progress of the timer (0-1).
  paused: boolean; // Whether the timer is currently paused.
  began: boolean; // Whether the timer has started.
  completed: boolean; // Whether the timer has completed.
  speed: number; // The playback speed of the timer.
}

/**
 * PseudoAnimation object used to manage and interact with animation instances.
 */
export interface PseudoAnimation {
  play(): void; // Starts the animation.
  pause(): void; // Pauses the animation.
  restart(): void; // Restarts the animation.
  reverse(): void; // Reverses the playback direction of the animation.
  seek(progress: number): void; // Jumps to a specific progress (0-1).
  destroy(): void; // Destroys the animation instance.

  targets: object | object[]; // The animation's targets.
  currentTime: number; // Current time of the animation in milliseconds.
  progress: number; // Current progress of the animation (0-1).
  duration: number; // Total duration of the animation in milliseconds.
  paused: boolean; // Whether the animation is currently paused.
  began: boolean; // Whether the animation has started.
  completed: boolean; // Whether the animation has completed.
  speed: number; // The playback speed of the animation.
}

/**
 * Manages timer and animation-related operations.
 *
 * @typedef {Object} timerManager
 * @property {clearTimer} clearTimer - Clears a timer identified by its ID.
 * @property {createTimer} createTimer - Creates and returns a new PseudoTimer instance.
 * @property {animate} animate - Creates and returns a new PseudoAnimation instance.
 */
export declare type timerManager = {
  /**
   * Clears a timer identified by its ID.
   *
   * @param {string} timerId - The ID of the timer to clear.
   */
  clearTimer: clearTimer;

  /**
   * Creates a new timer with the specified options.
   *
   * @param {CreateTimerOptions} options - The options for the timer.
   * @returns {PseudoTimer} - The created timer instance.
   */
  createTimer(options: CreateTimerOptions): PseudoTimer;

  /**
   * Creates a new animation with the specified options.
   *
   * @param {AnimateOptions} options - The options for the animation.
   * @returns {PseudoAnimation} - The created animation instance.
   */
  animate(options: AnimateOptions): PseudoAnimation;
};

declare global {
  /**
   * The `timerManager` provides methods for managing timers and animations.
   *
   * @global
   * @const {timerManager} timerManager
   */
  const timerManager: timerManager;

  /**
   * PseudoTimer object used to manage and interact with timer instances.
   */
  interface PseudoTimer {
    play(): void; // Starts the timer.
    pause(): void; // Pauses the timer.
    restart(): void; // Restarts the timer.
    reverse(): void; // Reverses the playback direction of the timer.
    seek(progress: number): void; // Jumps to a specific progress (0-1).
    destroy(): void; // Destroys the timer instance.

    id: string; // Unique identifier for the timer.
    currentTime: number; // Current time of the timer in milliseconds.
    progress: number; // Current progress of the timer (0-1).
    paused: boolean; // Whether the timer is currently paused.
    began: boolean; // Whether the timer has started.
    completed: boolean; // Whether the timer has completed.
    speed: number; // The playback speed of the timer.
  }

  /**
   * PseudoAnimation object used to manage and interact with animation instances.
   */
  interface PseudoAnimation {
    play(): void; // Starts the animation.
    pause(): void; // Pauses the animation.
    restart(): void; // Restarts the animation.
    reverse(): void; // Reverses the playback direction of the animation.
    seek(progress: number): void; // Jumps to a specific progress (0-1).
    destroy(): void; // Destroys the animation instance.

    targets: object | object[]; // The animation's targets.
    currentTime: number; // Current time of the animation in milliseconds.
    progress: number; // Current progress of the animation (0-1).
    duration: number; // Total duration of the animation in milliseconds.
    paused: boolean; // Whether the animation is currently paused.
    began: boolean; // Whether the animation has started.
    completed: boolean; // Whether the animation has completed.
    speed: number; // The playback speed of the animation.
  }
}

export {}; // Required to make this file a module

export const timerManager: timerManager;
