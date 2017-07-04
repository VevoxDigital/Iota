'use strict'

const discord = require('discord.js')
const path = require('path')
const _ = require('lodash')
const q = require('q')

const assert = require('assert')

const app = require('../package.json')

/**
  * @class IotaClient
  * A client class for Iota
  *
  * @author Matthew Struble
  */
class IotaClient extends discord.Client {

  /**
    * @constructor
    * Constructs a new IotaClient
    *
    * @param {object} config Client configuration
    */
  constructor (config) {
    super()

    this.once('ready', () => {
      Object.defineProperty(this, 'id', { value: this.user.id })
      Object.defineProperty(this, 'prefix', { value: config.get('commands:prefix') || app.productName })
    })
    this.on('message', msg => {
      let match = msg.content.match(new RegExp(`^<@!?${this.id}>[,:;]? `)) ||
        msg.content.match(new RegExp(`^${this.prefix}[,:;]? `, 'i'))
      if (match) {
        msg.content = msg.content.substring(match[0].length).trim()
        this.send(msg)
      }
    })

    Object.defineProperty(this, 'config', { value: config })
    Object.defineProperty(this, '_modules', { value: [ ], writeable: true })
  }

  /**
    * @method
    * Sends a message to the bot to handle.
    *
    * @param {string} msg The message
    * @return IotaClient
    */
  send (msg) {
    let promises = [ ]

    _.each(this._modules, m => {
      promises = promises.concat(m._deligate(msg))
    })

    q.allSettled(promises).then(results => {
      if (results.length) {
        let messages = [ ]

        _.each(results, res => {
          if (res.state === 'fulfilled') {
            if (res.value) messages.push(res.value)
          } else {
            const e = res.reason

            const modName = e.module ? e.module.constructor.name : 'UnknownModule'
            const cmdName = e.command ? e.command.constructor.name : 'UnknownCommand'

            this.sendError(msg, e.error || new Error('Internal Server Error'), cmdName, modName)
            messages.push('')
          }
        })

        if (messages.length) _.each(messages, m => { if (m) msg.channel.send(m instanceof discord.RichEmbed ? { embed: m } : m) })
        else msg.channel.send(this.ack())
      } else {
        msg.channel.send('I\'m not sure how to do that.')
      }
    }).catch(e => {
      this.sendError(msg, e)
    }).done()
  }

  sendError (msg, e, cmdName, modName) {
    Bot.log.error(modName, cmdName, e)
    const error = new discord.RichEmbed()
      .setTitle('Internal error encountered during task execution')
      .setColor(0xE74C3C)
      .setFooter(`${app.name}@${app.version}`)
      .addField('Type', e.constructor.name, true)

    if (cmdName && modName) {
      error.addField('Source', `${modName.substring(0, modName.length - 6)}.${cmdName.substring(0, cmdName.length - 7)}`, true)
    }

    error.addField('Message', '```' + e.message + '```')
      .addField('Stack Trace', '```' + e.stack + '```')
    msg.channel.send({ embed: error })
    return ''
  }

  /**
    * @method
    * Gets a generic acknowledgement
    *
    * @return {string} An acknowledgement
    */
  ack () {
    let acks = this.config.get('commands:acknowledgements') || [ '...' ]
    return acks[Math.floor(Math.random() * acks.length)]
  }

  /**
    * @method registerModule
    * Registers a local module (i.e. one  located in /src/modules) with the client.
    *
    * @param name The module name
    * @return IotaClient
    */
  registerModule (name) {
    assert.ok(name, 'Name should not be empty') // Still need an empty check here

    return this.registerNpmModule(path.join(Util.SRCDIR, 'modules', name))
  }

  /**
    * @method registerNpmModule
    * Registers a module from npm (i.e. /node_modules) with the client.
    *
    * @param name The module name
    * @return IotaClient
    */
  registerNpmModule (name) {
    assert.strictEqual(typeof name, 'string', 'Name must be a string')
    assert.ok(name, 'Name should not be empty')

    // let any errors occur and be handled by the caller
    let M = require(name) // eslint-disable-line global-require
    let mod = new M()
    if (!(mod instanceof Module) || !mod.name) throw new Error('Not valid module')
    this._modules.push(mod)

    Bot.log.info(` * loaded: ${mod.name}`)

    return this
  }

}
exports.IotaClient = IotaClient

/**
  * @class Command
  * A command which can be handled by the bot
  *
  * @author Matthew Struble
  */
class Command {
  /**
    * @constructor
    * Constructs a new command with the given input RegExp patterns
    *
    * @param patterns An array of RegExps (or a single one) to use as input
    */
  constructor (patterns) {
    assert.ok(patterns, 'Must specify command patterns')

    if (!(patterns instanceof Array)) patterns = [ patterns ]

    if (!_.every(patterns, p => { return p instanceof RegExp })) {
      throw new Error('Patterns list is not acceptable')
    }

    Object.defineProperty(this, '_patterns', { value: patterns })
  }

  /**
    * @method handle
    * Handles the incoming arguments. Should be overridden
    *
    * @param msg    The message object used to issue the command
    * @param index  The index of the pattern that matched
    * @param args   The args from capture group(s) in the input patterns
    */
  handle (msg, args, index) {
    return 'I understand what you\'re asking, but I don\'t know how to do it.'
  }
}
exports.Command = Command

/**
  * @class Module
  * A command module for Iota
  *
  * @author Matthew Struble
  */
class Module {
  /**
    * @constructor
    * Constructs a new module with the given commands
    *
    * @param {string} name     The module's internal name
    * @param {Array}  commands The commands to register
    */
  constructor (name, cmds) {
    assert.strictEqual(typeof name, 'string')
    assert.ok(cmds instanceof Array, 'Commands list must be an array')

    if (!_.every(cmds, p => { return p instanceof Command })) {
      throw new Error('Commands list is not acceptable')
    }

    Object.defineProperty(this, 'name', { value: name, enumerable: true })
    Object.defineProperty(this, '_commands', { value: cmds })
  }

  _deligate (msg) {
    let promises = [ ]

    _.each(this._commands, c => {
      _.each(c._patterns, (p, i) => {
        let match = msg.content.match(p)
        if (match) {
          promises.push((() => {
            const deferred = q.defer()

            try {
              q(c.handle(msg, match, i)).then(res => {
                deferred.resolve(res)
              }).catch(e => {
                deferred.reject({ module: this, command: c, error: e })
              }).done()
            } catch (e) {
              deferred.reject({ module: this, command: c, error: e })
            }

            return deferred.promise
          })())
        }
      })
    })

    return promises
  }
}
exports.Module = Module
