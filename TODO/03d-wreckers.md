# Phase 3d: Wreckers Remake (in progress)

Goal: a remake of Wreckers (Audiogenic, 1991, developed by Denton Designs, designed by John Heap) on Tenkai,
using the original's graphics, sound, maps and rules, recovered by reverse engineering the Amiga version. And,
as with [3c](03c-monkey-island-2-port.md), a better Tenkai: whatever an isometric game needs goes into `lib/` as
general features that leave 2D games working as they do.

A remake, not an emulation: the rules and content come from the original, but fidelity is not frame-exact, and
the original's known flaws can be fixed (see below).

## Where it is

`local/wreckers/`, git-ignored and local only: the game and everything derived from it are copyrighted. The
disk image is in `original/`, the manual and screenshots in `reference/`, Wreckers-specific tools in `tools/`
(`wreckers.py` starts the game in the emulator; `names.txt` names addresses as the code is understood), and
listings, extracted data, screenshots and save states in `build/`.

The general tooling is in `local/amiga-tools/`, kept for reverse engineering other Amiga games: disk reading,
a recursive-descent disassembler, unpackers, and a small emulated Amiga (Musashi 68000, copper, bitplanes,
blitter, trapped disk loaders, save states, coverage, profiling and watchpoints). The game runs in it from
boot through the title, commander selection and play.

## The game

Space station Beacon 04523N is attacked by plasmodian spores, the Wreckers. The player commands three officers
(switching between them; each has stamina and morale, and a dead officer becomes a tougher jelly monster) and up
to ten droids that can be programmed. Inside, aliens are fought with weapons and a vacuum attachment; outside,
in spacesuits with jetpacks, they are caught eating through the walls. The station's essential systems must be
kept running or it self-destructs. The map has several levels joined by lifts, an automap shows officers and
lifts, monitors give clues, and gadgets are found and used. Music by Warren Cann, effects by David Whittaker.

Amiga Power (64%) liked the atmosphere and the scrolling, and disliked: diagonal movement on a joystick,
uneven difficulty, droid programming that is effort for little visible return, and having to re-enter by the
airlock you left from. A remake can fix the controls (screen-relative) and the droid orders.

Screen: PAL 320 by 256; the isometric view scrolls smoothly inside an angled, clipped frame, with a HUD of
officer portraits, gadget slots, a radar or automap, and a status line.

## The disk

`Wreckers (1991)(Audiogenic)[cr CLS].adf`, a cracked copy. No AmigaDOS file system: everything is read from
the disk by sector.

- **Bootblock.** Loads 0x2800 bytes from disk offset 0x400 to `$40000` and calls it: the cracker's (CLS)
  intro, ByteKiller-packed ("TETRAGON" signature). Then it loads 0x8C00 bytes from 0x3EC00 into chip memory,
  disables the system, and jumps there.
- **Title program.** That block copies 0x8158 bytes of itself to `$440` and runs there: the loading screen,
  title pictures, credits and music, through its own sector loader (`$7D16`, standard MFM, also able to
  write) and a ByteKiller 1.3 unpacker with checksum (`$54A`). Its file table at `$6F6` (start sector, count,
  load address):

  | File | Sectors | To | Contents |
  |---|---|---|---|
  | 0 | 182-231 | `$AFB2` | title picture, 320 by 200, 16 colours (ByteKiller) |
  | 1 | 593-622 | `$AFB2` | second picture, the station in space (ByteKiller) |
  | 2 | 232-486 | `$4F480` | the main program: a self-unpacking LZ format, 233,766 bytes to `$7DC`, run at `$800` |
  | 3 | 754-863 | `$140B2` | music player and music |
  | 4, 5 | 142-181, 22-101 | `$25482` | preloaded only on machines with more than 512 KB |

- **Main program** (`$7DC` to `$398F2`): hand-written assembly, not compiled C (no `link`/`unlk` frames, no
  C library). About 65 KB of code and 170 KB of data. Its own file table at `$244D8`: the interior tile set
  (sectors 22-101, ByteKiller, unpacked to `$3808A`), sectors 102-141 to `$5E81C`, sectors 142-181 to
  `$3808A`, and sectors 624-753 to `$4C12A`. Unaccounted for so far: sectors 487-592, 623, and 864 on (the
  last look like filler).

