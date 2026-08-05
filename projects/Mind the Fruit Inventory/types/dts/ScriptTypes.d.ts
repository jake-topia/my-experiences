export type TwoVector = { x: number; y: number };

/**
 * A sprite instance
 * @typedef {Object} PseudoSprite
 * @property {"top" | "bottom"} displayLayer - adjusts the sprites rendering order on the canvas, 'top' or 'bottom'
 * @property {number} zOrder - affects the sprites rendering order and flip point
 * @property {number} opacity - opacity
 * @property {boolean} isInteractive - whether this sprite is clickable
 * @property {number} width - width
 * @property {number} height - height
 * @property {boolean} isStatic - whether this sprite is immobile
 * @property {TwoVector} position - position
 * @property {TwoVector} velocity - this is the sprites speed each loop step
 * @property {TwoVector} friction - this value is added to this sprites velocity each loop step
 * @property {boolean} allowSpectatorInteraction - whether spectators (non players) can interact with this sprite
 * @property {boolean} checkCollisions - whether collisions are checked during the loop step
 * @property {boolean} collisionGroup - defaults to "*" (wildcard). when set, collisions will only be checked with objects of a different collision group. ie: walls vs players
 * @property {boolean} applyPhysics - whether physics are applied during the loop step
 *
 * @property {number} [fontSize] - (text sprite option) The size of the font we'll use, in pixels.
 * @property {number} [containerWidth] - (text sprite option)
 * @property {string} [text] - (text sprite option)
 * @property {string} [align] - (text sprite option) left | center | right
 * @property {string} [fontFamily] - (text sprite option)
 * @property {number} [fontWeight] - (text sprite option)
 * @property {string} [fontColor] - (text sprite option)
 *
 * @property {number} [width] - (ellipse / rect sprite option)
 * @property {number} [height] - (ellipse / rect sprite option)
 * @property {string} [fill] - (ellipse / rect sprite option)
 * @property {string} [strokeColor] - (ellipse / rect sprite option)
 * @property {number} [strokeWeight] - (ellipse / rect sprite option)
 * @property {number} [borderRadius] - (rect sprite option)
 *
 * @property {string} [topUrl] - (web image asset sprite option)
 * @property {string} [bottomUrl] - (web image asset sprite option)
 *
 */
export declare class PseudoSprite {
  readonly uniqueId: string;
  // ?
  displayLayer: string;
  zOrder: number;
  opacity: number;
  isInteractive: number;

  isStatic: number;
  angle: number;
  position: TwoVector;
  velocity: TwoVector;
  friction: TwoVector;

  allowSpectatorInteraction: boolean;
  checkCollisions: boolean;
  collisionGroup?: string;
  applyPhysics: boolean;

  isPlayerSprite: boolean;
  // Text Sprite Options
  //
  fontSize?: number;
  containerWidth?: number;
  text?: string;
  align?: "left" | "center" | "right";
  fontFamily?: string;
  fontWeight?: string;
  fontColor?: string;
  // Rect Sprite Options
  //
  width: number;
  height: number;
  fill?: string;
  strokeColor?: string;
  strokeWeight?: number;
  borderRadius?: number;
  // Rect Sprite Options
  //
  topUrl?: string;
  bottomUrl?: string;

  /**
   * Attaches a component to this sprite.
   *
   * @typedef {Function} attachComponent
   * @param {Object} options - The options for attaching a component.
   * @param {string} [options.componentName] - The name of the component. When not included, defaults to scriptId
   * @param {string} [options.props] - These values get passed to the constructor
   * @param {string} options.scriptId - The script ID of the component.
   * @return ComponentScript
   */
  attachComponent(options: { componentName?: string; props: any; scriptId: string }): ComponentScript;
  /**
   * Detaches a component from this sprite.
   *
   * @typedef {Function} detachComponent
   * @param {string} componentName - The name of the component to detach.
   */
  detachComponent(componentName: string): void;
  /**
   * Gets a component from this sprite.
   *
   * @typedef {Function} getComponent
   * @param {string} componentName - The name of the component to get.
   * @return ComponentScript
   */
  getComponent(componentName: string): ComponentScript;
}

