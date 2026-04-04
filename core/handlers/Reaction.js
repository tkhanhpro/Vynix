const REACTION_META = new WeakMap();

class ReactionStoreGuard {
  constructor({
    defaultTTL = 10 * 60 * 1000, // 10 phút
    maxSize = 700,
    cleanupThreshold = 150,
    reserveSize = 550
  } = {}) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    this.cleanupThreshold = cleanupThreshold;
    this.reserveSize = reserveSize;
  }

  getMeta(entry) {
    let meta = REACTION_META.get(entry);
    if (!meta) {
      meta = {
        createdAt: Date.now(),
        lastAccessAt: 0
      };
      REACTION_META.set(entry, meta);
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

const reactionGuard = new ReactionStoreGuard({
  defaultTTL: 10 * 60 * 1000,
  maxSize: 700,
  cleanupThreshold: 150,
  reserveSize: 550
});

class ReactionHandler {
  async handle(event) {
    if (event?.type !== 'message_reaction') return;
    if (!event.userID || !event.messageID) return;

    const onReactionList = global.client.onReaction;
    if (!Array.isArray(onReactionList) || onReactionList.length === 0) return;

    reactionGuard.softCleanup(onReactionList);

    const matchedReactions = this.findMatchedReactions(onReactionList, event.messageID);

    if (matchedReactions.length === 0) {
      reactionGuard.softCleanup(onReactionList);
      return;
    }

    for (const matchedReaction of [...matchedReactions]) {
      reactionGuard.touch(matchedReaction);

      const context = this.createContext(event, matchedReaction);

      try {
        await matchedReaction.callback(context);

        if (matchedReaction.oneTime !== false) {
          reactionGuard.removeEntry(onReactionList, matchedReaction);
        }
      } catch (error) {
        global.logger.error('Lỗi khi xử lý reaction:', error);
      }
    }

    reactionGuard.layeredCleanup(onReactionList);
  }

  findMatchedReactions(onReactionList, messageID) {
    const matched = [];

    for (let i = 0; i < onReactionList.length; i++) {
      const reaction = onReactionList[i];

      if (!reactionGuard.isValidEntry(reaction)) continue;
      if (reactionGuard.isExpired(reaction)) continue;

      reactionGuard.getMeta(reaction);

      if (reaction.messageID === messageID) {
        matched.push(reaction);
      }
    }

    return matched;
  }

  createContext(event, matchedReaction) {
    return {
      ...event,
      api: global.api,
      reactionData: matchedReaction.data || {}
    };
  }
}

export default ReactionHandler;