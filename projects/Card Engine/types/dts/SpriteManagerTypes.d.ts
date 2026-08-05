import { PseudoSprite } from "./ScriptTypes";

/**
 * Options for configuring a sprite.
 *
 * @typedef {Object} SpriteOptions
 * @property {string} [uniqueId] - A unique identifier for the sprite.
 *
 * @property {number} [scaleX] - The scale along x-axis; default: 1
 * @property {number} [scaleY] - The scale along y-axis; default: 1
 * @property {number} [topAdjust] - Adjusts the layering of sprites on the top layer.
 * @property {string} [bottomAdjust] - Adjusts the layering of the sprites on the bottom layer. "NONE" | "BRING_TO_BACK" | "BRING_TO_FRONT"
 *
 * @property {number} [positionX] - The x-coordinate of the sprite's position.
 * @property {number} [positionY] - The y-coordinate of the sprite's position.
 * @property {number} [velocityX] - The x-component of the sprite's velocity.
 * @property {number} [velocityY] - The y-component of the sprite's velocity.
 * @property {number} [frictionX] - The x-component of the sprite's friction.
 * @property {number} [frictionY] - The y-component of the sprite's friction.
 * @property {boolean} [isInteractive] - Whether the sprite is interactive.
 * @property {boolean} [allowSpectatorInteraction] - Whether spectators can interact with the sprite.
 * @property {number} [opacity] - The sprite's opacity (0 to 1).
 * @property {string} [displayLayer] - The layer in which the sprite is displayed.
 * @property {number} [zOrder] - The z-order of the sprite for rendering.
 * @property {boolean} [isImmovable] - Whether the sprite is immovable.
 * @property {boolean} [isPlayerControlled] - Whether the sprite participates in syncing from the host. When true, each user will maintain their own instance of this sprite.
 * @property {boolean} [applyPhysics] - Whether the sprite is acted on by the physics manager, and participates in the PhysicsStep.
 * @property {boolean} [checkCollisions] - Whether this sprite factors into collision calculations.
 * @property {boolean} [isImpassable] - Whether this sprite factors into movement collision calculations.
 *
 * @property {number} [fontSize] - (text sprite option) The size of the font we'll use, in pixels.
 * @property {number} [containerWidth] - (text sprite option)
 * @property {string} [align] - (text sprite option) left | center | right
 * @property {string} [text] - (text sprite option)
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
 * @property {string} [collisionGroup] - When configured, we can skip collision checks against objects in the same collision group.


 */
export declare type SpriteOptions = {
  scaleX?: number;
  scaleY?: number;
  topAdjust?: number;
  bottomAdjust?: "NONE" | "BRING_TO_BACK" | "BRING_TO_FRONT";
  positionX?: number;
  positionY?: number;
  velocityX?: number;
  velocityY?: number;
  frictionX?: number;
  frictionY?: number;
  applyPhysics?: boolean;
  isInteractive?: boolean;
  allowSpectatorInteraction?: boolean;
  opacity?: number;
  displayLayer?: string;
  uniqueId?: string;
  zOrder?: number;
  isImmovable?: boolean;
  checkCollisions?: boolean;
  isImpassable?: boolean;
  isPlayerControlled?: boolean;
  // Text Sprite Options
  //
  fontSize?: number;
  containerWidth?: number;
  text?: string;
  align?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontColor?: string;
  // Rect Sprite Options
  //
  width?: number;
  height?: number;
  fill?: string;
  strokeColor?: string;
  strokeWeight?: number;
  borderRadius?: number;
  // Rect Sprite Options
  //
  topUrl?: string;
  bottomUrl?: string;
  // collision optimization
  //
  collisionGroup?: string;
};

export declare type addSprite = (spriteId: SpriteIdType, spriteOptions: SpriteOptions) => PseudoSprite;
export declare type getSprite = (objectUniqueId: string) => PseudoSprite | undefined;

export declare type removeSprite = (spriteId: string) => void;

export declare type updateSprite = (spriteId: string, spriteOptions: SpriteOptions) => void;

export declare type getProperty = <Property extends keyof SpriteOptions>(
  spriteId: string,
  property: Property,
) => SpriteOptions[Property];

/**
 * Configuration for a web image sprite as a world asset.
 */
export type WebImageSpriteAsWorldAssetConfig = {
  /**
   * The ID of the sprite.
   */
  spriteId: string;
  /**
   * Whether to persist the sprite with the engine.
   */
  persistWithEngine?: boolean;
  /**
   * Whether the sprite has collision.
   */
  collision?: boolean;
  /**
   * The X position of the sprite.
   */
  positionX: number;
  /**
   * The Y position of the sprite.
   */
  positionY: number;

  scaleX?: number;
  scaleY?: number;

  topAdjust?: number;
  bottomAdjust?: "NONE" | "BRING_TO_BACK" | "BRING_TO_FRONT";
};

