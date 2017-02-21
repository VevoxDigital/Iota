'use strct'

const _ = require('lodash')

class PingCommand extends Client.Command {
  constructor () {
    super(/^ping$/i)

    this.usage = 'ping'
    this.desc = 'Pong.'
  }

  handle (msg) {
    return 'Pong!'
  }
}

class InfoCommand extends Client.Command {
  constructor () {
    super(/^who (?:are you)?\??/i)

    this.usage = 'who (are you)?'
    this.desc = 'Explains who she is'
  }

  handle (msg) {
    msg.channel.sendMessage(
      '"*Hello: my name is Iota. ' +
      'I am a personality construct designed and developed by Maya to help assist personnel in ' +
      'everyday activites. Is there anything I can do for you?*"')
    return '- Iota Personality Construct, Shadows Of Maya :: <http://wiki.vevox.io/lore/som/iota>'
  }
}

class HelpCommand extends Client.Command {
  constructor () {
    super(/^help$/)

    this.usage = 'help'
    this.desc = 'Shows this help'
  }

  handle (msg) {
    let helpMessage = ''

    _.each(Bot._modules, mod => {
      let longest = 0

      // find the longest first
      _.each(mod._commands, c => {
        if (c.usage && longest < c.usage.length) longest = c.usage.length
      })

      let moduleHelp = mod.displayName || mod.name

      _.each(mod._commands, c => {
        if (!c.usage) return
        let usage = c.usage
        while (usage.length < longest) usage += ' '

        moduleHelp += `\n   ${usage} - ${c.desc || 'No description.'}`
      })

      helpMessage += '```\n' + moduleHelp + '\n```'
    })

    msg.author.send(helpMessage)

    return 'I have messaged some information to you.'
  }
}

exports = module.exports = class GeneralModule extends Client.Module {
  constructor () {
    super('general', [
      new PingCommand(),
      new InfoCommand(),
      new HelpCommand()
    ])

    this.displayName = 'General'
  }
}
