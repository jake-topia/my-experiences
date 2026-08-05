import { PseudoPromise } from "./InfraTypes";
/**
 * Options for configuring the integrations manager.
 *
 * @typedef {Object} IntegrationsManagerOptions
 * @property {string} interactivePublicKey - The public key used for interactions.
 */
export declare type IntegrationsManagerOptions = {
  interactivePublicKey: string;
};

/**
 * Enumeration for the scope of a data object.
 *
 * @readonly
 * @enum {string}
 */
export declare enum DATA_OBJECT_SCOPE {
  ASSET = "ASSET",
  USER = "USER",
  WORLD = "WORLD",
}

/**
 * The scope of a data object, derived from the DATA_OBJECT_SCOPE enum.
 */
export declare type DataObjectScope = (typeof DATA_OBJECT_SCOPE)[keyof typeof DATA_OBJECT_SCOPE];

/**
 * Options for opening an iframe.
 *
 * @typedef {IntegrationsManagerOptions & Object} OpenIframeOptions
 * @property {any} iframeId - The ID of the iframe.
 * @property {any} hasDataChannel - Indicates if the iframe has a data channel.
 * @property {any} linkSamlQueryParams - SAML query parameters for the link.
 * @property {string} link - The URL of the iframe.
 * @property {string} title - The title of the iframe.
 * @property {boolean} [isOpenLinkInDrawer] - Whether to open the link in a drawer. If false - it will open silently
 */
export declare type OpenIframeOptions = IntegrationsManagerOptions & {
  iframeId: any;
  hasDataChannel: any;
  linkSamlQueryParams: any;
  link: string;
  title: string;
  isOpenLinkInDrawer?: boolean;
};

/**
 * Opens an iframe with the specified options.
 *
 * @typedef {Function} openIframe
 * @param {OpenIframeOptions} payload - The options for the iframe.
 */
export declare type openIframe = (payload: OpenIframeOptions) => PseudoPromise<string>;

/**
 * Options for retrieving a data object.
 *
 * @typedef {IntegrationsManagerOptions & Object} GetDataObjectOptions
 * @property {"ASSET" | "USER" | "WORLD"} scope - The scope of the data object.
 * @property {number} [playerId] - If scope is user, you must provide the player id you're targeting
 */
export declare type GetDataObjectOptions = IntegrationsManagerOptions & {
  scope: "ASSET" | "USER" | "WORLD";
  playerId?: number;
};

/**
 * Retrieves a data object with the specified options.
 * (async)
 *
 * @typedef {Function} getDataObject
 * @param {GetDataObjectOptions} payload - The options for the data object.
 * @returns {PseudoPromise<Record<string, any>>} - A pseudo-promise resolving to the data object.
 */
export declare type getDataObject = (payload: GetDataObjectOptions) => PseudoPromise<Record<string, any>>;

/**
 * Options for updating a data object.
 *
 * @typedef {IntegrationsManagerOptions & Object} UpdateDataObjectOptions
 * @property {"ASSET" | "USER" | "WORLD"} scope - The scope of the data object.
 * @property {any} payload - The payload to update the data object with.
 * @property {number} [playerId] - If scope is user, you must provide the player id you're targeting
 */
export declare type UpdateDataObjectOptions = IntegrationsManagerOptions & {
  scope: "ASSET" | "USER" | "WORLD";
  playerId?: number;
  payload: any;
};

/**
 * Updates a data object with the specified options.
 * (async)
 *
 * @typedef {Function} updateDataObject
 * @param {UpdateDataObjectOptions} payload - The options for the data object update.
 * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the update is complete.
 */
export declare type updateDataObject = (payload: UpdateDataObjectOptions) => PseudoPromise<void>;

/**
 * Options for triggering a particle effect.
 *
 * @typedef {IntegrationsManagerOptions & Object} TriggerParticleEffectOptions
 * @property {string} [particleId] - The ID of the particle effect. You must specify either particleId or particleName.
 * @property {string} [particleName] - The name of the particle effect. You must specify either particleId or particleName.
 * @property {number} duration - The duration of the particle effect in milliseconds.
 * @property {number} followPlayerId - The ID of the player the effect should follow.
 * @property {{ x: number, y: number }} position - The position where the effect should occur.
 */
