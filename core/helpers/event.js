import moment from 'moment-timezone';

class EventHelper {
  constructor() {
    this.ignoredTypes = ['read_receipt', 'presence', 'typ'];
  }
  
  formatEvent(event) {
    if (!event.type) return null;
    
    const formatted = {
      ...event,
      senderID: event.senderID ? String(event.senderID) : null,
      threadID: event.threadID ? String(event.threadID) : null,
      messageID: event.messageID ? String(event.messageID) : null
    };
    
    if (event.args && Array.isArray(event.args)) {
      formatted.args = event.args.map(arg => String(arg));
    }
    
    if (event.attachments && Array.isArray(event.attachments)) {
      formatted.attachments = event.attachments;
    }
    
    if (event.mentions) {
      formatted.mentions = event.mentions;
    }
    
    return formatted;
  }
  
  shouldProcess(event) {
    if (this.ignoredTypes.includes(event.type)) {
      return false;
    }
    
    if (event.logMessageType && this.ignoredTypes.includes(event.logMessageType)) {
      return false;
    }
    
    return true;
  }
  
  logEvent(event) {
    if (!global.config.devMode) return;
    
    const eventType = event.type || event.logMessageType || 'unknown';
    
    global.logger(`Loại sự kiện: ${eventType}`, "DEV-MODE");
    
    if (event || event.body) {
      global.logger(`Tin nhắn: ${event.body}`, "DEV-MODE");
    }
  }
  
  logError(error, event) {
    global.logger.error(`Lỗi khi xử lý sự kiện: ${error.message}`);
    if (global.config.devMode) {
      console.error(error.stack);
    }
  }
}

export default EventHelper;