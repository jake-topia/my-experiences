import { ComponentScript, SystemScript } from "./ScriptTypes";

export declare type attachComponent = (options: {
  objectUniqueId: string;
  componentName: string;
  scriptId: ComponentIdType;
  props?: Record<string, any>;
}) => void;

export declare type detachComponent<ComponentName extends keyof ComponentsMap = ComponentIdType> = (options: {
  objectUniqueId: string;
  componentName: ComponentName;
}) => ComponentsMap[ComponentName];

export declare type attachSystem<SystemName extends keyof SystemsMap = string> = (options: {
  systemName?: string;
  scriptId: SystemName;
  isPlayerControlled?: boolean;
  props?: Record<string, any>;
}) => SystemsMap[SystemName];

/**
 * @typedef AttachSystemOptions
 * @property {string} [systemName] - The name of the system. When not included, defaults to scriptId
 * @property {boolean} [isPlayerControlled] - Whether the system is controlled by the player.
 * @property {any} [props] - These values get passed to the constructor
 */
export type AttachSystemOptions = {
  systemName?: string;
  isPlayerControlled?: boolean;
  props?: Record<string, any>;
};

//TODO - move engine apis over to this syntax - it improves type handling
// export declare const attachSystemInLineFn = <SystemName extends keyof SystemsMap = SystemIdType>(
//   scriptId: SystemName,
//   options: AttachSystemOptions,
// ): SystemsMap[SystemName] => {
//   return {} as SystemsMap[SystemName];
// };
// export declare type attachSystemInLine<SystemName extends keyof SystemsMap = SystemIdType> = (
//   scriptId: SystemName,
// ) => SystemsMap[SystemName];

export declare type detachSystem = (options: { systemName: keyof SystemsMap | string }) => void;

export declare type getComponent = <ComponentName extends string>(options: {
  objectUniqueId: string;
  componentName: ComponentName;
}) => ComponentName extends keyof ComponentsMap ? ComponentsMap[ComponentName] : ComponentScript | null;

export type getSystem = <SystemName extends string>(options: {
  systemName: SystemName;
}) => SystemName extends keyof SystemsMap ? SystemsMap[SystemName] : SystemScript | null;

/**
 * ScriptManager provides methods for managing components and systems.
 *
 * @typedef {Object} ScriptManager
 * @property {attachComponent} attachComponent - Attaches a component to an object.
 * @property {detachComponent} detachComponent - Detaches a component from an object.
 * @property {attachSystem} attachSystem - Attaches a system to the manager.
 * @property {detachSystem} detachSystem - Detaches a system from the manager.
 * @property {getComponent} getComponent - Retrieves a component attached to an object.
 * @property {getSystem} getSystem - Retrieves a system by name.
 */
export type ScriptManager = {
  // attachSystemInLineFn2: attachSystemInLineFn;
  /**
   * Attaches a component to an object.
   *
   * @typedef {Function} attachComponent
   * @param {Object} options - The options for attaching a component.
   * @param {string} options.objectUniqueId - The unique ID of the object.
   * @param {string} [options.componentName] - The name of the component. When not included, defaults to scriptId
   * @param {string} [options.props] - These values get passed to the constructor
   * @param {ComponentIdType} options.scriptId - The script ID of the component.
   * @return PseudoComponent
   */
  attachComponent: attachComponent;
  /**
   * Detaches a component from an object.
   *
   * @typedef {Function} detachComponent
   * @param {Object} options - The options for detaching a component.
   * @param {string} options.objectUniqueId - The unique ID of the object.
   * @param {keyof ComponentsMap} options.componentName - The name of the component to detach.
   */
  detachComponent: detachComponent;
  /**
   * Attaches a system to the manager.
   *
   * @typedef {Function} attachSystem
   * @param {Object} options - The options for attaching a system.
   * @param {string} [options.systemName] - The name of the system. When not included, defaults to scriptId
   * @param {SystemIdType} options.scriptId - The script ID of the system.
   * @param {boolean} [options.isPlayerControlled] - Whether the system is controlled by the player.
   * @param {any} [options.props] - These values get passed to the constructor
   * @return PseudoSystem
   */
  attachSystem: attachSystemFn;
  /**
   * Attaches a system to the manager.
   *
   * @typedef {Function} attachSystemInLine
   * @param {SystemIdType} scriptId - The script ID of the system.
   * @param {Object} options - The options for attaching a system.
   * @param {string} [options.systemName] - The name of the system. When not included, defaults to scriptId
   * @param {boolean} [options.isPlayerControlled] - Whether the system is controlled by the player.
   * @param {any} [options.props] - These values get passed to the constructor
   * @return PseudoSystem
   */
  attachSystemInLine: attachSystemInLine;
  /**
   * Detaches a system from the manager.
   *
   * @typedef {Function} detachSystem
   * @param {Object} options - The options for detaching a system.
   * @param {keyof SystemsMap} options.systemName - The name of the system to detach.
   */
  detachSystem: detachSystem;

  /**
   * Retrieves a component attached to an object.
   *
   * @template ComponentName
   * @typedef {Function} getComponent
   * @param {Object} options - The options for retrieving a component.
   * @param {string} options.objectUniqueId - The unique ID of the object.
   * @param {ComponentName} options.componentName - The name of the component to retrieve.
   * @returns {null|ComponentsMap[ComponentName]} The component or null if not found.
   */
  getComponent: getComponent;
  /**
   * Retrieves a system by name.
   *
   * @template SystemName
   * @typedef {Function} getSystem
   * @param {Object} options - The options for retrieving a system.
   * @param {SystemName} options.systemName - The name of the system to retrieve.
   * @returns {null|SystemsMap[SystemName]} The system or null if not found.
   */
  getSystem: getSystem;
};

