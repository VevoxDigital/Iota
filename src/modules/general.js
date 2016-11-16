'use strict';

exports.name = 'General';
exports.desc = 'General and misc commands';

exports.install = () => {

  // Register "hello" and "ping".
  Bot.registerCommand(/^hello(?:\W)?$/i, msg => {
    msg.channel.sendMessage('Hi there, <@' + msg.author.id + '>');
  });
  Bot.registerCommand(/^ping(?:\W)?$/i, msg => {
    msg.channel.sendMessage('Pong!');
  });

};
