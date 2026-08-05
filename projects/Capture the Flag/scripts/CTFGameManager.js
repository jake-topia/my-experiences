"use strict";
class CTFGameManager extends SystemScript {
    _destroyed;
    _hostPlayerId;
    _redScore; // simple numeric score
    _blueScore; // simple numeric score
    _spawnPoints; // team -> spawn { x, y }
    _currentState;
    _countdownEndTime;
    _winnerTeam;
    _isPhysicsRunning;
    // single neutral flag sprite id removed (dual only)
    _logEnabled;
    _countdownStarted;
    _finalScoresComputed;
    _lastHudUpdateT;
    _stageWidth;
    _stageHeight;
    _stageSize; // min(width,height) for square logic
    _cellSize; // stageSize / 3 for 3x3 grid
    _redSpawnX;
    _blueSpawnX;
    _centerY;
    _configProvider;
    _cfg;
    _versionTag;
    _teamRedList;
    _teamBlueList;
    // multi-team structures
    _teams; // team -> PseudoList
    _teamOrder; // order of teams
    _teamEmoji; // team -> emoji
    _teamColors; // team -> territory color hex
    _playerColors; // team -> player tint color hex (lighter versions)
    _armByTeam; // team -> 'N'|'W'|'E'|'S'
    _neutralCells; // list of { r, c }
    _gridRects; // 'r{row}c{col}' -> rect
    // dual-flag only mode (always true conceptually)
    _flagStates; // team -> { spriteId,pos:{x,y},heldBy,atBase }
    _carrierOfFlagTeam; // team -> pid
    _flagHeld; // team -> boolean
    _scores; // team -> number
    _physicsBuf;
    _pendingCaptureBlockedT;
    _redCarrierId;
    _blueCarrierId;
    _redFlagHeld; // simple booleans for fast re-trigger guards
    _blueFlagHeld;
    _recentTeleport; // pidStr -> timestamp (ms)
    _spawnImmunity; // pidStr -> expiry timestamp (ms)
    // anti-camping system
    _flagZoneSprites; // team -> spriteId (semi-opaque white rectangle)
    _campingTimers; // pidStr -> timestamp when camping started (ms)
    _flagZoneRadius; // radius around flag for camping detection
    // analytics
    _analyticsPublicKey;
    // notification system
    _notificationText;
    _notificationExpiry;
    // debug helpers
    _debugAuditOnceAfterStart;
    onInit() {
        this._destroyed = false;
        if (!playerManager.isHost)
            return;
        stageManager.setCurrentStage('back');
        this._logEnabled = true;
        this._debugAuditOnceAfterStart = false;
        scriptManager.attachSystem({ scriptId: 'CTFConfigSystem' });
        this._configProvider = scriptManager.getSystem({
            systemName: 'CTFConfigSystem',
        });
        this._cfg = this._configProvider.getConfig();
        this._hostPlayerId = playerManager.getMyPlayerId();
        // Using only simple PseudoLists for teams now
        this._teamRedList = [];
        this._teamBlueList = [];
        this._redScore = 0;
        this._blueScore = 0;
        this._stageWidth = this._cfg.stageWidth || 2880;
        this._stageHeight = this._cfg.stageHeight || 1620;
        this._stageSize = Math.min(this._stageWidth, this._stageHeight);
        this._cellSize = Math.floor(this._stageSize / 3);
        this._redSpawnX = Math.round(this._stageWidth * (this._cfg.redSpawnXFactor || 0.125));
        this._blueSpawnX = Math.round(this._stageWidth * (this._cfg.blueSpawnXFactor || 0.875));
        this._centerY = Math.round(this._stageHeight * (this._cfg.spawnYFactor || 0.5));
        // initialize but will be recomputed by computeLayout()
        this._spawnPoints = {};
        this._spawnPoints.red = { x: this._redSpawnX, y: this._centerY };
        this._spawnPoints.blue = { x: this._blueSpawnX, y: this._centerY };
        this._spawnPoints.green = {
            x: Math.round(this._stageWidth / 2),
            y: 40,
        };
        this._spawnPoints.yellow = {
            x: Math.round(this._stageWidth / 2),
            y: this._stageHeight - 40,
        };
        this._currentState = 'TEAM_SELECT';
        this._countdownEndTime = 0;
        this._winnerTeam = '';
        this._isPhysicsRunning = false;
        // no neutral flag id
        this._countdownStarted = false;
        this._finalScoresComputed = false;
        this._lastHudUpdateT = 0;
        this._redCarrierId = 0;
        this._blueCarrierId = 0;
        this._redFlagHeld = false;
        this._blueFlagHeld = false;
        this._recentTeleport = {};
        this._spawnImmunity = {};
        this._versionTag = 'ctf_simple_' + Date.now();
        // Initialize with non-null objects to avoid engine proxy null deref during deep inspection
        this._flagStates = {};
        this._flagStates.red = {
            spriteId: '',
            pos: { x: 0, y: 0 },
            heldBy: 0,
            atBase: true,
        };
        this._flagStates.blue = {
            spriteId: '',
            pos: { x: 0, y: 0 },
            heldBy: 0,
            atBase: true,
        };
        this._flagStates.green = {
            spriteId: '',
            pos: { x: 0, y: 0 },
            heldBy: 0,
            atBase: true,
        };
        this._flagStates.yellow = {
            spriteId: '',
            pos: { x: 0, y: 0 },
            heldBy: 0,
            atBase: true,
        };
        // multi-team containers and visuals
        this._teams = {};
        this._teams.red = [];
        this._teams.blue = [];
        this._teams.green = [];
        this._teams.yellow = [];
        this._teamOrder = [];
        this._teamOrder.push('red');
        this._teamOrder.push('blue');
        this._teamOrder.push('green');
        this._teamOrder.push('yellow');
        this._teamEmoji = {};
        this._teamEmoji.red = '🔴';
        this._teamEmoji.blue = '🔵';
        this._teamEmoji.green = '🟢';
        this._teamEmoji.yellow = '🟡';
        // Territory colors (darker, saturated)
        this._teamColors = {};
        this._teamColors.red = '#3B0200'; // Dark red
        this._teamColors.blue = '#0A2D43'; // Dark blue
        this._teamColors.green = '#184208'; // Dark green
        this._teamColors.yellow = '#BA7915'; // Dark yellow/gold
        // Player tint colors (lighter versions for visibility)
        this._playerColors = {};
        this._playerColors.red = '#D9A19A'; // Light red
        this._playerColors.blue = '#A3C4D9'; // Light blue
        this._playerColors.green = '#A8D9A1'; // Light green
        this._playerColors.yellow = '#F5D9A3'; // Light yellow/gold
        this._armByTeam = {};
        this._armByTeam.red = '';
        this._armByTeam.blue = '';
        this._armByTeam.green = '';
        this._armByTeam.yellow = '';
        this._neutralCells = [];
        this._neutralCells.push({ r: 0, c: 0 });
        this._neutralCells.push({ r: 0, c: 2 });
        this._neutralCells.push({ r: 1, c: 1 });
        this._neutralCells.push({ r: 2, c: 0 });
        this._neutralCells.push({ r: 2, c: 2 });
        this._gridRects = {};
        this._carrierOfFlagTeam = {};
        this._carrierOfFlagTeam.red = 0;
        this._carrierOfFlagTeam.blue = 0;
        this._carrierOfFlagTeam.green = 0;
        this._carrierOfFlagTeam.yellow = 0;
        this._flagHeld = {};
        this._flagHeld.red = false;
        this._flagHeld.blue = false;
        this._flagHeld.green = false;
        this._flagHeld.yellow = false;
        this._scores = {};
        this._scores.red = 0;
        this._scores.blue = 0;
        this._scores.green = 0;
        this._scores.yellow = 0;
        this._physicsBuf = 0;
        this._pendingCaptureBlockedT = 0;
        this._notificationText = '';
        this._notificationExpiry = 0;
        // Anti-camping system
        this._flagZoneSprites = {};
        this._campingTimers = {};
        this._flagZoneRadius = 120; // pixels around flag base
        this.log('INIT host=' + this._hostPlayerId + ' ver=' + this._versionTag);
        this._debugAudit('after-init');
        this.computeLayout();
        // Don't show zones on init - they'll appear when game starts
        this.drawOrUpdateTeamSelect();
        // Get analytics public key
        try {
            this._analyticsPublicKey = stateManager.getVariable('PublicKey');
        }
        catch (e) {
            this.log('Failed to get PublicKey for analytics: ' + e);
            this._analyticsPublicKey = '';
        }
    }
    log(m) {
        if (this._logEnabled)
            console.log('[CTF] ' + m);
    }
    showNotification(msg, durationMs) {
        this._notificationText = msg;
        this._notificationExpiry = Date.now() + durationMs;
        this.updateHud();
    }
    // --- TEAM / PLAYER HELPERS ---
    _typeOf(v) {
        const t = typeof v;
        if (v == null)
            return 'null';
        if (t !== 'object')
            return t;
        if (Array.isArray(v))
            return 'array';
        return 'object';
    }
    _safeNum(n) {
        return typeof n === 'number' && isFinite(n);
    }
    _debugAudit(label) {
        if (!this._logEnabled)
            return;
        try {
            const teams = {
                red: this._teamRedList.length,
                blue: this._teamBlueList.length,
                green: (this._teams.green || []).length,
                yellow: (this._teams.yellow || []).length,
            };
            const arms = {};
            const spawns = {};
            for (let i = 0; i < this._teamOrder.length; i++) {
                const t = this._teamOrder[i];
                arms[t] = this._armByTeam[t] || '';
                const sp = this._spawnPoints[t];
                if (sp)
                    spawns[t] = {
                        x: this._safeNum(sp.x),
                        y: this._safeNum(sp.y),
                        types: { x: this._typeOf(sp.x), y: this._typeOf(sp.y) },
                    };
            }
            const flags = {};
            for (let i = 0; i < this._teamOrder.length; i++) {
                const t = this._teamOrder[i];
                const fs = this._flagStates[t];
                if (fs)
                    flags[t] = {
                        spriteId: this._typeOf(fs.spriteId) +
                            ':' +
                            String(fs.spriteId || '').slice(0, 24),
                        pos: fs.pos
                            ? { x: this._safeNum(fs.pos.x), y: this._safeNum(fs.pos.y) }
                            : 'none',
                        heldBy: this._typeOf(fs.heldBy) + ':' + String(fs.heldBy),
                        atBase: this._typeOf(fs.atBase) + ':' + String(fs.atBase),
                    };
            }
            const rect1 = this._gridRects && this._gridRects['r1c1'];
            const gridOk = !!(rect1 &&
                this._safeNum(rect1.x) &&
                this._safeNum(rect1.y) &&
                this._safeNum(rect1.width) &&
                this._safeNum(rect1.height));
            const recentKeys = [];
            for (const k in this._recentTeleport)
                recentKeys.push({
                    k,
                    type: this._typeOf(k),
                    vType: this._typeOf(this._recentTeleport[k]),
                });
            this.log('AUDIT[' +
                label +
                '] teams=' +
                JSON.stringify(teams) +
                ' arms=' +
                JSON.stringify(arms) +
                ' spawns=' +
                JSON.stringify(spawns) +
                ' flags=' +
                JSON.stringify(flags) +
                ' gridCenterOk=' +
                gridOk +
                ' recentKeys=' +
                JSON.stringify(recentKeys.slice(0, 4)));
        }
        catch (e) {
            this.log('AUDIT error ' + e);
        }
    }
    _getTeam(pid) {
        const r = this._teamRedList;
        for (let i = 0; i < r.length; i++)
            if (r[i] === pid)
                return 'red';
        const b = this._teamBlueList;
        for (let i = 0; i < b.length; i++)
            if (b[i] === pid)
                return 'blue';
        const g = this._teams.green || [];
        for (let i = 0; i < g.length; i++)
            if (g[i] === pid)
                return 'green';
        const y = this._teams.yellow || [];
        for (let i = 0; i < y.length; i++)
            if (y[i] === pid)
                return 'yellow';
        return '';
    }
    _playerCarriesFlag(pid) {
        // generalized: return the team whose flag this player carries (enemy team key)
        for (let i = 0; i < this._teamOrder.length; i++) {
            const team = this._teamOrder[i];
            if (this._carrierOfFlagTeam[team] === pid)
                return team;
        }
        // legacy fallback
        if (this._redCarrierId === pid)
            return 'blue';
        if (this._blueCarrierId === pid)
            return 'red';
        return '';
    }
    _playerCarriesAllFlags(pid) {
        // Return ALL flag teams this player is carrying
        const flags = [];
        for (let i = 0; i < this._teamOrder.length; i++) {
            const team = this._teamOrder[i];
            if (this._carrierOfFlagTeam[team] === pid) {
                flags.push(team);
            }
        }
        return flags;
    }
    _clearCarrierForFlag(flagTeam) {
        if (flagTeam === 'red')
            this._blueCarrierId = 0; // blue player was carrying red flag
        if (flagTeam === 'blue')
            this._redCarrierId = 0; // red player was carrying blue flag
    }
    // COUNT HELPERS
    _count(team) {
        if (team === 'red')
            return this._teamRedList.length;
        if (team === 'blue')
            return this._teamBlueList.length;
        const list = this._teams[team];
        return list ? list.length : 0;
    }
    _list(team) {
        // Return a shallow copy of the list for the team using legacy-safe loops
        // Filter out players who are no longer in the game (no valid player details)
        const src = team === 'red'
            ? this._teamRedList
            : team === 'blue'
                ? this._teamBlueList
                : this._teams[team] || [];
        const out = [];
        for (let i = 0; i < src.length; i++) {
            const pid = src[i];
            // Verify player is still in game by checking if we can get their details
            const details = playerManager.getPlayerDetails(pid);
            if (details && details.username) {
                out.push(pid);
            }
        }
        return out;
    }
    _activeTeams() {
        const at = [];
        const keys = this._teamOrder;
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (this._count(k) > 0)
                at.push(k);
        }
        return at;
    }
    computeGrid() {
        // Build rects for 3x3 cells using top-left origin (kept for neutral zone logic)
        const size = this._stageSize;
        const cs = this._cellSize;
        this._gridRects = {};
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                const key = 'r' + r + 'c' + c;
                const x = c * cs + Math.floor((this._stageWidth - size) / 2);
                const y = r * cs + Math.floor((this._stageHeight - size) / 2);
                this._gridRects[key] = { x, y, width: cs, height: cs };
            }
        }
    }
    computeLayout() {
        // Fair rectangular base layout with neutral lanes between territories
        this.computeGrid(); // Keep old grid for backward compat
        const act = this._activeTeams();
        const order = act.length ? act : ['red', 'blue'];
        const teamCount = order.length;
        // Stage dimensions and neutral lane width
        const w = this._stageWidth;
        const h = this._stageHeight;
        const halfW = Math.floor(w / 2);
        const halfH = Math.floor(h / 2);
        const lane = this._cfg.neutralLaneWidth || 80; // neutral buffer width
        const halfLane = Math.floor(lane / 2);
        // Clear arm assignments and old neutral cells
        this._armByTeam.red = '';
        this._armByTeam.blue = '';
        this._armByTeam.green = '';
        this._armByTeam.yellow = '';
        this._neutralCells = []; // Clear old neutral cells; will use lane rects instead
        // Assign arms and define INSET base rectangles with neutral lanes between
        if (teamCount === 2) {
            // 2 teams: Left (W) vs Right (E) with vertical lane down middle
            // West base: left edge to (halfW - halfLane)
            // Neutral lane: (halfW - halfLane) to (halfW + halfLane)
            // East base: (halfW + halfLane) to right edge
            this._armByTeam[order[0]] = 'W';
            this._armByTeam[order[1]] = 'E';
            this._gridRects['baseW'] = {
                x: 0,
                y: 0,
                width: halfW - halfLane,
                height: h,
            };
            this._gridRects['baseE'] = {
                x: halfW + halfLane,
                y: 0,
                width: halfW - halfLane,
                height: h,
            };
            // Neutral lane: vertical strip down center
            this._gridRects['neutralV'] = {
                x: halfW - halfLane,
                y: 0,
                width: lane,
                height: h,
            };
        }
        else if (teamCount === 3) {
            // 3 teams: Equal vertical thirds with neutral lanes between
            // Each team gets (w / 3 - lane) width
            // Lanes separate the three territories
            const thirdW = Math.floor(w / 3);
            this._armByTeam[order[0]] = 'W'; // Left third
            this._armByTeam[order[1]] = 'N'; // Middle third (was center, now equal size)
            this._armByTeam[order[2]] = 'E'; // Right third
            // Left territory: 0 to (thirdW - halfLane)
            this._gridRects['baseW'] = {
                x: 0,
                y: 0,
                width: thirdW - halfLane,
                height: h,
            };
            // First neutral lane: (thirdW - halfLane) to (thirdW + halfLane)
            this._gridRects['neutralV_3t_1'] = {
                x: thirdW - halfLane,
                y: 0,
                width: lane,
                height: h,
            };
            // Middle territory: (thirdW + halfLane) to (2*thirdW - halfLane)
            this._gridRects['baseN'] = {
                x: thirdW + halfLane,
                y: 0,
                width: thirdW - lane,
                height: h,
            };
            // Second neutral lane: (2*thirdW - halfLane) to (2*thirdW + halfLane)
            this._gridRects['neutralV_3t_2'] = {
                x: 2 * thirdW - halfLane,
                y: 0,
                width: lane,
                height: h,
            };
            // Right territory: (2*thirdW + halfLane) to w
            this._gridRects['baseE'] = {
                x: 2 * thirdW + halfLane,
                y: 0,
                width: thirdW - halfLane,
                height: h,
            };
        }
        else if (teamCount >= 4) {
            // 4 teams: Four corners with cross-shaped neutral lanes
            // Horizontal lane across middle
            // Vertical lane down middle
            this._armByTeam[order[0]] = 'NW';
            this._armByTeam[order[1]] = 'NE';
            this._armByTeam[order[2]] = 'SW';
            this._armByTeam[order[3]] = 'SE';
            this._gridRects['baseNW'] = {
                x: 0,
                y: 0,
                width: halfW - halfLane,
                height: halfH - halfLane,
            };
            this._gridRects['baseNE'] = {
                x: halfW + halfLane,
                y: 0,
                width: halfW - halfLane,
                height: halfH - halfLane,
            };
            this._gridRects['baseSW'] = {
                x: 0,
                y: halfH + halfLane,
                width: halfW - halfLane,
                height: halfH - halfLane,
            };
            this._gridRects['baseSE'] = {
                x: halfW + halfLane,
                y: halfH + halfLane,
                width: halfW - halfLane,
                height: halfH - halfLane,
            };
            // Neutral lanes: cross shape (vertical + horizontal)
            this._gridRects['neutralV_4t'] = {
                x: halfW - halfLane,
                y: 0,
                width: lane,
                height: h,
            };
            this._gridRects['neutralH_4t'] = {
                x: 0,
                y: halfH - halfLane,
                width: w,
                height: lane,
            };
        }
        // Compute spawn points and flag positions for each active team
        const cfgMin = this._cfg && this._cfg.teleportMinDistanceFromFlag;
        const offset = cfgMin != null && cfgMin > 0 ? cfgMin : 200;
        for (let ti = 0; ti < order.length; ti++) {
            const t = order[ti];
            const arm = this._armByTeam[t];
            if (!arm)
                continue;
            const rect = this.rectForArm(arm);
            if (!rect)
                continue;
            // Flag at center of base - BUT for 3-team, use custom positions for fairness
            let flagX = rect.x + Math.floor(rect.width / 2);
            let flagY = rect.y + Math.floor(rect.height / 2);
            // For 3-team: flags at horizontal center of each zone
            // W/E zones: flags at top with buffer
            // N zone: flag at bottom with buffer
            // Buffer must be >= teleport distance (270px) to keep teleported players in zone
            if (teamCount === 3) {
                const verticalBuffer = 300; // Buffer from top/bottom edge (>270px teleport distance)
                if (arm === 'W') {
                    // West team: flag at horizontal center of west zone, near top with buffer
                    flagX = rect.x + Math.floor(rect.width / 2);
                    flagY = rect.y + verticalBuffer; // Buffer from top edge
                }
                else if (arm === 'E') {
                    // East team: flag at horizontal center of east zone, near top with buffer (mirror of W)
                    flagX = rect.x + Math.floor(rect.width / 2);
                    flagY = rect.y + verticalBuffer; // Buffer from top edge (same as W)
                }
                else if (arm === 'N') {
                    // North team: flag at horizontal center of north zone, near bottom with buffer
                    flagX = rect.x + Math.floor(rect.width / 2); // Horizontal center of N zone
                    flagY = rect.y + rect.height - verticalBuffer; // Buffer from bottom edge
                }
            }
            // Spawn offset toward outer edge for safety
            let spawnX = flagX;
            let spawnY = flagY;
            if (arm === 'W')
                spawnX = flagX - offset;
            else if (arm === 'E')
                spawnX = flagX + offset;
            else if (arm === 'N')
                spawnY = flagY - offset;
            else if (arm === 'S')
                spawnY = flagY + offset;
            else if (arm === 'NW') {
                spawnX = flagX - offset;
                spawnY = flagY - offset;
            }
            else if (arm === 'NE') {
                spawnX = flagX + offset;
                spawnY = flagY - offset;
            }
            else if (arm === 'SW') {
                spawnX = flagX - offset;
                spawnY = flagY + offset;
            }
            else if (arm === 'SE') {
                spawnX = flagX + offset;
                spawnY = flagY + offset;
            }
            this._spawnPoints[t] = { x: spawnX, y: spawnY };
            // Store flag position for use in spawnDualFlags()
            if (!this._flagStates[t]) {
                this._flagStates[t] = {
                    spriteId: '',
                    pos: { x: 0, y: 0 },
                    heldBy: 0,
                    atBase: false,
                };
            }
            this._flagStates[t].pos = { x: flagX, y: flagY };
        }
    }
    rectForArm(arm) {
        // Return base rect for arm - now uses larger fair rectangles
        const baseKey = 'base' + arm;
        if (this._gridRects[baseKey])
            return this._gridRects[baseKey];
        // Fallback for old arm keys (compatibility with neutral zone checks)
        if (arm === 'N')
            return this._gridRects['r0c1'];
        if (arm === 'W')
            return this._gridRects['r1c0'];
        if (arm === 'E')
            return this._gridRects['r1c2'];
        if (arm === 'S')
            return this._gridRects['r2c1'];
        // Final fallback
        const half = this._stageWidth / 2;
        return { x: 0, y: 0, width: half, height: this._stageHeight };
    }
    isNeutral(x, y) {
        // Check if point lies in any neutral lane rectangle
        const neutralKeys = [
            'neutralV',
            'neutralH',
            'neutralV_3t_1',
            'neutralV_3t_2',
            'neutralV_4t',
            'neutralH_4t',
        ];
        for (let i = 0; i < neutralKeys.length; i++) {
            const rect = this._gridRects[neutralKeys[i]];
            if (!rect)
                continue;
            if (x >= rect.x &&
                x < rect.x + rect.width &&
                y >= rect.y &&
                y < rect.y + rect.height)
                return true;
        }
        return false;
    }
    whichArm(x, y) {
        // Check new base rectangles first (larger fair zones)
        const basePairs = [
            { arm: 'W', key: 'baseW' },
            { arm: 'E', key: 'baseE' },
            { arm: 'N', key: 'baseN' },
            { arm: 'NW', key: 'baseNW' },
            { arm: 'NE', key: 'baseNE' },
            { arm: 'SW', key: 'baseSW' },
            { arm: 'SE', key: 'baseSE' },
        ];
        for (let i = 0; i < basePairs.length; i++) {
            const rect = this._gridRects[basePairs[i].key];
            if (!rect)
                continue;
            if (x >= rect.x &&
                x < rect.x + rect.width &&
                y >= rect.y &&
                y < rect.y + rect.height)
                return basePairs[i].arm;
        }
        // Fallback to old grid cells for backwards compatibility
        const pairs = [
            { arm: 'N', key: 'r0c1' },
            { arm: 'W', key: 'r1c0' },
            { arm: 'E', key: 'r1c2' },
            { arm: 'S', key: 'r2c1' },
        ];
        for (let i = 0; i < pairs.length; i++) {
            const rect = this._gridRects[pairs[i].key];
            if (!rect)
                continue;
            if (x >= rect.x &&
                x < rect.x + rect.width &&
                y >= rect.y &&
                y < rect.y + rect.height)
                return pairs[i].arm;
        }
        return '';
    }
    onPlayerJoined(o) {
        if (!playerManager.isHost)
            return;
        const pid = o.playerId;
        if (!pid)
            return;
        this.log('Player joined P' + pid);
        // Auto-assign to smallest team during TEAM_SELECT, PRE_COUNTDOWN, or ACTIVE
        if (this._currentState === 'TEAM_SELECT' ||
            this._currentState === 'PRE_COUNTDOWN' ||
            this._currentState === 'ACTIVE') {
            // For ACTIVE/PRE_COUNTDOWN: only consider teams that are currently in the game
            // For TEAM_SELECT: consider all teams
            let candidateTeams = ['red', 'blue', 'green', 'yellow'];
            if (this._currentState === 'ACTIVE' || this._currentState === 'PRE_COUNTDOWN') {
                // Only include teams that have an assigned arm (meaning they're active in the game)
                candidateTeams = [];
                for (let i = 0; i < this._teamOrder.length; i++) {
                    const team = this._teamOrder[i];
                    const arm = this._armByTeam[team];
                    if (arm) {
                        candidateTeams.push(team);
                    }
                }
                // Fallback: if no teams have arms yet, use teams with players
                if (candidateTeams.length === 0) {
                    const activeTeams = this._activeTeams();
                    for (let i = 0; i < activeTeams.length; i++) {
                        candidateTeams.push(activeTeams[i]);
                    }
                }
            }
            // Find team with minimum count from candidate teams
            let minCount = Infinity;
            let target = candidateTeams[0];
            for (let i = 0; i < candidateTeams.length; i++) {
                const team = candidateTeams[i];
                const count = this._count(team);
                if (count < minCount) {
                    minCount = count;
                    target = team;
                }
            }
            this.assignPlayerToTeam(pid, target);
            this.log('Auto-assigned P' + pid + ' to ' + target + ' (from ' + candidateTeams.length + ' active teams)');
            // Grant 3-second grace period on join (prevents edge case exploits like flag grabs during join)
            if (this._currentState === 'ACTIVE' || this._currentState === 'PRE_COUNTDOWN') {
                const now = Date.now();
                this._spawnImmunity[pid + ''] = now + 3000; // 3 seconds grace period
            }
            // Teleport to team spawn if game is active or countdown has started
            if (this._currentState === 'ACTIVE' || this._currentState === 'PRE_COUNTDOWN') {
                this.teleportToSpawn(pid, target);
            }
            else if (this._currentState === 'TEAM_SELECT') {
                // Teleport to team select area (centered, 30% from top)
                playerManager.teleportPlayers([pid], {
                    distributionType: 'area',
                    positionX: this._stageWidth / 2,
                    positionY: this._stageHeight * 0.30, // 30% from top
                    width: 100,
                    height: 50,
                });
            }
            this.drawOrUpdateTeamSelect();
        }
    }
    onPlayerLeft(o) {
        if (!playerManager.isHost)
            return;
        const pid = o.playerId;
        if (!pid)
            return;
        this.log('Player left P' + pid);
        // remove from lists (including green and yellow teams)
        function remove(list, v) {
            for (let i = 0; i < list.length; i++) {
                if (list[i] === v) {
                    for (let j = i + 1; j < list.length; j++)
                        list[j - 1] = list[j];
                    list.pop();
                    break;
                }
            }
        }
        remove(this._teamRedList, pid);
        remove(this._teamBlueList, pid);
        remove(this._teams.green, pid);
        remove(this._teams.yellow, pid);
        if (this._currentState !== 'GAME_OVER') {
            if (!(this._count('red') >= 1 && this._count('blue') >= 1)) {
                if (this._currentState !== 'TEAM_SELECT') {
                    this._currentState = 'TEAM_SELECT';
                    this._countdownStarted = false;
                    this.log('Countdown cancelled (player left)');
                }
            }
        }
        this.drawOrUpdateTeamSelect();
    }
    assignPlayerToTeam(pid, team) {
        if (team !== 'red' &&
            team !== 'blue' &&
            team !== 'green' &&
            team !== 'yellow')
            return false;
        // already in that team?
        if (this._getTeam(pid) === team)
            return true;
        // helper indexOf (no ES6 assumed)
        function idx(list, v) {
            for (let i = 0; i < list.length; i++) {
                if (list[i] === v)
                    return i;
            }
            return -1;
        }
        function remove(list, v) {
            const i = idx(list, v);
            if (i >= 0) {
                for (let j = i + 1; j < list.length; j++) {
                    list[j - 1] = list[j];
                }
                list.pop();
            }
        }
        // remove from both lists first
        remove(this._teamRedList, pid);
        remove(this._teamBlueList, pid);
        remove(this._teams.green, pid);
        remove(this._teams.yellow, pid);
        const targetList = team === 'red'
            ? this._teamRedList
            : team === 'blue'
                ? this._teamBlueList
                : this._teams[team];
        const max = this._cfg.maxPlayersPerTeam || 4;
        if (targetList.length >= max) {
            this.log('Team ' + team + ' full');
            return false;
        }
        if (idx(targetList, pid) === -1) {
            targetList.push(pid);
        }
        // Update nameplate with team emoji and apply tint immediately
        const d = playerManager.getPlayerDetails(pid);
        const base = d && d.username ? d.username : 'P' + pid;
        const emo = this._teamEmoji[team] || '';
        playerManager.setNameplate(pid, this._formatNameplate(pid, emo + ' ' + base));
        // Apply team tint using lighter player colors for visibility
        const playerTint = this._playerColors[team] || '#CCCCCC';
        playerManager.tintPlayer(pid, playerTint);
        this.log('Assign P' +
            pid +
            ' -> ' +
            team +
            ' (R=' +
            this._teamRedList.length +
            ' B=' +
            this._teamBlueList.length +
            ') tint=' +
            playerTint);
        this.computeLayout();
        return true;
    }
    // Helper: Format nameplate with host indicator
    _formatNameplate(pid, baseText) {
        const isHost = playerManager.isHost && pid === playerManager.getMyPlayerId();
        return isHost ? 'Host - ' + baseText : baseText;
    }
    drawOrUpdateTeamSelect() {
        if (!playerManager.isHost)
            return;
        const redBtn = 'ctf_team_red_btn', blueBtn = 'ctf_team_blue_btn', greenBtn = 'ctf_team_green_btn', yellowBtn = 'ctf_team_yellow_btn', startBtn = 'ctf_start_btn', selectTeamsHeader = 'ctf_select_teams_header';
        const rc = this._teamRedList.length;
        const bc = this._teamBlueList.length;
        const gc = this._teams.green.length;
        const yc = this._teams.yellow.length;
        const max = this._cfg.maxPlayersPerTeam || 4;
        // start requires at least 2 active teams
        const activeTeams = (rc > 0 ? 1 : 0) + (bc > 0 ? 1 : 0) + (gc > 0 ? 1 : 0) + (yc > 0 ? 1 : 0);
        const showStart = activeTeams >= 2 &&
            !this._countdownStarted &&
            this._currentState === 'TEAM_SELECT';
        if (activeTeams < 2 && playerManager.getPlayerIds().length > 0) {
            this._setWorldActivity('GAME_WAITING');
        }
        // Team lock: if countdown started and config disallows switching, make buttons non-interactive
        const allowSwitch = this._cfg.allowTeamSwitchDuringCountdown !== false ||
            !this._countdownStarted;
        // Remove ALL team buttons (including green/yellow) when not in TEAM_SELECT state
        const instructionsTxt = 'ctf_instructions_txt';
        if (this._currentState !== 'TEAM_SELECT') {
            const arr = [
                redBtn,
                blueBtn,
                greenBtn,
                yellowBtn,
                startBtn,
                instructionsTxt,
                selectTeamsHeader,
            ];
            for (let i = 0; i < arr.length; i++) {
                if (spriteManager.getSprite(arr[i]))
                    spriteManager.removeSprite(arr[i]);
            }
            return;
        }
        // Add instructional text (centered at top)
        if (spriteManager.getSprite(instructionsTxt))
            spriteManager.removeSprite(instructionsTxt);
        const instructionText = '🚩 Capture the Flag! Grab the enemy flag and return it to your base. First to 3 wins! 🏆';
        const instructionWidth = 550; // Estimated width for fontSize 20
        spriteManager.addSprite('text', {
            uniqueId: instructionsTxt,
            text: instructionText,
            positionX: this._stageWidth / 2 - instructionWidth / 2,
            positionY: 5,
            fontSize: 20,
            isInteractive: false,
            align: 'center',
        });
        // Add "Select a Team" header (bold, black, halfway between instructions and team buttons)
        // Only show during TEAM_SELECT and before countdown starts
        if (!this._countdownStarted) {
            if (spriteManager.getSprite(selectTeamsHeader))
                spriteManager.removeSprite(selectTeamsHeader);
            const selectTeamsText = 'Select a Team';
            const selectTeamsWidth = 220; // Increased for bigger text
            spriteManager.addSprite('text', {
                uniqueId: selectTeamsHeader,
                text: selectTeamsText,
                positionX: this._stageWidth / 2 - selectTeamsWidth / 2,
                positionY: 60, // Halfway between instructions (5+20=25) and team buttons (140)
                fontSize: 36, // Bigger font size
                fontWeight: 'bold',
                fontColor: '#000000', // Black text
                strokeColor: '#FFFFFF', // White outline for contrast
                strokeWeight: 2,
                isInteractive: false,
                align: 'center',
            });
        }
        else {
            // Remove header when countdown starts
            if (spriteManager.getSprite(selectTeamsHeader))
                spriteManager.removeSprite(selectTeamsHeader);
        }
        // Center team buttons - Red and Blue on first row, bigger and bolder
        const centerX = this._stageWidth / 2;
        const buttonSpacing = 200; // Increased spacing for bigger buttons
        const row1Y = 140; // Moved down to accommodate bigger header
        const row2Y = 200; // Moved down proportionally
        const buttonWidth = 160; // Estimated width for bigger button text
        const leftShift = 30; // Adjusted for new spacing
        if (spriteManager.getSprite(redBtn))
            spriteManager.removeSprite(redBtn);
        const rTxt = rc >= max ? '🔴 Red Full' : '🔴 Join Red (' + rc + ')';
        spriteManager.addSprite('text', {
            uniqueId: redBtn,
            text: rTxt,
            positionX: centerX - buttonSpacing - buttonWidth / 2 - leftShift,
            positionY: row1Y,
            fontSize: 28, // Bigger
            fontWeight: 'bold', // Bolder
            fontColor: this._teamColors.red, // Use dark red team color
            strokeColor: '#000000', // Black outline
            strokeWeight: 2,
            isInteractive: rc < max && allowSwitch,
        });
        if (spriteManager.getSprite(blueBtn))
            spriteManager.removeSprite(blueBtn);
        const bTxt = bc >= max ? '🔵 Blue Full' : '🔵 Join Blue (' + bc + ')';
        spriteManager.addSprite('text', {
            uniqueId: blueBtn,
            text: bTxt,
            positionX: centerX + buttonSpacing - buttonWidth / 2 - leftShift,
            positionY: row1Y,
            fontSize: 28, // Bigger
            fontWeight: 'bold', // Bolder
            fontColor: this._teamColors.blue, // Use dark blue team color
            strokeColor: '#000000', // Black outline
            strokeWeight: 2,
            isInteractive: bc < max && allowSwitch,
        });
        // Green and Yellow on second row
        if (spriteManager.getSprite(greenBtn))
            spriteManager.removeSprite(greenBtn);
        const gTxt = gc >= max ? '🟢 Green Full' : '🟢 Join Green (' + gc + ')';
        spriteManager.addSprite('text', {
            uniqueId: greenBtn,
            text: gTxt,
            positionX: centerX - buttonSpacing - buttonWidth / 2 - leftShift,
            positionY: row2Y,
            fontSize: 28, // Bigger
            fontWeight: 'bold', // Bolder
            fontColor: this._teamColors.green, // Use dark green team color
            strokeColor: '#000000', // Black outline
            strokeWeight: 2,
            isInteractive: gc < max && allowSwitch,
        });
        if (spriteManager.getSprite(yellowBtn))
            spriteManager.removeSprite(yellowBtn);
        const yTxt = yc >= max ? '🟡 Yellow Full' : '🟡 Join Yellow (' + yc + ')';
        spriteManager.addSprite('text', {
            uniqueId: yellowBtn,
            text: yTxt,
            positionX: centerX + buttonSpacing - buttonWidth / 2 - leftShift,
            positionY: row2Y,
            fontSize: 28, // Bigger
            fontWeight: 'bold', // Bolder
            fontColor: this._teamColors.yellow, // Use dark yellow/gold team color
            strokeColor: '#000000', // Black outline
            strokeWeight: 2,
            isInteractive: yc < max && allowSwitch,
        });
        // Start button on third row (centered)
        if (showStart) {
            if (spriteManager.getSprite(startBtn))
                spriteManager.removeSprite(startBtn);
            const cd = this._cfg.countdownSeconds || 3;
            const startBtnText = '▶️ Start (' + cd + 's)';
            const startBtnWidth = 140; // Increased for bigger text
            spriteManager.addSprite('text', {
                uniqueId: startBtn,
                text: startBtnText,
                positionX: centerX - startBtnWidth / 2 - leftShift,
                positionY: 260, // Moved down to accommodate taller buttons
                fontSize: 36, // Bigger font size
                fontWeight: 'bold', // Bolder
                fontColor: '#000000', // Black text
                strokeColor: '#FFFFFF', // White outline for contrast
                strokeWeight: 2,
                isInteractive: true,
            });
        }
        else {
            // Remove start button when not showing
            if (spriteManager.getSprite(startBtn))
                spriteManager.removeSprite(startBtn);
        }
    }
    // --- EVENT HANDLERS (restored after simplification) ---
    onEvent_playerSelectsTeam(eventData) {
        if (!playerManager.isHost)
            return;
        if (!eventData || !eventData.playerId)
            return;
        const pid = eventData.playerId;
        if (this.assignPlayerToTeam(pid, eventData.team)) {
            this.drawOrUpdateTeamSelect();
            this.computeLayout();
            // Analytics: Player joins (count + unique)
            if (this._analyticsPublicKey) {
                try {
                    const details = playerManager.getPlayerDetails(pid);
                    const profileId = details?.profileId;
                    if (profileId) {
                        integrationsManager.putPublicKeyAnalytics({
                            interactivePublicKey: this._analyticsPublicKey,
                            analytics: [
                                {
                                    analyticName: 'ctfJoins',
                                    profileId: profileId,
                                },
                                {
                                    analyticName: 'ctfUniqueJoins',
                                    profileId: profileId,
                                    uniqueKey: profileId,
                                },
                            ],
                        });
                    }
                }
                catch (e) {
                    this.log('Analytics error (join): ' + e);
                }
            }
            // Don't draw zones yet - wait until game actually starts
        }
    }
    onEvent_hostStartsGame(eventData) {
        if (!playerManager.isHost)
            return;
        if (this._currentState !== 'TEAM_SELECT' || this._countdownStarted)
            return;
        if (!eventData || !eventData.playerId)
            return;
        this.log('Start requested by P' + eventData.playerId);
        this.startCountdown();
    }
    // Alias for emitted 'startGame'
    onEvent_startGame(eventData) {
        this.onEvent_hostStartsGame(eventData);
    }
    onEvent_restartGame(eventData) {
        if (!playerManager.isHost)
            return;
        if (this._currentState !== 'GAME_OVER')
            return;
        if (!eventData || !eventData.playerId)
            return;
        this.log('Restart requested by P' + eventData.playerId);
        // Clear all territory zones (between games)
        this.clearAllZones();
        // Reset game to team selection
        this._currentState = 'TEAM_SELECT';
        this._countdownStarted = false;
        this._finalScoresComputed = false;
        this._winnerTeam = '';
        // Reset scores
        this._redScore = 0;
        this._blueScore = 0;
        for (var i = 0; i < this._teamOrder.length; i++) {
            var tk = this._teamOrder[i];
            this._scores[tk] = 0;
        }
        // Reset all flag states (but don't show them yet - they'll appear on next match start)
        for (var i = 0; i < this._teamOrder.length; i++) {
            var t = this._teamOrder[i];
            var fs = this._flagStates[t];
            if (fs) {
                fs.heldBy = 0;
                fs.atBase = true;
                this._carrierOfFlagTeam[t] = 0;
                this._flagHeld[t] = false;
                // Don't call showFlag() here - flags will be spawned when next match starts
            }
        }
        // Clear spawn immunity
        this._spawnImmunity = {};
        // Restore all player nameplates
        var pids = playerManager.getPlayerIds();
        for (var i = 0; i < pids.length; i++) {
            var pid = pids[i];
            var team = this._getTeam(pid);
            if (team) {
                this.restoreNameplate(pid, team);
            }
        }
        // Redraw team selection UI
        this.drawOrUpdateTeamSelect();
        this.updateHud();
        this.log('Game restarted - back to team selection');
    }
    startCountdown() {
        if (this._countdownStarted)
            return;
        this._countdownStarted = true;
        this._currentState = 'PRE_COUNTDOWN';
        const cd = this._cfg.countdownSeconds || 3;
        this._countdownEndTime = Date.now() + cd * 1000;
        this.log('Countdown start (' + cd + 's)');
        this._debugAudit('on-start-countdown');
        // Analytics: Game starts (one per game) + Player starts (count + unique per starter)
        if (this._analyticsPublicKey) {
            try {
                const allPids = playerManager.getPlayerIds();
                const analytics = [];
                // Game starts (one event per game)
                analytics.push({
                    analyticName: 'ctfGameStarts',
                });
                // For each player starting: track player start (count + unique)
                for (let i = 0; i < allPids.length; i++) {
                    const details = playerManager.getPlayerDetails(allPids[i]);
                    const profileId = details?.profileId;
                    if (profileId) {
                        analytics.push({
                            analyticName: 'ctfPlayerStarts',
                            profileId: profileId,
                        });
                        analytics.push({
                            analyticName: 'ctfUniquePlayerStarts',
                            profileId: profileId,
                            uniqueKey: profileId,
                        });
                    }
                }
                integrationsManager.putPublicKeyAnalytics({
                    interactivePublicKey: this._analyticsPublicKey,
                    analytics,
                });
            }
            catch (e) {
                this.log('Analytics error (game start): ' + e);
            }
        }
        // Remove ALL team selection UI elements (including green, yellow, and instructions)
        const ids = [
            'ctf_team_red_btn',
            'ctf_team_blue_btn',
            'ctf_team_green_btn',
            'ctf_team_yellow_btn',
            'ctf_start_btn',
            'ctf_instructions_txt',
            'ctf_select_teams_header', // Remove "Select a Team" header
        ];
        for (let i = 0; i < ids.length; i++) {
            if (spriteManager.getSprite(ids[i]))
                spriteManager.removeSprite(ids[i]);
        }
        this.updateHud();
    }
    _debugCheckRecentTeleport() {
        if (!this._logEnabled)
            return;
        try {
            for (const k in this._recentTeleport) {
                const v = this._recentTeleport[k];
                if (typeof v !== 'number' || !isFinite(v)) {
                    this.log('TP_BAD key=' + k + ' vType=' + this._typeOf(v) + ' val=' + v);
                    // sanitize: remove bad entry so serializer never sees undefined
                    delete this._recentTeleport[k];
                }
            }
        }
        catch (e) {
            this.log('TP_BAD_ERROR ' + e);
        }
    }
    _debugCheckAllStates() {
        if (!this._logEnabled)
            return;
        try {
            // Check all major state objects for undefined/null values
            for (const k in this._carrierOfFlagTeam) {
                const v = this._carrierOfFlagTeam[k];
                if (typeof v !== 'number' || !isFinite(v)) {
                    this.log('CARRIER_BAD key=' + k + ' vType=' + this._typeOf(v) + ' val=' + v);
                    this._carrierOfFlagTeam[k] = 0;
                }
            }
            for (const k in this._flagHeld) {
                const v = this._flagHeld[k];
                if (typeof v !== 'boolean') {
                    this.log('FLAGHELD_BAD key=' + k + ' vType=' + this._typeOf(v) + ' val=' + v);
                    this._flagHeld[k] = false;
                }
            }
            for (const k in this._scores) {
                const v = this._scores[k];
                if (typeof v !== 'number' || !isFinite(v)) {
                    this.log('SCORE_BAD key=' + k + ' vType=' + this._typeOf(v) + ' val=' + v);
                    this._scores[k] = 0;
                }
            }
        }
        catch (e) {
            this.log('STATECHECK_ERROR ' + e);
        }
    }
    update() {
        if (!playerManager.isHost || this._destroyed)
            return;
        const now = Date.now();
        if (this._currentState === 'PRE_COUNTDOWN' &&
            now >= this._countdownEndTime) {
            this._currentState = 'ACTIVE';
            this._setWorldActivity('GAME_ON');
            this.startMatch();
            this.log('STATE -> ACTIVE');
            if (!this._debugAuditOnceAfterStart) {
                this._debugAuditOnceAfterStart = true;
                this._debugAudit('post-active');
            }
        }
        if (this._currentState === 'ACTIVE') {
            this._debugCheckRecentTeleport();
            this._debugCheckAllStates();
        }
        if (now - this._lastHudUpdateT > 200) {
            this._lastHudUpdateT = now;
            this.updateHud();
        }
        // Removed stale references to _lastTeamDebugT, _teamsObj, and _teamCounts
    }
    onStep() {
        this.update();
    }
    startMatch() {
        this._redScore = 0;
        this._blueScore = 0;
        this._redCarrierId = 0;
        this._blueCarrierId = 0;
        this._redFlagHeld = false;
        this._blueFlagHeld = false;
        // Clean state maps to prevent serialization issues
        this._recentTeleport = {};
        this._carrierOfFlagTeam = {};
        this._carrierOfFlagTeam.red = 0;
        this._carrierOfFlagTeam.blue = 0;
        this._carrierOfFlagTeam.green = 0;
        this._carrierOfFlagTeam.yellow = 0;
        this._flagHeld = {};
        this._flagHeld.red = false;
        this._flagHeld.blue = false;
        this._flagHeld.green = false;
        this._flagHeld.yellow = false;
        this._scores = {};
        this._scores.red = 0;
        this._scores.blue = 0;
        this._scores.green = 0;
        this._scores.yellow = 0;
        for (let i = 0; i < this._teamOrder.length; i++) {
            const t = this._teamOrder[i];
            if (t !== 'red' && t !== 'blue')
                this._scores[t] = 0;
            this._carrierOfFlagTeam[t] = 0;
            this._flagHeld[t] = false;
        }
        this._winnerTeam = '';
        this.log('startMatch spawning dual flags');
        this.spawnDualFlags();
        this._debugAudit('after-spawn-flags');
        // teleport all active teams to computed spawns
        this.computeLayout();
        var teams = this._activeTeams();
        for (var ti = 0; ti < teams.length; ti++) {
            var tkey = teams[ti];
            var arr = this._list(tkey);
            for (var k = 0; k < arr.length; k++)
                this.teleportToSpawn(arr[k], tkey);
        }
        this.addOrUpdateZones();
        this.updateHud();
    }
    spawnDualFlags() {
        try {
            // Spawn one flag per active team at the center of its arm cell
            this.computeLayout();
            for (let i = 0; i < this._teamOrder.length; i++) {
                const team = this._teamOrder[i];
                const arr = this._list(team);
                const arm = this._armByTeam[team];
                const isActive = arr && arr.length > 0 && !!arm;
                const id = 'ctf_flag_' + team;
                this.log('FLAG_PRE team=' +
                    team +
                    ' active=' +
                    !!isActive +
                    ' arm=' +
                    arm +
                    ' len=' +
                    (arr ? arr.length : 0));
                if (!isActive) {
                    if (spriteManager.getSprite(id))
                        spriteManager.removeSprite(id);
                    this._flagStates[team].spriteId = id;
                    this._flagStates[team].heldBy = 0;
                    this._flagStates[team].atBase = false; // inactive
                    continue;
                }
                // Use pre-calculated flag position from computeLayout() (handles 3-team repositioning)
                const pos = this._flagStates[team].pos || { x: 0, y: 0 };
                const fill = this._teamColors[team] || '#CCCCCC';
                this._flagStates[team].spriteId = id;
                this._flagStates[team].heldBy = 0;
                this._flagStates[team].atBase = true;
                if (spriteManager.getSprite(id))
                    spriteManager.removeSprite(id);
                this.log('FLAG_ADD id=' +
                    id +
                    ' posTypes={' +
                    this._typeOf(pos.x) +
                    ',' +
                    this._typeOf(pos.y) +
                    '} fillType=' +
                    this._typeOf(fill));
                spriteManager.addSprite('ctf_flag', {
                    uniqueId: id,
                    positionX: pos.x,
                    positionY: pos.y,
                    width: 40,
                    height: 40,
                    fill,
                    strokeColor: '#000000',
                    strokeWeight: 2,
                    isInteractive: false,
                    collisionGroup: 'flag',
                    checkCollisions: true,
                    opacity: 1,
                });
            }
            this.log('spawned flags for active teams');
            this.spawnFlagZones(); // Add visual indicators
        }
        catch (e) {
            this.log('spawnDualFlags ERROR ' + e);
            console.log(e);
        }
    }
    spawnFlagZones() {
        // Create semi-opaque white rectangles around flag bases to indicate camping zones
        try {
            for (let i = 0; i < this._teamOrder.length; i++) {
                const team = this._teamOrder[i];
                const arr = this._list(team);
                const arm = this._armByTeam[team];
                const isActive = arr && arr.length > 0 && !!arm;
                const zoneId = 'ctf_flagzone_' + team;
                if (!isActive) {
                    if (spriteManager.getSprite(zoneId)) {
                        spriteManager.removeSprite(zoneId);
                    }
                    continue;
                }
                const pos = this._flagStates[team].pos;
                const size = this._flagZoneRadius * 2;
                const flagSize = 40; // Flag sprite is 40x40
                // Center the zone square around the flag
                // Offset by (zoneSize - flagSize) / 2 to center
                const offset = (size - flagSize) / 2;
                if (spriteManager.getSprite(zoneId)) {
                    spriteManager.removeSprite(zoneId);
                }
                spriteManager.addSprite('ctf_white_square', {
                    uniqueId: zoneId,
                    positionX: pos.x - offset,
                    positionY: pos.y - offset,
                    width: size,
                    height: size,
                    fill: '#FFFFFF',
                    isInteractive: false,
                    collisionGroup: 'flagzone_' + team, // Unique collision group per team
                    checkCollisions: true, // Enable collision detection for camping
                    opacity: 0.15, // Semi-transparent
                    zOrder: -2, // Below flag (flag has no zOrder, so defaults to 0)
                });
                this._flagZoneSprites[team] = zoneId;
            }
        }
        catch (e) {
            this.log('spawnFlagZones ERROR ' + e);
        }
    }
    teleportToSpawn(pid, team) {
        const sp = this._spawnPoints[team];
        if (!sp)
            return;
        // Blanket rule: Drop all flags on teleport (prevents edge cases)
        const carriedFlags = this._playerCarriesAllFlags(pid);
        if (carriedFlags.length > 0) {
            for (let i = 0; i < carriedFlags.length; i++) {
                this.resetStolenFlag(pid, carriedFlags[i]);
            }
            this.log('Player P' + pid + ' dropped ' + carriedFlags.length + ' flags on teleport');
        }
        playerManager.teleportPlayers([pid], {
            distributionType: 'area',
            positionX: sp.x,
            positionY: sp.y,
            height: 100,
            width: 100,
        });
        this._recentTeleport[pid + ''] = Date.now();
        // Grant 2-second spawn immunity
        const now = Date.now();
        this._spawnImmunity[pid + ''] = now + 2000; // 2 seconds
        // Update nameplate with shield emoji
        const det = playerManager.getPlayerDetails(pid);
        const base = det && det.username ? det.username : 'P' + pid;
        const teamEmoji = this._teamEmoji[team] || '';
        playerManager.setNameplate(pid, this._formatNameplate(pid, teamEmoji + ' 🛡️ ' + base));
        // No stored player record to update; position taken from engine when needed
    }
    onSpriteCollisionStart({ sprite1, sprite2, }) {
        if (this._currentState !== 'ACTIVE')
            return;
        const s1 = sprite1, s2 = sprite2;
        if (!s1 || !s2)
            return;
        if (s1.playerId == undefined && s2.playerId == undefined) {
            return;
        }
        // Check for flag zone camping (player entering their own flag zone)
        var playerSprite2 = s1.playerId != undefined ? s1 : (s2.playerId != undefined ? s2 : null);
        var zoneSprite = null;
        if (s1.collisionGroup && String(s1.collisionGroup).indexOf('flagzone_') === 0) {
            zoneSprite = s1;
        }
        else if (s2.collisionGroup && String(s2.collisionGroup).indexOf('flagzone_') === 0) {
            zoneSprite = s2;
        }
        if (playerSprite2 && zoneSprite) {
            const pid = playerSprite2.playerId;
            if (pid) {
                // Extract team from flagzone collision group (e.g., 'flagzone_red' -> 'red')
                const zoneTeam = String(zoneSprite.collisionGroup).substring('flagzone_'.length);
                const playerTeam = this._getTeam(pid);
                // Only track camping if player is a defender (in their own flag zone)
                // AND they are NOT carrying any flags (attackers with flags shouldn't be penalized)
                if (playerTeam === zoneTeam) {
                    const carriedFlags = this._playerCarriesAllFlags(pid);
                    // Don't track camping if player is carrying a flag (they're attacking, not camping)
                    if (carriedFlags.length === 0) {
                        const pidStr = String(pid);
                        const now = Date.now();
                        // Start camping timer
                        if (!this._campingTimers[pidStr]) {
                            this._campingTimers[pidStr] = now;
                            this.log('Player P' + pid + ' entered flag zone (camping started)');
                        }
                    }
                }
            }
        }
        if (s1.playerId != undefined && s2.playerId != undefined) {
            this.handleDualTag(s1.playerId, s2.playerId);
        }
        var playerSprite = null;
        var flagSprite = null;
        if (s1.collisionGroup == 'flag') {
            flagSprite = s1;
            playerSprite = s2;
        }
        else if (s2.collisionGroup == 'flag') {
            flagSprite = s2;
            playerSprite = s1;
        }
        if (playerSprite && flagSprite) {
            var pid = playerSprite.playerId;
            if (pid) {
                // Determine flag owner team from uniqueId pattern 'ctf_flag_<team>'
                var ownerTeam = '';
                var uid = String(flagSprite.uniqueId || '');
                var pfx = 'ctf_flag_';
                var idx = uid.indexOf(pfx);
                if (idx !== -1)
                    ownerTeam = uid.substring(idx + pfx.length);
                // minimal logging (owner team only when pickup/capture actually happens)
                if (ownerTeam) {
                    var fs = this._flagStates[ownerTeam];
                    if (!fs) {
                        this.log('WARN fs missing for ' + ownerTeam);
                        return;
                    }
                    const playerTeam = this._getTeam(pid);
                    if (playerTeam === ownerTeam) {
                        // Player collided with their OWN flag
                        // ONLY score if the flag is at base (not being carried)
                        if (fs.atBase && fs.heldBy === 0) {
                            // Check for spawn/join grace period - prevent scoring during immunity
                            const now = Date.now();
                            const pidStr = String(pid);
                            if (this._spawnImmunity[pidStr] && now < this._spawnImmunity[pidStr]) {
                                // Player has spawn immunity - ignore scoring
                                return;
                            }
                            // Check if they're carrying ANY ENEMY flags to score captures
                            const carriedFlags = this._playerCarriesAllFlags(pid);
                            const enemyFlags = [];
                            for (let i = 0; i < carriedFlags.length; i++) {
                                if (carriedFlags[i] !== playerTeam) {
                                    enemyFlags.push(carriedFlags[i]);
                                }
                            }
                            if (enemyFlags.length > 0) {
                                // Player is carrying enemy flag(s) and touched their own flag AT BASE - SCORE ALL!
                                for (let i = 0; i < enemyFlags.length; i++) {
                                    this.scoreCaptureDual(pid, playerTeam, enemyFlags[i]);
                                }
                            }
                        }
                        // Own flag touched but either being carried or player has no enemy flags - ignore
                        return;
                    }
                    // overlap handling simplified (debug removed for performance)
                    if (fs && fs.atBase && fs.heldBy === 0 && playerTeam !== ownerTeam) {
                        // Check for spawn/join grace period - prevent flag pickup during immunity
                        const now = Date.now();
                        const pidStr = String(pid);
                        if (this._spawnImmunity[pidStr] && now < this._spawnImmunity[pidStr]) {
                            // Player has spawn immunity - ignore flag pickup
                            return;
                        }
                        // guard: if flag already marked held by simple bool, ignore
                        if (this._flagHeld[ownerTeam])
                            return;
                        fs.atBase = false;
                        fs.heldBy = pid;
                        this._carrierOfFlagTeam[ownerTeam] = pid;
                        this._flagHeld[ownerTeam] = true;
                        // HARD CODE hide using known constant IDs (simplest reliable path)
                        this.hideFlag(ownerTeam);
                        // Get player details for nameplate and particle effects
                        var det = playerManager.getPlayerDetails(pid);
                        // Particle effect: Confetti on flag grab
                        if (det) {
                            try {
                                const publicKey = stateManager.getVariable('PublicKey');
                                integrationsManager.triggerParticleEffect({
                                    particleName: 'classicConfetti_explosion',
                                    position: { x: det.x, y: det.y },
                                    duration: 1.0,
                                    followPlayerId: pid,
                                    interactivePublicKey: publicKey,
                                });
                            }
                            catch (e) {
                                this.log('Flag grab particle effect error: ' + e);
                            }
                        }
                        var base = det && det.username ? det.username : 'P' + pid;
                        // Show ALL flags in nameplate
                        const allCarriedFlags = this._playerCarriesAllFlags(pid);
                        const flagIcons = allCarriedFlags
                            .map(function () {
                            return '🏳️';
                        })
                            .join(' ');
                        playerManager.setNameplate(pid, this._formatNameplate(pid, (this._teamEmoji[playerTeam] || '') +
                            ' ' +
                            flagIcons +
                            ' ' +
                            base));
                        // White indicator sprites removed - using nameplate emoji instead
                        this.log('Pickup ' + ownerTeam + ' flag by P' + fs.heldBy);
                        // Clear camping timer when picking up a flag (now attacking, not defending)
                        if (this._campingTimers[pidStr]) {
                            this._campingTimers[pidStr] = 0;
                        }
                        const ownerLabel = ownerTeam.charAt(0).toUpperCase() + ownerTeam.slice(1);
                        const playerLabel = playerTeam.charAt(0).toUpperCase() + playerTeam.slice(1);
                        this.showNotification(playerLabel + ' team captured the ' + ownerLabel + ' flag!', 2500);
                        return;
                    }
                }
            }
        }
    }
    onSpriteCollisionStop({ sprite1, sprite2, }) {
        // Handle player leaving flag zone (stop camping)
        const s1 = sprite1, s2 = sprite2;
        if (!s1 || !s2)
            return;
        var playerSprite = s1.playerId != undefined ? s1 : (s2.playerId != undefined ? s2 : null);
        var zoneSprite = null;
        if (s1.collisionGroup && String(s1.collisionGroup).indexOf('flagzone_') === 0) {
            zoneSprite = s1;
        }
        else if (s2.collisionGroup && String(s2.collisionGroup).indexOf('flagzone_') === 0) {
            zoneSprite = s2;
        }
        if (playerSprite && zoneSprite) {
            const pid = playerSprite.playerId;
            if (pid) {
                const zoneTeam = String(zoneSprite.collisionGroup).substring('flagzone_'.length);
                const playerTeam = this._getTeam(pid);
                // Clear camping timer when defender leaves their flag zone
                if (playerTeam === zoneTeam) {
                    const pidStr = String(pid);
                    if (this._campingTimers[pidStr]) {
                        this._campingTimers[pidStr] = 0;
                        this.log('Player P' + pid + ' left flag zone (camping stopped)');
                        // Restore normal nameplate
                        const det = playerManager.getPlayerDetails(pid);
                        if (det) {
                            const base = det.username || 'P' + pid;
                            const teamEmoji = this._teamEmoji[playerTeam] || '';
                            playerManager.setNameplate(pid, this._formatNameplate(pid, teamEmoji + ' ' + base));
                        }
                    }
                }
            }
        }
    }
    showFlag(flagTeam) {
        const fs = this._flagStates[flagTeam];
        if (!fs)
            return;
        // Use stored flag position from computeLayout (handles 3-team repositioning)
        // Position was already set in computeLayout, just need to ensure it's set
        const storedPos = this._flagStates[flagTeam].pos;
        const baseX = storedPos ? storedPos.x : this._redSpawnX;
        const baseY = storedPos ? storedPos.y : this._centerY;
        fs.pos.x = baseX;
        fs.pos.y = baseY;
        const id = 'ctf_flag_' + flagTeam;
        fs.spriteId = id;
        if (spriteManager.getSprite(id)) {
            spriteManager.updateSprite(id, {
                positionX: baseX,
                positionY: baseY,
                opacity: 1,
            });
        }
        else {
            const fill = this._teamColors[flagTeam] || '#CCCCCC';
            spriteManager.addSprite('ctf_flag', {
                uniqueId: id,
                positionX: baseX,
                positionY: baseY,
                width: 40,
                height: 40,
                fill,
                isInteractive: false,
                collisionGroup: 'flag',
                checkCollisions: true,
                opacity: 1,
            });
        }
    }
    addFlagIndicator(pid, flagTeam) {
        // Add a small white flag sprite indicator on/behind the player carrying a flag
        // Multiple flags are spaced horizontally so all are visible
        const indicatorId = 'flag_indicator_' + pid + '_' + flagTeam;
        const det = playerManager.getPlayerDetails(pid);
        if (!det)
            return;
        // Count how many flags this player is already carrying to space them out
        const carriedFlags = this._playerCarriesAllFlags(pid);
        const flagIndex = carriedFlags.indexOf(flagTeam);
        const spacing = 25; // Horizontal spacing between flags
        const offsetX = flagIndex * spacing - ((carriedFlags.length - 1) * spacing) / 2;
        spriteManager.addSprite('ctf_flag', {
            uniqueId: indicatorId,
            positionX: det.x + offsetX,
            positionY: det.y + 5, // On player body (slightly below center)
            width: 20,
            height: 20,
            fill: '#FFFFFF', // White flag icon (neutral)
            isInteractive: false,
            opacity: 0.9,
        });
    }
    removeFlagIndicator(pid, flagTeam) {
        const indicatorId = 'flag_indicator_' + pid + '_' + flagTeam;
        if (spriteManager.getSprite(indicatorId)) {
            spriteManager.removeSprite(indicatorId);
        }
    }
    hideFlag(flagTeam) {
        const id = 'ctf_flag_' + flagTeam;
        if (spriteManager.getSprite(id)) {
            spriteManager.updateSprite(id, { opacity: 0 });
        }
    }
    restoreNameplate(pid, team) {
        const d = playerManager.getPlayerDetails(pid);
        const base = d && d.username ? d.username : 'P' + pid;
        const emo = this._teamEmoji[team] || '';
        playerManager.setNameplate(pid, this._formatNameplate(pid, emo + ' ' + base));
    }
    // singleFlagPickup removed (dual only)
    // removed fallback manual scan + tagging functions for performance simplicity
    handleDualTag(pida, pidb) {
        const ta = this._getTeam(pida);
        const tb = this._getTeam(pidb);
        // Players of the same team CANNOT tag one another
        if (!ta || !tb || ta === tb)
            return;
        const now = Date.now();
        // Check spawn immunity - if either player is immune, ignore tag
        if ((this._spawnImmunity[pida + ''] &&
            now < this._spawnImmunity[pida + '']) ||
            (this._spawnImmunity[pidb + ''] && now < this._spawnImmunity[pidb + '']))
            return;
        // guard: if either just teleported (<300ms), ignore tag to avoid multi-trigger
        if ((this._recentTeleport[pida + ''] &&
            now - this._recentTeleport[pida + ''] < 300) ||
            (this._recentTeleport[pidb + ''] &&
                now - this._recentTeleport[pidb + ''] < 300))
            return;
        // NEW: Player-to-player collision for flag carriers
        // Get ALL flags each player is carrying
        const flagsA = this._playerCarriesAllFlags(pida);
        const flagsB = this._playerCarriesAllFlags(pidb);
        // NEW RULE: If BOTH players are carrying flags, BOTH lose their flags and get teleported
        if (flagsA.length > 0 && flagsB.length > 0) {
            // Both players are flag carriers - drop all flags and teleport both
            for (let i = 0; i < flagsA.length; i++) {
                this.resetStolenFlag(pida, flagsA[i]);
            }
            for (let i = 0; i < flagsB.length; i++) {
                this.resetStolenFlag(pidb, flagsB[i]);
            }
            this.showNotification('Flag carriers collided - both flags returned!', 2000);
            return;
        }
        // If A is carrying flags and B is a defender of any of them, return ALL of A's flags
        if (flagsA.length > 0) {
            let isDefender = false;
            for (let i = 0; i < flagsA.length; i++) {
                if (tb === flagsA[i]) {
                    isDefender = true;
                    break;
                }
            }
            if (isDefender) {
                // Return ALL flags A is carrying
                for (let i = 0; i < flagsA.length; i++) {
                    this.resetStolenFlag(pida, flagsA[i]);
                }
                this.showNotification(tb.charAt(0).toUpperCase() +
                    tb.slice(1) +
                    ' defender tagged carrier!', 2000);
                return;
            }
        }
        // If B is carrying flags and A is a defender of any of them, return ALL of B's flags
        if (flagsB.length > 0) {
            let isDefender = false;
            for (let i = 0; i < flagsB.length; i++) {
                if (ta === flagsB[i]) {
                    isDefender = true;
                    break;
                }
            }
            if (isDefender) {
                // Return ALL flags B is carrying
                for (let i = 0; i < flagsB.length; i++) {
                    this.resetStolenFlag(pidb, flagsB[i]);
                }
                this.showNotification(ta.charAt(0).toUpperCase() +
                    ta.slice(1) +
                    ' defender tagged carrier!', 2000);
                return;
            }
        }
        // If either is a carrier (but not tagged by defender), return ALL their flags
        if (flagsA.length > 0) {
            for (let i = 0; i < flagsA.length; i++) {
                this.resetStolenFlag(pida, flagsA[i]);
            }
            return;
        }
        if (flagsB.length > 0) {
            for (let i = 0; i < flagsB.length; i++) {
                this.resetStolenFlag(pidb, flagsB[i]);
            }
            return;
        }
        // Determine positions
        const da = playerManager.getPlayerDetails(pida);
        const db = playerManager.getPlayerDetails(pidb);
        if (!da || !db)
            return;
        // Neutral rule: if collision inside neutral and neither carries, teleport both
        if (this.isNeutral(da.x, da.y)) {
            this.teleportToSpawn(pida, ta);
            this.teleportToSpawn(pidb, tb);
            this.showNotification('Neutral zone collision!', 1500);
            return;
        }
        // Enemy-zone collision rule with mutual invader check
        const armA = this.whichArm(da.x, da.y);
        const armB = this.whichArm(db.x, db.y);
        const teamAtArmA = this.teamForArm(armA);
        const teamAtArmB = this.teamForArm(armB);
        // Check if A is in enemy territory and B is in enemy territory
        const aInEnemyTerritory = teamAtArmA && teamAtArmA !== ta;
        const bInEnemyTerritory = teamAtArmB && teamAtArmB !== tb;
        // If BOTH are in enemy territory, treat as neutral - teleport both, no tag
        if (aInEnemyTerritory && bInEnemyTerritory) {
            this.teleportToSpawn(pida, ta);
            this.teleportToSpawn(pidb, tb);
            this.showNotification('Both invading - neutral collision!', 1500);
            return;
        }
        // Standard rule: if only one is in enemy territory, they get tagged
        if (aInEnemyTerritory) {
            // Particle effect: Dark smoke on tag (no flag)
            const detA = playerManager.getPlayerDetails(pida);
            if (detA) {
                try {
                    const publicKey = stateManager.getVariable('PublicKey');
                    integrationsManager.triggerParticleEffect({
                        particleName: 'blackSmoke_puff',
                        position: { x: detA.x, y: detA.y },
                        duration: 1.5,
                        followPlayerId: pida,
                        interactivePublicKey: publicKey,
                    });
                }
                catch (e) {
                    this.log('Particle effect error: ' + e);
                }
            }
            this.teleportToSpawn(pida, ta);
            return;
        }
        if (bInEnemyTerritory) {
            // Particle effect: Dark smoke on tag (no flag)
            const detB = playerManager.getPlayerDetails(pidb);
            if (detB) {
                try {
                    const publicKey = stateManager.getVariable('PublicKey');
                    integrationsManager.triggerParticleEffect({
                        particleName: 'blackSmoke_puff',
                        position: { x: detB.x, y: detB.y },
                        duration: 1.5,
                        followPlayerId: pidb,
                        interactivePublicKey: publicKey,
                    });
                }
                catch (e) {
                    this.log('Particle effect error: ' + e);
                }
            }
            this.teleportToSpawn(pidb, tb);
            return;
        }
    }
    teamForArm(arm) {
        if (!arm)
            return '';
        for (let i = 0; i < this._teamOrder.length; i++) {
            const t = this._teamOrder[i];
            if (this._armByTeam[t] === arm && this._count(t) > 0)
                return t;
        }
        return '';
    }
    resetStolenFlag(carrierPid, flagTeam) {
        if (!flagTeam)
            return;
        var fs = this._flagStates[flagTeam];
        if (fs) {
            fs.heldBy = 0;
            fs.atBase = true;
            // generalized carrier maps
            this._carrierOfFlagTeam[flagTeam] = 0;
            this._flagHeld[flagTeam] = false;
            // Clean up any lingering white indicator sprites (legacy cleanup)
            const indicatorId = 'flag_indicator_' + carrierPid + '_' + flagTeam;
            if (spriteManager.getSprite(indicatorId)) {
                spriteManager.removeSprite(indicatorId);
            }
            this.showFlag(flagTeam);
        }
        const team = this._getTeam(carrierPid);
        this.restoreNameplate(carrierPid, team);
        // Particle effect: Smoke burst on tag
        const det = playerManager.getPlayerDetails(carrierPid);
        if (det) {
            try {
                const publicKey = stateManager.getVariable('PublicKey');
                integrationsManager.triggerParticleEffect({
                    particleName: 'blackSmoke_puff',
                    position: { x: det.x, y: det.y },
                    duration: 1.5,
                    followPlayerId: carrierPid,
                    interactivePublicKey: publicKey,
                });
            }
            catch (e) {
                this.log('Particle effect error: ' + e);
            }
        }
        this.teleportToSpawn(carrierPid, team);
        this.log('Tag carrier reset flag ' + flagTeam + ' P' + carrierPid);
        const teamLabel = team ? team.charAt(0).toUpperCase() + team.slice(1) : '';
        const flagLabel = flagTeam.charAt(0).toUpperCase() + flagTeam.slice(1);
        this.showNotification(teamLabel + ' carrier tagged! ' + flagLabel + ' flag returned.', 2000);
        this.updateHud();
    }
    detectAndHandleCamping() {
        // Check camping timers and teleport campers
        // Zone entry/exit is tracked by collision events (more performant)
        const now = Date.now();
        const campingTimeoutMs = 3000; // 3 seconds
        const allPids = playerManager.getPlayerIds();
        for (let i = 0; i < allPids.length; i++) {
            const pid = allPids[i];
            const pidStr = String(pid);
            if (this._campingTimers[pidStr] && this._campingTimers[pidStr] > 0) {
                const campingDuration = now - this._campingTimers[pidStr];
                const playerTeam = this._getTeam(pid);
                if (campingDuration >= campingTimeoutMs) {
                    // Teleport camper to nearby position
                    const flagPos = this._flagStates[playerTeam]?.pos;
                    if (flagPos) {
                        const angle = Math.random() * Math.PI * 2;
                        const teleportDist = this._flagZoneRadius + 150; // Well outside zone (120 + 150 = 270px from flag)
                        const newX = flagPos.x + Math.cos(angle) * teleportDist;
                        const newY = flagPos.y + Math.sin(angle) * teleportDist;
                        playerManager.teleportPlayers([pid], {
                            distributionType: 'area',
                            positionX: newX,
                            positionY: newY,
                            width: 40,
                            height: 40,
                        });
                        this.showNotification(playerTeam.charAt(0).toUpperCase() + playerTeam.slice(1) + ' player stop camping!', 2000);
                        // Reset camping timer
                        this._campingTimers[pidStr] = 0;
                        // Restore nameplate
                        const det = playerManager.getPlayerDetails(pid);
                        if (det) {
                            const base = det.username || 'P' + pid;
                            const teamEmoji = this._teamEmoji[playerTeam] || '';
                            playerManager.setNameplate(pid, this._formatNameplate(pid, teamEmoji + ' ' + base));
                        }
                    }
                }
                else {
                    // Still camping but not yet timeout - show tent emoji
                    const det = playerManager.getPlayerDetails(pid);
                    if (det) {
                        const base = det.username || 'P' + pid;
                        const teamEmoji = this._teamEmoji[playerTeam] || '';
                        playerManager.setNameplate(pid, this._formatNameplate(pid, teamEmoji + ' ⛺ ' + base));
                    }
                }
            }
        }
    }
    onPhysicsStep() {
        // Follow any carried flags
        for (let i = 0; i < this._teamOrder.length; i++) {
            const t = this._teamOrder[i];
            const fs = this._flagStates[t];
            if (fs && fs.heldBy) {
                const det = playerManager.getPlayerDetails(fs.heldBy);
                // Update actual flag (40x40) position to trail behind player
                if (det && spriteManager.getSprite(fs.spriteId)) {
                    // Space multiple flags horizontally when carrying multiple
                    const carriedFlags = this._playerCarriesAllFlags(fs.heldBy);
                    const flagIndex = carriedFlags.indexOf(t);
                    const spacing = 25;
                    const offsetX = flagIndex * spacing - ((carriedFlags.length - 1) * spacing) / 2;
                    spriteManager.updateSprite(fs.spriteId, {
                        positionX: det.x + offsetX - 30, // Trail behind player (negative X)
                        positionY: det.y, // Same Y as player
                        opacity: 1, // Make visible when carried
                        zOrder: -1, // Behind player
                    });
                }
            }
        }
        if (!playerManager.isHost)
            return;
        if (this._isPhysicsRunning)
            return;
        this._isPhysicsRunning = true;
        // Zone-based capture removed - scoring now happens on flag collision only
        // (see onSpriteCollisionStart where player carrying enemy flag touches own flag)
        // Anti-camping detection
        if (this._currentState === 'ACTIVE') {
            this.detectAndHandleCamping();
        }
        this._isPhysicsRunning = false;
    }
    // scoreCapture removed (single flag mode deleted)
    scoreCaptureDual(pid, scoringTeam, carriedFlagTeam) {
        // guard: ensure flag marked as currently held before scoring to avoid duplicate triggers
        if (!this._flagHeld[carriedFlagTeam]) {
            this.log('SCORE_GUARD: Flag not held, ignoring duplicate score attempt for ' +
                carriedFlagTeam);
            return;
        }
        // CRITICAL: Immediately mark flag as NOT held to prevent re-entry
        this._flagHeld[carriedFlagTeam] = false;
        // scoringTeam has brought enemy flag (carriedFlagTeam) home while own flag still at base
        if (scoringTeam === 'red')
            this._redScore += 1;
        else if (scoringTeam === 'blue')
            this._blueScore += 1;
        else
            this._scores[scoringTeam] = (this._scores[scoringTeam] || 0) + 1;
        // Reset enemy flag to its base & clear all carrier tracking
        var fs = this._flagStates[carriedFlagTeam];
        if (fs) {
            fs.heldBy = 0;
            fs.atBase = true;
            this._carrierOfFlagTeam[carriedFlagTeam] = 0;
            // _flagHeld already set to false above to prevent re-entry
            this.showFlag(carriedFlagTeam);
        }
        // Clean up any lingering white indicator sprites (legacy cleanup)
        const indicatorId = 'flag_indicator_' + pid + '_' + carriedFlagTeam;
        if (spriteManager.getSprite(indicatorId)) {
            spriteManager.removeSprite(indicatorId);
        }
        // Particle effect: Stars on flag capture (burst following player)
        const det = playerManager.getPlayerDetails(pid);
        if (det) {
            try {
                const publicKey = stateManager.getVariable('PublicKey');
                integrationsManager.triggerParticleEffect({
                    particleName: 'whiteStar_burst',
                    position: { x: det.x, y: det.y },
                    duration: 1.5,
                    followPlayerId: pid,
                    interactivePublicKey: publicKey,
                });
            }
            catch (e) {
                this.log('Particle effect error: ' + e);
            }
        }
        // Analytics: Total flags captured
        if (this._analyticsPublicKey) {
            try {
                const details = playerManager.getPlayerDetails(pid);
                const profileId = details?.profileId;
                if (profileId) {
                    integrationsManager.putPublicKeyAnalytics({
                        interactivePublicKey: this._analyticsPublicKey,
                        analytics: [
                            {
                                analyticName: 'ctfTotalFlagsCaptured',
                                profileId: profileId,
                            },
                        ],
                    });
                }
            }
            catch (e) {
                this.log('Analytics error (capture): ' + e);
            }
        }
        this.restoreNameplate(pid, scoringTeam);
        // Check if this score wins the game
        var winScore = this._cfg.captureScoreToWin || 3;
        const checkScore = scoringTeam === 'red'
            ? this._redScore
            : scoringTeam === 'blue'
                ? this._blueScore
                : this._scores[scoringTeam] || 0;
        const isWinningScore = checkScore >= winScore;
        // Teleport player away from flag zone after scoring to prevent camping
        // BUT skip this if they just won the game (they'll be teleported to center instead)
        if (!isWinningScore) {
            const flagPos = this._flagStates[scoringTeam]?.pos;
            if (flagPos) {
                const angle = Math.random() * Math.PI * 2;
                const teleportDist = this._flagZoneRadius + 150; // Same distance as camping teleport
                const newX = flagPos.x + Math.cos(angle) * teleportDist;
                const newY = flagPos.y + Math.sin(angle) * teleportDist;
                playerManager.teleportPlayers([pid], {
                    distributionType: 'area',
                    positionX: newX,
                    positionY: newY,
                    width: 40,
                    height: 40,
                });
            }
        }
        const scoringLabel = scoringTeam.charAt(0).toUpperCase() + scoringTeam.slice(1);
        const carriedLabel = carriedFlagTeam.charAt(0).toUpperCase() + carriedFlagTeam.slice(1);
        this.showNotification(scoringLabel + ' scores! Captured ' + carriedLabel + ' flag!', 3000);
        this.log('Capture (dual) team=' +
            scoringTeam +
            ' scores vs ' +
            carriedFlagTeam +
            ' R=' +
            this._redScore +
            ' B=' +
            this._blueScore);
        this.updateHud();
        var winScore = this._cfg.captureScoreToWin || 3;
        let currentScore = scoringTeam === 'red'
            ? this._redScore
            : scoringTeam === 'blue'
                ? this._blueScore
                : this._scores[scoringTeam] || 0;
        if (currentScore >= winScore) {
            this._currentState = 'GAME_OVER';
            this._winnerTeam = scoringTeam;
            this.finalizeScores();
            // Clear all game objects (flags, zones) immediately on game end
            this.clearAllZones();
            // Particle effect: Trophy celebration on game win (follows the scoring player)
            const winningPlayerDetails = playerManager.getPlayerDetails(pid);
            if (winningPlayerDetails) {
                try {
                    const publicKey = stateManager.getVariable('PublicKey');
                    integrationsManager.triggerParticleEffect({
                        particleName: 'trophyBalloon_float',
                        position: { x: winningPlayerDetails.x, y: winningPlayerDetails.y },
                        duration: 3.0,
                        followPlayerId: pid,
                        interactivePublicKey: publicKey,
                    });
                }
                catch (e) {
                    this.log('Trophy particle effect error: ' + e);
                }
            }
            // Teleport all players to lower center to view scores
            const allPids = playerManager.getPlayerIds();
            const centerX = this._stageWidth / 2;
            const lowerY = this._stageHeight * 0.30; // 30% from top
            if (allPids.length > 0) {
                playerManager.teleportPlayers(allPids, {
                    distributionType: 'area',
                    positionX: centerX,
                    positionY: lowerY,
                    width: 200,
                    height: 200,
                });
            }
            // Analytics: Player completions (count + unique for all players who completed the game)
            if (this._analyticsPublicKey) {
                try {
                    const allPids = playerManager.getPlayerIds();
                    const analytics = [];
                    for (let i = 0; i < allPids.length; i++) {
                        const details = playerManager.getPlayerDetails(allPids[i]);
                        const profileId = details?.profileId;
                        if (profileId) {
                            analytics.push({
                                analyticName: 'ctfPlayerCompletions',
                                profileId: profileId,
                            });
                            analytics.push({
                                analyticName: 'ctfUniquePlayerCompletions',
                                profileId: profileId,
                                uniqueKey: profileId,
                            });
                        }
                    }
                    if (analytics.length > 0) {
                        integrationsManager.putPublicKeyAnalytics({
                            interactivePublicKey: this._analyticsPublicKey,
                            analytics,
                        });
                    }
                }
                catch (e) {
                    this.log('Analytics error (completion): ' + e);
                }
            }
        }
    }
    addOrUpdateZones() {
        if (!playerManager.isHost)
            return;
        const alpha = this._cfg.zoneAlpha != null ? this._cfg.zoneAlpha : 0.65;
        // Ensure layout ready
        this.computeLayout();
        // Draw neutral overlays: center and corners
        const neutralAlpha = Math.max(0, Math.min(1, this._cfg.neutralZoneAlpha != null ? this._cfg.neutralZoneAlpha : 0.35));
        console.log(`NeutralAlpha = ${neutralAlpha}`);
        // Draw neutral lane overlays (strips between team territories)
        const neutralKeys = [
            'neutralV',
            'neutralH',
            'neutralV_3t_1',
            'neutralV_3t_2',
            'neutralV_4t',
            'neutralH_4t',
        ];
        for (let i = 0; i < neutralKeys.length; i++) {
            const key = neutralKeys[i];
            const rect = this._gridRects[key];
            if (!rect) {
                // Remove sprite if lane doesn't exist in current config
                const zId = 'ctf_zone_neutral_' + key;
                if (spriteManager.getSprite(zId))
                    spriteManager.removeSprite(zId);
                continue;
            }
            this.log('ZONE_NEUTRAL_LANE key=' +
                key +
                ' rect={' +
                rect.x +
                ',' +
                rect.y +
                ',' +
                rect.width +
                ',' +
                rect.height +
                '}');
            const zId = 'ctf_zone_neutral_' + key;
            const fill = 'rgba(200,200,200,' + neutralAlpha + ')';
            if (spriteManager.getSprite(zId))
                spriteManager.updateSprite(zId, {
                    positionX: rect.x,
                    positionY: rect.y,
                    width: rect.width,
                    height: rect.height,
                    fill,
                    isInteractive: false,
                });
            else
                spriteManager.addSprite('rectangle', {
                    uniqueId: zId,
                    positionX: rect.x,
                    positionY: rect.y,
                    width: rect.width,
                    height: rect.height,
                    fill,
                    isInteractive: false,
                });
        }
        // Draw zones for all teams with an assigned arm
        for (let i = 0; i < this._teamOrder.length; i++) {
            const t = this._teamOrder[i];
            const arm = this._armByTeam[t];
            const list = this._list(t);
            // Only draw if team is active (has players)
            if (!arm || !list || list.length === 0) {
                // remove existing if present
                const zId = 'ctf_zone_' + t;
                if (spriteManager.getSprite(zId))
                    spriteManager.removeSprite(zId);
                continue;
            }
            const rect = this.rectForArm(arm);
            const zId = 'ctf_zone_' + t;
            const fill = this._teamColors[t] ||
                (t === 'red'
                    ? '#CC6666'
                    : t === 'blue'
                        ? '#6699CC'
                        : t === 'green'
                            ? '#66CC66'
                            : t === 'yellow'
                                ? '#CCCC66'
                                : '#CCCCCC');
            this.log('ZONE_TEAM t=' +
                t +
                ' arm=' +
                arm +
                ' rectT={' +
                this._typeOf(rect.x) +
                ',' +
                this._typeOf(rect.y) +
                ',' +
                this._typeOf(rect.width) +
                ',' +
                this._typeOf(rect.height) +
                '} fillT=' +
                this._typeOf(fill));
            if (spriteManager.getSprite(zId))
                spriteManager.updateSprite(zId, {
                    positionX: rect.x,
                    positionY: rect.y,
                    width: rect.width,
                    height: rect.height,
                    fill: this._rgba(fill, alpha),
                    isInteractive: false,
                });
            else
                spriteManager.addSprite('rectangle', {
                    uniqueId: zId,
                    positionX: rect.x,
                    positionY: rect.y,
                    width: rect.width,
                    height: rect.height,
                    fill: this._rgba(fill, alpha),
                    isInteractive: false,
                });
        }
        this._debugAudit('after-zones');
    }
    clearAllZones() {
        if (!playerManager.isHost)
            return;
        // Remove all team zones
        for (let i = 0; i < this._teamOrder.length; i++) {
            const t = this._teamOrder[i];
            const zId = 'ctf_zone_' + t;
            if (spriteManager.getSprite(zId)) {
                spriteManager.removeSprite(zId);
            }
        }
        // Remove all neutral zones
        const neutralKeys = [
            'neutralV',
            'neutralH',
            'neutralV_3t_1',
            'neutralV_3t_2',
            'neutralV_4t',
            'neutralH_4t',
        ];
        for (let i = 0; i < neutralKeys.length; i++) {
            const key = neutralKeys[i];
            const zId = 'ctf_zone_neutral_' + key;
            if (spriteManager.getSprite(zId)) {
                spriteManager.removeSprite(zId);
            }
        }
        // Also remove any flag sprites and flag-zone overlays so the screen is fully cleared
        for (let i = 0; i < this._teamOrder.length; i++) {
            const t = this._teamOrder[i];
            const flagId = 'ctf_flag_' + t;
            const flagZoneId = 'ctf_flagzone_' + t;
            if (spriteManager.getSprite(flagId))
                spriteManager.removeSprite(flagId);
            if (spriteManager.getSprite(flagZoneId))
                spriteManager.removeSprite(flagZoneId);
        }
        // Remove any lingering flag indicator sprites (per-player)
        try {
            const pids = playerManager.getPlayerIds();
            for (let i = 0; i < pids.length; i++) {
                const pid = pids[i];
                for (let j = 0; j < this._teamOrder.length; j++) {
                    const t = this._teamOrder[j];
                    const indicatorId = 'flag_indicator_' + pid + '_' + t;
                    if (spriteManager.getSprite(indicatorId))
                        spriteManager.removeSprite(indicatorId);
                }
            }
        }
        catch (e) {
            // Non-fatal - continue
        }
        this.log('All zones and flags cleared');
    }
    _rgba(hex, a) {
        // naive hex to rgba parser for #RRGGBB
        if (hex && hex[0] === '#' && hex.length === 7) {
            const r = parseInt(hex.substr(1, 2), 16);
            const g = parseInt(hex.substr(3, 2), 16);
            const b = parseInt(hex.substr(5, 2), 16);
            return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
        }
        return hex;
    }
    isInZone(x, y, team) {
        // generalized: check against team arm rect when available
        const arm = this._armByTeam[team];
        if (arm) {
            const rect = this.rectForArm(arm);
            if (!rect)
                return false;
            return (x >= rect.x &&
                x < rect.x + rect.width &&
                y >= rect.y &&
                y < rect.y + rect.height);
        }
        // legacy fallback
        const half = this._stageWidth / 2;
        if (team === 'red')
            return x < half;
        if (team === 'blue')
            return x >= half;
        return false;
    }
    updateHud() {
        if (!playerManager.isHost)
            return;
        const now = Date.now();
        // Clear expired spawn immunity and update nameplates
        const allPids = playerManager.getPlayerIds();
        for (let i = 0; i < allPids.length; i++) {
            const pid = allPids[i];
            const pidStr = pid + '';
            if (this._spawnImmunity[pidStr] && now >= this._spawnImmunity[pidStr]) {
                // Immunity expired - clear it and restore normal nameplate
                delete this._spawnImmunity[pidStr];
                const team = this._getTeam(pid);
                if (team) {
                    const det = playerManager.getPlayerDetails(pid);
                    const base = det && det.username ? det.username : 'P' + pid;
                    const teamEmoji = this._teamEmoji[team] || '';
                    // Check if carrying flags
                    const carriedFlags = this._playerCarriesAllFlags(pid);
                    const flagIcons = carriedFlags.length > 0
                        ? ' ' +
                            carriedFlags
                                .map(function () {
                                return '🏳️';
                            })
                                .join(' ') +
                            ' '
                        : ' ';
                    playerManager.setNameplate(pid, this._formatNameplate(pid, teamEmoji + flagIcons + base));
                }
            }
        }
        const timerId = 'ctf_hud_timer', scoreId = 'ctf_hud_scores', overId = 'ctf_game_over_banner';
        let t = '';
        // Check for active notification first
        if (this._notificationText && now < this._notificationExpiry) {
            t = this._notificationText;
        }
        else if (this._notificationText && now >= this._notificationExpiry) {
            this._notificationText = '';
        }
        // Default status messages if no notification
        // Removed "Select Teams..." - now shown in drawOrUpdateTeamSelect header
        if (!t && this._currentState === 'PRE_COUNTDOWN') {
            const sec = Math.max(0, Math.floor((this._countdownEndTime - now) / 1000));
            t = 'Start in ' + sec + 's';
        }
        else if (!t && this._currentState === 'ACTIVE') {
            // HUD status for capture blocking
            // Scan for any carrier whose own flag missing
            var ids = playerManager.getPlayerIds();
            for (var i = 0; i < ids.length; i++) {
                var pid = ids[i];
                var carried = this._playerCarriesFlag(pid);
                if (carried) {
                    var playerTeam = this._getTeam(pid);
                    var own = this._flagStates[playerTeam];
                    if (own && !own.atBase) {
                        t = 'Cannot capture - own flag stolen!';
                        break;
                    }
                }
            }
            if (!t &&
                this._pendingCaptureBlockedT &&
                now - this._pendingCaptureBlockedT < 2500)
                t = 'Capture blocked - own flag missing';
        }
        // Position "Select Teams..." message near team buttons (Y=90, just above first row at Y=120)
        // For PRE_COUNTDOWN, show GIANT countdown at center of screen (like Glitch Lava)
        // For other states, position at top of screen (Y=20)
        const centerX = this._stageWidth / 2;
        const centerY = this._stageHeight / 2;
        if (this._currentState === 'PRE_COUNTDOWN') {
            // GIANT countdown in center of screen
            const sec = Math.max(0, Math.floor((this._countdownEndTime - now) / 1000));
            const countdownText = sec > 0 ? String(sec) : 'GO!';
            // Manual width estimation for centering (like Glitch Lava)
            let offsetX = 0;
            if (countdownText === 'GO!') {
                offsetX = 220; // Half-width for "GO!"
            }
            else if (countdownText === '1') {
                offsetX = 70; // Half-width for narrow "1"
            }
            else {
                offsetX = 85; // Half-width for "2", "3", etc.
            }
            const countdownBoxHeight = 300;
            const centeredY = centerY - countdownBoxHeight / 2;
            if (spriteManager.getSprite(timerId))
                spriteManager.updateSprite(timerId, {
                    text: countdownText,
                    positionX: centerX - offsetX,
                    positionY: centeredY,
                    fontSize: 250,
                    fontColor: '#FFFFFF',
                });
            else
                spriteManager.addSprite('text', {
                    uniqueId: timerId,
                    text: countdownText,
                    positionX: centerX - offsetX,
                    positionY: centeredY,
                    fontSize: 250,
                    fontColor: '#FFFFFF',
                });
        }
        else {
            // Normal HUD text for other states
            const statusY = this._currentState === 'TEAM_SELECT' ? 90 : 20;
            const statusWidth = 350;
            if (spriteManager.getSprite(timerId))
                spriteManager.updateSprite(timerId, {
                    text: t,
                    positionX: centerX - statusWidth / 2,
                    positionY: statusY,
                    fontSize: 28,
                    fontColor: '#FFFFFF',
                });
            else
                spriteManager.addSprite('text', {
                    uniqueId: timerId,
                    text: t,
                    positionX: centerX - statusWidth / 2,
                    positionY: statusY,
                    fontSize: 28,
                    fontColor: '#FFFFFF',
                });
        }
        // Multi-team HUD: show scores for all active teams
        // Only display score during active gameplay and countdown, hide during TEAM_SELECT and GAME_OVER
        if (this._currentState !== 'TEAM_SELECT' &&
            this._currentState !== 'GAME_OVER') {
            var scoreParts = [];
            for (var i = 0; i < this._teamOrder.length; i++) {
                var tk = this._teamOrder[i];
                var has = this._count(tk) > 0;
                if (!has)
                    continue;
                var val = tk === 'red'
                    ? this._redScore
                    : tk === 'blue'
                        ? this._blueScore
                        : this._scores[tk] || 0;
                var label = tk.charAt(0).toUpperCase() + tk.slice(1);
                scoreParts.push(label + ': ' + val);
            }
            const scoreLine = scoreParts.length ? scoreParts.join('  ') : '—';
            const scoreWidth = 400; // Increased width for larger font
            if (spriteManager.getSprite(scoreId))
                spriteManager.updateSprite(scoreId, {
                    text: scoreLine,
                    positionX: centerX - scoreWidth / 2,
                    positionY: 60,
                    fontSize: 24,
                });
            else
                spriteManager.addSprite('text', {
                    uniqueId: scoreId,
                    text: scoreLine,
                    positionX: centerX - scoreWidth / 2,
                    positionY: 60,
                    fontSize: 24,
                });
        }
        else {
            // Remove score during team selection and game over
            if (spriteManager.getSprite(scoreId))
                spriteManager.removeSprite(scoreId);
        }
        if (this._currentState === 'GAME_OVER') {
            const centerX = this._stageWidth / 2;
            // Hide countdown/timer during game over
            if (spriteManager.getSprite(timerId))
                spriteManager.removeSprite(timerId);
            // Game over title - centered at top
            const title = 'GAME OVER';
            const titleWidth = 200;
            const msg = 'Winner: ' +
                (this._winnerTeam ? this._winnerTeam.toUpperCase() : 'TIE');
            const msgWidth = 180;
            if (spriteManager.getSprite(overId))
                spriteManager.updateSprite(overId, {
                    text: title,
                    positionX: centerX - titleWidth / 2,
                    positionY: 20,
                    fontSize: 32,
                });
            else
                spriteManager.addSprite('text', {
                    uniqueId: overId,
                    text: title,
                    positionX: centerX - titleWidth / 2,
                    positionY: 20,
                    fontSize: 32,
                });
            // Winner announcement - centered below title
            const winnerBannerId = 'ctf_winner_banner';
            if (spriteManager.getSprite(winnerBannerId))
                spriteManager.updateSprite(winnerBannerId, {
                    text: msg,
                    positionX: centerX - msgWidth / 2,
                    positionY: 60,
                    fontSize: 24,
                });
            else
                spriteManager.addSprite('text', {
                    uniqueId: winnerBannerId,
                    text: msg,
                    positionX: centerX - msgWidth / 2,
                    positionY: 60,
                    fontSize: 24,
                });
            // Final scores - centered below winner
            const scoresId = 'ctf_final_scores';
            var scoreParts = [];
            for (var i = 0; i < this._teamOrder.length; i++) {
                var tk = this._teamOrder[i];
                var has = this._count(tk) > 0;
                if (!has)
                    continue;
                var val = tk === 'red'
                    ? this._redScore
                    : tk === 'blue'
                        ? this._blueScore
                        : this._scores[tk] || 0;
                var label = tk.charAt(0).toUpperCase() + tk.slice(1);
                scoreParts.push(label + ': ' + val);
            }
            const scoresText = scoreParts.join('  |  ');
            const scoresWidth = 300;
            if (spriteManager.getSprite(scoresId))
                spriteManager.updateSprite(scoresId, {
                    text: scoresText,
                    positionX: centerX - scoresWidth / 2,
                    positionY: 100,
                    fontSize: 20,
                });
            else
                spriteManager.addSprite('text', {
                    uniqueId: scoresId,
                    text: scoresText,
                    positionX: centerX - scoresWidth / 2,
                    positionY: 100,
                    fontSize: 20,
                });
            // Restart button - centered below scores (matching Start button style)
            const restartBtnId = 'ctf_restart_btn';
            const restartText = 'Play Again';
            const restartWidth = 140; // Match Start button width
            if (spriteManager.getSprite(restartBtnId))
                spriteManager.updateSprite(restartBtnId, {
                    text: restartText,
                    positionX: centerX - restartWidth / 2,
                    positionY: 150,
                    fontSize: 36, // Match Start button
                    fontWeight: 'bold', // Match Start button
                    fontColor: '#000000', // Black text
                    strokeColor: '#FFFFFF', // White outline
                    strokeWeight: 2,
                    isInteractive: true,
                });
            else
                spriteManager.addSprite('text', {
                    uniqueId: restartBtnId,
                    text: restartText,
                    positionX: centerX - restartWidth / 2,
                    positionY: 150,
                    fontSize: 36, // Match Start button
                    fontWeight: 'bold', // Match Start button
                    fontColor: '#000000', // Black text
                    strokeColor: '#FFFFFF', // White outline
                    strokeWeight: 2,
                    isInteractive: true,
                });
        }
        else {
            // Clean up game over UI when not in GAME_OVER state
            const cleanupIds = [
                'ctf_game_over_banner',
                'ctf_winner_banner',
                'ctf_final_scores',
                'ctf_restart_btn',
            ];
            for (var i = 0; i < cleanupIds.length; i++) {
                if (spriteManager.getSprite(cleanupIds[i]))
                    spriteManager.removeSprite(cleanupIds[i]);
            }
        }
    }
    finalizeScores() {
        if (this._finalScoresComputed)
            return;
        this._finalScoresComputed = true;
        // Summarize scores across all teams
        var parts = [];
        for (var i = 0; i < this._teamOrder.length; i++) {
            var tk = this._teamOrder[i];
            var val = tk === 'red'
                ? this._redScore
                : tk === 'blue'
                    ? this._blueScore
                    : this._scores[tk] || 0;
            parts.push(tk.charAt(0).toUpperCase() + tk.slice(1) + '=' + val);
        }
        this.log('Final scores ' + parts.join(' '));
    }
    _setWorldActivity(type) {
        try {
            if (!playerManager.isHost)
                return;
            if (!this._analyticsPublicKey)
                return;
            integrationsManager.setWorldActivity({
                type: type,
                interactivePublicKey: this._analyticsPublicKey,
            });
        }
        catch (e) { }
    }
}
