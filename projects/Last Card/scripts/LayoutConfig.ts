class LayoutConfig extends SystemScript {
  private _config: any;

  constructor() {
    // NO super() call - platform doesn't support it!

    this._config = {
      // Stage Dimensions
      STAGE_WIDTH: 1000,
      STAGE_HEIGHT: 1000,

      // Card Dimensions
      CARD_WIDTH: 180,
      CARD_HEIGHT: 180,
      CARD_STROKE_COLOR: '#000000', // Black outline for cards
      CARD_STROKE_WEIGHT: 3, // Outline thickness

      // Layout Spacing
      HAND_CARD_BUFFER: 15,
      HAND_BOTTOM_MARGIN: 20,
      HAND_SIDE_MARGIN: 20, // Minimum margin from stage edges

      // UI Positioning (as percentages of stage height)
      TURN_INDICATOR_Y_PERCENT: 0.6, // "It's your turn!" / "Waiting for..." text at top
      PLAYER_STATUS_Y_PERCENT: 0.07, // Opponent card count list (top-left)
      PLAY_AGAIN_Y_PERCENT: 0.1, // "Play Again?" button text
      PILE_Y_DIVISOR: 2, // Pile position (centerY / PILE_Y_DIVISOR)

      // Player Status List Positioning
      PLAYER_STATUS_START_X: 10, // Left margin for opponent status list
      PLAYER_STATUS_LINE_HEIGHT: 50, // Vertical spacing between opponent status lines

      // Card Layout - Element Positioning
      CARD_LEFT_VALUE_X: 5, // X offset for rank/value in upper left
      CARD_LEFT_VALUE_Y: 5, // Y offset for rank/value in upper left
      CARD_SUIT_LEFT_SIZE: 30, // Size of suit icon in upper left (doubled from 15)
      CARD_SUIT_LEFT_X: 5, // X offset for suit icon in upper left
      CARD_SUIT_LEFT_Y_OFFSET: 50, // Y offset below the rank value

      // Card Layout - Center Art Sizing
      CARD_CENTER_SUIT_SIZE: 40, // Size for number cards (suit icons in center)
      CARD_CENTER_FACE_MULTIPLIER: 1.7, // Multiplier for face cards (J/Q/K) - smaller to show labels
      CARD_CENTER_JOKER_MULTIPLIER: 3, // Multiplier for joker - 3x suit size
      CARD_CENTER_FACE_Y_OFFSET: -8, // Move face card art up to clear special labels

      // Text Styling
      TEXT_COLOR: '#FFFFFF',
      TEXT_STROKE_COLOR: '#000000',
      TEXT_STROKE_WEIGHT: 2,

      // Text Background (semi-opaque rectangles for readability)
      TEXT_BG_COLOR: 'rgba(0, 0, 0, 0.6)', // Semi-transparent black
      TEXT_BG_PADDING_X: 15, // Horizontal padding around text
      TEXT_BG_PADDING_Y: 8, // Vertical padding around text
      TEXT_BG_CORNER_RADIUS: 8, // Border radius (if supported)

      // Font sizes
      FONT_SIZE_LARGE: 55,
      FONT_SIZE_MEDIUM: 50,
      FONT_SIZE_SMALL: 45,
      FONT_SIZE_TINY: 40,

      // Character width estimation
      CHAR_WIDTH_LARGE: 25,
      CHAR_WIDTH_MEDIUM: 22,
      CHAR_WIDTH_SMALL: 20,
      CHAR_WIDTH_TINY: 18,

      // Colors
      TABLE_COLOR: '#2d5016',

      // Player Count Display
      PLAYER_COUNT_Y_PERCENT: 0.03, // Player count position at very top

      // Help Button Positioning (upper right corner)
      HELP_BUTTON_X_OFFSET: 105, // Distance from right edge
      HELP_BUTTON_Y_PERCENT: 0.02, // Distance from top as % of stage height
      HELP_BUTTON_SIZE: 45, // Font size for help button

      // Instructions Display (lobby - below start button)
      INSTRUCTIONS_Y_OFFSET: 80, // Pixels below center (start button)
      INSTRUCTIONS_LINE_HEIGHT: 45, // Line spacing for instruction text
      INSTRUCTIONS_FONT_SIZE: 35, // Font size for instruction lines

      // Help Overlay (when ? is clicked)
      HELP_OVERLAY_WIDTH_PERCENT: 0.85, // Width as % of stage
      HELP_OVERLAY_PADDING: 20, // Padding inside overlay
      HELP_OVERLAY_LINE_HEIGHT: 40, // Line height in overlay

      // Special Card Label Styling
      SPECIAL_CARD_LABEL_SIZE: 18, // Font size for special card labels
      SPECIAL_CARD_LABEL_COLOR: '#000000', // Black color for labels
      SPECIAL_CARD_LABEL_STROKE_COLOR: '#FFFFFF', // White stroke for visibility
      SPECIAL_CARD_LABEL_STROKE_WEIGHT: 2, // Stroke thickness
      SPECIAL_CARD_LABEL_Y_OFFSET: 30, // Y offset from BOTTOM of card

      // Camping Teleport Protection (TP) - prevents players standing on UI
      CAMPING_TP_ENABLED: true, // Enable camping TP zones
      CAMPING_TP_PADDING: 20, // Extra padding around UI elements
      CAMPING_TP_CHECK_INTERVAL: 30, // Frames between camping checks (~0.5s at 60fps)
      CAMPING_TP_TELEPORT_RADIUS: 150, // How far to teleport campers away

      // Card Asset Names
      CARD_ASSETS: {
        hearts: {
          suit: 'hearts',
          jack: 'hearts_jack',
          queen: 'hearts_queen',
          king: 'hearts_king',
        },
        diamonds: {
          suit: 'diamonds',
          jack: 'diamonds_jack',
          queen: 'diamonds_queen',
          king: 'diamonds_king',
        },
        clubs: {
          suit: 'clubs',
          jack: 'clubs_jack',
          queen: 'clubs_queen',
          king: 'clubs_king',
        },
        spades: {
          suit: 'spades',
          jack: 'spades_jack',
          queen: 'spades_queen',
          king: 'spades_king',
        },
        joker: {
          suit: 'joker',
          face: 'joker',
        },
      },

      // Calculated center points
      centerX: 500,
      centerY: 500,
    };
  }

  public getConfig() {
    return this._config;
  }
}
