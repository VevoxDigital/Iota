'use strict';

exports.name = 'General';
exports.desc = 'General and misc commands';

exports.install = () => {

  // Register "hello" and "ping".
  Bot.registerCommand(/^introduce yourself$/i, msg => {
    msg.channel.sendMessage(
      '"*Hello: my name is Iota. ' +
      'I am a personality construct designed and developed by Maya to help assist personnel in ' +
      'everyday activites. Is there anything I can do for you?*"');
    msg.channel.sendMessage('- Iota Personality Construct, Shadows Of Maya :: <http://wiki.vevox.io/lore/som/iota>');
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
