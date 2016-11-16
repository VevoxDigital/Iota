'use strict';

const discord = require('discord.js'),
      fs      = require('fs-extra'),
      path    = require('path'),
      config  = require('nconf');

global.SRCDIR  = __dirname;
global.ROOTDIR = path.join(SRCDIR, '..');

config.argv().env().file({ file: path.join(ROOTDIR, 'config.json') });

global.Bot = new discord.Client();

Bot.on('ready', () => {
  console.log('Bot ready');
});

Bot.on('message', msg => {
  let pattern = new RegExp(`^(?:${config.get('prefix')}|<@${config.get('clientID')}>)[,:;]? `, 'i'),
    match = msg.content.match(pattern);

  if (!match) return;

  let cmd = msg.content.substring(match.index + match[0].length);
  console.log(' > ' + cmd);
});

fs.readFile(path.join(ROOTDIR, '.token'), (err, token) => {

  if (err) return console.error(err.stack);

  token = token ? token.toString().trim() : '';

  if (!token || !token.match(/^[A-Z0-9]{24}\.[A-Z0-9]{6}\.[A-Z0-9]{27}$/i))
    return console.error('Token does not match format');

  Bot.login(token);

});
