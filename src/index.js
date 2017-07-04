'use strict'

const fs = require('fs-extra')
const path = require('path')
const config = require('nconf')

const SRCDIR = __dirname
const ROOTDIR = path.join(SRCDIR, '..')
const DATADIR = path.join(ROOTDIR, 'data')

global.Util = require('./util')
global.Client = require('./bot')

const log = Util.logger

try {
  let stats = fs.statSync(path.join(DATADIR, 'config.json'))
  if (!stats.isFile()) throw new Error()
  log.verbose('discovered pre-existing config, will load that')
} catch (e) {
  try {
    fs.copySync(path.join(ROOTDIR, 'config.default.json'), path.join(DATADIR, 'config.json'))
    log.info('copied default config')
  } catch (e2) {
    log.error('Failed to copy config defaults')
    log.error(e2.stack)
    throw e2
  }
}

config.argv().env().file({ file: path.join(DATADIR, 'config.json') })
log.info('config good, loaded')

// util setup
Object.defineProperty(Util, 'SRCDIR', { value: SRCDIR, enumerable: true })
Object.defineProperty(Util, 'ROOTDIR', { value: ROOTDIR, enumerable: true })
Object.defineProperty(Util, 'DATADIR', { value: DATADIR, enumerable: true })
Util.configKey = (g, m) => { return `modules:${g.id}:${m.name}:` }

// bot setup
global.Bot = new Client.IotaClient(config)
Bot.app = require('../package.json')
Bot.log = log

// module registration
const mods = fs.readdirSync(path.join(SRCDIR, 'modules'))
for (const mod of mods) Bot.registerModule(path.basename(mod, '.js'))

// misc
process.on('SIGINT', () => {
  console.log()
  log.info('got interrupt, signing off...\n')
  Bot.destroy()
})
Bot.on('warn', msg => { log.warn(msg) })
Bot.saveConfig = () => {
  log.verbose('attempting to save config')
  config.save(err => { if (err) log.error(err.stack) })
}

// finally, log in
let token = config.get('token') || ''
if (!token || !token.match(/^[A-Z0-9_-]{24}\.[A-Z0-9_-]{6}\.[A-Z0-9_-]{27}$/i)) {
  log.error('Token does not match format')
} else {
  Bot.login(token)
}
