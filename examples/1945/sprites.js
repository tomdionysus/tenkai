import { Sheet } from '../../index.js'

// Regions of assets/sprite.png. The image is laid out as several grids of different sized tiles separated by
// 1-2px borders, so each region is its own Sheet over the same image. Within a region, tile [x, y] is the x-th
// tile across and the y-th tile down. Every sheet is anchored at the centre of its tiles, so sprites are
// positioned, scaled and rotated about their middle.
//
// All aircraft in the image face up the screen; enemies are rotated to face their direction of travel.

// The columns from one to another, as frames in row 0
const run = (from, to) => {
  var out = []
  var step = from <= to ? 1 : -1
  for (var i = from; i !== to + step; i += step) out.push([i, 0])
  return out
}

// A one-shot animation whose last tile only flashes up: it is shown for a single step (a delay of 0)
const endingBriefly = (from, to) => run(from, to - Math.sign(to - from)).concat([[to, 0, 0]])

const REGIONS = {
  // Lockheed P-38 Lightning, 3 propeller frames
  p38: { offsetX: 1, offsetY: 1, tileWidth: 64, tileHeight: 64, spacing: 2, clips: { fly: { frames: run(0, 2), delay: 40, loop: true } } },

  // Mitsubishi A6M Zero, 3 propeller frames
  zero: { offsetX: 1, offsetY: 67, tileWidth: 64, tileHeight: 64, spacing: 2, clips: { fly: { frames: run(0, 2), delay: 40, loop: true } } },

  // Twin engine bomber, 3 propeller frames
  bomber: { offsetX: 100, offsetY: 199, tileWidth: 98, tileHeight: 98, spacing: 1, clips: { fly: { frames: run(0, 2), delay: 40, loop: true } } },

  // Small fighters in four liveries of 3 propeller frames each
  fighter: {
    offsetX: 1,
    offsetY: 496,
    tileWidth: 32,
    tileHeight: 32,
    spacing: 1,
    clips: [0, 1, 2, 3].reduce((clips, livery) => Object.assign(clips, { ['fly' + livery]: { frames: run(livery * 3, livery * 3 + 2), delay: 50, loop: true } }), {})
  },

  // White hit silhouettes: [0, 0] P-38, [0, 1] Zero, [0, 2] bomber
  flash: { offsetX: 414, offsetY: 331, tileWidth: 64, tileHeight: 64, spacing: 2 },

  // Projectiles: [0, 0] twin cannon, [1, 0] cannon, [2, 0] round, [3, 0] small round, [4, 0] large round,
  // [5, 0] bomb, [6, 0] tracer
  shot: { offsetX: 199, offsetY: 67, tileWidth: 32, tileHeight: 32, spacing: 1 },

  // Explosions, largest frame first, fading to a last wisp
  explosionSmall: { offsetX: 199, offsetY: 100, tileWidth: 32, tileHeight: 32, spacing: 1, clips: { explode: { frames: endingBriefly(0, 5), delay: 45 } } },
  explosionLarge: { offsetX: 1, offsetY: 133, tileWidth: 64, tileHeight: 64, spacing: 2, clips: { explode: { frames: endingBriefly(0, 6), delay: 70 } } },

  // Islands, 3 kinds
  island: { offsetX: 1, offsetY: 298, tileWidth: 64, tileHeight: 64, spacing: 1 },

  // Battleship with 2 frames of bow wave
  battleship: { offsetX: 199, offsetY: 298, tileWidth: 41, tileHeight: 197, spacing: 1, clips: { steam: { frames: run(0, 1), delay: 250, loop: true } } },

  // Submarine, from fully surfaced [0, 0] to submerged [5, 0]. It surfaces through tiles 5 to 1 (tile 0 goes
  // up as it becomes a target), and dives ending on a brief glimpse of the last ripple.
  submarine: {
    offsetX: 1,
    offsetY: 364,
    tileWidth: 32,
    tileHeight: 98,
    spacing: 1,
    clips: { surface: { frames: run(5, 1), delay: 140 }, dive: { frames: endingBriefly(0, 5), delay: 140 } }
  },

  // Power-ups: [0, 0] spread shot, [1, 0] side shot, [2, 0] wing shot, [3, 0] triple shot, [4, 0] medal,
  // [5, 0] speed
  powerup: { offsetX: 1, offsetY: 463, tileWidth: 32, tileHeight: 32, spacing: 1 },

  // Title and game over text
  logo: { offsetX: 26, offsetY: 544, tileWidth: 498, tileHeight: 143 },
  pressSpace: { offsetX: 465, offsetY: 31, tileWidth: 220, tileHeight: 40 },
  gameOver: { offsetX: 506, offsetY: 368, tileWidth: 172, tileHeight: 17 }
}

/**
 * Make a Sheet for each region of the sprite image.
 * @returns {object} Sheets by name
 */
export default function sheets (image) {
  var out = {}
  for (var name in REGIONS) {
    var r = REGIONS[name]
    out[name] = new Sheet(Object.assign({ image, anchor: [r.tileWidth / 2, r.tileHeight / 2] }, r))
  }
  return out
}