/**
 * Configuration for dropping web image sprites as world assets.
 */
export type WebImageDropConfig = {
  spriteId: string;
  engineDroppedAssetId?: string;
  //
  persistWithEngine?: boolean;
  collision?: boolean;
  positionX: number;
  positionY: number;
};
/**
 * Configuration options for dropping web image sprites as world assets.
 */
interface DropWebImageSpritesAsWorldAssetsOptions {
  /**
   * The sprites to drop.
   */
  sprites: WebImageDropConfig[];
  /**
   * The public key of the interactive.
   */
  interactivePublicKey: string;
}

/**
 * Drops web image sprites as world assets.
 *
 * @param options Options for dropping the sprites.
 */
export type dropWebImageSpritesAsWorldAssets = (options: DropWebImageSpritesAsWorldAssetsOptions) => void;

/**
 * Configuration options for removing engine-dropped world assets.
 */
interface RemoveEngineDroppedWorldAssetsOptions {
  /**
   * The IDs of the assets to remove.
   */
  engineDroppedAssetIds: string[];
  /**
   * The public key of the interactive.
   */
  interactivePublicKey: string;
}

/**
 * Removes engine-dropped world assets.
 *
 * @param options Options for removing the assets.
 */
export type removeEngineDroppedWorldAssets = (options: RemoveEngineDroppedWorldAssetsOptions) => void;

/**
 * Gets a list of engine dropped assets ids that are in the world.
 *
 */
export type getEngineDroppedAssetIds = () => string[];
/**
 * Manages sprite-related operations.
 *
 * @typedef {Object} spriteManager
 * @property {addSprite} addSprite - Adds a sprite with the specified ID and options.
 * @property {getSprite} getSprite - Gets a sprite with the specified unique ID
 * @property {removeSprite} removeSprite - Removes a sprite by its unique ID.
 * @property {updateSprite} updateSprite - Updates a sprite's properties.
 * @property {getProperty} getProperty - Retrieves a specific property of a sprite.
 */
export declare type spriteManager = {
  /**
   * Adds a sprite with the specified ID and options.
   *
   * @typedef {Function} addSprite
   * @param {SpriteIdType} spriteId - The ID of the sprite to add.
   * @param {SpriteOptions} spriteOptions - The options for the sprite.
   * @return PseudoSprite
   */
  addSprite: addSprite;
  /**
   * Gets a sprite with the specified unique ID
   *
   * @typedef {Function} getSprite
   * @param {string} objectUniqueId - The ID of the sprite to add.
   * @return PseudoSprite
   */
  getSprite: getSprite;
  /**
   * Removes a sprite by its unique ID.
   *
   * @typedef {Function} removeSprite
   * @param {SpriteUniqueIdTypes} spriteId - The unique ID of the sprite to remove.
   */
  removeSprite: removeSprite;
  /**
   * Updates a sprite's properties with the given options.
   *
   * @typedef {Function} updateSprite
   * @param {SpriteUniqueIdTypes} spriteId - The unique ID of the sprite to update.
   * @param {SpriteOptions} spriteOptions - The updated options for the sprite.
   */
  updateSprite: updateSprite;
  /**
   * Retrieves a specific property of a sprite.
   *
   * @template Property
   * @typedef {Function} getProperty
   * @param {SpriteUniqueIdTypes} spriteId - The unique ID of the sprite.
   * @param {Property} property - The name of the property to retrieve.
   * @returns {SpriteOptions[Property]} The value of the specified property.
   */
  getProperty: getProperty;

  /**
   * Drops web image sprites as world assets.
   *
   * @param sprites The sprites to drop.
   * @param interactivePublicKey The public key of the interactive.
   */
  dropWebImageSpritesAsWorldAssets: dropWebImageSpritesAsWorldAssets;
  /**
   * Removes engine-dropped world assets.
   *
   * @param engineDroppedAssetIds The IDs of the assets to remove.
   * @param interactivePublicKey The public key of the interactive.
   */
  removeEngineDroppedWorldAssets: removeEngineDroppedWorldAssets;

  /**
   * Gets a list of engine dropped assets ids that are in the world.
   *
   */
  getEngineDroppedAssetIds: getEngineDroppedAssetIds;
};

declare global {
  /**
   * The `spriteManager` provides methods for managing sprites in the system.
   *
   * @global
   * @const {spriteManager} spriteManager
   */
  const spriteManager: spriteManager;
}

export {}; // Required to make this file a module
export const spriteManager: spriteManager;