declare global {
  /**
   * The `scriptManager` allows interaction with the script's utilities for managing components and systems.
   *
   * @global
   * @const {ScriptManager} scriptManager
   */
  const scriptManager = {
    // /**
    //  * Attaches a system to the runtime. This method should be preferred over attachSystem, as it is capable of returning a fully typed instance of the System.
    //  *
    //  * @typedef {Function} attachSystem
    //  * @param {SystemIdType} scriptId - The script Id of the system. Note that the compiler may bark if you pass a string in here. To remove the error, cast the string as SystemIdType... like so: scriptId: someString as SystemIdType.
    //  * @param {AttachSystemOptions} options - The options for attaching a system.
    //  * @return PseudoSystem
    //  */
    // attachSystemInLine: attachSystemInLineFn,
    /**
     * Attaches a component to an object.
     *
     * @typedef {Function} attachComponent
     * @param {Object} options - The options for attaching a component.
     * @param {string} options.objectUniqueId - The unique ID of the object.
     * @param {string} [options.componentName] - The name of the component. When not included, defaults to scriptId
     * @param {string} [options.props] - These values get passed to the constructor
     * @param {ComponentIdType} options.scriptId - The script ID of the component.
     * @return PseudoComponent
     */
    attachComponent: (() => {}) as attachComponent,

    /**
     * Detaches a component from an object.
     *
     * @typedef {Function} detachComponent
     * @param {Object} options - The options for detaching a component.
     * @param {string} options.objectUniqueId - The unique ID of the object.
     * @param {keyof ComponentsMap} options.componentName - The name of the component to detach.
     */
    detachComponent: (() => {}) as detachComponent,
    /**
     * Attaches a system to the manager.
     *
     * @typedef {Function} attachSystem
     * @param {Object} options - The options for attaching a system.
     * @param {string} [options.systemName] - The name of the system. When not included, defaults to scriptId
     * @param {SystemIdType} options.scriptId - The script ID of the system.
     * @param {boolean} [options.isPlayerControlled] - Whether the system is controlled by the player.
     * @param {any} [options.props] - These values get passed to the constructor
     * @return PseudoSystem
     */
    attachSystem: (() => {}) as attachSystem,
    // /**
    //  * Attaches a system to the manager.
    //  *
    //  * @typedef {Function} attachSystemInLine
    //  * @param {SystemIdType} scriptId - The script ID of the system.
    //  * @param {Object} options - The options for attaching a system.
    //  * @param {string} [options.systemName] - The name of the system. When not included, defaults to scriptId
    //  * @param {boolean} [options.isPlayerControlled] - Whether the system is controlled by the player.
    //  * @param {any} [options.props] - These values get passed to the constructor
    //  * @return PseudoSystem
    //  */
    // attachSystemInLine: (() => {}) as attachSystemInLine,
    /**
     * Detaches a system from the manager.
     *
     * @typedef {Function} detachSystem
     * @param {Object} options - The options for detaching a system.
     * @param {keyof SystemsMap} options.systemName - The name of the system to detach.
     */
    detachSystem: (() => {}) as detachSystem,

    /**
     * Retrieves a component attached to an object.
     *
     * @template ComponentName
     * @typedef {Function} getComponent
     * @param {Object} options - The options for retrieving a component.
     * @param {string} options.objectUniqueId - The unique ID of the object.
     * @param {ComponentName} options.componentName - The name of the component to retrieve.
     * @returns {null|ComponentsMap[ComponentName]} The component or null if not found.
     */
    getComponent: (() => {}) as getComponent,
    /**
     * Retrieves a system by name.
     *
     * @template SystemName
     * @typedef {Function} getSystem
     * @param {Object} options - The options for retrieving a system.
     * @param {SystemName} options.systemName - The name of the system to retrieve.
     * @returns {null|SystemsMap[SystemName]} The system or null if not found.
     */
    getSystem: (() => {}) as getSystem,
  };
}

export const scriptManager: ScriptManager;