export declare class PseudoEvent {
  /**
   * Prevent this event from firing at the system level.
   *
   */
  stopPropagation(): void;
}

export declare class ComponentScript {
  sprite: PseudoSprite;
  componentName: string;

  constructor({ isHydration }: { isHydration: boolean } & any);

  onInit({ isHydration, ...props }: { isHydration: boolean } & any): void;
  onPlayerStart(): void;
  onSpectatorStart(): void;
  onHostStart(): void;
  onStep(deltaTime: number): void;
  onPhysicsStep(deltaTime: number): void;
  onPlayerJoined({ playerId }: { playerId: number }): void;
  onPlayerLeft({ playerId }: { playerId: number }): void;

  onClicked({ event }: { event: PseudoEvent }): void;

  onSpriteCollisionStart({
    collisionX,
    collisionY,
    sprite,
  }: {
    collisionX: number;
    collisionY: number;
    sprite: PseudoSprite;
  }): void;
  onSpriteCollisionStop({
    collisionX,
    collisionY,
    sprite,
  }: {
    collisionX: number;
    collisionY: number;
    sprite: PseudoSprite;
  }): void;
  onBeforeDestroy(): void;
}

export declare class SystemScript {
  systemName: string;

  onInit({ isHydration, ...props }: { isHydration: boolean } & any): void;
  onStep(deltaTime: number): void;

  onPlayerStart(): void;
  onSpectatorStart(): void;
  onHostStart(): void;

  onPhysicsStep(deltaTime: number): void;
  onPlayerJoined({ playerId }: { playerId: number }): void;
  onPlayerLeft({ playerId }: { playerId: number }): void;

  constructor({ isHydration }: { isHydration: boolean } & any);

  /**
   * Handles the event when a sprite is clicked.
   *
   * @param {Object} params - The event parameters.
   * @param {PseudoEvent} params.event - The event associated with the sprite click.
   * @param {PseudoSprite} params.sprite - The sprite that was clicked.
   *
   * @returns {void}
   */
  onSpriteClicked({ event, sprite }: { event: PseudoEvent; sprite: PseudoSprite }): void;

  onSpriteCollisionStart({
    collisionX,
    collisionY,
    sprite1,
    sprite2,
  }: {
    collisionX: number;
    collisionY: number;
    sprite1: PseudoSprite;
    sprite2: PseudoSprite;
  }): void;
  onSpriteCollisionStop({
    collisionX,
    collisionY,
    sprite1,
    sprite2,
  }: {
    collisionX: number;
    collisionY: number;
    sprite1: PseudoSprite;
    sprite2: PseudoSprite;
  }): void;

  onBeforeDestroy(): void;

  /**
   * Run any logic here that wants to be setup before the player actually joins the game.
   * If async, the join request will wait until this process is complete before the player actually joins the game
   * This was initially designed to support setting up iframes, waiting for the connection to establish before becoming a player.
   *
   * if you set anything up in this routine, you will want to clean it up in onJoinGameAsPlayerInterrupt
   *
   * All this code must complete in 12 seconds, otherwise we will interrupt with reason = TIMEOUT
   *
   */
  onBeforeJoinGameAsPlayer(): void;

  /**
   * Anything you spin up in onBeforeJoinGameAsPlayer, might have to be torn down in this routine.
   *
   * This method is given an object, with one key: reason. This reason can be any of the following:
   * USER_INITIATED_ABORT - The user cancelled their join attempt
   * CLOSED - The engine the user is trying to join is not accepting players
   * ERROR - There was an error while joining (usually server / network issues)
   * TIMEOUT - The code running in onBeforeJoinGameAsPlayer took too long to complete.
   *
   *
   */
  onJoinGameAsPlayerInterrupt({ reason }: { reason: "USER_INITIATED_ABORT" | "CLOSED" | "ERROR" | "TIMEOUT" }): void;
}

