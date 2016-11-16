'use strict';

const fs    = require('fs-extra'),
      path  = require('path');

const MODULES_DIR = path.join(__dirname, 'modules');

var modules = [];
fs.walk(MODULES_DIR)
  .on('data', item => {
    if (!item.stats.isDirectory())
      modules.push(require(item.path));
  }).on('end', () => {

    console.log(`loading ${modules.length} module(s)...`);

    modules.forEach(mod => {

      console.log(' > ' + mod.name + ' - ' + mod.desc);

      // TODO Set up docs/readme for module.
      mod.install();

    });

  });
