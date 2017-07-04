'use strict'

const _ = require('lodash')
const q = require('q')
const discord = require('discord.js')
const yt = require('ytdl-core')
const ytSearch = require('youtube-search')

// TODO Playlists
const queue = { }
let dispatcher

class PlayCommand extends Client.Command {
  constructor () {
    super(/^(?:play|queue) (.+)$/i)

    this.usage = 'play|queue <url|query>'
    this.desc = 'Queues a URL or the first result of a query'
  }

  handle (msg, args) {
    if (args[1].match(/^https?/i)) {
      msg.channel.send('Just a moment...')

      // given a url, look up info and queue it
      return this.fetchVideoInfo(args[1]).then(info => {
        return this.queue(msg, info)
      })
    } else {
      // search key, need to fetch a url
      args.shift()
      return this.search(msg, args.join(' '))
    }
  }

  search (msg, query) {
    const deferred = q.defer()

    ytSearch(query, {
      key: Bot.config.get('youtube:key'),
      maxResults: 1,
      type: 'video'
    }, (err, result) => {
      if (err) return deferred.reject(err)

      result = result.pop()
      deferred.resolve(this.handle(msg, [ 'play', result.link ]))
    })

    return deferred.promise
  }

  fetchVideoInfo (url) {
    const deferred = q.defer()

    yt.getInfo(url, (err, info) => {
      if (err) return deferred.reject(err)
      info.link = url
      info.url = 'https://www.youtube.com/watch?v=' + info.video_id
      info.length = Number.parseInt(info.length_seconds, 10)
      deferred.resolve(info)
    })

    return deferred.promise
  }

  getVoiceConnectionFor (id, target) {
    if (queue[id].connection) return q(queue[id].connection)

    return q(target.join())
  }

  queue (msg, info) {
    const id = msg.channel.guild.id
    const maxLength = Bot.config.get('youtube:maxLength') || 600

    if (info.length > maxLength) return `That song is too long (${info.length} seconds!), maximum length is ${maxLength} seconds`

    queue[id] = queue[id] || [ ]
    queue[id].push({ msg: msg, info: info })
    this.playNext(msg)
    return Bot.ack()
  }

  playNext (msg) {
    if (dispatcher) return // something is already playing

    const id = msg.channel.guild.id
    this.getVoiceConnectionFor(id, this.getTargetChannel(msg)).then(connection => {
      queue[id].connection = connection

      // we either just joined or are still here
      // either way, we are not playing and should either leave or start doing so
      if (queue[id].length) {
        // we have something to play
        const next = queue[id][0]

        let stream = yt(next.info.url, { filter: 'audioonly' })
        dispatcher = connection.playStream(stream)
        dispatcher.setVolume(0.1)

        dispatcher.on('error', e => {
          Bot.sendError(msg, e, 'Audio', 'Play')
        })

        dispatcher.on('end', reason => {
          if (reason) Bot.log.verbose('Voice connection ended. Reason: ' + reason)
          dispatcher = undefined
          if (queue[id].length) this.playNext(queue[id].shift().msg)
        })
      } else {
        // leave if there are no songs left in queue
        dispatcher = undefined
        connection.disconnect()
        delete queue[id].connection
      }
    })
  }

  getTargetChannel (msg) {
    let channel

    _.each(msg.guild.channels.array(), ch => {
      if (ch.type !== 'voice') return

      _.each(ch.members.array(), member => {
        if (member.id === msg.author.id) channel = ch
      })
    })

    return channel
  }
}