declare global {
  type PseudoSprite = PseudoSprite;

  /**
   * Represents a system script, which includes functionality for handling sprite interactions and other system-level operations.
   */
  export class SystemScript {
    systemName: string;

    onInit({ isHydration, ...props }: { isHydration: boolean } & any): void;
    onStep(deltaTime: number): void;
    onPlayerStart(): void;
    onSpectatorStart(): void;
    onHostStart(): void;
    onPhysicsStep(deltaTime: number): void;
    onPlayerJoined({ playerId }: { playerId: number }): void;
    onPlayerLeft({ playerId }: { playerId: number }): void;

    /**
     * Run any logic here that wants to be setup before the player actually joins the game.
     * If async, the join request will wait until this process is complete before the player actually joins the game
     * This was initially designed to support setting up iframes, waiting for the connection to establish before becoming a player.
     *
     * if you set anything up in this routine, you will want to clean it up in onJoinGameAsPlayerInterrupt
     *
     * All this code must complete in 12 seconds, otherwise we will interrupt with reason = TIMEOUT
     *
     */
    onBeforeJoinGameAsPlayer(): void;

    /**
     * Anything you spin up in onBeforeJoinGameAsPlayer, might have to be torn down in this routine.
     *
     * This method is given an object, with one key: reason. This reason can be any of the following:
     * USER_INITIATED_ABORT - The user cancelled their join attempt
     * CLOSED - The engine the user is trying to join is not accepting players
     * ERROR - There was an error while joining (usually server / network issues)
     * TIMEOUT - The code running in onBeforeJoinGameAsPlayer took too long to complete.
     *
     *
     */
    onJoinGameAsPlayerInterrupt({ reason }: { reason: "USER_INITIATED_ABORT" | "CLOSED" | "ERROR" | "TIMEOUT" }): void;

    /**
     * Anything passed to props when attaching this System, will appear in this params object
     * @param isHydration
     */
    constructor({ isHydration }: { isHydration: boolean } & any);

    /**
     * onSpriteClicked
     * @param {Object} options
     * @param {PseudoEvent} options.event
     * @param {PseudoSprite} options.sprite
     */
    onSpriteClicked({ event, sprite }: { event: PseudoEvent; sprite: PseudoSprite }): void;

    onSpriteCollisionStart({
      collisionX,
      collisionY,
      sprite1,
      sprite2,
    }: {
      collisionX: number;
      collisionY: number;
      sprite1: PseudoSprite;
      sprite2: PseudoSprite;
    }): void;
    onSpriteCollisionStop({
      collisionX,
      collisionY,
      sprite1,
      sprite2,
    }: {
      collisionX: number;
      collisionY: number;
      sprite1: PseudoSprite;
      sprite2: PseudoSprite;
    }): void;

    onBeforeDestroy(): void;
  }

  /**
   * Represents a component script, which includes functionality for handling sprite interactions and other sprite-level operations.
   */
  export class ComponentScript {
    sprite: PseudoSprite;
    componentName: string;

    /**
     * Anything passed to props when attaching this System, will appear in this params object
     * @param isHydration
     */
    constructor({ isHydration }: { isHydration: boolean } & any);

    onInit({ isHydration, ...props }: { isHydration: boolean } & any): void;
    onStep(deltaTime: number): void;
    onPlayerStart(): void;
    onSpectatorStart(): void;
    onHostStart(): void;
    onPhysicsStep(deltaTime: number): void;
    onPlayerJoined({ playerId }: { playerId: number }): void;
    onPlayerLeft({ playerId }: { playerId: number }): void;

    onClicked({ event }: { event: PseudoEvent }): void;

    onSpriteCollisionStart({
      collisionX,
      collisionY,
      sprite,
    }: {
      collisionX: number;
      collisionY: number;
      sprite: PseudoSprite;
    }): void;
    onSpriteCollisionStop({
      collisionX,
      collisionY,
      sprite,
    }: {
      collisionX: number;
      collisionY: number;
      sprite: PseudoSprite;
    }): void;

    onBeforeDestroy(): void;
  }
}