export declare type TriggerParticleEffectOptions = IntegrationsManagerOptions & {
  particleId?: string;
  particleName?: string;
  duration: number;
  followPlayerId?: number;
  position?: { x: number; y: number };
};

/**
 * Triggers a particle effect with the specified options.
 * (async)
 *
 * @typedef {Function} triggerParticleEffect
 * @param {TriggerParticleEffectOptions} payload - The options for the particle effect.
 * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the effect is triggered.
 */
export declare type triggerParticleEffect = (payload: TriggerParticleEffectOptions) => PseudoPromise<void>;

/**
 * @typedef {Object} AnalyticsItem
 * @property {string} analyticName - The name of the analytic event.
 * @property {number} [incrementBy=1] - The amount to increment the analytic by.
 * @property {string} [uniqueKey] - A unique key for tracking analytics.
 * @property {string} [profileId] - Allows the host to post analytics for other players in the experience.
 */

/**
 * @typedef {Object} PublicKeyAnalyticsOptions
 * @property {AnalyticsItem[]} analytics - An array of analytics objects.
 */
export declare type PublicKeyAnalyticsOptions = IntegrationsManagerOptions & {
  analytics: {
    analyticName: string;
    incrementBy?: number;
    uniqueKey?: string;
    profileId?: string;
  }[];
};

/**
 * Sends public key analytics with the specified options.
 * (async)
 *
 * @typedef {Function} putPublicKeyAnalytics
 * @param {PublicKeyAnalyticsOptions} payload - The analytics options.
 * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the analytics are sent.
 */
export declare type putPublicKeyAnalytics = (payload: PublicKeyAnalyticsOptions) => PseudoPromise<void>;

/**
 * @typedef WorldActivityTypes
 * Possible values for the world activity type
 */
export type WorldActivityTypes = "GAME_ON" | "GAME_WAITING" | "GAME_HIGH_SCORE";

/**
 * Options used to fire a world activity log.
 * @typedef WorldActivityOptions
 * @property {WorldActivityTypes} type
 * @property {number[]} [excludeFromNotification] - This should be an array of playerIds, anyone not in this array and in the world, will see the activity log toast.
 * @property {string} interactivePublicKey
 */
export type WorldActivityOptions = {
  type: WorldActivityTypes;
  excludeFromNotification?: number[];
  interactivePublicKey: string;
};

/**
 * Fires a world activity log entry.
 * (async)
 *
 * @typedef {Function} setWorldActivity
 * @param {WorldActivityOptions} options - The activity options
 * @param {string} options.interactivePublicKey - A valid public key. The activity log will use the description field from this public key.
 * @param {number[]} [options.excludeFromNotification] - A list of player ids to exclude from the notification.
 * @param {"GAME_ON" | "GAME_WAITING" | "GAME_HIGH_SCORE"} options.type - The specific activity type to fire.
 * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the activity has sent.
 */
export declare type setWorldActivity = (payload: WorldActivityOptions) => PseudoPromise<void>;

/**
 * Closes the currently open iframe.
 *
 * @typedef {Function} closeIframe
 */
export declare type closeIframe = () => void;

/**
 * The integrations manager, providing various utility methods for integrating Topia's public api.
 *
 * @typedef {Object} integrationsManager
 * @property {openIframe} openIframe - Opens an iframe.
 * @property {getDataObject} getDataObject - Retrieves a data object.
 * @property {updateDataObject} updateDataObject - Updates a data object.
 * @property {triggerParticleEffect} triggerParticleEffect - Triggers a particle effect.
 * @property {putPublicKeyAnalytics} putPublicKeyAnalytics - Sends public key analytics.
 * @property {setWorldActivity} setWorldActivity - Fires a world activity log entry.
 * @property {closeIframe} closeIframe - Closes the currently open iframe.
 */
export declare type getSceneDropId = () => string;

/**
 * Options for force-opening an existing iframe by ID.
 */
export declare type ForceOpenIframeByIdOptions = {
  iframeId: string;
  osType?: string;
  title?: string;
};

/**
 * Force-open an existing iframe (opens the Link drawer and attaches the iframe).
 */
export declare type forceOpenIframeById = (payload: ForceOpenIframeByIdOptions) => void;

/**
 * Options for hiding/closing a drawer by ID.
 */
