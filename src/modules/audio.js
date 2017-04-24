'use strict'

const _ = require('lodash')
const https = require('https')
const url = require('url')

let queueStack
let playlistStack

const apiURL = 'https://www.googleapis.com/youtube/v3/'
function fetchYT (route, opts) {
  return new Promise((resolve, reject) => {
    let u = new url.URL(apiURL + route)
    u.query = opts
    https.get(url.format(u), res => {

    })
  })
}

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

class PlayCommand extends Client.Command {
  constructor () {
    super(/^play (.+)$/i)

    this.usage = 'play <url|query>'
    this.desc = 'Queues a URL or the first result of a query'
  }

  handle (msg, args) {
    if (args[1].match(/^https?/i)) {
      // given a url, look up info and queue it

    } else {
      // search key, need to fetch a url

    }
  }
}

exports = module.exports = class AudioModule extends Client.Module {
  constructor () {
    super('audio', [
      new SummonCommand(),
      new PlayCommand()
    ])

    this.displayName = 'Audio'
  }
}
