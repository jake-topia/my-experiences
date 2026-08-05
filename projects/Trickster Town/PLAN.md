# Trickster Town Plan

This plan follows the local `AI.txt` guidance: keep host authority narrow, push most UI into player-controlled sprites, use deadline timestamps instead of reset-heavy timers, and remember that new engine variables/events/scripts still need to be created manually in the Topia UI.

## Core approach

- `gameManager` stays host-authoritative for roles, phase flow, vote resolution, teleports, tints, blocker sprites, particles, and win checks.
- `clientUiManager` is `isPlayerControlled: true` and owns almost every text/button/name/vote sprite so non-hosts never try to add or update synced sprites.
- Countdowns should be driven by a host-set `phaseEndsAtMs` timestamp and local `onStep()` / host `onPhysicsStep()` checks, not by constantly clearing and recreating timers.
- Shared blocker/background sprites are the main synced sprites. Nearly everything else can be local UI.
- Secret information is only UI-secret in v1. If `playerRoleMap` is a synced server variable, a determined client could inspect it. The plan avoids revealing secrets in shared sprites, but it is not cheat-proof without a real private channel.

## Phase flow

1. `WAITING`
   Host sees clickable local config text and two start affordances: a center start label and a host-following mirror button.
   Everyone sees `Trickster Town`, `waiting for players... (X/4 minimum)`, and the current settings.
2. `REVEAL`
   Has no countdown. It ends only once every round player acknowledges their role.
   Counts as daytime, so the green overlay is fully visible.
   Each player gets a mandatory local role/rules popup sourced from `role-copy.txt`. Its larger role heading and underlined `I understand my role` action are the only way to close it.
3. `NIGHT_TRICKSTER`
   Tricksters see `Choose a TOWNSFOLK to ELIMINATE from the game!`
   Everyone else sees `Waiting for the TRICKSTERS to make their move`.
   Universal countdown text sits below the main message.
4. `NIGHT_DETECTIVE`
   Detective sees inspect copy and can click a target name.
   Everyone else sees the waiting copy.
5. `NIGHT_DOCTOR`
   Doctor sees save copy and can click a target name.
   Everyone else sees the waiting copy.
6. `DISCUSS`
   Apply the saved target and night elimination before this phase begins.
   Eliminated players are red for everyone.
   Saved player is yellow and gets `sparkles_float`.
   This is the normal place to check win conditions.
7. `VOTE`
   Alive players click a name label to exile someone.
   Name text turns yellow when vote count is above zero.
   Vote count text below names shows `(X / aliveVoterCount)`.
8. `ANNOUNCE`
   Exile result is shown in the center.
   Exiled player is tinted red and their local banner changes to death-summary copy.
9. `END`
   Show winner announcement, keep banners visible until reset, then return to `WAITING`.
10. `END_EARLY`
    Used when a leave forces an immediate finish.
    Show `Too many players left, ending the game early...` plus the winning team before returning to `WAITING`.

Loop:
`WAITING -> REVEAL -> NIGHT_TRICKSTER -> NIGHT_DETECTIVE -> NIGHT_DOCTOR -> DISCUSS -> VOTE -> ANNOUNCE -> NIGHT_TRICKSTER ... -> END/END_EARLY -> WAITING`

## Arena and seat layout

- Treat the play space as a `1500 x 1500` square with center at `(750, 750)`.
- On game start, snapshot the connected players into a locked round roster. Do not reshuffle remaining seats mid-round.
- Compute seat positions dynamically on a circle, no matter how many players joined.
- Recommended first-pass numbers:
  - player radius: `540`
  - label radius: `620`
  - vote-count radius: `660`
  - booth depth: `160`
  - booth width based on `360 / playerCount`
- For seat `i`:
  - `angle = -90 + (360 / playerCount) * i`
  - `playerX = 750 + cos(angle) * 540`
  - `playerY = 750 + sin(angle) * 540`
- Store per-seat anchor data in `playerSeatMap` so every client can place the same local labels.
- Build each player booth from `baseRect` blocker sprites. Use rotated left wall, right wall, and outer wall so the player is trapped in a wedge-like pen.
- Rebuild blockers with `removeSprite(...)` then `addSprite(...)` whenever the layout changes. Do not rely on in-place `updateSprite(...)` for impassable collision props.
- On player leave:
  - first attempt `teleportPlayers([playerId], { positionX: 0, positionY: 0, width: 1, height: 1 })`
  - then clear their seat state
  - in `WAITING`, recompute the circle
  - mid-round, keep everyone else in their original pens and evaluate early-end logic
