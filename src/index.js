'use strict'

const fs = require('fs')
const path = require('path')
const config = require('nconf')

const SRCDIR = __dirname
const ROOTDIR = path.join(SRCDIR, '..')

global.Utils = require('./utils')
global.Client = require('./bot')

try {
  let stats = fs.statSync(path.join(ROOTDIR, 'config.json'))
  if (!stats.isFile()) throw new Error()
} catch (e) {
  try {
    fs.copySync(path.join(ROOTDIR, 'config.default.json'), path.join(ROOTDIR, 'config.json'))
  } catch (e2) {
    console.error('Failed to copy config defaults')
    console.error(e.stack)
  }
}

config.argv().env().file({ file: path.join(ROOTDIR, 'config.json') })

global.Bot = new Client.IotaClient(config)

Bot.saveConfig = () => {
  config.save(err => {
    if (err) console.error(err.stack)
  })
}

// Start registering commands here

Bot.registerModule('general')

// Login stuff

let token = config.get('token') || ''

if (!token || !token.match(/^[A-Z0-9]{24}\.[A-Z0-9]{6}\.[A-Z0-9]{27}$/i)) {
  console.error('Token does not match format')
} else {
  Bot.login(token)
}