## How the station is modelled

The original keeps two separate models of the station: one for drawing and one for the game. This split is
the main thing to carry into the remake and into Tenkai.

### Drawing: a flat map of pre-drawn isometric tiles

- **Tiles**: 256 tiles of 32 by 16 pixels, four bitplanes (16 colours), at `$3808A`. Each tile row is four
  longwords, one per 8-pixel column, each the four planes' bytes.
- **Map**: 128 by 128 tiles at `$4808A`, one byte per tile: a 4,096 by 2,048 pixel picture of the whole
  interior, both decks drawn in one plane (the upper deck in the top half, the lower deck about 900 pixels
  below it). The isometric look is entirely in the art.
- **Renderer** (`F_506E`): draws an 8 by 9 tile window (256 pixels wide) into a back buffer whose bitplanes
  are interleaved by word, 160 bytes a line, with `movep` (one instruction writes a tile row's four planes).
  Horizontal scrolling is coarse, 8 pixels: four routine variants (`$505E`) draw a whole tile, or only its
  last 24, 16 or 8 pixels at the left edge. `F_16B0` copies the back buffer to the screen.
- **Changing scenery** (`F_1F7A`): doors and similar are shown by patching the map: a table of (offset, tile)
  pairs at `$2954`.
- **Camera** (`F_0C46`): scroll x = player screen x - 120, rounded down to 8 pixels; scroll y = player screen
  y - 96.

### The game: world coordinates, zones and typed rectangles

- **World coordinates**: every character has X, Y and Z (height) in world units. The decks are separated by
  height: the lower deck at Z = 0, the upper at Z = 896 (`$380`); Z of 792 or more counts as the upper deck.
- **Projection** (`F_2440`): screen x = 2(Y - X + 1024), screen y = 3072 - X - Y - Z, in map pixels. A 2:1
  isometric projection; one unit of height raises a sprite one pixel. `F_2468` is the inverse, from a screen
  position and a height back to X and Y.
- **Zones** (`F_2490`): each deck has a list of 17 rectangles in X and Y (`$2D60` upper, `$2E0A` lower), each
  naming a zone (34 in all): a room or a corridor. A character's zone is kept in its record.
- **Collision** (`F_24F4`): each zone has a list of rectangles in X and Y (pointers at `$44EA`; 222 in all),
  each with a type. A move into a rectangle runs that type's handler (32 types, routine table `$2562`): type 0
  is a wall (stops the player, turns other characters), types 1 to 11 appear to be passages between zones, and
  others are doors, consoles and lifts, some acting only for the player or depending on game state. Outside
  every rectangle a move is free. Characters also block each other within 4 units in X and Y and 32 in Z
  (`F_2B2A`).
- **Rectangle types** (handlers in the table at `$2562`; count of rectangles in brackets):

  | Type | Handler | What it does |
  |---|---|---|
  | 0 (176) | `F_28BE` | Wall: stops the player; other characters turn. |
  | 1, 3-11 (1 each) | `F_2918`-`F_294E`, `L_297C` | The ten lift stops (stop 0 is type 1, stops 1-9 types 3-11). Never in the way; standing still in one for 24 ticks boards the car when it is at that end. The door tile shows open while he waits (table `$2954`). See "Lifts". |
  | 2 (4) | `F_2818` | The Battlepod bay doors: with power (`$1018C`) above $80 they open (`F_283C`) and the officer goes to the Battlepod; otherwise "POWER LEVELS ARE TOO LOW TO DRIVE BATTLEPOD". |
  | 12 (1) | `F_27EC` | The Droid Factory: with power above $80, the construction screen (mode 4); otherwise "CONSTRUCTION MODULE SHUT DOWN UNTIL POWER LEVELS INCREASE". |
  | 13-16 (1 each) | `F_27AE` | The consoles of bulb rooms 0-3, used facing +X: mode 5, tuning the bulb (two Lissajous figures; a bulb whose frequencies differ heats up and at 72 explodes, ending the game). |
  | 17 (13), 18 (2) | `F_276C`, `F_2770` | Consoles: in the way; eight pushes in a row by the player facing them (animation 1, respectively 0) open the console screen (`$1E822`). One shared push counter (`$27AC`), reset by a push that does not count. |
  | 19 (8) | `F_274E` | The hatches of the four Battlepod bays and the eight airlocks (doors at `$6262`): centres the officer and opens the door; he walks in and goes to the Battlepod or outside. |
  | 20-27 | | Re-entry points, in the outside zones only; you come back in through the airlock you left by. |
  | 28 | `F_25FE` | Cryogenic pods, set at run time on empty pods: standing still 16 ticks puts the officer to sleep there and switches to another officer. |
  | 30, 31 | `F_2A78`, `F_2A92` | The floor of the elevator shaft: the player may be there only while boarding or riding. |

  A handler's result is the zero flag on return: set (as from `moveq #0` or `clr.w`) lets the move happen,
  clear blocks it.
- **Movement is scripted**: a character's (animation, direction) picks a script (table `$333E`): a list of
  8-byte steps, each a change in X, Y and Z and the sprite frame to show. Each step is tried at a candidate
  position (`$5C9EE`) through the collision test (`F_23FE`) and taken only if allowed. A script's end can
  trigger an event (table `$2EB4`).
- **Directions**: four, along the isometric axes. The joystick's diagonals fold onto them (table `$CB8`), so
  "up" on the joystick is +X, "left" is -Y. The manual says to hold the joystick diagonally or turn it 45
  degrees; the remake can map screen directions instead.
- **Characters**: up to 19 records of 40 bytes from `$25F30`, the player first: type, state flags,
  direction, animation and step, X, Y, Z, screen position, current script, zone.

### The screen

- **One 320 by 200 screen** of four bitplanes (16 colours) at `$70000`, planes 8,000 bytes apart, holds the HUD
  and the view. The copper list (`$37EEC`) only sets the planes, points sprites 0 and 1 at the mouse pointer
  (`$1BD2`, `$1C1A`), and raises a copper interrupt at line 204 that paces the game.
- **The view** is 256 by 128 pixels at (32, 7): the tile renderer and sprites draw into a back buffer laid out
  like the screen, and `F_16B0` copies lines 0 to 134 of it to the screen (columns 0 to 288 for the first 44
  lines, 32 to 288 after). The camera holds the officer 120 pixels across and 96 down from the view's top
  left (`F_0C46`).
- **The frame and score box** over the view are drawn into the back buffer each frame (`F_B22A`, `F_FCDE`,
  after the sprites); the HUD below the view is static except its gauges. The remake's `data/hud.png` is the
  original's screen outside the view plus the overlay pixels inside it, found as the pixels that stay the same
  across eight screens taken at different places in the station.

### Characters and objects on screen

- **Occlusion by occluders.** The tile map is one flat picture, so walls, railings and arch legs that a
  character passes behind are handled by occluders (`F_136C2`, `F_13846`): each zone has a list (`$13B3A`,
  404 in all) of 16-byte records: a rectangle of the map, X and Y thresholds, and a mask shape (`$15870`: a
  grid of 16-pixel cells, two to a byte, from 32 by 16 patterns at `$15B5E`, whose 0 bits hide). A character
  in that zone whose sprite overlaps the rectangle and who stands beyond the thresholds (X > tx and Y > ty;
  0 means always) has the mask cut out of its sprite before it is drawn. Nothing is redrawn after the sprites.
  (An earlier reading here said there was no occlusion: the trace it was based on had the officer where nothing
  covered him.) `tools/occluders.py` renders all the masks over the map: they sit on the near walls, railings
  and arch legs.
- **Depth order** (`F_A6D6`): every frame, sprites are drawn farthest first by X + Y (a painter's algorithm
  over world positions), from three lists: the 19 characters (`$25F30`), 32 projectiles (`$19C20`, 14 bytes
  each) and 5 objects (`$1C400`, 16 bytes each).
- **Sprites**: a character's frame table (record +$1C) has 6-byte entries: width, height, graphics address.
  Graphics rows are word-interleaved like the screen (planes 0 to 3 for each 16 pixels); colour 0 is
  transparent, the mask being the inverted OR of the planes (`F_AC00`). Frames facing the other way are
  mirrored at run time through a byte-reversal table (`$A9B0`), and shifted to the pixel (`F_A922`). The draw
  itself (`F_AD12`, `F_AC42`) is a masked AND/OR blit, clipped to the view's edges.
- **Sprite sets** (frame tables found by `tools/findsprites.py`): the officer (`$34770`, 28 frames of 32 by 34,
  including the spacesuit), droids in red, yellow and blue with damage states (`$2B9F4`, `$2DE78`), blue robots
  (`$2FD2C`), more crew poses (`$30968`), the aliens from spores to grown jelly creatures (`$317B0`, 71 frames),
  smoke (`$3372E`), shots and spray (`$B498`), items and explosions (`$19DE0`), the cryo pod and a machine
  (`$1C45E`). `tools/sprites.py` writes each as a sheet.

**Checking the remake against the original.** `tools/movetrace.py` runs the original in the emulator under a
seeded random command sequence, a logic tick at a time (each call of `F_1D72`), with each tick's command coming
in through the game's own input path (the joystick-to-direction routine `F_0CC8` is replaced). `tools/movecheck.mjs`
runs the remake's movement (`remake/src/officer.js`, `rules.js`) on the same commands and reports the first tick
where position, animation or frame differ. Reading the disassembly is the faster way to learn each mechanism;
the comparison then confirms the reading and catches wrong assumptions (it caught one about how input arrives).

### Lifts

Details in `local/wreckers/notes/lifts.md`. Five cars (`$1C400`, 16 bytes; also drawn with the characters):
car 0 the elevator, the only way between the decks inside the station, and cars 1-4 shuttles along a deck
(Atmo. Control to Battlepod 1, Cryogenics to Grav. Control, Droid Factory to Stores, Battlepod 2 to the
Generator). Each runs between ends A and B on a path (`$1C32E`): the elevator 8 units of Z a tick between 0
and 896 (112 ticks), the shuttles 4 units of X and Y a tick (92-104 ticks).

- **Idle cars come to the player** (`F_1BFB4`): an empty car at rest drives to the end nearer him (the elevator
  by map y > 1144, the shuttles by map x > 1960). There is no call button.
- **Boarding**: standing still 24 ticks in a stop's doorway (counter `$2A76`) with the car at that stop's end
  sets the officer walking to the boarding point (`$791E`, X first, within 4); there the car sets off for its
  other end with him aboard.
- **Riding** (`F_7E4A`): each tick the rider is placed at the car plus the rider record's offset (`$1C388`, one
  per car and direction, with the riding animation and command). Up and down reverse the elevator, left and
  right a shuttle, even in mid-journey.
