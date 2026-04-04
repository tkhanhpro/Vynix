import EventHelper from './event.js';
import MessageHandler from '../handlers/Message.js';
import ReplyHandler from '../handlers/Reply.js';
import ReactionHandler from '../handlers/Reaction.js';
import EventHandler from '../handlers/Event.js';
import RefreshHandler from '../handlers/Refresh.js';

class Listener {
  constructor() {
    this.eventHelper = new EventHelper();
    this.refreshHandler = null;
    this.messageHandler = null;
    this.replyHandler = null;
    this.reactionHandler = null;
    this.eventHandler = null;
  }
  
  initHandlers() {
    this.refreshHandler = new RefreshHandler();
    this.messageHandler = new MessageHandler();
    this.replyHandler = new ReplyHandler();
    this.reactionHandler = new ReactionHandler();
    this.eventHandler = new EventHandler();
  }
  
  listen(api) {
    this.messageHandler = new MessageHandler(api);
    this.replyHandler = new ReplyHandler();
    this.reactionHandler = new ReactionHandler();
    this.eventHandler = new EventHandler();
    this.refreshHandler = new RefreshHandler();

    api.listenMqtt(async (error, event) => {
      if (error) {
        global.logger.error('Lỗi khi nghe event:', error);
        return;
      }
      
      try {
        const formattedEvent = this.eventHelper.formatEvent(event);
        if (!formattedEvent) return;
        
        if (!this.eventHelper.shouldProcess(formattedEvent)) return;
        
        this.eventHelper.logEvent(formattedEvent);
        
        if (formattedEvent.senderID && this.refreshHandler) {
          await this.refreshHandler.checkAndRefresh(
            formattedEvent.senderID,
            formattedEvent.threadID,
            formattedEvent.participantIDs
          );
        }
        
        switch (formattedEvent.type) {
          case 'message':
          case 'message_reply':
          case 'message_reaction':
            if (this.messageHandler) {
              await this.messageHandler.handle(formattedEvent);
            }
            if (this.replyHandler) {
              await this.replyHandler.handle(formattedEvent);
            }
            if (this.reactionHandler) {
              await this.reactionHandler.handle(formattedEvent);
            }
            break;
          
          case 'event':
            if (this.eventHandler) {
              await this.eventHandler.handle(formattedEvent);
            }
            if (this.refreshHandler) {
              await this.refreshHandler.handleEvent?.(formattedEvent);
            }
            break;
          
          default:
            if (formattedEvent.logMessageType && this.eventHandler) {
              await this.eventHandler.handle(formattedEvent);
            }
            break;
        }
      } catch (err) {
        this.eventHelper.logError(err, event);
      }
    });
  }
}

export default Listener;