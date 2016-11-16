'use strict';

exports.name = 'General';
exports.desc = 'General and misc commands';

exports.install = () => {

  // Register "hello" and "ping".
  Bot.registerCommand(/^hello(?:\S)?$/i, msg => {
    msg.channel.sendMessage('Hi there, <@' + msg.author.id + '>');
  });
  Bot.registerCommand(/^ping(?:\S)?$/i, msg => {
    msg.channel.sendMessage('Pong!');
  });

  // List voice ids
  Bot.registerCommand(/^(?:list )?voice channels$/i, msg => {
    let voiceChannels = { };

    msg.guild.channels.forEach((channel, channelID) => {
      if (channel.type === 'voice')
        voiceChannels[channelID] = {
          name: channel.name,
          limit: channel.userLimit
        };
    });
    msg.channel.sendCode('json', JSON.stringify({
      server: msg.guild.id,
      voice: voiceChannels
    }, null, '\t'));

  });


};
