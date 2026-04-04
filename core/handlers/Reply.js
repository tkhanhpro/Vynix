const REPLY_META = new WeakMap();

class ReplyStoreGuard {
  constructor({
    defaultTTL = 5 * 60 * 1000, // 5 phút
    maxSize = 500,
    cleanupThreshold = 100,
    reserveSize = 400
  } = {}) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    this.cleanupThreshold = cleanupThreshold;
    this.reserveSize = reserveSize;
  }

  getMeta(entry) {
    let meta = REPLY_META.get(entry);
    if (!meta) {
      meta = {
        createdAt: Date.now(),
        lastAccessAt: 0
      };
      REPLY_META.set(entry, meta);
    }
    return meta;
  }

  touch(entry) {
    const meta = this.getMeta(entry);
    meta.lastAccessAt = Date.now();
  }

  getEntryTTL(entry) {
    return Number.isFinite(entry?.ttl) && entry.ttl > 0
      ? entry.ttl
      : this.defaultTTL;
  }

  isExpired(entry, now = Date.now()) {
    const meta = this.getMeta(entry);
    return now - meta.createdAt > this.getEntryTTL(entry);
  }

  isValidEntry(entry) {
    return !!(
      entry &&
      typeof entry === 'object' &&
      typeof entry.callback === 'function' &&
      entry.author != null &&
      entry.messageID != null
    );
  }

  removeAt(list, index) {
    if (index >= 0 && index < list.length) {
      list.splice(index, 1);
      return true;
    }
    return false;
  }

  removeEntry(list, entry) {
    return this.removeAt(list, list.indexOf(entry));
  }

  cleanupInvalid(list) {
    let removed = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      if (!this.isValidEntry(list[i])) {
        list.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  cleanupExpired(list, now = Date.now()) {
    let removed = 0;
    for (let i = list.length - 1; i >= 0; i--) {
      const entry = list[i];
      if (!this.isValidEntry(entry) || this.isExpired(entry, now)) {
        list.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  findOldestIndex(list) {
    let oldestIndex = -1;
    let oldestTime = Infinity;

    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (!this.isValidEntry(entry)) continue;

      const meta = this.getMeta(entry);
      if (meta.createdAt < oldestTime) {
        oldestTime = meta.createdAt;
        oldestIndex = i;
      }
    }

    return oldestIndex;
  }

  cleanupOverflow(list, targetSize = this.reserveSize) {
    let removed = 0;

    while (list.length > targetSize) {
      const oldestIndex = this.findOldestIndex(list);

      if (oldestIndex === -1) {
        list.shift();
      } else {
        list.splice(oldestIndex, 1);
      }

      removed++;
    }

    return removed;
  }

  layeredCleanup(list) {
    if (!Array.isArray(list) || list.length === 0) return;

    const now = Date.now();

    this.cleanupInvalid(list);
    this.cleanupExpired(list, now);

    if (list.length >= this.maxSize) {
      this.cleanupOverflow(list, this.reserveSize);
    }
  }

  softCleanup(list) {
    if (!Array.isArray(list) || list.length === 0) return;

    const now = Date.now();

    if (list.length >= this.cleanupThreshold) {
      this.cleanupExpired(list, now);
    }

    if (list.length >= this.maxSize) {
      this.cleanupOverflow(list, this.reserveSize);
    }
  }
}

const replyGuard = new ReplyStoreGuard({
  defaultTTL: 5 * 60 * 1000,
  maxSize: 500,
  cleanupThreshold: 100,
  reserveSize: 400
});

class ReplyHandler {
  async handle(event) {
    const onReplyList = global.client.onReply;

    if (!Array.isArray(onReplyList) || onReplyList.length === 0) return;
    if (!event?.messageReply?.messageID) {
      replyGuard.softCleanup(onReplyList);
      return;
    }

    replyGuard.softCleanup(onReplyList);

    const matchedReply = this.findMatchedReply(onReplyList, event);

    if (!matchedReply) {
      replyGuard.softCleanup(onReplyList);
      return;
    }

    replyGuard.touch(matchedReply);

    const context = this.createContext(event, matchedReply);

    try {
      await matchedReply.callback(context);
    } catch (error) {
      global.logger.error('Lỗi khi xử lý reply:', error);
    } finally {
      replyGuard.removeEntry(onReplyList, matchedReply);
      replyGuard.layeredCleanup(onReplyList);
    }
  }

  findMatchedReply(onReplyList, event) {
    const senderID = event.senderID;
    const repliedMessageID = event.messageReply.messageID;

    for (let i = 0; i < onReplyList.length; i++) {
      const reply = onReplyList[i];

      if (!replyGuard.isValidEntry(reply)) continue;
      if (replyGuard.isExpired(reply)) continue;

      replyGuard.getMeta(reply);

      if (
        reply.author === senderID &&
        reply.messageID === repliedMessageID
      ) {
        return reply;
      }
    }

    return null;
  }

  createContext(event, matchedReply) {
    return {
      ...event,
      api: global.api,
      replyData: matchedReply.data
    };
  }
}

export default ReplyHandler;