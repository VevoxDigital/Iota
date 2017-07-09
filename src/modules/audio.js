'use strict'

const _ = require('lodash')
const q = require('q')
const discord = require('discord.js')
const yt = require('ytdl-core')
const path = require('path')
const fs = require('fs-extra')

const queue = { }
const activePlaylist = { }
let dispatcher

function playNext (msg) {
  if (dispatcher) return // something is already playing

  const id = msg.guild.id

  getVoiceConnectionFor(id, getTargetChannel(msg)).then(connection => {
    queue[id] = queue[id] || [ ]
    queue[id].connection = connection

    // check if Iota is alone, and leave if so
    if (connection.channel.members.array().length <= 1) {
      Bot.log.verbose(id + ': channel appears to be empty, leaving')
      delete queue[id]
      delete activePlaylist[id]
      return playNext(msg)
    }

    // we either just joined or are still here
    // either way, we are not playing and should either leave or start doing so
    if (queue[id].length) {
      Bot.log.verbose(id + ': advancing queue')
      // we have something to play
      const next = queue[id][0]

      let stream = yt(next.info.url, { filter: 'audioonly' })
      dispatcher = connection.playStream(stream, { seek: 0, volume: 0.1 })

      dispatcher.player.on('warn', console.warn)
      dispatcher.on('warn', console.warn)
      dispatcher.on('error', e => {
        Bot.sendError(msg, e, 'Audio', 'Play')
      })

      dispatcher.once('end', reason => {
        Bot.log.verbose(id + ': dispatcher ended, ' + (reason || 'no reason'))
        dispatcher = undefined
        // wait half a second due to a bug is Discord.js, see issue #1387
        if (queue[id].length) setTimeout(() => { playNext(queue[id].shift().msg) }, 500)
      })
    } else if (activePlaylist[id]) {
      Bot.log.verbose(id + ': queue empty, queueing from active playlist')
      const p = activePlaylist[id]
      if (p.currentIndex >= p.playlist.songs.length) {
        Bot.log.verbose(id + ': playlist is done')
        delete activePlaylist[id]
        return playNext(msg)
      }

      Util.youtube.info(p.playlist.songs[p.currentIndex++].url).then(info => {
        const res = addToQueue(msg, info)
        if (res) msg.channel.send(res)
      }).catch(e => {
        Bot.sendError(msg, e, 'playNextCommand', 'AudioModule')
      }).done()
    } else {
      Bot.log.verbose(id + ': queue empty and no active playlist, leaving')
      // leave if there are no songs left in queue
      dispatcher = undefined
      connection.disconnect()
      delete queue[id].connection
    }
  }).catch(e => {
    Bot.sendError(msg, e, 'playNextCommand', 'AudioModule')
  }).done()
}

function getTargetChannel (msg) {
  let channel

  _.each(msg.guild.channels.array(), ch => {
    if (ch.type !== 'voice') return

    _.each(ch.members.array(), member => {
      if (member.id === msg.author.id) channel = ch
    })
  })

  return channel
}

function getVoiceConnectionFor (id, target) {
  if (queue[id] && queue[id].connection) return q(queue[id].connection)

  Bot.log.verbose(id + ': voice connection missing, creating one')
  return q(target.join())
}

function addToQueue (msg, info) {
  const id = msg.channel.guild.id
  const maxLength = Bot.config.get('youtube:maxLength') || 600

  if (info.length > maxLength) return `That song is too long (${info.length} seconds!), maximum length is ${maxLength} seconds`

  queue[id] = queue[id] || [ ]
  queue[id].push({ msg: msg, info: info })
  playNext(msg)
}

class PlayCommand extends Client.Command {
  constructor () {
    super(/^(?:play|queue) (.+)$/i)

    this.usage = 'play|queue <url|query>'
    this.desc = 'Queues a URL or the first result of a query'
  }