export declare type HideDrawerByIframeIdOptions = {
  iframeId: string;
};

/**
 * Hide/close an iframe drawer by its iframeId.
 */
export declare type hideDrawerByIframeId = (payload: HideDrawerByIframeIdOptions) => void;

/**
 * Options for destroying an iframe by ID.
 */
export declare type DestroyIframeByIdOptions = {
  iframeId: string;
};

/**
 * Destroy an iframe by its ID (completely removes it from DOM and cleans up resources).
 */
export declare type destroyIframeById = (payload: DestroyIframeByIdOptions) => void;

export declare type IntegrationsManager = {
  /**
   * Opens an iframe with the specified options.
   * If hasDataChannel is true, this can run asynchronously, resolving when the data channel is connected
   * If you want an iframe open while the user is a player, await this in a onBeforeJoinGameAsPlayer method
   * @typedef {Function} openIframe
   * @param {OpenIframeOptions} payload - The options for the iframe.
   */
  openIframe: openIframe;
  /**
   * Retrieves a data object with the specified options.
   * (async)
   *
   * @typedef {Function} getDataObject
   * @param {GetDataObjectOptions} payload - The options for the data object.
   * @returns {PseudoPromise<Record<string, any>>} - A pseudo-promise resolving to the data object.
   */
  getDataObject: getDataObject;
  /**
   * Updates a data object with the specified options.
   * (async)
   *
   * @typedef {Function} updateDataObject
   * @param {UpdateDataObjectOptions} payload - The options for the data object update.
   * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the update is complete.
   */
  updateDataObject: updateDataObject;
  /**
   * Triggers a particle effect with the specified options.
   * (async)
   *
   * @typedef {Function} triggerParticleEffect
   * @param {TriggerParticleEffectOptions} payload - The options for the particle effect.
   * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the effect is triggered.
   */
  triggerParticleEffect: triggerParticleEffect;
  /**
   * Sends public key analytics with the specified options.
   * (async)
   *
   * @typedef {Function} putPublicKeyAnalytics
   * @param {PublicKeyAnalyticsOptions} payload - The analytics options.
   * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the analytics are sent.
   */
  putPublicKeyAnalytics: putPublicKeyAnalytics;

  /**
   * Fires a world activity log entry.
   * (async)
   *
   * @typedef {Function} putPublicKeyAnalytics
   * @param {Object} options - The activity options
   * @param {string} options.interactivePublicKey - A valid public key. The activity log will use the description field from this public key.
   * @param {number[]} [options.excludeFromNotification] - A list of player ids to exclude from the notification.
   * @param {"GAME_ON" | "GAME_WAITING" | "GAME_HIGH_SCORE"} options.type - The specific activity type to fire.
   * @returns {PseudoPromise<void>} - A pseudo-promise resolving when the activity has sent.
   */
  setWorldActivity: setWorldActivity;

  /**
   * Closes the currently open iframe.
   *
   * @typedef {Function} closeIframe
   */
  closeIframe: closeIframe;

  /**
   * Returns the sceneDropId of the current asset/experience.
   */
  getSceneDropId: getSceneDropId;

  /**
   * Force-open an existing iframe by its ID (opens the Link drawer and attaches it).
   */
  forceOpenIframeById: forceOpenIframeById;

  /**
   * Hide/close a drawer by its ID.
   */
  hideDrawerByIframeId: hideDrawerByIframeId;

  /**
   * Destroy an iframe by its ID (completely removes it from DOM and cleans up resources).
   */
  destroyIframeById: destroyIframeById;
};

declare global {
  /**
   * The integrations manager, providing various utility methods for integration tasks.
   *
   * @property {openIframe} openIframe - Opens an iframe.
   * @property {getDataObject} getDataObject - Retrieves a data object.
   * @property {updateDataObject} updateDataObject - Updates a data object.
   * @property {triggerParticleEffect} triggerParticleEffect - Triggers a particle effect.
   * @property {putPublicKeyAnalytics} putPublicKeyAnalytics - Sends public key analytics.
   * @property {setWorldActivity} setWorldActivity - Fires a world activity log entry.
   * @property {closeIframe} closeIframe - Closes the currently open iframe.
   */
  const integrationsManager: IntegrationsManager;
}

export {}; // Required to make this file a module

export const integrationsManager: IntegrationsManager;
