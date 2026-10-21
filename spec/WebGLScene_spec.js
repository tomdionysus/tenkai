import WebGLScene from '../lib/WebGLScene.js'
import ContextMock2D from './mocks/ContextMock2D.js'

function fakeGL () {
  return jasmine.createSpyObj('gl', ['viewport', 'clear', 'createShader', 'shaderSource', 'compileShader', 'getShaderParameter', 'getShaderInfoLog', 'createProgram', 'attachShader', 'linkProgram', 'getProgramParameter', 'getProgramInfoLog'])
}
function fakeCanvas (gl) {
  return () => ({ width: 0, height: 0, style: {}, parentNode: null, getContext: (type) => type === 'webgl2' ? gl : null })
}
function fakePage () {
  var parent = { insertBefore: (node) => { node.parentNode = parent } }
  return { width: 800, height: 450, style: {}, parentNode: parent, nextSibling: null, getBoundingClientRect: () => ({ left: 10, top: 20, width: 1600, height: 900 }) }
}

describe('WebGLScene', () => {
  it('should make a canvas of its size with a WebGL 2 context', () => {
    var gl = fakeGL()
    var scene = new WebGLScene({ width: 320, height: 200, createCanvas: fakeCanvas(gl) })
    expect(scene.canvas.width).toEqual(320)
    expect(scene.canvas.height).toEqual(200)
    expect(scene.gl).toBe(gl)
  })

  it('should render, then draw its canvas, then its children', () => {
    var gl = fakeGL()
    var order = []
    var scene = new WebGLScene({ width: 320, height: 200, createCanvas: fakeCanvas(gl), render: (g) => order.push(g === gl ? 'render' : 'wrong') })
    var context = new ContextMock2D()
    context.drawImage.and.callFake(() => order.push('canvas'))
    spyOn(scene, 'drawScenes').and.callFake(() => order.push('scenes'))
    scene.draw(context)
    expect(order).toEqual(['render', 'canvas', 'scenes'])
    expect(context.drawImage).toHaveBeenCalledWith(scene.canvas, 0, 0)
    expect(gl.viewport).toHaveBeenCalledWith(0, 0, 320, 200)
  })

  it('should take the game\'s size when made without one', () => {
    var scene = new WebGLScene({ createCanvas: fakeCanvas(fakeGL()) })
    scene.parent = { isGameEngine: true, width: 800, height: 450, parent: null }
    scene.draw(new ContextMock2D())
    expect(scene.canvas.width).toEqual(800)
    expect(scene.canvas.height).toEqual(450)
  })

  it('should call resized when its size changes', () => {
    var scene = new WebGLScene({ width: 10, height: 10, createCanvas: fakeCanvas(fakeGL()) })
    spyOn(scene, 'resized')
    scene.resize(64, 48)
    expect(scene.resized).toHaveBeenCalledWith(64, 48)
    expect(scene.width).toEqual(64)
  })

  it('should draw only its children without WebGL', () => {
    var scene = new WebGLScene({ width: 10, height: 10, createCanvas: fakeCanvas(null) })
    var render = spyOn(scene, 'render')
    var context = new ContextMock2D()
    scene.draw(context)
    expect(scene.gl).toBe(null)
    expect(render).not.toHaveBeenCalled()
    expect(context.drawImage).not.toHaveBeenCalled()
  })

  it('should present itself on the page over the game\'s canvas, hiding it, and withdraw again', () => {
    var gl = fakeGL()
    var render = jasmine.createSpy('render')
    var scene = new WebGLScene({ createCanvas: fakeCanvas(gl), render })
    var page = fakePage()
    scene.present(page)
    expect(render).toHaveBeenCalledWith(gl)
    expect(scene.canvas.width).toEqual(800)
    expect(scene.canvas.height).toEqual(450)
    expect(scene.canvas.parentNode).toBe(page.parentNode)
    expect(scene.canvas.style.left).toEqual('10px')
    expect(scene.canvas.style.width).toEqual('1600px')
    expect(page.style.visibility).toEqual('hidden')
    scene.withdraw(page)
    expect(scene.canvas.style.display).toEqual('none')
    expect(page.style.visibility).toEqual('')
  })

  it('should compile a program, and name the shader that fails', () => {
    var gl = fakeGL()
    gl.VERTEX_SHADER = 1
    gl.FRAGMENT_SHADER = 2
    gl.createShader.and.callFake((t) => ({ t }))
    gl.getShaderParameter.and.callFake((s) => s.t === 1)
    gl.getShaderInfoLog.and.returnValue('bad')
    expect(() => WebGLScene.program(gl, 'v', 'f')).toThrowError('fragment shader: bad')
    gl.getShaderParameter.and.returnValue(true)
    gl.getProgramParameter.and.returnValue(true)
    gl.createProgram.and.returnValue('p')
    expect(WebGLScene.program(gl, 'v', 'f')).toEqual('p')
  })
})
