import Motion from '../lib/Motion.js'

describe('Motion', () => {
  // A world with one wall at x >= 3
  var world = () => ({
    move: (body, dx, dy, dz) => {
      if (body.x + dx >= 3) return { moved: false, blocker: 'wall' }
      body.x += dx
      body.y += dy
      body.z += dz
      return { moved: true }
    }
  })
  var scripts = [
    { steps: [[0, 0, 0, 0]], next: 0 },
    { steps: [[1, 0, 0, 1], [1, 0, 0, 2]], next: 1 },
    { steps: [[0, 0, 4, 5]], next: 0 }
  ]

  it('should choose a script from the table and take its steps, showing their frames', () => {
    var body = { x: 0, y: 0, z: 0 }
    var m = new Motion({ scripts, table: [[0, 1], [0, 1]], world: world(), body })
    m.setCommand(1)
    m.tick()
    expect(body.x).toEqual(1)
    expect(m.frame).toEqual(1)
    expect(m.anim).toEqual(1)
    expect(m.ended).toBe(false)
    m.tick()
    expect(body.x).toEqual(2)
    expect(m.frame).toEqual(2)
    expect(m.ended).toBe(true)
    expect(m.finished).toBe(true)
  })

  it('should hold a blocked step, keep its frame, and say what blocked it', () => {
    var body = { x: 2, y: 0, z: 0 }
    var m = new Motion({ scripts, table: [[0, 1], [0, 1]], world: world(), body, frame: 9 })
    m.setCommand(1)
    m.tick()
    expect(m.blocked).toBe(true)
    expect(m.blocker).toEqual('wall')
    expect(body.x).toEqual(2)
    expect(m.frame).toEqual(9)
    expect(m.step).toEqual(0)
    expect(m.tried).toEqual({ x: 3, y: 0, z: 0 })
  })

  it('should run a script backwards, its steps reversed and negated', () => {
    var body = { x: 2, y: 0, z: 0 }
    var m = new Motion({ scripts, table: [[0, { script: 1, reverse: true }]], world: world(), body })
    m.setCommand(1)
    m.tick()
    expect(body.x).toEqual(1)
    expect(m.frame).toEqual(2)
  })

  it('should take steps without the world when carried, ghosted, free or given free steps', () => {
    var body = { x: 2, y: 0, z: 0 }
    var m = new Motion({ scripts, table: [[0, 1], [0, 1]], world: world(), body })
    m.carried = true
    m.setCommand(1)
    m.tick()
    expect(body.x).toEqual(2)
    expect(m.frame).toEqual(1)
    m.carried = false
    m.ghost = true
    m.tick()
    expect(body.x).toEqual(3)
    m.ghost = false
    m.freeSteps = 1
    m.force(1, 1)
    m.tick()
    expect(body.x).toEqual(4)
    expect(m.freeSteps).toEqual(0)
    var rising = new Motion({ scripts, table: [[2]], world: world(), body: { x: 5, y: 0, z: 0 }, free: (b, s) => !s[0] && !s[1] })
    rising.tick()
    expect(rising.body.z).toEqual(4)
  })

  it('should choose again when the command changes or is forced, and take a lookup instead of a table', () => {
    var calls = []
    var m = new Motion({ scripts, lookup: (anim, command) => { calls.push([anim, command]); return { script: command } }, world: world(), body: { x: 0, y: 0, z: 0 } })
    m.tick()
    m.tick()
    m.setCommand(1)
    m.tick()
    m.force(0, 0)
    m.tick()
    expect(calls).toEqual([[0, 0], [0, 0], [0, 1], [0, 0]])
  })
})