  handle (msg, args) {
    msg.channel.send('Just a moment...')
    return Util.youtube.infoFromUnknown(args[1]).then(info => {
      return addToQueue(msg, info)
    })
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
        .setDescription('```' + (info.description.length > 200 ? info.description.substring(0, 200) + '...' : info.description) + '```')
        .setThumbnail(info.thumbnail_url)
        .setURL(info.url)
        .setFooter('Video ID: ' + info.video_id)
        .setColor(0xE67E22)
        .addField('Author', info.author.name, true)
        .addField('Added By', `<@${song.msg.author.id}>`, true)
        .addField('Duration', new Date(info.length * 1000).toISOString().slice(11, 19), true)
        .addField('Playing For', new Date(dispatcher.time * 1000).toISOString().slice(11, 19), true)
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
        .addField('Playlist', activePlaylist[msg.guild.id]
          ? `\`${activePlaylist[msg.guild.id].title}\` by <@${activePlaylist[msg.guild.id].playlist.owner}>`
          : 'No active playlist')

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
      return Bot.ack() + (queue[msg.guild.id].length || activePlaylist[msg.guild.id] ? '' : ' No songs left in queue.')
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
      delete activePlaylist[id]
      dispatcher.end('stopped')
      return Bot.ack() + ' Stopped playing all songs.'
    } else return 'I\'m not playing anything.'
  }
}

class PlaylistCommand extends Client.Command {
  constructor () {
    super([
      /^(create|delete) playlist (\S+)$/i,
      /^update playlist ([a-z0-9_-]+) (\S+) (.+)$/i,
      /^start playlist ([a-z0-9_-]+)$/i,
      /^shuffle playlist ([a-z0-9_-]+)$/i,
      /^list playlists?$/i,
      /^view playlist ([a-z0-9_-]+)$/i
    ])

    this.usage = '[create|delete|update] playlist [playlist] <with...>'
    this.desc = 'Manages playlists'
  }

  /* eslint complexity: [1, 8] */
  handle (msg, args, i) {
    switch (i) {
      case 0: return args[1] === 'create' ? this.create(msg, args) : this.delete(msg, args)
      case 1: return this.update(msg, args)
      case 2: return this.start(msg, args)
      case 3: return this.shuffle(msg, args)
      case 4: return this.list(msg)
      case 5: return this.view(msg, args)
    }
  }

  getAllPlaylists () {
    try {
      /* eslint global-require: 0 */
      return require(path.join(Util.DATADIR, 'playlist.json'))
    } catch (e) {
      return { }
    }
  }

  getPlaylists (id) {
    const playlists = this.getAllPlaylists()
    playlists[id] = playlists[id] || { }
    return playlists[id]
  }

  saveAllPlaylists (playlists) {
    fs.writeFileSync(path.join(Util.DATADIR, 'playlist.json'), JSON.stringify(playlists))
  }

  savePlaylists (id, playlists) {
    const pl = this.getAllPlaylists()
    pl[id] = playlists
    this.saveAllPlaylists(pl)
  }

  // create playlist
  create (msg, args) {
    const pl = this.getPlaylists(msg.guild.id)

    if (pl[args[2].toLowerCase()]) return 'A playlist already exists with that name.'
    pl[args[2].toLowerCase()] = {
      owner: msg.author.id,
      songs: [ ]
    }
    return q(this.savePlaylists(msg.guild.id, pl))
  }

  // delete playlist
  delete (msg, args) {
    const pl = this.getPlaylists(msg.guild.id)

    if (msg.author.id !== pl.owner && !Util.user.isAdmin(msg.author)) return 'You do not own this playlist.'

    if (!pl[args[2].toLowerCase()]) return 'No playlist by that name exists.'
    delete pl[args[2].toLowerCase()]

    return q(this.savePlaylists(msg.guild.id, pl))
  }

  // update a playlist
  update (msg, args) {
    const pls = this.getPlaylists(msg.guild.id)
    const pl = pls[args[1].toLowerCase()]
    if (!pl) return 'No playlist by that name exists.'

    if (msg.author.id !== pl.owner && !Util.user.isAdmin(msg.author)) return 'You do not own this playlist.'

    switch (args[2]) {
      case 'add': return this.updateAdd(msg, args[3], pl, args[1].toLowerCase(), pls)
      case 'remove': return this.updateRemove(msg, args[3], pl, args[1].toLowerCase(), pls)
    }
  }

