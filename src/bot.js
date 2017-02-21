'use strict'

const discord = require('discord.js')
const path = require('path')
const _ = require('lodash')

const assert = require('assert')

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
    */
  constructor (config) {
    super()

    this.once('ready', () => {
      Object.defineProperty(this, 'id', { value: this.user.id })
    })
    this.on('message', msg => {
      let match = msg.content.match(new RegExp(`^<@${this.id}>[,:;]? `))
      if (match) {
        msg.content = msg.content.substring(match[0].length).trim()
        this.send(msg)
      }
    })

    Object.defineProperty(this, 'config', { value: config })
    Object.defineProperty(this, '_modules', { value: [ ], writeable: true })
  }

  /**
    * @method send
    * Sends a message to the bot to handle.
    *
    * @param msg The message
    * @return IotaClient
    */
  send (msg) {
    _.each(this._modules, m => {
      m._deligate(msg)
    })

    return this
  }

  /**
    * @method ack
    * Gets a generic acknowledgement
    *
    * @return string An acknowledgement
    */
  ack () {
    let acks = this.config.get('commands:acknowledgements')
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

    return this.registerNpmModule(path.join(Utils.src, 'modules', name))
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

    console.log(` * loaded: ${mod.name}`)

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
    * @param name     The module's internal name
    * @param commands The commands to register
    */
  constructor (name, cmds) {
    assert.ok(cmds instanceof Array, 'Commands list must be an array')

    if (!_.every(cmds, p => { return p instanceof Command })) {
      throw new Error('Commands list is not acceptable')
    }

    Object.defineProperty(this, 'name', { value: name, enumerable: true })
    Object.defineProperty(this, '_commands', { value: cmds })
  }

  _deligate (msg) {
    _.each(this._commands, c => {
      _.each(c._patterns, (p, i) => {
        let match = msg.content.match(p)
        if (match) {
          try {
            let res = c.handle(msg, match, i)
            if (res) msg.channel.sendMessage(res)
            else if (typeof res === 'string') msg.channel.sendMessage(this.ack())
          } catch (e) {
            msg.channel.sendMessage('I cannot complete this task.')
            msg.channel.sendCode(e.stack)
          }
        }
      })
    })
  }
}
exports.Module = Module
