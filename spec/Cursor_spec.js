import Cursor from '../lib/Cursor.js'
import ContextMock2D from './mocks/ContextMock2D.js'

describe('Cursor', () => {
  it('should draw a cursor with its hotspot at the mouse', () => {
    var cursor = new Cursor()
    var img = {}
    cursor.define('hand', img, 6, 2)
    var context = new ContextMock2D()
    cursor.draw(context, 100.4, 50.6, 'hand')
    expect(context.drawImage).toHaveBeenCalledWith(img, 94, 49)
  })

  it('should draw nothing for an unknown cursor, a missing mouse, or when hidden', () => {
    var cursor = new Cursor()
    cursor.define('hand', {}, 0, 0)
    var context = new ContextMock2D()
    cursor.draw(context, 10, 10, 'nope')
    cursor.draw(context, undefined, 10, 'hand')
    cursor.hidden = true
    cursor.draw(context, 10, 10, 'hand')
    expect(context.drawImage).not.toHaveBeenCalled()
  })
})
