class EventHandler {
  async handle(event) {
    const eventType = event.logMessageType || event.type;
    
    for (const [eventName, eventHandler] of global.client.events) {
      if (eventHandler.config.eventType.includes(eventType)) {
        const context = {
          ...event,
          api: global.api
        };
        
        try {
          await eventHandler.call(context);
        } catch (error) {
          global.logger.error(`Lỗi khi xử lý sự kiện ${eventName}:`, error);
        }
      }
    }
  }
}

export default EventHandler;