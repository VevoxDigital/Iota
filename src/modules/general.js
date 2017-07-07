'use strct'

const _ = require('lodash')
const discord = require('discord.js')

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
    super([ /^who(?: are you)?\??/i, /^introduce yourself$/i ])

    this.usage = 'who (are you)?'
    this.desc = 'Explains who she is'
  }

  handle (msg) {
    return new discord.RichEmbed()
      .setColor(0x00AACC)
      .setThumbnail(Bot.user.avatarURL)
      .setFooter(`${Bot.app.description}`)
      .setURL('https://github.com/VevoxDigital/Iota')
      .setTitle('Hello; my name is Iota')
      .setDescription(
        'I am a personality construct designed and developed by Maya to help assist ' +
        'personnel in everyday activites. Is there anything I can do for you?\n\n' +
        ' - *[Iota Personality Construct](http://wiki.vevox.io/info/som/people/iota), Shadows of Maya*')
      .addField('Author', 'CynicalBusiness#2916', true)
      .addField('NodeJS', process.version, true)
      .addField('App', `\`${Bot.app.name}@${Bot.app.version}\``, true)
      .addField('Modules', _.map(Bot._modules, 'name').join(', '))
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

class DebugCommand extends Client.Command {
  constructor () {
    // TODO Output debug help if no sub-command specified
    super([ /^debug errors?$/ ])

    this.usage = 'debug'
    this.desc = 'Helps to debug Iota'
  }

  handle (msg, match, i) {
    switch (i) {
      case 0:
        throw new Error('This is a debug error')
    }
  }
}

class RollCommand extends Client.Command {
  constructor () {
    super([ /^roll ([d\d+-]+)$/i, /^roll (\d+)$/i ])

    this.usage = 'roll <dice>'
    this.desc = 'Rolls a dice or a set of dice'
  }

  /* eslint complexity: [1, 8] */
  handle (msg, match, i) {
    if (i === 0) {
      let expression = ''
      let sum = 0

      const pattern = /([+-]?)(d?)(\d+)/g

      let r
      while ((r = pattern.exec(match[1])) !== null) {
        const mp = r[1] === '-' ? -1 : 1
        const num = Number.parseInt(r[3], 10)

        const val = r[2] ? Math.floor(Math.random() * num) + 1 : num

        sum += (mp * val)
        expression += ` ${r[1] || '+'} ${(r[2] ? `${val}{d${num}}` : num)}`
      }

      expression += ' = ' + sum
      return expression.substring(3)
    } else if (i === 1) return this.handle(msg, [ match[0], 'd' + match[1] ], 0)
  }
}

exports = module.exports = class GeneralModule extends Client.Module {
  constructor () {
    super('general', [
      new PingCommand(),
      new InfoCommand(),
      new HelpCommand(),
      new DebugCommand(),
      new RollCommand()
    ])

    this.displayName = 'General'
  }
}
