const Video = require('../lib/Video')
const ContextMock2D = require('./mocks/ContextMock2D')

function fakeElement () {
  return {
    currentTime: 0,
    readyState: 4,
    videoWidth: 320,
    videoHeight: 240,
    duration: 10,
    play: jasmine.createSpy('play').and.returnValue(Promise.resolve()),
    pause: jasmine.createSpy('pause')
  }
}

describe('Video', () => {
  it('should set up the element', () => {
    var el = fakeElement()
    new Video({ src: 'a.mp4', element: el, muted: true, loop: true }) // eslint-disable-line no-new
    expect(el.src).toEqual('a.mp4')
    expect(el.muted).toBe(true)
    expect(el.loop).toBe(true)
  })

  it('should not loop the element itself when a range is set', () => {
    var el = fakeElement()
    var v = new Video({ src: 'a.mp4', element: el, loop: true, end: 2 })
    expect(v.element.loop).toBe(false)
  })

  it('should start at the start time and play', () => {
    var el = fakeElement()
    var v = new Video({ src: 'a.mp4', element: el, start: 3 })
    v.play()
    expect(el.currentTime).toEqual(3)
    expect(el.play).toHaveBeenCalled()
    expect(v.playing).toBe(true)
  })

  it('should finish when the movie ends', (done) => {
    var el = fakeElement()
    var v = new Video({ src: 'a.mp4', element: el })
    v.play().then(() => {
      expect(v.playing).toBe(false)
      done()
    })
    el.onended()
  })

  it('should finish when stopped', (done) => {
    var el = fakeElement()
    var v = new Video({ src: 'a.mp4', element: el })
    v.play().then(() => {
      expect(el.pause).toHaveBeenCalled()
      done()
    })
    v.stop()
  })

  it('should finish when play is refused', (done) => {
    var el = fakeElement()
    el.play.and.returnValue(Promise.reject(new Error('not allowed')))
    var v = new Video({ src: 'a.mp4', element: el })
    v.play().then(() => done())
  })

  it('should stop at the end of its range', () => {
    var el = fakeElement()
    var v = new Video({ src: 'a.mp4', element: el, start: 1, end: 2 })
    v.play()
    el.currentTime = 2.1
    v.update()
    expect(el.pause).toHaveBeenCalled()
    expect(v.playing).toBe(false)
  })

  it('should loop within its range', () => {
    var el = fakeElement()
    var v = new Video({ src: 'a.mp4', element: el, start: 1, end: 2, loop: true })
    v.play()
    el.currentTime = 2.1
    v.update()
    expect(el.currentTime).toEqual(1)
    expect(v.playing).toBe(true)
  })

  it('should step backwards when reversed, without calling play', () => {
    var el = fakeElement()
    var now = 1000
    spyOn(Date, 'now').and.callFake(() => now)
    var v = new Video({ src: 'a.mp4', element: el, start: 5, end: 1, reverse: true })
    v.play()
    expect(el.play).not.toHaveBeenCalled()
    now = 2000
    v.update()
    expect(el.currentTime).toEqual(4)
    now = 6000
    v.update()
    expect(el.currentTime).toEqual(1)
    expect(v.playing).toBe(false)
  })

  it('should draw its frame at its position when ready', () => {
    var el = fakeElement()
    var context = new ContextMock2D()
    var v = new Video({ src: 'a.mp4', element: el, x: 10, y: 20 })
    v.draw(context)
    expect(context.translate).toHaveBeenCalledWith(10, 20)
    expect(context.drawImage).toHaveBeenCalledWith(el, 0, 0, 320, 240)
  })

  it('should not draw before a frame is available', () => {
    var el = fakeElement()
    el.readyState = 1
    var context = new ContextMock2D()
    new Video({ src: 'a.mp4', element: el }).draw(context)
    expect(context.drawImage).not.toHaveBeenCalled()
  })
})