- **Arrival** (`F_1C1C8`): the car snaps to its end and puts him off at the car's position plus the offset,
  with X and Y rounded down to 4 and Z to 16 (so riding down from 899 lands at Z 0), walking out with the
  arrival command.

The remake (`remake/src/lifts.js`) follows this; checked in the browser: boards after 24 ticks, rides down in
112 ticks, put off at (800, 768, 0) in the lower corridor (zone 25), as the original.

Drawing the cars (`F_A6D6`, `F_1BF6A`, `F_A5C6`): each car is an object in the depth sort, taken before a
character at the same X + Y; the elevator is frame 0 of `$1C45E`, a shuttle two pieces (frame 1, then frame 2
32 pixels right, from `$1C450`); both are hidden by the occluders of the car's own zone (34 + car, lists at
`$13B3A` like the rooms'), and a rider takes his car's zone. On arrival the rider's zone is 0 until his next
step, so that step is not tested against the room's walls (a shuttle at the far end of its track puts him off
inside one). The remake does all of this (`IsometricScene` entities gained `sortOffset`), and the cars slide
between ticks; checked against the emulator's pictures of a shuttle ride (`build/shots/lifts-shuttle-*.png`).

### The aliens

Details in `local/wreckers/notes/aliens.md`. Character +0 indexes a 256-entity master table (`$8E16`, 16 bytes);
the 19 records are the entities near the camera (records 11-18 the on-screen alien slots), streamed in and out.

