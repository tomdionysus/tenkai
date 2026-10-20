"""Blood shareware SHARE.SHR: list its entries, or extract them.
usage: shr.py FILE list | shr.py FILE extract OUTDIR [NAME...] | shr.py FILE cat NAME"""
import sys, os, struct

# --- PKWARE DCL "implode" decoder (after zlib's contrib/blast.c) ---
LITLEN = [11,124,8,7,28,7,188,13,76,4,10,8,12,10,12,10,8,23,8,9,7,6,7,8,7,6,55,8,23,24,12,11,7,9,11,12,6,7,22,5,7,24,
          6,11,9,6,7,22,7,11,38,7,9,8,25,11,8,11,9,12,8,12,5,38,5,38,5,11,7,5,6,21,6,10,53,8,7,24,10,27,44,253,253,253,
          252,252,252,13,12,45,12,45,12,61,12,45,44,173]
LENLEN = [2,35,36,53,38,23]
DISTLEN = [2,20,53,230,247,151,248]
BASE = [3,2,4,5,6,7,8,9,10,12,16,24,40,72,136,264]
EXTRA = [0,0,0,0,0,0,0,0,1,2,3,4,5,6,7,8]

def construct(rep, n):
    length = []
    for r in rep:
        length += [r & 15] * ((r >> 4) + 1)
    assert len(length) == n, (len(length), n)
    count = [0] * 16
    for l in length: count[l] += 1
    offs = [0] * 16
    for i in range(1, 15): offs[i + 1] = offs[i] + count[i]
    symbol = [0] * n
    for s in range(n):
        if length[s]: symbol[offs[length[s]]] = s; offs[length[s]] += 1
    return count, symbol

LITCODE = construct(LITLEN, 256); LENCODE = construct(LENLEN, 16); DISTCODE = construct(DISTLEN, 64)

class Bits:
    def __init__(self, data, pos=0): self.d = data; self.p = pos; self.buf = 0; self.n = 0
    def bits(self, need):
        while self.n < need:
            self.buf |= self.d[self.p] << self.n; self.p += 1; self.n += 8
        v = self.buf & ((1 << need) - 1); self.buf >>= need; self.n -= need
        return v
    def decode(self, h):
        count, symbol = h
        code = first = index = 0
        for l in range(1, 16):
            code |= self.bits(1) ^ 1
            c = count[l]
            if code < first + c: return symbol[index + (code - first)]
            index += c; first = (first + c) << 1; code <<= 1
        raise ValueError('bad code')

def explode(data, pos, size):
    b = Bits(data, pos); out = bytearray()
    lit = b.bits(8); dict_ = b.bits(8)
    if lit > 1 or dict_ < 4 or dict_ > 6: raise ValueError('not DCL: lit=%d dict=%d' % (lit, dict_))
    end = pos + size
    while b.p <= end:
        if b.bits(1):
            sym = b.decode(LENCODE); ln = BASE[sym] + b.bits(EXTRA[sym])
            if ln == 519: break
            s = 2 if ln == 2 else dict_
            dist = (b.decode(DISTCODE) << s) + b.bits(s) + 1
            if dist > len(out): raise ValueError('distance too far')
            for _ in range(ln): out.append(out[-dist])
        else:
            out.append(b.decode(LITCODE) if lit else b.bits(8))
    return bytes(out)

# --- the container ---
def dos_datetime(date, time):
    return '%04d-%02d-%02d %02d:%02d:%02d' % (1980 + (date >> 9), (date >> 5) & 15, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2)

def entries(d):
    pos = 0x3a
    while pos + 0xa8 <= len(d):
        name = d[pos:pos + 0x80].split(b'\0')[0].decode('ascii')
        attr, = struct.unpack_from('<I', d, pos + 0x80)
        size, date, time = struct.unpack_from('<III', d, pos + 0x88)
        yield dict(name=name, attr=attr, size=size, when=dos_datetime(date, time), data=pos + 0xa8, pos=pos)
        pos += 0xa8 + size

def main():
    d = open(sys.argv[1], 'rb').read(); cmd = sys.argv[2]
    hdr = d[:0x3a]
    if cmd == 'list':
        print('header', hdr.hex()); total = 0
        for i, e in enumerate(entries(d)):
            total += e['size']
            print('%3d %9d %s %#x %s' % (i, e['size'], e['when'], e['attr'], e['name']))
        print('entries end at', e['data'] + e['size'], 'of', len(d), 'compressed total', total)
    elif cmd in ('cat', 'extract'):
        names = set(n.upper() for n in sys.argv[3 if cmd == 'cat' else 4:])
        for e in entries(d):
            if names and e['name'].upper() not in names: continue
            out = explode(d, e['data'], e['size'])
            if cmd == 'cat': sys.stdout.buffer.write(out)
            else:
                p = os.path.join(sys.argv[3], e['name']); open(p, 'wb').write(out)
                print('%-14s %9d -> %9d' % (e['name'], e['size'], len(out)))
main()