- Late joiners during a round should be treated as spectators and parked outside the ring until the next `WAITING`.

## Host vs client responsibilities

### Host-only

- Set and reset all server variables.
- Clamp lobby settings to legal values.
- Assign roles at round start.
- Teleport players into seat positions.
- Create and remove blocker sprites.
- Resolve night actions and day votes.
- Tint players and trigger `sparkles_float`.
- Check win conditions during `DISCUSS` and immediately after player leaves.

### Every client

- Build and maintain local UI sprites.
- React to `onVariableChanged_*` callbacks using `newValue` where needed.
- Recompute countdown text locally from `phaseEndsAtMs`.
- Render player name labels and vote counters from synced seat/vote maps.
- Show only the local player's role banner and role-specific instructions.
- Emit input events back to the host when a local UI sprite is clicked.

### Non-host safety rule

- Non-hosts should never add, remove, or update synced sprites.
- Non-hosts should never set server variables.
- Private interaction should always be: local click -> input event -> host validates -> host updates server state.

## Engine variables to add in the Topia UI

All of these should be server variables.

| Variable                      | Type     | Default Value | Purpose                                                                                                                                         |
| ----------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `gamePhase`                   | `String` | `WAITING`     | Current phase: `WAITING`, `REVEAL`, `NIGHT_TRICKSTER`, `NIGHT_DETECTIVE`, `NIGHT_DOCTOR`, `DISCUSS`, `VOTE`, `ANNOUNCE`, `END`, or `END_EARLY`. |
| `phaseEndsAtMs`               | `Number` | `0`           | Host deadline timestamp for timed phases; `0` for `WAITING` and the acknowledgement-driven `REVEAL` phase.                                    |
| `phaseNonce`                  | `Number` | `0`           | Bump whenever the host wants all clients to refresh local UI even if the phase string repeats.                                                  |
| `roundNumber`                 | `Number` | `0`           | Starts at `0` in lobby and increments each full day/night cycle.                                                                                |
| `configuredTricksterCount`    | `Number` | `1`           | Host-selected trickster count for the next game.                                                                                                |
| `configuredDiscussionSeconds` | `Number` | `90`          | Host-selected discuss duration.                                                                                                                 |
| `configuredVotingSeconds`     | `Number` | `30`          | Host-selected vote duration.                                                                                                                    |
| `configuredNightSeconds`      | `Number` | `30`          | Host-selected per-role night duration.                                                                                                          |
| `winningTeam`                 | `String` | ``            | Empty until `END` or `END_EARLY`, then `TOWNSFOLK` or `TRICKSTERS`.                                                                             |
| `endReasonText`               | `String` | ``            | Empty normally; used for `END_EARLY` explanation text.                                                                                          |
| `playerRoleMap`               | `MAP`    | `{}`          | `playerId -> role`. Needed for role reveal, trickster filtering, and detective results.                                                         |
| `playerSeatMap`               | `MAP`    | `{}`          | `playerId -> { seatIndex, playerX, playerY, labelX, labelY, voteX, voteY, angle }`.                                                             |
| `playerAliveMap`              | `MAP`    | `{}`          | `playerId -> true/false`.                                                                                                                       |
| `playerDeathInfoMap`          | `MAP`    | `{}`          | `playerId -> { roundNumber, cause, killerTeam }`. Used to build the dead-player banner copy.                                                    |
| `nightTargetMap`              | `MAP`    | `{}`          | Acting-player target choices for the active night phase: `actorPlayerId -> targetPlayerId`.                                                     |
| `dayVoteTargetMap`            | `MAP`    | `{}`          | Day vote choices: `voterPlayerId -> targetPlayerId`.                                                                                            |
| `roleRevealAcknowledgementMap`| `MAP`    | `{}`          | Role-reveal acknowledgements: `playerId -> true`. The host starts the first night after every round player is present.                          |
| `savedPlayerId`               | `Number` | `0`           | The doctor save result for the most recent night, or `0`.                                                                                       |
| `lastNightEliminatedPlayerId` | `Number` | `0`           | The player eliminated by tricksters after doctor resolution, or `0`.                                                                            |
| `lastInvestigatedPlayerId`    | `Number` | `0`           | Detective's most recent target, mainly for local detective result copy.                                                                         |
| `lastExiledPlayerId`          | `Number` | `0`           | The most recently exiled player, or `0`.                                                                                                        |