- **Waves** (`F_D3B0`, table `$D726`): spores come in waves with lulls (wave 1: 192 spores, then a 4,096-tick
  lull; from wave 13, 1,024 and 1,280); the first 512 ticks into a game. A 1-in-16 chance a tick launches one
  (`F_D4CC`, 64 in flight at `$D786`); after 43-128 ticks one in three lands as an alien at one of 32 entry
  points per side of the hull (tables `$D896`-`$DB96`).
- **Life**: falling (4 units a tick), eating through the hull (510 ticks), dropping 48 units to the floor;
  then wandering (a new direction with a 1-in-16 chance a tick; walls turn it), migrating, hunting. It takes
  the big spitting form whenever the officer is within 56 units, the small crawler otherwise; spit at the
  officer or droids in line, every 5 ticks. Zones with more than 4 aliens send them to the system rooms.
- **Death**: one shot (25 points); the suit's spray outside; cleaner droids.
- **Systems** (`F_F258`, every 8 ticks): generator, air, gravity and droid factory levels (`$1018C`-`$1018F`,
  1-208) fall when their room has 7 or more aliens, rise with 4 or fewer. The first alien inside starts a
  60-minute self-destruct clock; clearing every alien and spore during a lull aborts it.
- Measured pace: about 11 logic ticks a second under load (14 when quiet).

