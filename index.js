module.exports = {
  // Primitives
  Logger: require('./lib/Logger'),
  Mixin: require('./lib/Mixin'),
  Asset: require('./lib/Asset'),
  AssetCache: require('./lib/AssetCache'),
  Sheet: require('./lib/Sheet'),
  Input: require('./lib/Input'),
  Audio: require('./lib/Audio'),
  SoundManager: require('./lib/SoundManager'),

  // Point-and-click
  Hotspots: require('./lib/Hotspots'),
  Cursor: require('./lib/Cursor'),

  // Game Engine
  GameEngine: require('./lib/GameEngine'),

  // Mixins
  HasEntitiesMixin: require('./lib/HasEntitiesMixin'),
  HasScenesMixin: require('./lib/HasScenesMixin'),

  // Entities
  Entity: require('./lib/Entity'),
  Video: require('./lib/Video'),

  // Scenes
  Scene: require('./lib/Scene'),
  BackgroundScene: require('./lib/BackgroundScene'),
  BufferedScene: require('./lib/BufferedScene'),
  TiledScene: require('./lib/TiledScene')
}
