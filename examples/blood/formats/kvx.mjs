// Ken Silverman's KVX voxel models (BLOOD.RFF *.KVX): Blood draws some sprites as these (the tiles' view kinds 6 and
// 7; VOXEL.DAT gives each tile its model). Only the first mip level is read.
//   i32 numbytes (of this level), i32 xsiz, ysiz, zsiz, i32 xpivot, ypivot, zpivot (8.8 fixed),
//   i32 xoffset[xsiz + 1], i16 xyoffset[xsiz][ysiz + 1] (offsets into the slab data, from its start),
//   slabs: for each column (x, y), from xyoffset[x][y] to [x][y + 1]: u8 ztop, u8 zleng, u8 vis (faces), u8 colours[zleng]
//   the palette (768 bytes, 6-bit) at the file's end
export default function kvx (b) {
  const numbytes = b.readInt32LE(0)
  const xsiz = b.readInt32LE(4), ysiz = b.readInt32LE(8), zsiz = b.readInt32LE(12)
  const xpivot = b.readInt32LE(16) / 256, ypivot = b.readInt32LE(20) / 256, zpivot = b.readInt32LE(24) / 256
  let p = 28
  const xoffset = []
  for (let i = 0; i <= xsiz; i++, p += 4) xoffset.push(b.readInt32LE(p))
  const xyoffset = []
  for (let x = 0; x < xsiz; x++) { const row = []; for (let y = 0; y <= ysiz; y++, p += 2) row.push(b.readInt16LE(p)); xyoffset.push(row) }
  const dataStart = 28 + (xsiz + 1) * 4 + xsiz * (ysiz + 1) * 2
  // The slabs: each column's runs of voxels
  const voxels = [] // [x, y, z, colour]
  for (let x = 0; x < xsiz; x++) {
    for (let y = 0; y < ysiz; y++) {
      let q = dataStart + xoffset[x] - xoffset[0] + xyoffset[x][y]
      const end = dataStart + xoffset[x] - xoffset[0] + xyoffset[x][y + 1]
      while (q < end) {
        const ztop = b[q], zleng = b[q + 1]
        for (let k = 0; k < zleng; k++) voxels.push([x, y, ztop + k, b[q + 3 + k]])
        q += 3 + zleng
      }
    }
  }
  return { numbytes, xsiz, ysiz, zsiz, xpivot, ypivot, zpivot, voxels, palette: b.subarray(b.length - 768) }
}