The remake's aliens (`remake/src/aliens.js`, data exported to `aliens.json` and `aliens.png`) follow this: the
entity table and eight on-screen records, the wave clock and spores in flight with the original's random
generator, the on-screen AI (falling, hull, wander with big and small forms, spitting through the three looks of
each facing, walls turning them), the off-screen rules six entities a tick (patrol points, the zone graph walk
to the system rooms), zone counts, system wear with the original's messages, and the self-destruct clock and its
abort. Shots hit characters (an alien dies in one shot for 25 points; spit takes the officer's 16, 4, 4 and the
first stat to run out decides). Checked headless: a spore falls 1020 to 944 in 19 ticks, eats the hull for 510,
drops 48 and grows near the officer, spitting every 5 to 6 ticks; with the officer away, the first wave's
aliens swarm to gravity control and close it down after about 4,600 ticks. A dead officer lies 16 cycles of
his lying script (about 128 ticks) while the aliens in his zone gather round the body, then rises as his
plasmozomb (its own scripts, frames 34-40 of the alien set): stunned 10 ticks by a shot, hurt only once a lull
finds no aliens or spores (message 56), 32 a shot from 255, then bursting into eight big aliens for 950
points; its tread shakes the view. Checked in the browser: rises 135 ticks after death, bursts on the 8th hit.
Not yet: plasmozombs grabbing characters (needs a living officer, so the next commander), cleaner droids,
droids at all, off-screen attrition, the outside.

The HUD (details in `local/wreckers/notes/ui.md`): the status line is a ticker tape, messages scrolling left a
pixel a frame (50 a second) through a 128 by 7 window at (32, 145) in the large LCD font, in red, each followed by
". " and five spaces, queued 16 deep with a repeat of the last one dropped; the score is six BCD digits at
(16, 20) that roll like an odometer, a row every other frame. The remake has both (`remake/src/ticker.js`), with
the status messages from the original's table `$26278`.
The gauges are the original's too (`remake/src/hud.js`): three LED columns for generator, air and gravity (12
LEDs, lit = level >> 4, red, orange and green from the bottom); the lifeforce pulse, a beat of height
health / 32 + 1 traced 16 points at a time; the self-destruct countdown, whose graphic starts lit and darkens
a line from the bottom every 80 seconds (plane 0 cleared under plane 3); and the long range scanner's 7
pictures, a step every 4 frames.
The map screen (mode 1, `F_649C`) is a 256 by 128 plan of both decks, packed at `$5F594` and unpacked into
`$4808A` in place of the tile map (reloaded on return), with every zone holding aliens recoloured by count
(`F_D5FE`, rectangles at `$DC9A`): where the plan has plane 3 set, colour 14 up to 8 aliens, 10 up to 16, 9
beyond. The remake opens it with F1 or Tab (`remake/src/mapscreen.js`); the droid and officer markers are not
in yet.

