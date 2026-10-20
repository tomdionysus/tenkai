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
