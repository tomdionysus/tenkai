#!/usr/local/bin/node

const path = require('path')
const Logger = require(path.join(__dirname, '../lib/Logger'))
const fs = require('fs')

var logger = new Logger({ logLevel: 'info' })

function main () {
  logger.info('Starting')

  loadFiles(path.join(__dirname, '../lib'), '', '../spec')
}

function loadFiles (pth, bs = '', target) {
  var files = fs.readdirSync(pth)
  for (var f in files) {
    var filename = path.join(pth, files[f])
    var shortname = path.join(bs, files[f])
    var specname = path.join(__dirname, target, shortname)
    var d = fs.statSync(filename)
    if (d.isFile() && files[f].substr(files[f].length - 3, 3) == '.js') {
      logger.info('Processing ' + shortname)
      specname = path.join(path.dirname(specname), path.basename(specname, '.js') + '_spec.js')
      if (!fs.existsSync(specname)) {
        logger.info('Creating ' + specname)
        var klName = path.basename(files[f], '.js')
        var requirePath = path.relative(path.dirname(specname), filename.slice(0, -3)).split(path.sep).join('/')
        fs.writeFileSync(specname, 'const ' + klName + ' = require(\'' + requirePath + '\')\n\n')
      }
    } else if (d.isDirectory() && files[f] !== 'jsdoc') {
      // lib/jsdoc holds typedef-only files with nothing to test
      if (!fs.existsSync(specname)) {
        logger.info('Creating Directory ' + specname)
        fs.mkdirSync(specname)
      }
      loadFiles(filename, shortname, target)
    }
  }
}

main()