class PlayingCommand extends Client.Command {
  constructor () {
    super(/^(?:what'?s )?playing\??$/i)

    this.usage = 'what\'s playing?'
    this.desc = 'Shows the current song'
  }

  handle (msg) {
    const song = (queue[msg.channel.guild.id] || [ ])[0]
    if (song) {
      const info = song.info
      return new discord.RichEmbed()
        .setTitle(info.title)
        .setDescription(info.description.length > 200 ? info.description.substring(0, 200) + '...' : info.description)
        .setThumbnail(info.thumbnail_url)
        .setURL(info.url)
        .setFooter('Video ID: ' + info.video_id)
        .setColor(0xE67E22)
        .addField('Author', info.author.name, true)
        .addField('Duration', new Date(info.length * 1000).toISOString().slice(11, 19), true)
        .addField('Added By', `<@!${song.msg.author.id}>`, true)
    } else return 'I am not currently playing anything'
  }
}

class QueueCommand extends Client.Command {
  constructor () {
    super(/^(?:what'?s )?queued?\??$/i)

    this.usage = 'what\'s queued?'
    this.desc = 'Shows what\'s queued'
  }

  handle (msg) {
    const qu = queue[msg.channel.guild.id] || [ ]
    if (qu.length) {
      const embed = new discord.RichEmbed()
        .setColor(0x95A5A6)
        .addField('Now Playing', `[${qu[0].info.title}](${qu[0].info.url})`)

      let queueStr = ''
      _.each(qu.slice(1), item => {
        queueStr += `\n * [${item.info.title}](${item.info.url})`
      })
      embed.addField('Next Up', queueStr.trim() || 'There are no other songs in queue')
        .addField('Playlist', 'No active playlist') // TODO Playlists

      return embed
    } else return 'There is nothing in queue.'
  }
}

class SkipCommand extends Client.Command {
  constructor () {
    super([ /^force skip$/i, /^skip$/i ])

    this.usage = '(force) skip'
    this.desc = 'Skips the current song (force skip is Admin only)'
  }

  handle (msg, match, i, override) {
    return i === 0 ? this.skip(msg) : this.voteskip(msg)
  }

  skip (msg, override) {
    if (!Util.user.isAdmin(msg.author, msg.channel.guild) && !override) return 'I\'m sorry, but you cannot do that.'
    if (dispatcher) {
      dispatcher.end('skipped')
      return Bot.ack() + (queue[msg.channel.guild.id].length ? '' : ' No songs left in queue.')
    } else return 'I\'m not playing anything.'
  }

  voteskip (msg) {
    const song = queue[msg.channel.guild.id][0]
    if (song.msg.author.id === msg.author.id) return this.skip(msg, true)

    song.skipVotes = song.skipVotes || [ ]
    if (song.skipVotes.includes(msg.author.id)) return 'You already voted to skip this song.'
    song.skipVotes.push(msg.author.id)

    const connection = queue[msg.channel.guild.id].connection
    const members = connection.channel.members.array().map(u => { return u.id })

    // make sure people haven't voted then left.
    song.skipVotes = song.skipVotes.filter(u => {
      return members.includes(u)
    })

    // figure out how many votes we need
    members.splice(members.indexOf(Bot.id, 1))
    if (song.skipVotes.length > members.length / 2) return this.skip(msg, true)
    else {
      let needed = Math.ceil(members.length / 2)
      if (needed === members.length / 2) needed++
      return `Voted. **${song.skipVotes.length}** of **${needed}** needed to skip.`
    }
  }
}

class StopCommand extends Client.Command {
  constructor () {
    super(/^stop(?: playing)?$/i)

    this.usage = 'stop playing'
    this.desc = 'Stops playing all songs (Admin)'
  }

  handle (msg) {
    if (!Util.user.isAdmin(msg.author, msg.channel.guild)) return 'I\'m sorry, but you cannot do that.'
    if (dispatcher) {
      const id = msg.channel.guild.id
      queue[id].splice(0, queue[id])
      dispatcher.end('stopped')
      return Bot.ack() + ' Stopped playing all songs.'
    } else return 'I\'m not playing anything.'
  }
}

exports = module.exports = class AudioModule extends Client.Module {
  constructor () {
    super('audio', [
      new PlayCommand(),
      new PlayingCommand(),
      new QueueCommand(),
      new SkipCommand(),
      new StopCommand()
    ])

    this.displayName = 'Audio'
  }
}
