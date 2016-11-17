'use strict';

exports.name = 'Administration';
exports.desc = 'Server administration and role management';

exports.install = () => {

  Bot.registerCommand(/^promote <@([\d]+)>$/, (msg, args) => {
    let user;
    msg.guild.members.forEach((member, memberID) => {
      if (memberID == args.cmd[1]) user = member;
    });

    if (!user)
      msg.channel.sendMessage('Sorry, promoting roles is coming soon!');
    else if (Bot.isAdmin(user, msg.guild))
      msg.channel.sendMessage('That user is already promoted.');
    else if (Bot.isAdmin(msg.author)) {
      let admins = Bot.config.get(Bot.configDir(msg.guild, 'admin') + 'admins') || [];
      admins.push(user.id);
      Bot.config.set(Bot.configDir(msg.guild, 'admin') + 'admins', admins);
      Bot.saveConfig();
      msg.channel.sendMessage(Bot.ack() + ' <@' + user.id + '> has been promoted.');
    } else msg.channel.sendMessage('Sorry, you do not have permission to do that');
  });

  Bot.registerCommand(/^demote <@([\d]+)>$/, (msg, args) => {
    let user;
    msg.guild.members.forEach((member, memberID) => {
      if (memberID == args.cmd[1]) user = member;
    });

    if (!user)
      msg.channel.sendMessage('Sorry, promoting roles is coming soon!');
    else if (Bot.isAdmin(user))
      msg.channel.sendMessage('That user is a global admin and cannot be demoted via command.');
    else if (!Bot.isAdmin(user, msg.guild))
      msg.channel.sendMessage('That user is not an admin.');
    else if (Bot.isAdmin(msg.author)) {
      let admins = Bot.config.get(Bot.configDir(msg.guild, 'admin') + 'admins'), index = admins.indexOf(user.id);
      admins.splice(index, 1);
      Bot.config.set(Bot.configDir(msg.guild, 'admin') + 'admins', admins);
      Bot.saveConfig();
      msg.channel.sendMessage(Bot.ack() + ' <@' + user.id + '> has been demoted.');
    } else msg.channel.sendMessage('Sorry, you do not have permission to do that');
  });

};
