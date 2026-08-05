/**
 * @module playerManager
 */

export declare type getPlayerIds = () => number[];

export declare type getMyPlayerId = () => number;

/**
 * Details about a player.
 *
 * @typedef {Object} PlayerDetails
 * @property {number} height - The height of the player.
 * @property {number} width - The width of the player.
 * @property {number} x - The x-coordinate of the player's position.
 * @property {number} y - The y-coordinate of the player's position.
 * @property {string} username - The player's username.
 * @property {string} nameplate - The player's nameplate.
 * @property {string} color - The player's color.
 * @property {string} profileId - The player's profile ID.
 * @property {boolean} isBiking - Whether the player is biking.
 * @property {boolean} isMoving - Whether the player is moving.
 * @category Player Functions
 */
export declare type PlayerDetails = {
  height: number;
  width: number;
  x: number;
  y: number;
  username: string;
  nameplate: string;
  color: string;
  profileId: string;
  isBiking: boolean;
  isMoving: boolean;
};

export declare type getPlayerDetails = (playerId: number) => PlayerDetails;

export declare type tintPlayer = (playerId: number, color: string | null | undefined) => void;

export declare type setNameplate = (playerId: number, text: string | null | undefined) => void;

export declare type teleportPlayers = (playerIds: number[], options: TeleportPlayersOptions) => void;

/**
 * Options for teleporting players.
 *
 * @typedef {Object} TeleportPlayersOptions
 * @property {"area"|"radius"} distributionType - The type of teleportation distribution.
 * @property {number} radius - The radius of the teleportation area.
 * @property {number} height - The height of the teleportation area.
 * @property {number} width - The width of the teleportation area.
 * @property {number} positionX - The x-coordinate of the teleportation area.
 * @property {number} positionY - The y-coordinate of the teleportation area.
 *
 * @category Player Functions
 */
export declare type TeleportPlayersOptions = {
  distributionType: "area" | "radius";
  radius?: number;
  height?: number;
  width?: number;
  positionX: number;
  positionY: number;
};

/** @category Player Functions */
export type getIsSpectator = (playerIds: number[], teleportOptions: TeleportPlayersOptions) => boolean;

/** @category Player Functions */
export declare type kickFromGame = (playerId: number) => void;

/** @category Player Functions */
export declare type transferHost = (playerId: number) => void;

/** @category Player Functions */
export declare type leaveGame = () => void;

export declare type playerManager = {
  isHost: boolean;
  isSpectator: boolean;
  isPlayer: boolean;

  /**
   * Retrieves an array of all player IDs.
   *
   * @typedef {Function} getPlayerIds
   * @returns {number[]} An array of player IDs.
   */
  getPlayerIds: getPlayerIds;
  /**
   * Retrieves the ID of the current player.
   *
   * @typedef {Function} getMyPlayerId
   * @returns {number} The ID of the current player.
   */
  getMyPlayerId: getMyPlayerId;
  /**
   * Retrieves the details of a player by their ID.
   *
   * @typedef {Function} getPlayerDetails
   * @param {number} playerId - The ID of the player.
   * @returns {PlayerDetails} The details of the specified player.
   */
  getPlayerDetails: getPlayerDetails;
  /**
   * Tints a player with the specified color.
   *
   * @typedef {Function} tintPlayer
   * @param {number} playerId - The ID of the player.
   * @param {string|null|undefined} color - The color to tint the player, or null/undefined to remove the tint.
   */
  tintPlayer: tintPlayer;
  /**
   * Sets the nameplate text for a player.
   *
   * @typedef {Function} setNameplate
   * @param {number} playerId - The ID of the player.
   * @param {string|null|undefined} text - The nameplate text, or null/undefined to clear it.
   */
  setNameplate: setNameplate;
  /**
   * Teleports players.
   * @param {number[]} playerIds - The ids of the players you want to teleport.
   * @param {TeleportPlayersOptions} - options
   * @typedef {Function} teleportPlayers
   */
  teleportPlayers: teleportPlayers;

  /**
   * Checks if the specified player IDs are spectators based on teleportation options.
   *
   * @typedef {Function} getIsSpectator
   * @param {number[]} playerIds - An array of player IDs to check.
   * @param {TeleportPlayersOptions} teleportOptions - The teleportation options.
   * @returns {boolean} True if the players are spectators, otherwise false.
   */
  getIsSpectator: getIsSpectator;

  /**
   * Kicks a player from the game.
   *
   * @typedef {Function} kickFromGame
   * @param {number} playerId - The ID of the player to kick.
   */
  kickFromGame: kickFromGame;

  /**
   * Transfers host privileges to another player.
   *
   * @typedef {Function} transferHost
   * @param {number} playerId - The ID of the player to make host.
   */
  transferHost: transferHost;

  /**
   * Exits the experience as a player. The user becomes a spectator.
   * (The same process happens when clicking 'Leave' in the experience floating toolbar button)
   *
   * @typedef {Function} leaveGame
   */
  leaveGame: leaveGame;
};

declare global {
  /**
   * The global player manager, providing utilities for managing players.
   *
   * @global
   *
   * @property {getPlayerIds} getPlayerIds - Retrieves an array of all player IDs.
   * @property {getMyPlayerId} getMyPlayerId - Retrieves the ID of the current player.
   * @property {getPlayerDetails} getPlayerDetails - Retrieves the details of a player by their ID.
   * @property {tintPlayer} tintPlayer - Tints a player with the specified color.
   * @property {setNameplate} setNameplate - Sets the nameplate text for a player.
   * @property {teleportPlayers} teleportPlayers - Teleports all players.
   * @property {getIsSpectator} getIsSpectator - Checks if specified players are spectators.
   * @property {kickFromGame} kickFromGame - Kicks a player from the game.
   * @property {transferHost} transferHost - Transfers host privileges to another player.
   */
  export const playerManager: playerManager;
}
export const playerManager: playerManager;