  // add to a playlist
  updateAdd (msg, item, p, id, pls) {
    msg.channel.send('Just a moment...')
    return Util.youtube.infoFromUnknown(item).then(info => {
      const maxLength = Bot.config.get('youtube:maxLength') || 600
      if (info.length > maxLength) return `That song is too long (${info.length} seconds!), maximum length is ${maxLength} seconds`

      p.songs.push({
        title: info.title,
        url: info.link
      })

      pls[id] = p
      return q(this.savePlaylists(msg.guild.id, pls))
    })
  }

  // remove from a playlist
  updateRemove (msg, i, p, id, pls) {
    const index = Number.parseInt(i, 10)
    if (isNaN(index)) return `'${i}' is not a valid number.`
    i--
    if (i < 0 || i >= p.songs.length) return 'Index is out of bounds.'
    p.songs.splice(i, 1)

    pls[id] = p
    return q(this.savePlaylists(msg.guild.id, pls))
  }

  start (msg, args) {
    const pl = this.getPlaylists(msg.guild.id)[args[1].toLowerCase()]
    if (!pl) return 'No playlist by that name exists.'

    activePlaylist[msg.guild.id] = Object.assign(activePlaylist[msg.guild.id] || { }, { currentIndex: 0, playlist: pl, title: args[1].toLowerCase() })
    playNext(msg)
  }

  shuffle (msg, args) {
    const shuffle = a => {
      for (let i = a.length; i; i--) {
        let j = Math.floor(Math.random() * i)
        let x = a[i - 1]
        a[i - 1] = a[j]
        a[j] = x
      }
    }

    const pl = this.getPlaylists(msg.guild.id)[args[1].toLowerCase()]
    if (!pl) return 'No playlist by that name exists.'

    activePlaylist[msg.guild.id] = Object.assign(activePlaylist[msg.guild.id] || { }, { currentIndex: 0, playlist: pl, title: args[1].toLowerCase() })
    shuffle(activePlaylist[msg.guild.id].playlists.songs)
    playNext(msg)
  }

  // list playlists
  /* eslint complexity: [ 1, 9 ] */
  list (msg) {
    const pl = this.getPlaylists(msg.guild.id)

    // set up the table
    let table = [ [ 'Name', 'Songs', '`Owner`' ] ]
    for (const p in pl) {
      if (!pl.hasOwnProperty(p)) continue
      table.push([ p, '' + pl[p].songs.length, `<@${pl[p].owner}>` ])
    }
    if (table.length <= 1) return 'No playlists on this server.'

    let titleLength = 0
    let songsLength = 0

    // start by getting the spacing correct
    for (const row of table) {
      titleLength = Math.max(row[0].length, titleLength)
      songsLength = Math.max(row[1].length, songsLength)
    }

    let list = ''
    for (const row of table) {
      let titleSpaces = ''
      for (let t = row[0].length; t < titleLength; t++) titleSpaces += ' '
      let songsSpaces = ''
      for (let s = row[1].length; s < songsLength; s++) songsSpaces += ' '

      list += `\n\`${row[0]}${titleSpaces} | ${row[1]}${songsSpaces} |\` ${row[2]}`
    }

    return new discord.RichEmbed()
      .setFooter('Server ID: ' + msg.guild.id)
      .addField(`Server has ${table.length - 1} playlist(s)`, list.trim(), true)
  }

  // view a playlist
  view (msg, args) {
    const pl = this.getPlaylists(msg.guild.id)[args[1].toLowerCase()]
    if (!pl) return 'No playlist by that name exists.'

    let list = ''
    for (let i = 0; i < pl.songs.length; i++) {
      const song = pl.songs[i]
      list += `\n${i + 1}. [${song.title}](${song.url})`
    }

    return new discord.RichEmbed()
      .setTitle(`Playlist "${args[1].toLowerCase()}"`)
      .setFooter('Server ID: ' + msg.guild.id)
      .addField('Owner', `<@${pl.owner}>`, true)
      .addField('Song Count', pl.songs.length, true)
      .addField('Songs', list.trim())
  }
}

exports = module.exports = class AudioModule extends Client.Module {
  constructor () {
    super('audio', [
      new PlayCommand(),
      new PlayingCommand(),
      new QueueCommand(),
      new SkipCommand(),
      new StopCommand(),
      new PlaylistCommand()
    ])

    this.displayName = 'Audio'
  }
}
