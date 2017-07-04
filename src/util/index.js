'use strict'
// reads directory contents and exports them

const fs = require('fs')
const path = require('path')
const files = fs.readdirSync(path.join('./', 'src', 'util'))
files.splice(files.indexOf('index.js'), 1)

for (const file of files) {
  /* eslint global-require: 0 */
  exports[path.basename(file, '.js')] = require('./' + file)
}
