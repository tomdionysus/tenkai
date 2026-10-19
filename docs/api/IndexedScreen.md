# IndexedScreen

`lib/IndexedScreen.js`

A [Screen](Screen.md) drawn in palette numbers, as old games draw their windows and full screens: it owns an
[IndexedSurface](IndexedSurface.md) of its size, shown through a [Palette](Palette.md) by an
[IndexedScene](IndexedScene.md), and paints it afresh before each drawing, so what it shows follows the game's state
every frame. A transparent surface lets the game show through wherever the window paints nothing.

```js
class Funds extends IndexedScreen {
  constructor (game) {
    super({ width: 320, height: 200, palette: windowPalette, transparent: true, modal: true })
    this.game = game
  }
  paint (surface) {
    surface.clear()
    text.draw(surface, 'MONEY: ' + this.game.money, 16, 40, { colours: { 1: 28 } })
  }
}
```

| Member | |
|---|---|
| `new IndexedScreen({ palette, transparent, createCanvas, ...screen options })` | the surface is the screen's `width` x `height`; `transparent` default false; `createCanvas` for its scene |
| `surface`, `picture` | the surface it paints; the scene showing it |
| `palette` | the palette it is shown through, changeable at any time |
| `paint(surface)` | what it shows, painted before each drawing; override it |
