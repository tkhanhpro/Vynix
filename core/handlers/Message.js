class MessageHandler {
  constructor(api) {
    this.api = api;
  }

  normalizeMessage(message) {
    if (typeof message === 'string') {
      return { body: message };
    }
    return message || {};
  }

  createMessageContext(event) {
    const { threadID, messageID } = event;

    return {
      ...event,
      api: this.api,

      send: async (message, callback) => {
        const msg = this.normalizeMessage(message);
        return this.api.sendMessage(msg, threadID, callback);
      },

      reply: async (message, callback) => {
        const msg = this.normalizeMessage(message);
        return this.api.sendMessage(msg, threadID, callback, messageID);
      },

      react: async (reaction) => {
        return this.api.setMessageReaction(reaction, messageID, threadID);
      },

      unsend: async (messageId) => {
        return this.api.unsendMessage(messageId);
      },

      edit: async (message) => {
        const msg = this.normalizeMessage(message);
        return this.api.editMessage(msg, messageID);
      }
    };
  }

  async handle(event) {
    const context = this.createMessageContext(event);

    const commandHandler = new (await import('./Command.js')).default();
    await commandHandler.handle(context);
  }
}

export default MessageHandler;