'use strict'

const _ = require('lodash')

class SummonCommand extends Client.Command {
  constructor () {
    super(/^come here$/i)

    this.usage = 'come here'
    this.desc = 'Joins the voice channel you\'re in.'
  }

  handle (msg) {
    let channel
    _.each(msg.guild.channels.array(), ch => {
      if (ch.type !== 'voice') return

      _.each(ch.members.array(), member => {
        if (member.id === msg.author.id) channel = ch
      })
    })

    if (channel) {
      channel.join()
      return ''
    } else return 'You don\'t appear to be in a channel.'
  }
}

exports = module.exports = class AudioModule extends Client.Module {
  constructor () {
    super('audio', [
      new SummonCommand()
    ])

    this.displayName = 'Audio'
  }
}
