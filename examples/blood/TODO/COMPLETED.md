# Blood on Tenkai: completed

## Phase 0: the original in hand (2026-10-21)

- `original/blood.exe` (17,349,441 bytes, 1997-09-23) is a self-extracting PKZIP holding the Blood Shareware v1.11
  installer: INSTALL.EXE (PKLITE-packed), MONO320.PCX (the splash) and SHARE.SHR (the game).
- SHARE.SHR is a custom installer container, read by `tools/shr.py`: a 58-byte header (file count 23 at 0x0e?),
  then entries of a 128-byte name, 32-bit attributes (0x20), 32-bit compressed size, 32-bit DOS date, 32-bit DOS
  time, 16 zero bytes, and the data as a PKWARE DCL "implode" stream (decoded after zlib's contrib/blast.c).
  All 23 entries decode to their full length; the texts read, the EXE is an LE DOS/4GW executable, the RFFs
  start `RFF\x1a` v3.01, the ART is Build ART v1 with tiles 0 to 4095.
- `original/` holds the 23 unpacked files beside blood.exe; it is git-ignored (third-party data), as is `data/`.

## Phase 1 (most) and 2a: the formats and the data (2026-10-21)

- RFF v3.01: a 32-byte header; the directory at the offset the header gives, 48 bytes an entry, XORed with
  (dirOffset + (i >> 1)) & 0xff; a file with flag 0x10 has its first 256 bytes XORed with i >> 1. BLOOD.RFF holds
  636 files (8 maps, 396 SEQ, 134 QAV, 64 KVX, 5 PAL, 15 PLU, ...), SOUNDS.RFF 1196 (652 SFX, 528 RAW, 12 MID).
- Maps are v6.03, not encrypted (the retail 7.00 maps are): a 37-byte header after the magic, the sky offsets, then
  sectors (40 bytes, + a 60-byte XSECTOR when extra > 0), walls (32, + 24), sprites (44, + 56), 4 bytes of checksum.
  The extras are C bit fields, read LSB first; each starts with its owner's index, which agrees for all 4,981 sprite
  extras but one (E1M6's last, a placeholder). The XWALL has 6 unused bits before its last 32, not 4.
- Sprite types are the lotag: 1 the single and co-op starts (data1 the player), 2 the Bloodbath starts.
- ART: Build's v1 layout; picanm bits 28-31 are Blood's view kind (1: 5 views, mirrored; 2: 8; 6, 7: voxel).
- PLU ids are the pal numbers; NORMAL.PLU's 64 rows darken linearly (row 48 is a quarter as bright).
- 57 of 396 SEQs carry 8 bytes over their frame count (an unused frame); readers take the count.
- data/ holds only standard formats, built by `tools/build.mjs`: atlas pages as grey PNGs of palette numbers
  (for the shader) and true-colour PNGs (for 2D), the palettes and shade tables as PNGs, maps and SEQs as JSON,
  638 sounds as WAV (11025 Hz unsigned 8-bit, as recorded; 13 SFX name a RAW that is not in the shareware).

## Phase 3a and the first of 3b: drawing (2026-10-21)

- `lib/WebGLScene.js` in Tenkai (spec, doc page): a scene with its own WebGL 2 canvas, drawn into the game's canvas
  under its children.
- `src/view/BuildView.js` on it: the tiles as an R8UI texture array, each tile's place and animation in an
  integer texture (so the vertex shader animates tiles by Build's picanm), each pixel through its pal's shade
  row and the palette. Geometry in `src/view/geometry.js`: floors and ceilings by earcut (holes for inner loops),
  slopes by Build's getflorzofslope, walls in solid, upper, lower and masked parts with Build's alignment rules.
- The original runs headless (`fidelity/emu.mjs`, js-dos's emulators under Node, with a BLOOD.CFG written from the
  keys BLOOD.EXE reads): the menu after ~20 s, New Game into E1M1 by four Enters (`fidelity/newgame.mjs`).
- Fitted against its first view of E1M1: Build's 320 by 200 view is 90 degrees across and 90 degrees up, so
  heights show at 0.625 of z / 16; the distance shading is much weaker than first guessed (1 / 409600 a unit of
  visibility a unit of distance, to be fitted more finely). The player starts in a coffin sector (type 614) whose
  lid slides open, and a light sector (amplitude -16) brightens the crypt: game logic, for the server.

## Phase 6a-b (first part): the original traced from its memory, the movement matched (2026-10-21)

- The original's RAM is inside the emulator's WebAssembly heap (`ci.transport.module.HEAPU8`): `fidelity/mem.mjs`
  finds the player's sprite (status 6, type 231, clipdist 48) and Blood's sector, wall and sprite arrays from the
  map, and reads them as it runs. Node gets in every 1 to 4 game ticks.
- BLOOD.CFG needs a [KeyDefinitions] section: without it no game key is bound (Escape still works). The defaults
  are in BLOOD.EXE's strings.
- Attract mode plays BLOOD000.DEM (E1M1) about 65 s after boot; `-playback` does nothing here. The counter 934408
  bytes before the player's sprite is the demo's input index, so `fidelity/trace.mjs` lines every sample up with
  the input that made it. The counter moves before the player in a frame, so a sample may show the tick before.
- Demos: a 411-byte header, then 22-byte inputs (sync flags, forward and strafe as signed bytes of 256, turn as
  int16 with the angle moving turn >> 2, buttons, keys, use, weapon).
- `fidelity/replay.mjs` plays a demo through the server's game and compares. Found and matched on the way:
  - acceleration: mulscale8(0x4000, forward) (an input scale of 0xfe00 fitted at first stood in for the air drag,
    below); drag 0x2a00 per tick with mulscale16r, applied after the move; position += xvel >> 12;
  - Blood's sector types are two above the reconstructed source's: 612 path, 613 step rotate, 614 slide marked
    walls, 615 rotate marked, 616 slide all, 617 rotate all, 618 damage, 619 counter; sliding and rotating sectors
    are put at their rest state at load (translate by -65536, rebase, translate to busy);
  - E1M1 opens with a coffin lid (614) sliding shut over the start and the player rising through a stack link
    (markers 11 and 12) into the graveyard: Blood's GetZRange looks through links, CheckLink carries the body;
  - the player's tile comes from its sequence (PLAY1: idle 12032, moving +8, 14 clock ticks a frame), changing the
    sprite's extents, so z; the idle tile returns below a speed of 0x8000;
  - running into a wall whose far sector takes a wall push (E1M1's gate, a 617) triggers it, only at rest;
  - a wall hit takes away the velocity into it (actWallBounceVector).
- The result: within 20 units through tick 340 of BLOOD000; it then departs where the original is knocked about
  by being shot at (the monsters, not yet on the server).

## The game in full, and the fidelity tools widened (2026-10-21, evening)

- BLOOD.EXE's own tables read out by signature (`formats/exe.mjs`): dudeInfo (148 bytes a dude, types 201-255),
  VECTORDATA (134 bytes, 22 hitscans), missileInfo (14 bytes, 300-317), and the pickups' tables (weapons from 40,
  ammo from 60, items from 100). The server uses them as they are.
- QAV (weapon animations): a 36-byte header and 204-byte frames of 8 tiles; a frame's callback (> 0) is when the
  weapon fires. Weapons fire on those frames.
- Blood's random numbers are Watcom's rand() (seed * 1103515245 + 12345), found in the original's memory 2146176
  bytes before the player's sprite; the demo starts from the same state every run. `fidelity/random.mjs` compares
  the remake's draws with the original's tick by tick: idle monsters (each a Chance every fourth frame by
  (gFrame & 3) == (sprite & 3), buried zombies too) make the original's 7.75 draws a tick; the original's frame
  counter runs 2 ahead of the demo's count; a slow drift of about one draw in six ticks is still unexplained.
- Monte-Carlo (`fidelity/montecarlo.mjs`): random-input demos written with the original's header, played by the
  original in place of BLOOD000.DEM (attract mode plays it), traced, replayed through the server and scored. It
  found the crouch's sequence (PLAY1M4, +11; swimming +9) and confirmed the player's floor test's extra 16
  (taking it out worsened every run). Three runs of 360 ticks keep together 180, 67 and 301 ticks.
- Server: weapons, pickups, damage with the dude's resistances by skill, armour, death and respawn, missiles and
  TNT, monsters on Blood's AI structure, generators, Bloodbath with frags and random starts; the level's end and the
  next by BLOOD.INI. Client: the status bar and weapon in hand (QAV), sounds by position, music (the MIDIs rendered
  to MP3 through FluidSynth in WebAssembly), room over room through stencilled portals (E1M1's sky), messages, the
  end-of-level tally and the frag list.
- Tenkai gained `PictureAtlas.draw` options (scale, mirror, alpha, filter) on the way.

## Monsters, things and explosions against the original (2026-10-21, night)

- `fidelity/trace.mjs` with DUDES=1 records every monster and every sprite the original makes (thrown TNT, effects,
  gibs) from its memory; `fidelity/dudes.mjs` sets each monster's story (when it stirs, where it ends, its tile)
  beside the remake's.
- Buried zombies lie as ZOMB1I2 (+12, tile 3055) and rise by ZOMB1M2 (+9, 3046-3054, then 1224); they think as
  idle monsters do (a Chance each fourth frame), hearing only (their sight is 0). The remake's rise within 2-8
  ticks of the original's (the random draws decide).
- BLOOD.EXE's thingInfo (51 bytes, 400-429), explodeInfo (27 bytes, 8 kinds) and GIBTHING (20 bytes) read out.
  Things move by Blood's MoveThing (bounce by elasticity, friction capped at 0x11111, fall damage over
  dmgResist). The thrown TNT bundle (419) flies about 152 units a tick and goes off on meeting a monster: in
  BLOOD000 it goes off at tick 301 in both. Its explosion is the standard kind (1: the original's explosion
  sprite is type 1); an explosion lasts its ticks, hurting and concussing every frame (Blood's ConcussSprite: by
  size over mass). The zombie dies at 302 (the original's 301), flies as a body (ZOMB1D2, +2 for a blast) and
  throws its gibs (the human run, 1454-1456, and the head 3405), blocking things the player can step on: the
  original's player climbs one at tick 351.
- What still parts the two: the random draws (a burst of about 16 more in the original near tick 20, then a
  slow drift), so where the gibs land and how monsters choose differ after a few seconds.
- Views compared: the original's screen at a demo tick beside the remake's from the server's own state at that
  tick (`fidelity/views.mjs`): the mausoleum, the graveyard, its fence and sky agree.
- BLOOD001 (E1M6) and BLOOD002 (E1M5) traced and replayed (the replay now seeded with the original's random state
  at the demo's start, and allowing for samples taken mid-tick). BLOOD002's player died in the remake to its own
  TNT and lived in the original: the bundle (BUNFUSE, QAV 21) is lit when fire is pressed and thrown (BUNTHRO, 23)
  when it is let go, harder the longer it was held (Blood's throwPower, hold over 240 clocks); let go before the
  fuse catches (about 24 clocks) it is lobbed at the least strength (BLOOD000's throw: its rise and fall match only
  so). A thrown bundle goes off on whatever it hits (the floor in BLOOD002, the zombie in BLOOD000); held to
  BUNFUSE's end it goes off in the hand; alt drops it lit. Blood's explosion: the fixed damage (dmg +
  Random(dmgRng)) once, to the first dude reached; every frame the concussion pushes and hurts by force over
  0x40000 + distance squared (CheckProximity: >> 4 in x and y, >> 8 in z, in sight of middle, top or bottom).
  actFireThing starts a thing a clipdist ahead of its thrower with half the thrower's velocity. BLOOD002's three
  bundles now match the original's in time and height.
- The original's velocities read from its memory: Blood's xvel, yvel and zvel arrays (4096 ints each, one after
  another) found by fidelity/findvel.mjs 1736580 bytes before the sprite array, and traced with every sample. They
  showed Blood's actAirDrag(sprite, 128) on every dude each tick, before the move and gravity (each axis loses
  128/65536, x and y drawn toward the sector's wind), and no input scale. With both, BLOOD000's player matches the
  original's velocity to the unit on every tick up to 350 (where gibs placed by the drifting random draws differ),
  and its position to the unit past tick 330 (it parted at 91 before).
- The original's rand() callers logged (fidelity/randlog.mjs patches rand() in the emulator's memory to write each
  caller and the tick into a ring buffer; tools/randcalls.py --json names each call site's source file). They
  showed: Blood's CalcGameChecksum draws once every eight frames (network.cpp), Blood's frame count starts at 0 for
  a demo (not 2), the generators' first draws come in the level's setup, the secret's message is a draw between two.
  With these, BLOOD000's draws are the original's, tick by tick and in order, to tick 351, through the thrown TNT,
  its explosion, the zombie blown apart and the blood and gibs after (they parted at tick 17 before).
- Blood's effects ported (server/game/fx.mjs): gFXData (57, read from BLOOD.EXE), fxSpawn's draws (two flips,
  the life), fxProcess (drag, gravity, the floor's callbacks: fxBloodBits), fxSpawnBlood and fxBloodSpurt, fxDynPuff
  (lit TNT's smoke every 12 clock ticks), GibSprite with gibList (31, read from the exe: GIBFX 21 bytes packed,
  GIBTHING 20) and ChanceToCount; gib objects (bits 425, the head 427) locked for 180 clock ticks, then broken by
  what they hit into blood chunks (actActivateGibObject). Things spawn with cstat 128 and their own, repeat 64, in
  the sprite's sector; locked things are not concussed; things fly above a parallaxed sky; a thing's air drag 128.
- The frame in Blood's order: the players' input and weapons (after the turn and the weapon's height), then busy
  sectors, events, sequences, then things, missiles, explosions (from the frame after their own), the dudes' moves,
  the dudes' minds (aiProcessDudes: recoil from the frame's total damage, RecoilDude's draw), the effects. Dudes get
  their type's clipdist (actInit); a dead dude is thing 426 with its thingInfo; a dude rolls for a new target only
  for another attacker. The TNT bundle's strength is its hold over 240 (thrown at letting go, impact on what it hits).
- fidelity/lockstep.mjs: the original stepped a frame at a time (ProcessFrame patched where a frame begins to wait
  on a flag), so randlog.mjs reads every frame's draws (512 a frame) and nothing is lost. With it BLOOD001 and
  BLOOD002 showed: Blood's event queue is a binary heap ordered by time alone (equal times come out in the heap's
  order: ported as EventQueue in triggers.mjs); the bubble generators (706, 707) spawn effects 23 and 26; the gib
  objects (416, 417, the bits, the bodies, the head) break on off, on or toggle (actActivateGibObject: data1 and
  data2's gibs, data3's if burning, data4's sound, the drop; an unseen one stays); the map's things get their
  thingInfo's clipdist and flags (actInit: a breakable's is 0); aiActivateDude picks a way first (its
  aiChooseDirection draw) when the dude's state is off, then each type's cry. BLOOD001's and BLOOD002's draws
  match the original's to tick 183.
- A disassembler for BLOOD.EXE (tools/x86.mjs, disasm.mjs) and its AI states read out (tools/aistates.mjs: 28-byte
  AISTATEs, a sequence, a callback, ticks, enter, move, think, next). The trace samples every dude's AI state
  (its xsprite's aiState at 0x34; the in-memory XSPRITE is 56 bytes), frame by frame (STEP=1). The axe zombies
  (203, the buried 205, the laying 244) now run by the original's own states and its functions ported from their
  disassembly (server/game/ai.mjs: aiNewState, aiProcessDudes' step, aiThinkTarget, aiLookForTarget,
  aiActivateDude, aiSetTarget, aiMoveForward and aiMoveTurn, CanMove, RecoilDude, zombThinkChase, Ponder, Goto,
  Search, entryEStand, entryEZombie, HackSeqCallback). With Blood's MoveDude rules found on the way (a dude moves
  only when falling or moved; standing on a face sprite it slides off it, undragged; no drag under water) and
  aiChooseDirection's halving toward zero: BLOOD000's zombie stirs, rises, is blown up and lands within a few
  units of the original's, and BLOOD001's draws match to tick 195.