Notes:

- `playerRoleMap` is the main v1 compromise. It keeps the UI simple, but it is not truly private.
- For `MAP` callbacks, prefer the callback `newValue` and do not assume child-key hydration is complete on the same frame.

## Engine events to add in the Topia UI

Use input events for player actions and one experience event for forced reset.

| Event                      | Type                | Payload                                       | Purpose                                                                     |
| -------------------------- | ------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `hostStartsGame`           | `Input`             | `{ fromPlayerId }`                            | Host presses either start button in `WAITING`.                              |
| `hostCyclesLobbySetting`   | `Input`             | `{ fromPlayerId, settingKey }`                | Host cycles `tricksters`, `discussion`, `voting`, or `night`.               |
| `playerChoosesNightTarget` | `Input`             | `{ fromPlayerId, targetPlayerId, phaseName }` | Trickster, detective, or doctor submits a target during the matching phase. |
| `playerChoosesDayVote`     | `Input`             | `{ fromPlayerId, targetPlayerId }`            | Alive player submits or changes their day vote.                             |
| `playerAcknowledgesRole`   | `Input`             | `{ fromPlayerId }`                            | Player closes their mandatory role/rules popup during `REVEAL`.              |
| `resetGame`                | `Experience Engine` | `{}`                                          | Optional safety reset back to `WAITING`.                                    |

## Script plan

### `main.ts`

- Attach `clientUiManager` as `isPlayerControlled: true` for all players and spectators.
- Attach `arenaManager` and `gameManager` on the host only.
- Set sync parameters if needed, similar to `Mind the Fruit`.

### `gameManager.ts`

- Own the authoritative phase machine.
- Initialize all variables for `WAITING`.
- Handle `onPlayerJoined` and `onPlayerLeft`.
- Validate lobby config clicks.
- Assign roles and build `playerRoleMap`.
- Track `roleRevealAcknowledgementMap` and advance from `REVEAL` only after all assigned players acknowledge their role.
- Clear and resolve `nightTargetMap` / `dayVoteTargetMap`.
- Handle tie-breaking on the host.
- Apply deaths, saves, tints, banner-state data, and win checks.
- Manage `phaseEndsAtMs` transitions in `onPhysicsStep()`.

### `arenaManager.ts`

- Build and clear seat blockers.
- Compute circle seat geometry and write `playerSeatMap`.
- Teleport players into their seat positions on start.
- Teleport spectators or eliminated players to holding spots if needed.
- Own the two shared background sprites if you want the day/night fade to be host-synced.
- If background opacity changes feel too spammy over sync, move that animation into `clientUiManager` later.

### `clientUiManager.ts`

- Player-controlled local UI only.
- Create local title, subtitle, center message, countdown, role banner, host config buttons, player name labels, and vote-count labels.
- In `WAITING`, show config state to everyone and clickable config text only for the host.
- Keep the host-following mirror start button attached to the host's live position.
- In night phases, gate private instructions and click affordances by the local player's role and alive state.
- Build vote counts locally from `nightTargetMap` or `dayVoteTargetMap`.
- Update the local top banner when the player dies:
  - `You were a TRICKSTER role`
  - `You were voted out in round 2`
  - or `You were a TOWNSFOLK role`
  - `You were killed by a TRICKSTER`

### Optional `utils.ts`

- Shared helpers for:
  - circle-seat math
  - player-name formatting
  - tie-breaking helpers
  - banner-copy builders

## Sprite instance plan

No new art definitions are required for first pass if `baseRect`, `baseEllipse`, and `baseText` already exist.

### Synced instances

- `bgBlack`
- `bgDayGreen`
- `seatBlocker_<playerId>_<segment>`
- optional `seatPad_<playerId>` from `baseEllipse`

### Local player-controlled instances

