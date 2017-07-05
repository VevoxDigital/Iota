'use strict'

const q = require('q')
const ytSearch = require('youtube-search')
const yt = require('ytdl-core')

/**
  * @function
  * Fetches the info for the specified URL
  *
  * @param {string} url The url to fetch info for
  * @return {Promise<object>} The video information
  */
exports.info = url => {
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

/**
  * @function
  * Searches for a video by query and returns the URL of the first result.
  *
  * @param {string} query The query
  * @return {Promise<string>} The result URL
  */
exports.search = query => {
  const deferred = q.defer()

  if (!Bot.config.get('youtube:key')) {
    return deferred.reject('No YouTube API key was specified by this instance\'s owner.')
  }

  ytSearch(query, {
    key: Bot.config.get('youtube:key'),
    maxResults: 1,
    type: 'video'
  }, (err, result) => {
    if (err) return deferred.reject(err)
    result = result.pop()
    deferred.resolve(result.link)
  })

  return deferred.promise
}

/**
  * @function
  * Searches for a video by query and returns its info.
  * Convienience for calling #search followed by #info
  *
  * @param {string} query The query
  * @return {Promise<object>} The result video info
  */
exports.searchInfo = query => {
  return exports.search(query).then(exports.info)
}

/**
  * @function
  * Attempts to get info, searching for the video if the query is not a URL
  *
  * @param {string} query The query
  * @return {Promise<object>} The video info
  */
exports.infoFromUnknown = query => {
  return query.match(/^https:\/\/(?:www\.youtube\.com|youtu\.be)/i) ? exports.info(query) : exports.searchInfo(query)
}
