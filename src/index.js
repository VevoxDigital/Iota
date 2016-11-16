'use strict';

const discord = require('discord.js'),
      fs      = require('fs-extra'),
      path    = require('path'),
      config  = require('nconf');

global.SRCDIR  = __dirname;
global.ROOTDIR = path.join(SRCDIR, '..');

try {
  let stats = fs.statSync(path.join(ROOTDIR, 'config.json'));
  if (!stats.isFile()) throw new Error();
} catch (e) {
  try {
    fs.copySync(path.join(ROOTDIR, 'config.default.json'), path.join(ROOTDIR, 'config.json'));
  } catch (e2) {
    console.error('Failed to copy config defaults');
    console.error(e.stack);
    return;
  }
}

config.argv().env().file({ file: path.join(ROOTDIR, 'config.json') });

global.Bot = new discord.Client();

Bot.on('ready', () => {
  config.defaults({ 'clientID': Bot.id });

  require('./commands');
  console.log('Bot ready');
});

Bot.on('message', msg => {
  let pattern = new RegExp(`^(?:${config.get('commands:prefix')}|<@${config.get('clientID')}>)[,:;]? `, 'i'),
    match = msg.content.match(pattern);

  if (!match) return;

  let cmd = msg.content.substring(match.index + match[0].length);
  if (Bot.$cmds) {
    let found = false;
    for (const c of Bot.$cmds) {
      let match = cmd.match(c.cmd);
      if (!match) continue;

      found = true;
      let args = { cmd: match };
      for (const opt in c.opts) {
        let match = cmd.match(c.opts[opt]);
        if (match) args[opt] = match;
      }

      msg.content = cmd;
      try {
        c.cb(msg, args);
      } catch (e) {
        msg.channel.sendMessage('Sorry, something went wrong: `' + e.toString() + '`');
      }
    }
    if (!found) msg.channel.sendMessage('Sorry, I do not know how to do that');
  } else msg.channel.sendMessage('Command registry missing: were any commands loaded?');
});

Bot.acknowledge = () => {
  let acknowledgements = config.get('commands:acknowledgements');
  return acknowledgements[Math.floor(Math.random() * acknowledgements.length)];
};
Bot.ack = Bot.acknowledge;

Bot.saveConfig = () => {
  config.save(err => {
    console.error(err.stack);
  });
}

Bot.registerCommand = (cmd, opts, cb) => {
  if (typeof opts === 'function') {
    cb = opts;
    opts = { };
  }
  if (typeof cmd !== 'object') throw new Error('Command must be a regular expression');

  Bot.$cmds = Bot.$cmds || [];

  Bot.$cmds.push({ cmd: cmd, opts: opts, cb: cb });
};

let token = config.get('token') || '';

if (!token || !token.match(/^[A-Z0-9]{24}\.[A-Z0-9]{6}\.[A-Z0-9]{27}$/i))
  return console.error('Token does not match format');

Bot.login(token);