- `uiTitle`
- `uiSubtitle`
- `uiCenterMessage`
- `uiCountdown`
- `uiRoleBanner`
- `uiSettingTricksters`
- `uiSettingDiscussion`
- `uiSettingVoting`
- `uiSettingNight`
- `uiStartCenter`
- `uiStartHostFollow`
- `uiName_<playerId>`
- `uiVotes_<playerId>`
- optional `uiDetectiveResult`

## Rules and assumptions for v1

- Minimum players to start: `4`.
- Legal trickster counts should clamp to `1..min(4, floor((connectedPlayers - 1) / 2))` so the game does not start with tricksters already at parity.
- Tricksters cannot vote for tricksters.
- Detective can inspect any alive player except themself.
- Doctor can save any alive player, including themself.
- Dead players cannot act or vote.
- Day vote ties resolve randomly among the top-voted players if at least one vote was cast.
- If nobody receives any day votes, exile nobody and continue to the next night.
- Normal win checks only happen when `DISCUSS` begins, after the night resolution has been applied.
- If a player leave causes a decisive team win or the game can no longer continue sensibly, go to `END_EARLY`.

## Recommended build order

1. Create the variables and events in the Topia UI.
2. Build `main.ts`, `arenaManager.ts`, and the circle-seat blocker flow.
3. Add `clientUiManager.ts` for local labels, center text, and host lobby controls.
4. Add `gameManager.ts` phase transitions with `phaseEndsAtMs`.
5. Add night-action and day-vote resolution.
6. Add discuss/announce/end polish, tints, and `sparkles_float`.

## Biggest risk to remember

The hardest part is secret information. This plan keeps the presentation private by using local UI, but the underlying synced role data is still inspectable. That is probably acceptable for a first playable version, but if you want real secrecy later, we will need a stronger per-player data strategy than plain server variables.

Things to fix:

The detective learning facts about who is what role is still not permanently represented in the game through permanently changing the color of their name sprite accordingly. Before you proceed with the fix please ask me to create any global variables you may need.

Sometimes the text for non-hosts is still broken and either doesn't appear or appears unformmated on the left edge.

Still not instant update sprite on click, somehow like wtf broooooooo.

(potential option if host sync version still feels slow:
if the voting counter sprites are not synced, there's no reason to even do the roundtrip then from client to host back to client with updates vote totals - we can just update the respective text sprite immediately with the clients vote, then its okay if other clients and the host themselves receive this update late as long as my vote UI felt responsive. If we do this we can revert back to the sprites using updateSprite instead of the add and remove each time operations since this the sprites are local again)

Tied vote in the exile phase should actually not exile anyone and should say special dialouge: "The TOWNSFOLK could not agree on who to exile... No one was exiled."


Inputs on seats / user name text sprites are not dropped now but still a little delayed for non-hosts, can fix in the future. In the non-host vote to update vote counter sprite path is there any waiting on non-host to client communication before moving on to actually updating the local sprite? Maybe we can make something async to speed this up or maybe we can just do the local sprite update before we communicate anything to the host and if we showed the wrong vote because we were  being TOO responsive, oh well.

Use the AI.txt file as context for the duration of this session. Change Trickster Town/ to function in this new way: Instead of a role reveal phase, change the role reveal phase to be the  role reveal / rules explanation phase (continue to call it role reveal phase). In this phase instead of just adding the You are the X role text, we'll force a UI popup almost exactly like what should appear when we press the ? button currently. This new popup should not have an X button, instead it will close when the user clicks new sprite text at the bottom center of the popup saying 'I understand my role' (this text should be underlined). I will put the totality of the text for each role to be included in this popup inside the role-copy.txt file. Note the first lines for each role should be bigger in font size than the rest of the text - they'll all say something like 'You are the X role'. The 'I understand my role' text should also be bigger than the rest of the text. Once all players have clicked that they understand their role, the game will move onto the next phase post-role announcement. Please stop and request any new global vars or events you'll want for this update, if you think you won't need anything new of either, go ahead and start your work.


When a player is eliminated their text sprite with their name should become grey, right now this grey coloring works for only the host and the eliminated player, not anyone else. We need to make sure the nonhosts are getting this elimination update and properly updating their local text sprites of names to reflect the truth they have been updated on. Locally the 'You are X role' text should be updated for the eliminated player to say 'You were eliminated...'