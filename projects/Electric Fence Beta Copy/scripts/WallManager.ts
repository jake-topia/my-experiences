class WallManager extends SystemScript {
  // --- Properties ---
  // Config (Primitives)
  wallThickness: number;
  wallAssetKey: string;
  wallScriptId: string;

  pelletManager: PseudoAny;

  //Level Number (hard coded atm)
  totalLevels: number;
  startingLevel: number;

  // State
  activeWallSprites: PseudoList; // Array to track spawned walls

  // Level Layouts (Defined as separate properties)
  easyLevel1Layout: string;
  easyLevel2Layout: string;
  easyLevel3Layout: string;
  easyLevel4Layout: string;
  easyLevel5Layout: string;
  mediumLevel1Layout: string;
  mediumLevel2Layout: string;
  mediumLevel3Layout: string;
  mediumLevel4Layout: string;
  mediumLevel5Layout: string;
  hardLevel1Layout: string;
  hardLevel2Layout: string;
  hardLevel3Layout: string;
  hardLevel4Layout: string;
  hardLevel5Layout: string;
  extremeLevel1Layout: string;
  extremeLevel2Layout: string;
  extremeLevel3Layout: string;
  extremeLevel4Layout: string;
  extremeLevel5Layout: string;
  impossibleLevel1Layout: string;
  impossibleLevel2Layout: string;
  impossibleLevel3Layout: string;
  impossibleLevel4Layout: string;
  impossibleLevel5Layout: string;
  blockLayout: string;
  possibleWalls: PseudoList<any>;

  /** Constructor: Init primitives ONLY */
  constructor() {
    scriptManager.attachSystem({ scriptId: 'PelletManager' });
    this.pelletManager = scriptManager.getSystem({
      systemName: 'PelletManager',
    });
    this.activeWallSprites = [];
    this.easyLevel1Layout = '';
    this.easyLevel2Layout = '';
    this.easyLevel3Layout = '';
    this.easyLevel4Layout = '';
    this.easyLevel5Layout = '';
    this.mediumLevel1Layout = '';
    this.mediumLevel2Layout = '';
    this.mediumLevel3Layout = '';
    this.mediumLevel4Layout = '';
    this.mediumLevel5Layout = '';
    this.hardLevel1Layout = '';
    this.hardLevel2Layout = '';
    this.hardLevel3Layout = '';
    this.hardLevel4Layout = '';
    this.hardLevel5Layout = '';
    this.extremeLevel1Layout = '';
    this.extremeLevel2Layout = '';
    this.extremeLevel3Layout = '';
    this.extremeLevel4Layout = '';
    this.extremeLevel5Layout = '';
    this.impossibleLevel1Layout = '';
    this.impossibleLevel2Layout = '';
    this.impossibleLevel3Layout = '';
    this.impossibleLevel4Layout = '';
    this.impossibleLevel5Layout = '';
    this.blockLayout = '';
    this.totalLevels = 5;
    this.startingLevel = 0;
    console.log('WallManager Constructor: Initializing config...');
    this.wallThickness = 50;
    this.wallAssetKey = 'bluecube';
    this.possibleWalls = ['bluecube']; //, 'redcube', 'blueorb', 'redorb'
    this.wallScriptId = 'Wall'; // Script attached to each wall sprite
    console.log('WallManager Constructor: Initialized config.');
  }

  /** onInit: Initialize arrays and level layout data */
  onInit() {
    console.log('WallManager onInit: Initializing state and layouts...');
    // Initialize level layouts directly here
    try {
      this.blockLayout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        'WW                WW',
        ' WW              WW',
        '  WWWWWWWWWWWWWWWW  ',
      ].join(',');
      this.easyLevel1Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W        P       W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
      ].join(',');

      this.easyLevel2Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W   P              W',
        ' W                W ',
        'W      WWWWWW      W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
      ].join(',');

      this.easyLevel3Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W      W    W      W',
        ' W                W ',
        'W         P        W',
        ' W                W ',
        'W                  W',
        ' W     WWWWWW     W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
      ].join(',');

      this.easyLevel4Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W        P       W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        'W      WWW WW      W',
        ' W                W ',
        ' W                W ',
        '  WWWWW      WWWWW  ',
      ].join(',');

      this.easyLevel5Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W   P              W',
        ' W                W ',
        'W                  W',
        ' W     W    W     W ',
        'W                  W',
        ' W                W ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W     WW  WW     W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        '  WWWWW      WWWWW  ',
      ].join(',');

      this.mediumLevel1Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        ' W             P  W ',
        'W                  W',
        ' W                W ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W     WW  WW     W ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W      WWWWWW      W',
        ' W                W ',
        'W                  W',
        ' WWWWWW      WWWWWW ',
      ].join(',');

      this.mediumLevel2Layout = [
        '      WWWWWWWW      ',
        ' WWWWWW      WWWWWW ',
        'W                  W',
        ' W     P          W ',
        'W                  W',
        ' W      WWWW      W ',
        'W                  W',
        ' WWWWW      WWWWWWW ',
        'W                  W',
        ' W                W ',
        'W      WW  WW      W',
        ' W                W ',
        'W                  W',
        ' WWWWWW      WWWWWW ',
        'W                  W',
        ' W                W ',
        'W                  W',
        ' W     WWWWWW     W ',
      ].join(',');

      this.mediumLevel3Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W              P   W',
        ' W                W ',
        'W      W    W      W',
        ' W                W ',
        '  WWWWW  WW  WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W     W    W     W ',
        'W                  W',
        ' W                W ',
        '  WWWWW  WW  WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W                W ',
        'W      W    W      W',
      ].join(',');
      this.mediumLevel4Layout = [
        '      WWWWWWWW      ',
        ' WWWWWW      WWWWWW ',
        'W                  W',
        ' W  P             W ',
        'W                  W',
        ' W     WWWWWW     W ',
        'W                  W',
        ' WWWWWW  WW  WW   W ',
        'W                  W',
        ' W                W ',
        ' WWWWWW  WWWWWW   W ',
        'W                  W',
        ' W                W ',
        '  WWWWW  WW  WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W                W ',
        '  WWWWW  WW  WW    W',
      ].join(',');
      this.mediumLevel5Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W      WW       P  W',
        ' W                W ',
        'W           WWWWWW  ',
        ' W                W ',
        '  WWWWWWWW   WWWWW  ',
        ' W                W ',
        'W                  W',
        ' WWWWWW  WWWWWWWWWW ',
        'W                  W',
        ' W                W ',
        '  WWWWWWWWW  WWWWW  ',
        ' W                W ',
        'W                  W',
        ' W                W ',
        '  WWWWW  WWWWWWWWW  ',
      ].join(',');
      this.hardLevel1Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W  P     WW       W ',
        ' W                 W',
        '  WWWWWWWWWW     WW ',
        ' W                 W',
        'W                 W ',
        ' WWW     WWWWWWWWW  ',
        'W                 W ',
        ' W                 W',
        '  WWWWWWWWW     WWW ',
        ' W                 W',
        'W                 W ',
        ' WWWW    WWWWWWWWW  ',
        'W                   ',
        ' W                  ',
        '  WWWWWWWW          ',
      ].join(',');

      this.hardLevel2Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W              P   W',
        ' W                W ',
        '  W     WWWWWWWWWW  ',
        ' W                W ',
        'W                  W',
        ' WWWWWWWWW      WWW ',
        'W                  W',
        ' W                W ',
        '  WWW     WWWWWWWW  ',
        ' W                W ',
        ' W                W ',
        '  WWWWWW       WWW  ',
        ' W                W ',
        ' W                W ',
        '  W     WWWWWWWWWW  ',
      ].join(',');
      this.hardLevel3Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W   P              W',
        ' W                W ',
        '  WWW  WWWWWW  WWW  ',
        ' W                W ',
        'W                  W',
        ' W  WWW  WWWWWW  WW ',
        'W                  W',
        ' W                W ',
        '  WW  WWWW  WWWWWW  ',
        ' W                W ',
        ' W                W ',
        '  WWWW  WWWWW  WWW  ',
        ' W                W ',
        ' W                W ',
        '  WW  WWWW  WWW     ',
      ].join(',');
      this.hardLevel4Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWW  ',
        ' W                W ',
        'W  P               W',
        ' W                W ',
        '  WWWWWW    WWWWWW  ',
        ' W                W ',
        'W                  W',
        ' WW  WWWWWWWWWW  WW ',
        'W                  W',
        ' W                W ',
        '  WWWWWW    WWWWWW  ',
        ' W                W ',
        ' W                W ',
        '  W  WWWWWWWWWW  W  ',
        ' W                W ',
        ' W                W ',
        '  WWWWWW    WWWWWW  ',
      ].join(',');
      this.hardLevel5Layout = [
        '      WWWWWWWW      ',
        '  WWWWW      WWWWWW ',
        ' W                 W',
        'W            P    W ',
        ' W                 W',
        '  W   WWWWWWWWWWWWW ',
        ' W                 W',
        'W                 W ',
        ' WWWWWWWWWWWWW   W  ',
        'W                 W ',
        ' W                W ',
        '  W   WWWWWWWWWWWW  ',
        ' W                W ',
        ' W                W ',
        '  WWWWWWWWWWWW   W  ',
        ' W                W ',
        ' W                W ',
        '  W   WWWWWWWWWWWW  ',
      ].join(',');
      this.extremeLevel1Layout = [
        '     WWWWWW         ',
        ' WWWW      WWWW     ',
        'W           P  W    ',
        ' W            W     ',
        'W    WW WW WWW      ',
        ' W  W  W  W   W     ',
        'W              W    ',
        ' W            W     ',
        '  W     WW     W    ',
        '   W      WW  WWWWW ',
        '    W              W',
        '     W            W ',
        '      WWW  WW  W  WW',
        '      W  WW  WW    W',
        '  WWWW            W ',
        ' WW                W',
        'WW   WWWWWWWWWWWWWW ',
        'WW  WW              ',
      ].join(',');
      this.extremeLevel2Layout = [
        '    WWWWWWWWWW     ',
        '   W          W    ',
        '  W            W   ',
        '   W            W   ',
        '  W       P      W  ',
        '   W            W   ',
        '   WWWW     WWWW    ',
        '     W   WWW        ',
        '      W   W         ',
        '     W   W          ',
        '      W   W         ',
        '     W   W          ',
        '      W   W         ',
        '     W   W          ',
        '      W   W         ',
        '     W   W          ',
        '      W   W         ',
        '     W   W          ',
      ].join(',');
      this.extremeLevel3Layout = [
        '      WWWWWWWW      ',
        '   WWW        WWW   ',
        '  W              W  ',
        '  W              W  ',
        '   W      P     W   ',
        '  W              W  ',
        '   W   WWWWWW   W   ',
        '  W   W      W   W  ',
        '   W  W      W  W   ',
        '  W   W      W   W  ',
        '   W  W      W  W   ',
        '  W   WW    WW   W  ',
        '   W    W  W    W   ',
        '    WW        WW    ',
        '      WWW  WWW      ',
        '        W  W        ',
        '        W  W        ',
        '        W  W        ',
      ].join(',');
      this.extremeLevel4Layout = [
        '     WWWWWWWWWW     ',
        '    W          W    ',
        '   W            W   ',
        '   W            W   ',
        '  W       P      W  ',
        '   W            W   ',
        '  W   W  WW  W   W  ',
        '   WW   W  W   WW   ',
        '  W   W      W   W  ',
        '   WW   W  W   WW   ',
        '  W   W      W   W  ',
        '   WW   WWWW   WW   ',
        '  W   W      W   W  ',
        '   WW   W  W   WW   ',
        '  W   W      W   W  ',
        '   WW   WWWW   WW   ',
        '  W   W      W   W  ',
        '   WW   W  W   WW   ',
      ].join(',');
      this.extremeLevel5Layout = [
        '        WWWWW       ',
        '   WWWWW     WWWW   ',
        '  W              W  ',
        '   W            W   ',
        '    WWWWW P WWWW    ',
        '   W            W   ',
        '    W   WWWW   W    ',
        '   W  WW    WW  W   ',
        '    W   W  W   W    ',
        '   W  WW    WW  W   ',
        '    W          W    ',
        '   W  WW    WW  W   ',
        '    WW  W  W  WW    ',
        '   W  WW    WW  W   ',
        '    W          W    ',
        '      WW    WW      ',
        '        W  W        ',
        '  WWWWWWWWWWWWWWWW  ',
      ].join(',');
      this.impossibleLevel1Layout = [
        '      WWWWW         ',
        '     W     WWWWW    ',
        '    W  W        W   ',
        '   W  W   W      W  ',
        '    W  W   P      W ',
        '     W  W   W     W ',
        '      W  W   W   W  ',
        '       W  WW     W  ',
        '        W   WWWWW   ',
        '       W   W        ',
        '      W   W         ',
        '     W  WW          ',
        '    W  W            ',
        '   W  W             ',
        '  W  W              ',
        ' W  W               ',
        'W  W                ',
        '  W                 ',
      ].join(',');
      this.impossibleLevel2Layout = [
        '      WWWWW         ',
        '     W     WWWWWW   ',
        '    W  W         W  ',
        '   W  W    W      W ',
        '  W  W     W       W',
        '   W  W     W      W',
        '    W  W   P W    W ',
        '     W  W    W   W  ',
        '      W     W   W   ',
        '       WWWWW   W    ',
        '      W       W     ',
        '     W  WWWWWW      ',
        '    W  W            ',
        '   W  W             ',
        '  W  W              ',
        ' W  W               ',
        'W  W                ',
        '  W                 ',
      ].join(',');
      this.impossibleLevel3Layout = [
        '    WWWWWWW         ',
        '   W       WWWWWW   ',
        '  W  W           W  ',
        ' W  W WWWWW       W ',
        'W  W       W       W',
        ' W  W       W      W',
        '  W  W   P   W    W ',
        '   W  W      W   W  ',
        '    W       W   W   ',
        '     WWWWWWW   W    ',
        '      W       W     ',
        '     W  WWWWWW      ',
        '    W  W     W      ',
        '   W  W     WWWW    ',
        '  W        W    W   ',
        '   W      W   W  W  ',
        '    WWW      W W  W ',
        '       WWWWWW   W  W',
      ].join(',');
      this.impossibleLevel4Layout = [
        '    WWWWWWW         ',
        '   W       WWWWWW   ',
        '  W  WWWWW       W  ',
        ' W  W     W       W ',
        'W  W       W       W',
        ' W  W   P   W      W',
        '  W  W       W    W ',
        '   W  W      W   W  ',
        '    W       W   W   ',
        '     WWWWWWW   W    ',
        '    W         W     ',
        '   W    WWWWWW      ',
        '  W  WWW      W     ',
        ' W  W   W   W  W    ',
        'W  W  W  W   W  W   ',
        ' W  W  W  W   W  W  ',
        '  W     W    W W  W ',
        '   WWWWW WWWW   W  W',
      ].join(',');
      this.impossibleLevel5Layout = [
        '    WWWWWWW         ',
        '   W       WWWWWW   ',
        '  W  WWWWW  W    W  ',
        ' W  W       W  W  W ',
        'W  W        W   W  W',
        ' W  W   P   W  W   W',
        '  W  W     W  W   W ',
        '   W  WWWWW  W   W  ',
        '    W       W   W   ',
        '     WWWWWWW   W    ',
        '    W         W     ',
        '   W    WWWWWW      ',
        '  W  WWW      W     ',
        ' W  W   W   W  W    ',
        'W  W  W  W   W  W   ',
        ' W  W  W  W   W  W  ',
        '  W     W    W    W ',
        '   WWWWW WWWW      W',
      ].join(',');
      console.log('WallManager onInit: Initialized level layouts.');
    } catch (e) {
      console.log(
        '!!! WallManager ERROR initializing level layouts in onInit:',
        e,
      );
      // Ensure layouts are null if init fails somehow
      this.easyLevel1Layout = null;
      this.easyLevel2Layout = null;
      this.easyLevel3Layout = null;
      this.easyLevel4Layout = null;
      this.easyLevel5Layout = null;
      this.mediumLevel1Layout = null;
      this.mediumLevel2Layout = null;
      this.mediumLevel3Layout = null;
      this.mediumLevel4Layout = null;
      this.mediumLevel5Layout = null;
      this.hardLevel1Layout = null;
      this.hardLevel2Layout = null;
      this.hardLevel3Layout = null;
      this.hardLevel4Layout = null;
      this.hardLevel5Layout = null;
      this.extremeLevel1Layout = null;
      this.extremeLevel2Layout = null;
      this.extremeLevel3Layout = null;
      this.extremeLevel4Layout = null;
      this.extremeLevel5Layout = null;
      this.impossibleLevel1Layout = null;
      this.impossibleLevel2Layout = null;
      this.impossibleLevel3Layout = null;
      this.impossibleLevel4Layout = null;
      this.impossibleLevel5Layout = null;

      this.blockLayout = null;
    }
    console.log('WallManager onInit: Completed.');
  }

  /** Clears all currently active wall sprites */
  clearLevel() {
    // Check if activeWallSprites is valid before accessing length
    // Need to count manually - length isn't working
    const numSprites = this.activeWallSprites?.length || 0;
    //console.log(`WallManager: Clearing ${numSprites} wall sprites.`);

    if (numSprites > 0) {
      // Iterate backwards is safer when removing items
      for (let i = numSprites - 1; i >= 0; i--) {
        const sprite = this.activeWallSprites[i];
        if (sprite && sprite.uniqueId) {
          // Check sprite and uniqueId exist
          try {
            spriteManager.removeSprite(sprite.uniqueId);
          } catch (e) {
            console.log(
              `!!! WallManager ERROR removing wall ${sprite.uniqueId}:`,
              e,
            );
          }
        }
      }
    }
    this.activeWallSprites = []; // Reset the tracking array
    console.log('WallManager: Level cleared.');
  }

  /** Loads the walls for a specific level index */
  loadLevel(levelIndex: number) {
    console.log(`WallManager: Request to load level ${levelIndex}`);
    this.clearLevel(); // Ensure previous walls are gone

    let layout: string[] | null = null; // Local variable to hold selected layout

    // Select the correct layout based on the index
    switch (levelIndex) {
      case 0:
        layout = this.easyLevel1Layout.split(',');
        break;
      case 1:
        layout = this.easyLevel2Layout.split(',');
        break;

      case 2:
        layout = this.easyLevel3Layout.split(',');
        break;

      case 3:
        layout = this.easyLevel4Layout.split(',');
        break;

      case 4:
        layout = this.easyLevel5Layout.split(',');
        break;

      case 5:
        layout = this.mediumLevel1Layout.split(',');
        break;

      case 6:
        layout = this.mediumLevel2Layout.split(',');
        break;

      case 7:
        layout = this.mediumLevel3Layout.split(',');
        break;

      case 8:
        layout = this.mediumLevel4Layout.split(',');
        break;

      case 9:
        layout = this.mediumLevel5Layout.split(',');
        break;
      case 10:
        layout = this.hardLevel1Layout.split(',');
        break;
      case 11:
        layout = this.hardLevel2Layout.split(',');
        break;

      case 12:
        layout = this.hardLevel3Layout.split(',');
        break;

      case 13:
        layout = this.hardLevel4Layout.split(',');
        break;

      case 14:
        layout = this.hardLevel5Layout.split(',');
        break;

      case 15:
        layout = this.extremeLevel1Layout.split(',');
        break;

      case 16:
        layout = this.extremeLevel2Layout.split(',');
        break;

      case 17:
        layout = this.extremeLevel3Layout.split(',');
        break;

      case 18:
        layout = this.extremeLevel4Layout.split(',');
        break;

      case 19:
        layout = this.extremeLevel5Layout.split(',');
        break;
      case 20:
        layout = this.impossibleLevel1Layout.split(',');
        break;
      case 21:
        layout = this.impossibleLevel2Layout.split(',');
        break;

      case 22:
        layout = this.impossibleLevel3Layout.split(',');
        break;

      case 23:
        layout = this.impossibleLevel4Layout.split(',');
        break;

      case 24:
        layout = this.impossibleLevel5Layout.split(',');
        break;
      case 99:
        layout = this.blockLayout.split(',');
        break;

      default:
        //console.log(`!!! WallManager ERROR: Invalid level index ${levelIndex}`);
        let gameManager = scriptManager.getSystem({
          systemName: 'GameManager',
        });
        gameManager.currentLevelIndex = 0;
        layout = this.easyLevel1Layout.split(',');

        break;
    }

    // Check if the selected layout was actually initialized
    if (!layout || !Array.isArray(layout) || layout.length === 0) {
      console.log(
        `!!! WallManager ERROR: Layout data for level ${levelIndex} is missing or invalid.`,
      );
      return;
    }

    console.log(`--- WallManager: Spawning walls for level ${levelIndex} ---`);
    this.spawnWallsFromLayout(layout, levelIndex);
  }

  /** Spawns the wall sprites for a given layout */
  spawnWallsFromLayout(layout: string[], levelIndex: number) {
    // Ensure configuration properties are valid
    if (typeof this.wallThickness !== 'number' || !this.wallScriptId) {
      console.log(
        '!!! WallManager ERROR: Config properties missing in spawnWallsFromLayout.',
      );
      return;
    }
    // Layout validity already checked in loadLevel

    console.log(
      `--- WallManager: Processing layout with ${layout.length} rows.`,
    );
    let spawnedCount = 0;
    for (let y = 0; y < layout.length; y++) {
      const row = layout[y];
      if (typeof row !== 'string') continue; // Skip invalid rows

      for (let x = 0; x < row.length; x++) {
        if (row[x] === 'W') {
          // Check for Wall character
          const wallId = `wall_${levelIndex}_${x}_${y}`;
          const positionX = x * this.wallThickness;
          const positionY = y * this.wallThickness;
          //RANDOM - if we want to do different wall types or even custom pellets, we can create a new if statement

          let wallType = mathRandomInt(1, this.possibleWalls.length) - 1;

          try {
            const wallSprite = spriteManager.addSprite(
              this.possibleWalls[wallType],
              {
                uniqueId: wallId,
                positionX: positionX,
                positionY: positionY,
                checkCollisions: true,
                isImpassable:true,
              },
            );

            if (wallSprite) {
              // wallSprite.attachComponent({ scriptId: this.wallScriptId });
              this.activeWallSprites.push(wallSprite);
              /*console.log(
                `Pushing wall sprite into activeWallSprites - ${this.activeWallSprites.length}`,
              );*/
              //console.log('foo', this.activeWallSprites);

              spawnedCount++;
            } else {
              console.log(
                `!!! WallManager WARNING: Failed to add sprite for wall ${wallId}`,
              );
            }
          } catch (e) {
            console.log(
              `!!! WallManager ERROR adding sprite or attaching component for wall ${wallId}:`,
              e,
            );
          }
        } else if (row[x] === 'P') {
          const positionX = x * this.wallThickness;
          const positionY = y * this.wallThickness;
          this.pelletManager.spawnPellet(positionX, positionY);
        }
      }
    }
    console.log(
      `--- WallManager: Finished spawning walls for level ${levelIndex}. Spawned: ${spawnedCount} ---`,
    );
  }

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
  }) {
    const is1Wall = sprite1.uniqueId.indexOf('wall_') !== -1;
    const is2Wall = sprite2.uniqueId.indexOf('wall_') !== -1;

    if (!is1Wall && !is2Wall) return;

    const wallSprite = is1Wall ? sprite1 : sprite2;
    const otherSprite = is1Wall ? sprite2 : sprite1;

    if (!otherSprite) {
      return;
    }

    if (otherSprite.uniqueId.indexOf('collider_') === -1) {
      return;
    }

    let tempComponent = otherSprite.getComponent('Collider');
    let tempNumber = tempComponent.playerId;
    console.log('--------!!!!!!!!! COLLIDER FOUND!!!!!! -------' + tempNumber);

    // Broadcast an event using eventManager.emit
    try {
      const eventPayload = {
        playerId: tempComponent.playerId, // Pass the ID of the player who hit the wall
        wallId: wallSprite?.uniqueId, // Optional: helpful for debugging
      };
      console.log('Wall using eventManager.emit: playerHitWall', eventPayload);

      // *** Use the correct event emission syntax ***
      eventManager.emit('playerHitWall', eventPayload);
      // *** ***
    } catch (error) {
      console.log(
        `!!! Wall ${wallSprite?.uniqueId} ERROR emitting playerHitWall event for player ${tempComponent.playerId}:`,
        error,
      );
    }
  }
} // End class WallManager
