# Where BLOOD.EXE calls rand() (Watcom's, found by its multiplier 0x41C64E6D), attributed to the source file whose name
# the nearest assertion in the code pushes (Blood's asserts carry "src\\file.cpp"). For finding which parts of the
# original draw random numbers.
#   python3 tools/randcalls.py [file]   (with a file: the addresses of its calls)
import struct, re, collections, bisect, sys
d = open(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'original', 'BLOOD.EXE'), 'rb').read()
le = d.find(b'LE\x00\x00')
data_pages = struct.unpack_from('<I', d, le + 0x80)[0]
objs = []
for i in range(struct.unpack_from('<I', d, le + 0x44)[0]):
    vsize, base, flags, pidx, pcount, _ = struct.unpack_from('<6I', d, le + struct.unpack_from('<I', d, le + 0x40)[0] + i * 24)
    objs.append((base, data_pages + (pidx - 1) * 4096, vsize))
CODE_BASE, CODE_FILE, CODE_SIZE = objs[0]
DATA_BASE, DATA_FILE, _ = objs[3]
lin = lambda f: f - CODE_FILE + CODE_BASE
h = d.find(bytes.fromhex('6d4ec641'), CODE_FILE)
rand = lin(h - 12)
calls = [lin(f) for f in range(CODE_FILE, CODE_FILE + CODE_SIZE - 5) if d[f] == 0xE8 and lin(f) + 5 + struct.unpack_from('<i', d, f + 1)[0] == rand]
names = {DATA_BASE + m.start(): m.group().decode() for m in re.finditer(rb'src\\[a-z0-9_]+\.cpp', d[DATA_FILE:])}
# The LE's fixups: where the code holds an address, which object and offset it points at (absolute addresses are
# put in at load from these, so the code's own bytes do not hold them)
npages = struct.unpack_from('<I', d, le + 0x14)[0]
fpt = le + struct.unpack_from('<I', d, le + 0x68)[0]
frt = le + struct.unpack_from('<I', d, le + 0x6c)[0]
obj_page = struct.unpack_from('<I', d, le + struct.unpack_from('<I', d, le + 0x40)[0] + 12)[0]
refs = []
for page in range(npages):
    start = struct.unpack_from('<I', d, fpt + page * 4)[0]
    end = struct.unpack_from('<I', d, fpt + (page + 1) * 4)[0]
    p = frt + start
    while p < frt + end:
        stype, flags = d[p], d[p + 1]
        p += 2
        if stype & 0x20:
            count = d[p]; p += 1
            srcs = None
        else:
            srcs = [struct.unpack_from('<h', d, p)[0]]; p += 2
        if flags & 3 == 0:
            if flags & 0x40: obj = struct.unpack_from('<H', d, p)[0]; p += 2
            else: obj = d[p]; p += 1
            off = 0
            if (stype & 0xf) != 2:
                if flags & 0x10: off = struct.unpack_from('<I', d, p)[0]; p += 4
                else: off = struct.unpack_from('<H', d, p)[0]; p += 2
        else:
            raise SystemExit('fixup kind %d not handled' % (flags & 3))
        if srcs is None:
            srcs = [struct.unpack_from('<h', d, p + k * 2)[0] for k in range(count)]; p += count * 2
        if obj == 4:
            target = DATA_BASE + off
            if target in names:
                for so in srcs: refs.append((CODE_BASE + page * 4096 + so, names[target]))
refs.sort()
keys = [r[0] for r in refs]
by = collections.Counter()
detail = collections.defaultdict(list)
for c in calls:
    j = bisect.bisect(keys, c)
    cands = []
    if j < len(refs): cands.append((refs[j][0] - c, refs[j][1]))
    if j > 0: cands.append((c - refs[j - 1][0], refs[j - 1][1]))
    dist, name = min(cands) if cands else (1 << 30, '?')
    nm = name if dist < 0x1000 else '?'
    by[nm] += 1
    detail[nm].append(hex(c))
print('rand at', hex(rand), 'called from', len(calls), 'places;', len(names), 'source names,', len(refs), 'references')
if len(sys.argv) > 1:
    print(' '.join(detail[sys.argv[1]]))
else:
    for n, c in by.most_common(): print(f'{n:28s} {c}')
