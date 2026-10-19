/**
 * Laid-out text by name, as old games keep their windows' words: each block a list of items run in order (texts and
 * values at their places, numbers in so many places, changes of colour, centring and wrapping, a pen for the plain
 * strings, flags that stop or skip the rest), drawn with an {@link IndexedText}. The game gives the values by name
 * when it draws a block, so one block serves every state of its window.
 *
 * A block: `{ x, y, width, items, centreShift, wrapIndent }`. Centred lines are centred in the block's width from
 * its x (moved right by `centreShift`); wrapped ones wrap at the width less the `margin` and the `wrapIndent`.
 * Its items, by `op`:
 *
 * | op | |
 * |---|---|
 * | `colour` `{ colour }` | the colour from here on (the block starts in `startColour`) |
 * | `centre` `{ on }`, `wrap` `{ on }` | centring, wrapping on or off |
 * | `at` `{ x, y }` | the pen: where the next plain `string` goes |
 * | `text` `{ text, x, y }` | a text by its number (`words(n)`), or `{ of }`: by the number a value holds, or the value itself if it is a string |
 * | `string` `{ string }` | a plain string at the pen; or `{ of, x, y }`: a value as it is |
 * | `number` `{ of, x, y, digits, signed }` | a value right-aligned in `digits` places (made positive unless `signed`) |
 * | `stopIfFlag`, `skipIfFlag` | with the value `flag` set: stop here, or skip the next item |
 *
 * A value that is missing (or an empty string) leaves its item out.
 *
 * @example
const blocks = new TextBlocks({ blocks: layout.textBlocks, text: new IndexedText({ font, lineHeight: 10 }), words: (n) => texts[n] })
blocks.draw(frame, 'engineering', { param1: 'LIVING QUARTERS', param3: 1000 })
blocks.draw(frame, 'engineering', values, { colours: (c) => ({ 1: c + 16 }) })   // in a window's colours
 */
class TextBlocks {
  /**
   * @param {object} options
   * @param {object} options.blocks By name: the blocks
   * @param {IndexedText} options.text What draws them
   * @param {function} options.words `(n) => string`: a text by its number
   * @param {function} options.colours `(colour) => colours by the font's layer` (default `{ 1: colour }`)
   * @param {integer} options.margin Wrapped lines run this much short of the block's width (default 0)
   * @param {integer} options.startColour A block's colour until an item changes it (default 1)
   */
  constructor ({ blocks, text, words, colours = (c) => ({ 1: c }), margin = 0, startColour = 1 }) {
    this.blocks = blocks
    this.text = text
    this.words = words
    this.colours = colours
    this.margin = margin
    this.startColour = startColour
  }

  /** Whether there is a block of that name. */
  has (name) {
    return !!this.blocks[name]
  }

  /**
   * A block drawn with its values; nothing for an unknown name.
   * @param {IndexedSurface} surface
   * @param {string} name
   * @param {object} values By the names its items use; `flag` for the stop and skip items
   * @param {object} options
   * @param {IndexedText} options.text Another font's text to draw it with (default the one given)
   * @param {function} options.colours Other colours for this drawing, as the constructor's
   */
  draw (surface, name, values = {}, options = {}) {
    var block = this.blocks[name]
    if (!block) return
    var text = options.text || this.text
    var colours = options.colours || this.colours
    var colour = this.startColour
    var centre = false
    var wrap = false
    var pen = { x: block.x, y: block.y }
    var items = block.items
    for (var i = 0; i < items.length; i++) {
      var it = items[i]
      switch (it.op) {
        case 'colour': colour = it.colour; break
        case 'centre': centre = it.on; break
        case 'wrap': wrap = it.on; break
        case 'at': pen = { x: it.x, y: it.y }; break
        case 'stopIfFlag': if (values.flag) return; break
        case 'skipIfFlag': if (values.flag) i++; break
        case 'text':
        case 'string': {
          var s = this.itemWords(it, values)
          if (s === null) continue
          var plain = it.string !== undefined
          var x = plain ? pen.x : it.x
          var drawOptions = { colours: colours(colour) }
          if (centre) {
            x = block.x + (block.centreShift || 0)
            drawOptions.centre = block.width
          }
          if (wrap) drawOptions.wrap = block.width - this.margin - (block.wrapIndent || 0)
          text.draw(surface, s, x, plain ? pen.y : it.y, drawOptions)
          break
        }
        case 'number': {
          var v = values[it.of]
          if (v === undefined || v === null) continue
          text.number(surface, it.signed ? v : Math.abs(v), it.x, it.y, it.digits, { colours: colours(colour) })
          break
        }
      }
    }
  }

  /** A text or string item's words, or null when its value is missing. */
  itemWords (it, values) {
    if (it.op === 'text' && it.text !== undefined) return this.words(it.text)
    if (it.string !== undefined) return it.string
    var v = values[it.of]
    if (v === undefined || v === null || v === '') return null
    return it.op === 'text' && typeof v === 'number' ? this.words(v) : String(v)
  }
}

export default TextBlocks
