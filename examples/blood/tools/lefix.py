# BLOOD.EXE's LE fixups: every place (object, offset) that holds an address once loaded, and what it points at.
# Used to find tables of pointers (Blood's gibList, its FX and gib arrays) from the tables they point to.
#   python3 tools/lefix.py to <obj> <offset-hex>      (the places that point at an object's offset)
#   python3 tools/lefix.py from <obj> <start-hex> <end-hex>  (the pointers held in a range of an object)
import struct, sys, os
d = open(os.path.join(os.path.dirname(__file__), '..', 'original', 'BLOOD.EXE'), 'rb').read()
le = d.find(b'LE\x00\x00')
npages = struct.unpack_from('<I', d, le + 0x14)[0]
fpt = le + struct.unpack_from('<I', d, le + 0x68)[0]
frt = le + struct.unpack_from('<I', d, le + 0x6c)[0]
objtab = le + struct.unpack_from('<I', d, le + 0x40)[0]
objs = []
for i in range(struct.unpack_from('<I', d, le + 0x44)[0]):
    vsize, base, flags, pidx, pcount, _ = struct.unpack_from('<6I', d, objtab + i * 24)
    objs.append((pidx, pcount))
def obj_of_page(page):
    for i, (pidx, pcount) in enumerate(objs):
        if pidx - 1 <= page < pidx - 1 + pcount: return i + 1, (page - (pidx - 1)) * 4096
    return None, None
fix = []
for page in range(npages):
    start = struct.unpack_from('<I', d, fpt + page * 4)[0]
    end = struct.unpack_from('<I', d, fpt + (page + 1) * 4)[0]
    p = frt + start
    so_obj, so_base = obj_of_page(page)
    while p < frt + end:
        stype, flags = d[p], d[p + 1]; p += 2
        if stype & 0x20: count = d[p]; p += 1; srcs = None
        else: srcs = [struct.unpack_from('<h', d, p)[0]]; p += 2
        if flags & 0x40: obj = struct.unpack_from('<H', d, p)[0]; p += 2
        else: obj = d[p]; p += 1
        off = 0
        if (stype & 0xf) != 2:
            if flags & 0x10: off = struct.unpack_from('<I', d, p)[0]; p += 4
            else: off = struct.unpack_from('<H', d, p)[0]; p += 2
        if srcs is None: srcs = [struct.unpack_from('<h', d, p + k * 2)[0] for k in range(count)]; p += count * 2
        for so in srcs: fix.append((so_obj, so_base + so, obj, off))
if __name__ == '__main__':
    if sys.argv[1] == 'to':
        o, t = int(sys.argv[2]), int(sys.argv[3], 16)
        for f in fix:
            if f[2] == o and f[3] == t: print('object', f[0], 'offset', hex(f[1]))
    else:
        o, a, b = int(sys.argv[2]), int(sys.argv[3], 16), int(sys.argv[4], 16)
        for f in sorted(fix, key=lambda f: f[1]):
            if f[0] == o and a <= f[1] < b: print(hex(f[1]), '->', 'object', f[2], hex(f[3]))
