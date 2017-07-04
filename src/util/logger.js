'use strict'

const winston = require('winston')

exports = module.exports = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: 'verbose',
      colorize: true
    })
    // TODO File logs?
  ]
})