The bulbs (`notes/lifts.md` section 3) are in the remake (`remake/src/bulbs.js`): each drifts to a new tuning
every 256 x 64 ticks (twice as fast with 4 or more aliens in its room), heats a step every 64 ticks while out of
tune, warns at 36 and from 56, and at 72 explodes and ends the game with the original's texts (`$2386E`).
Pushing a bulb console facing +X opens its screen: the original's own picture of it, captured per bulb and title
in the emulator with the moving parts switched off (`tools/bulbscreen.py`), and over it the two Lissajous
figures, the knobs, the heat bar and the blinking CRITICAL label, drawn as the original draws them. Measured in
the emulator: the play display is lines 25-224 of its 256-line frame (so a capture's line 25 is the screen's
line 0; the console's figures are centred on line 60, its knobs at 110 - 16f, as the code says), and the
figures turn once a logic tick, not once a frame. The
sliders take a click (the original's formula) or the arrow keys; Q, Escape or the quit icon leave.

Also in: the game clock (H.MM.SS, 50 frames a second, stopped by pause), the message archive (M: the last 7
messages logged with the clock as each starts on the status line, rows 16 lines apart from line 48, the time in
the large font, the text in the small font wrapped at 44 characters, under the header text 107), and pause (P:
everything stops but the status line, which holds "GAME PAUSED" and is restored after).

The officers (`local/wreckers/notes/officers.md`) are in the remake (`remake/src/officers.js`): a new game starts
on the commander screen (the original's, captured, with a DECEASED label per dead officer) with all three asleep
in the cryo pods; the chosen one wakes in his pod (1020, 348 + 16p, 896), standing 32 ticks, with his own stats,
damage per hit, rate of fire and colours (the shared frames recoloured: Tweddell 3/11, Hambleton 9/10, Knight
4/8). Standing still 16 ticks in an open pod puts him to sleep and 24 ticks later the commander screen opens.
Sleepers recover a point a stat every 64 ticks while Cryogenics holds 8 aliens or fewer, and lose 4 health
(dying in the pod, message 45) while it holds more. A dead officer is replaced only when the player presses
Space or clicks; leaving the body raises its plasmozomb at once (with the officer's own face, frames 34, 41,
42). Promotion is once a lull with the station clear, rank up to AIR MARSHAL, message 0 (the letter and its
points wait for the data terminals). All three dead: the game is over (the original goes to the high score
table, not in yet).

The pods change the map: their tiles (closed or open, `$1F746`), their rectangles (type 28 or a wall) and their
own occluders (`$1410C + 16p`), which the game switches off while a pod is open by setting bit 14 of the
record's x0. Occluders in the remake are now live, as in the original: the map's own art under each mask,
taken again when tiles under it change (`IsometricScene` `source` option and `invalidateOccluders`).

### Sound

Details in `local/wreckers/notes/sound.md`. The in-game sound driver (David Whittaker's replayer, by its
structure) and its data are on disk sectors 624-753, loaded at `$4C12A` with a jump table (init tune, play from
the 50 Hz interrupt, stop, resume, start effect, cut effects, fade). Effects: 47 synthesised ($00-$2E: a slice of a
wave table stepped in period, alternated, enveloped) and 8 samples ($80-$87); the game starts them through
`F_1C68` (id, channel), which refuses every effect while a tune plays and lets a sample on channel 3 finish. Four
tunes by Warren Cann (0 for screens, 1 promotion, 2 death, and the title's), selected by `curtune` (`$1C62`).
Channel 2 carries the station hum ($16), restarted every frame; the alien noise ($23, level min(4 x aliens in
the zone, 48)) is cut by the hum at once in the original, a flaw the remake fixes by playing the noise instead.
Everything was rendered through the driver itself in the emulator (`tools/sounds.py`, and the general
`local/amiga-tools/tools/paula.py`, which captures Paula's registers and mixes them through a DMA model);
checked against the game's own register stream (tune 2: 1,588 of 1,588 frames equal; 119 effect calls).

The remake plays them (`remake/src/sound.js`) through `SoundManager`, which gained loop regions (`loopStart`,
`loopEnd`) for the endless effects and the looping tune. A start screen unlocks audio.

The program also still holds its assembler's symbol table (477 names at `$37EEC-$39902`: `seqproc` for
`F_1D72`, `place_ef` for `F_1C68`, `collisio`, `fix_hero` and so on), now in `tools/names.txt`.

### Droids

Details in `local/wreckers/notes/droids.md`: ids 1-10 are the HUD slots; eight models (FIGHTER 1-6, CLEANER, DR
DROID) sharing scripts, each with its own frames, damage, rate of fire and build time; the only order is a room
to go to, where the droid patrols; on screen it walks 1 unit a tick and fights what it sees along its lines
(ahead, the sides, behind for models 4-6; friends block a line), off screen one droid is updated a tick (16
units each 11 ticks) and fights the aliens of its zone by numbers. Also: the factory (build times 1,224 to 1,968
ticks while the factory system is above 96, rank needed for models 4-6), the doctor, the cleaner pulling aliens
in, the recharge pad, floating without gravity, out of control when the factory fails, and speech.

In the remake (`remake/src/droids.js`), first stage: the three droids of the start, on and off screen, their
orders (F1-F10 or a slot click opens the map, a room click gives the order; the original asks for the '>' icon
first), patrol, combat with the original's line tests and rates of fire, damage per model (destroyed, shut
down, retreating), off-screen fights, the HUD slots (faces, blinking when low), and markers on the map. Checked
in the browser: the three walk to their rooms off screen and patrol; droid 1 sent to Cryogenics comes on
screen, walks in, patrols, and shoots an alien put in its line. Crossing the decks is simplified (the droid is
taken to the other deck's lobby; the elevator queue is not modelled yet).

Second stage, also checked in the browser: gravity at 24 or less floats every droid but cleaners (bobbing,
drifting a fixed way), and above 32 they stand by where they are; a failed droid factory sends droids out of
control one by one (messages 54 and 55; they hunt the officer off screen and shoot their own side on screen);
the doctor links to a damaged droid and repairs it (+8 an update off screen, +1 a tick on screen, to above 192);
the cleaner turns the aliens of its zone to fly into it (25 points each, 6/4/6 off the cleaner); the recharge
pad.

The factory is in (`remake/src/factory.js`): walking into the desk with the generator above $80 opens it (the
original's desk captured bare per vacant or occupied port, `tools/factoryscreen.py`, with the pictures the game
draws per model, and the texts, description and progress bar drawn from the layout table `$26DEC`); a slot or
F1-F10 picks the command port; the arrows browse the models and OK commissions one (FIGHTER 4-6 refused below
their rank, ACCESS DENIED blinking). Builds step every 8 ticks while the factory system is above 96; checked: a
cleaner at port 4 appears at (1002, 778, 0) in zone 21 and reports "DROID FOUR COMPLETED" 16 steps later, as in
the emulator. Text offsets in the screen buffer are 160 bytes a line, 8 bytes per 16 pixels (x = (b >> 3) x 16 +
(b & 1) x 8). Not yet: the elevator queue, droid speech and the info screen.

### Weapons and health

Details in `local/wreckers/notes/weapons.md`; the essentials:

- **Identities.** Character record +0 is an identity, not a type: 0 the officer under control, 1 to 10 droids
  (class in `$101A4`), 11 to 13 the three commanders' jelly monsters, 14 and up plasmodians.
- **Firing** (`F_17B78`): no ammunition; while the button is held, the officer fires from his scripts' events:
  every tick standing (event 1), after every step taken walking (events $71 to $74). A cooldown per shooter
  (`$18F4A`): Tweddell 4 ticks, Hambleton 3, Knight 5 (`$19C16`); droids 5 or 3; aliens 5. Muzzle offsets per
  class and facing at `$18E5A`.
- **Shots** (32 at `$19C20`, 14 bytes): officer and droid shots move 8 units a tick for 15 ticks; alien spit
  5 a tick after holding still one tick, for 22. They hit a character within 4 units in X and Y (alien spit
  only the officer and droids), and stop on rectangles of the types listed at `$17FBA` (walls, conditional
  doors, lifts, consoles, 19), tested as a short segment across the line of travel; then a 4-tick burst on the
  wall face. Sprites: frame table `$19DE0` (4 classes x 4 directions, then orange and green bursts).
- **Damage** (`$1011C + 8 x id`: health, stamina, morale, cause): each hit takes a per-class amount of each;
  the first to run out decides: health is death, stamina "shut down", morale "retreating" (both freeze the
  officer). Commanders: Tweddell 255/192/255 taking 16/4/4 a hit, Hambleton 192/255/192 taking 10/2/3, Knight
  255/224/192 taking 12/2/4. A dead officer falls, and about 128 ticks later becomes his jelly monster. Jellies
  cannot be hurt until all plasmodians are gone, then take 32 a shot; a killed jelly releases 8 plasmodians.
  Plasmodians die in one shot, 25 points.
- **HUD**: the lifeforce indicator is a heartbeat trace whose spike height is health / 32 + 1; the information
  panel shows three bars, value / 2 pixels long.

The remake's shots (`remake/src/shots.js`) follow this; checked headless against the original's numbers (shots
at ticks 1, 5, 9, 13; X + 13 at the end of the first tick; a burst at X 1048, Z 910 from the start position).

`tools/overlay.py` draws the zones and collision rectangles, projected with the game's formula, over the
composed map (`build/data/logic.png`): they sit on the corridors, walls and consoles of both decks.

## Tenkai: extending it for isometric games

Principles: isometric support is added beside the 2D scenes, not into them; `Scene`, `TiledScene`, `Entity`
and `Sheet` keep their behaviour, and an isometric game uses the same entities, sheets, clips, input and sound.

What the original shows (above) is that an isometric game needs two layers that Tenkai should keep apart:

1. **A world model**, independent of the art: positions in (x, y, z), a projection, regions, and typed
   colliders. This is what game logic, movement and AI use.
2. **A view**: how the world is drawn. Wreckers draws a flat 2D tile map of pre-drawn isometric art and
   places sprites by projecting world positions; other isometric games draw stacks of blocks per cell. Both
   should sit on the same world model.

Proposed, following that split:

- **`IsometricProjection`**: world (x, y, z) to screen and back, with the ratio (2:1 here), the units, the
  origin, and height. Wreckers' formula is one configuration of it. Used by the scene, the automap and logic.
- **`IsometricWorld`** (the world model): regions (named rectangles in x and y, at a height range, such as
  decks and rooms), colliders (rectangles with a type and a handler or tag, looked up by region), and
  queries: which region a point is in, what a move into a point hits, line of sight. Characters block each
  other with a box. Optionally, movement scripts (steps of dx, dy, dz and a frame, each step checked),
  which is a general way to drive walking, climbing and lifts.
- **`IsometricScene`** (the view): extends `Scene`; holds a projection, a world, and entities with world
  positions. Its ground is pluggable: a `TiledScene`-style flat map of pre-drawn art (the Wreckers way, reusing
  `TiledScene`'s map and `Sheet` code rather than duplicating it), or stacked blocks per cell (the other
  common way). Entities are projected and sorted by depth among the scenery.
- **Clipping a scene to a shape**: the angled frame needs a scene drawn inside a polygon. Useful to any game,
  so it goes into `Scene` itself, off by default.
- Already there: indexed colour (`Palette`, `IndexedSurface`) for Amiga graphics, `SoundManager` for samples.

For the view, Wreckers needs a ground layer, depth-sorted sprites (by world X + Y, then height), and occluders:
foreground cut-outs of the art, each with a test of who is behind it. `IsometricScene` has these: after each
entity, the occluders that hide it are drawn over it, clipped to its box. Block-based isometric games, whose
scenery is separate pieces, can instead make the scenery entities and let the depth sort handle it.

Still to learn from the original: the outside (spacesuit) view, the Battlepod, droid programming, the HUD and
its panels, the aliens' behaviour, and the sound.

Gaps found go into this section as they turn up, as in `local/monkey2/TENKAI-GAPS.md`.
