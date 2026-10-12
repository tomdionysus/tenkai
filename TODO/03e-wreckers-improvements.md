# Phase 3e: Wreckers improvements beyond the original

The Wreckers remake ([03d-wreckers.md](03d-wreckers.md)) is past its fidelity phase (the user, 2026-10-11:
"we're beyond fidelity now"): changes that improve on the original are welcome, and no more checks against the
original are run. Baselines a change alters are re-saved on purpose, with the reason noted. Improvements are
built on the architecture of [03g](03g-wreckers-remake-architecture.md): the larger ones here (the resizable HUD,
the fonts) are client work and sit best after 03g's step 3, when the HUD and the screens are drawn by the client
from the engine's state through the socket; small ones go in whenever they come up. Multiplayer itself (three
officers, three players) and further stations are not improvements here but 03g's goal and structure.

## Done (2026-10-11)

- The factory desk's description text starts at x 80, lined up with the headings above it (the original: 72).
- The factory desk no longer covers the HUD's slot 1 (its captured picture is drawn whole only over the view,
  lines 0-134, and below that only from x 40): no more stale white face on slot 1 after choosing an empty port.
- The droid faces in the HUD slots sit one pixel right of the original's place (`Slots.js`, `NUDGE`).
- The officer dossier (mode 9) exists (it was missing from 1.0.0); see 03d.

## Done (2026-10-12)

- **The HUD resizes, though not as planned below.** The page fills the window (03g's Status, "Client"): the view is
  as large as the window, and the frame round it is gone instead of being rebuilt from tiled runs. The bottom
  panel is cut from the captured HUD at load (`remake/src/Layout.js`), split into two halves at the window's bottom
  corners, cleaned of the pipes, the green lines and the black backing. The static screens are drawn centred at the
  original's size. No atlas, no tool and no Tenkai frame builder were needed for this.
- **The fonts, in part.** The large font's one-pixel gaps through its strokes are filled at load
  (`remake/src/FontCleaner.js`), in the picture and in the rows of bits, and the cleaned font is the only one (the
  user: "clean up the fonts"; no setting). Not done: the title's scrolling credits spaced so no lines touch (the
  strip is a picture, to be rebuilt from the fonts). The high score table, whose line colours blanked the last row,
  is gone.
- The fades of the static screens run at twice the original's speed; the title takes a click from 300 ms after it
  shows.

## Earlier plans, kept for reference

### A resizable HUD (superseded)

The HUD is one 320 by 200 picture (`remake/data/hud.png`, captured from the original) framing a fixed 256 by
128 view at (32, 7). To let the view grow (wider screens, a larger scale, more of the station on show), break
it into its main pieces so the frame can be rebuilt at any size, with the plain runs of the four borders tiled
and the ornaments kept whole:

- **Fixed pieces, anchored to a corner or an edge:**
  - top left: the pipe junction and the score box (with the score digits drawn over it);
  - top right: the corner holding the quit icon;
  - bottom left: the droid slot cluster (slots 1-10 at their own offsets) and the commander's face;
  - bottom middle: the long range scanner;
  - bottom right: the status LED panel, the lifeforce panel and the self-destruct countdown pipe;
  - the status line (ticker) plate, whose window is 128 pixels wide.
- **Tiled runs, repeated to fill the space between the fixed pieces:**
  - the top border (the double rail over the view);
  - the left border (the vertical pipes);
  - the right border (the rail down to the countdown pipe);
  - the bottom border (the rail under the view and the cable runs between the panels).

Work:

1. Find each border's repeating period by comparing pixel columns (top and bottom) and rows (left and right)
   of `hud.png`, and cut the tileable segment and the pieces between them. Write a tool for it
   (`tools/hudpieces.py`), so the cut can be redone from a fresh capture.
2. Export the pieces as one atlas, with a layout file: each piece's source rectangle, its anchor (corner or
   edge), its offset from the anchor, and whether it is fixed or tiled along an axis.
3. Place the moving parts relative to their pieces' anchors, not by absolute position: the score digits, the
   ticker window, the LEDs, the lifeforce trace, the countdown, the scanner, the droid slots and the clickable
   regions. All are absolute positions in `remake/src` at present.
4. Build the frame in the remake from the layout for a given view size (the original's 256 by 128 must give
   back exactly the captured picture), and let the view and its clip follow.
5. Tenkai: a general frame or panel builder (nine-slice and beyond: fixed corners, tiled edge runs, anchored
   ornaments of any number), so other games with pre-drawn frames can do the same. Log it in
   `local/monkey2/TENKAI-GAPS.md`.

### Fix the fonts (mostly done, above)

The original's text looks clipped in places, and the remake reproduces it exactly (checked pixel for pixel
against the original's frames): many glyphs of the large 8 by 8 font have a blank row through the middle, the
line colour tables colour each row's last glyph line 0 (so the high score table's rows look cut), and in the
title's scrolling credits some name lines are packed so tightly they touch ("PAUL SALMON" over "HERMAN
SERRANO"). Offer cleaner text as an option, the original's look staying the default:

1. Redraw the affected glyphs of the large font (the HUD, the screens, the high score table, the end texts) and
   the title's credits font with the gaps filled, in the same sizes and colours, as an alternative glyph sheet.
2. Space the scrolling credits' lines so none touch, rebuilding those blocks of the strip from the fonts
   (tools/frontend_data.py already draws the remake's own credit block this way).
3. On the high score table, colour every glyph line rather than letting the per-line colour table blank the
   last one.
4. A setting to switch between the original's fonts and the cleaned ones.
