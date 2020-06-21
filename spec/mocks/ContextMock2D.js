module.exports = class ContextMock2D {
  constructor () {
    spyOn(this, 'save')
    spyOn(this, 'translate')
    spyOn(this, 'scale')
    spyOn(this, 'rotate')
    spyOn(this, 'drawImage')
    spyOn(this, 'restore')
  }

  save () {}
  translate () {}
  scale () {}
  rotate () {}
  drawImage () {}
  restore () {}
}
