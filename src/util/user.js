'use strict'

const config = require('nconf')

/**
  * @function
  * Checks if a user is an admin, optionally including a specified guild
  *
  * @param {User} user The user
  * @param {Guild} guild The guild
  * @return {boolean} If the user is mod or not
  */
exports.isAdmin = (user, guild) => {
  let mods = config.get('admins') || []
  if (guild) mods = mods.concat((Util.configKey(guild.id, 'admin') + 'admins') || [])

  return mods.indexOf(user.id) >= 0
}
