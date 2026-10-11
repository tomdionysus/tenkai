import crypto from 'crypto'

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
const TEXT = 0x1
const CLOSE = 0x8
const PING = 0x9
const PONG = 0xa

/**
 * Real WebSockets for a {@link GameServer}, under Node: each browser (or any WebSocket client) that connects to the
 * HTTP server's upgrade path becomes one of the game server's connections, its text messages the game's. Node only
 * (it uses Node's `crypto` and an `http` server), so it is not exported by Tenkai's index; import it from
 * `tenkai/lib/node/WebSocketServer.js`. It speaks the WebSocket protocol's text frames, pings and closes, enough for
 * a game's JSON messages, with no dependencies.
 *
 * @example
import http from 'http'
const web = http.createServer()
new WebSocketServer({ http: web, server: gameServer, path: '/game' })
web.listen(8053)
gameServer.start()
// in the page: new GameClient({ socket: new WebSocket('ws://localhost:8053/game'), name: 'Ann' })
 */
class WebSocketServer {
  /**
   * @param {object} options
   * @param {object} options.http A Node `http.Server` (its `upgrade` requests are taken)
   * @param {GameServer} options.server The game server the connections join
   * @param {string} options.path The path WebSocket requests ask for (default any)
   */
  constructor (options) {
    this.server = options.server
    this.path = options.path || null
    this.sockets = new Set()
    options.http.on('upgrade', (req, socket) => this.upgrade(req, socket))
  }

  upgrade (req, socket) {
    const key = req.headers['sec-websocket-key']
    if (!key || (this.path && req.url.split('?')[0] !== this.path)) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
      return
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64')
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n')
    socket.setNoDelay(true)
    this.sockets.add(socket)
    const connection = this.server.connect((text) => this.send(socket, TEXT, Buffer.from(text, 'utf8')))
    let buffer = Buffer.alloc(0)
    let message = []
    const end = () => {
      if (!this.sockets.has(socket)) return
      this.sockets.delete(socket)
      this.server.disconnect(connection)
    }
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      for (;;) {
        const frame = WebSocketServer.frame(buffer)
        if (!frame) break
        buffer = buffer.subarray(frame.size)
        if (frame.opcode === CLOSE) {
          this.send(socket, CLOSE, frame.payload.subarray(0, 2))
          socket.end()
          end()
          return
        }
        if (frame.opcode === PING) this.send(socket, PONG, frame.payload)
        else if (frame.opcode === TEXT || frame.opcode === 0) {
          message.push(frame.payload)
          if (frame.fin) {
            this.server.receive(connection, Buffer.concat(message).toString('utf8'))
            message = []
          }
        }
      }
    })
    socket.on('close', end)
    socket.on('error', end)
  }

  /** One frame from the start of `buffer`, or null until it has all arrived: { fin, opcode, payload, size }. */
  static frame (buffer) {
    if (buffer.length < 2) return null
    const fin = (buffer[0] & 0x80) !== 0
    const opcode = buffer[0] & 0x0f
    const masked = (buffer[1] & 0x80) !== 0
    let length = buffer[1] & 0x7f
    let at = 2
    if (length === 126) {
      if (buffer.length < 4) return null
      length = buffer.readUInt16BE(2)
      at = 4
    } else if (length === 127) {
      if (buffer.length < 10) return null
      length = Number(buffer.readBigUInt64BE(2))
      at = 10
    }
    const mask = masked ? buffer.subarray(at, at + 4) : null
    if (masked) at += 4
    if (buffer.length < at + length) return null
    const payload = Buffer.from(buffer.subarray(at, at + length))
    if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3]
    return { fin, opcode, payload, size: at + length }
  }

  /** Sends one unmasked frame (a server's frames are not masked). */
  send (socket, opcode, payload) {
    if (socket.destroyed) return
    const n = payload.length
    const head = n < 126 ? Buffer.from([0x80 | opcode, n]) : n < 65536 ? Buffer.alloc(4) : Buffer.alloc(10)
    if (n >= 126 && n < 65536) {
      head[0] = 0x80 | opcode
      head[1] = 126
      head.writeUInt16BE(n, 2)
    } else if (n >= 65536) {
      head[0] = 0x80 | opcode
      head[1] = 127
      head.writeBigUInt64BE(BigInt(n), 2)
    }
    socket.write(Buffer.concat([head, payload]))
  }

  /** Closes every connection. */
  close () {
    for (const socket of this.sockets) {
      this.send(socket, CLOSE, Buffer.from([0x03, 0xe8]))
      socket.end()
    }
  }
}

export default WebSocketServer
