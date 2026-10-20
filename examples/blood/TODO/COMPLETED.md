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
