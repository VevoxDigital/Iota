'use strict'

const path = require('path')
const config = require('nconf')

Object.defineProperty(exports, 'root', { value: path.join(__dirname, '..') })
Object.defineProperty(exports, 'src', { value: __dirname })

/**
  * @function configKey
  * Gets the config key for the specified guild and module
  *
  * @return string The config key
  */
exports.configKey = function (guild, module) {
  return `modules:${guild.id}:${module.name}:`
}

/**
  * @function isAdmin
  * Checks if a user is an admin, optionally including a specified guild
  *
  * @param user   The user
  * @param guild  The guild
  * @return boolean If the user is mod or not
  */
exports.isAdmin = function (user, guild) {
  let mods = config.get('admins') || []
  if (guild) mods = mods.concat((exports.configKey(guild.id, 'admin') + 'admins') || [])

  return mods.indexOf(user.id) >= 0
}
