// The data the client loads from data/ (built by tools/build.mjs): the images through the engine's assets, the
// JSON by fetch.
export const IMAGES = ['shades', 'palettes']
export async function json (path) {
  const r = await fetch(path)
  if (!r.ok) throw new Error(path + ': ' + r.status)
  return r.json()
}
/** Declares the images on a GameEngine (in its constructor), given the tiles' page count. */
export function addImages (game, pages) {
  for (let k = 0; k < pages; k++) game.addAsset('tiles-' + k + '-index', 'data/tiles-' + k + '-index.png')
  for (const n of IMAGES) game.addAsset(n, 'data/' + n + '.png')
}
export const image = (game) => (name) => game.getAsset(name).element
