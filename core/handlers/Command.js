import stringSimilarity from 'string-similarity';

class CommandHandler {
    escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    getThreadData(threadID) {
        return global.data.threadData.get(threadID);
    }

    getThreadPrefix(threadID) {
        return this.getThreadData(threadID)?.extra?.prefix || global.config.prefix;
    }

    createPrefixRegex(prefix, senderID) {
        return new RegExp(`^(<@!?${senderID}>|${this.escapeRegex(prefix)})\\s*`);
    }

    hasPrefix(body, prefix, senderID) {
        return this.createPrefixRegex(prefix, senderID).test(body);
    }

    parseCommandWithPrefix(body, prefix, senderID) {
        const prefixRegex = this.createPrefixRegex(prefix, senderID);
        const matchedPrefix = body.match(prefixRegex)?.[0];

        if (!matchedPrefix) {
            return {
                args: [],
                commandName: null
            };
        }

        const args = body
            .slice(matchedPrefix.length)
            .trim()
            .split(/ +/)
            .filter(Boolean);

        const commandName = args.shift()?.toLowerCase() || null;

        return { args, commandName };
    }

    findCommand(commandName) {
        if (!commandName) return null;

        if (global.client.commands.has(commandName)) {
            return global.client.commands.get(commandName);
        }

        for (const [, command] of global.client.commands) {
            if (command.config.alias?.includes(commandName)) {
                return command;
            }
        }

        return null;
    }

    findPrefixDisabledCommand(content) {
        if (!content || typeof content !== 'string') return null;

        const trimmedContent = content.trim();
        const words = trimmedContent.split(/\s+/);

        for (let i = Math.min(words.length, 5); i >= 1; i--) {
            const potentialCommandName = words.slice(0, i).join(' ').toLowerCase();
            const remainingArgs = words.slice(i);

            for (const [, command] of global.client.commands) {
                const requiresPrefix = command.config.prefix !== false;
                if (requiresPrefix) continue;

                if (command.config.name.toLowerCase() === potentialCommandName) {
                    return {
                        command,
                        args: remainingArgs,
                        matchedName: command.config.name
                    };
                }

                if (command.config.alias) {
                    const matchedAlias = command.config.alias.find(
                        alias => alias.toLowerCase() === potentialCommandName
                    );

                    if (matchedAlias) {
                        return {
                            command,
                            args: remainingArgs,
                            matchedName: matchedAlias
                        };
                    }
                }
            }
        }

        return null;
    }

    isCommandValidWithPrefix(command, commandName, hasPrefix) {
        if (!command || !command.config) return false;

        const requiresPrefix = command.config.prefix !== false;
        const aliases = Array.isArray(command.config.alias)
            ? command.config.alias.map(alias => alias.toLowerCase())
            : [];

        const isValidName =
            command.config.name.toLowerCase() === commandName ||
            aliases.includes(commandName);

        if (!isValidName) return false;
        if (requiresPrefix && !hasPrefix) return false;

        return true;
    }

    canUsePrefixDisabledCommand(senderID) {
        const operatorPrefix = global.config['operator-prefix'] === true;

        if (!operatorPrefix) return true;

        return global.config.operators?.includes(senderID) === true;
    }

    findSimilarCommand(commandName) {
        const allCommandNames = [];

        for (const [name, command] of global.client.commands) {
            allCommandNames.push(name);

            if (command.config.alias) {
                allCommandNames.push(...command.config.alias);
            }
        }

        const similarity = stringSimilarity.findBestMatch(commandName, allCommandNames);

        if (similarity.bestMatch.rating >= 0.5) {
            const target = similarity.bestMatch.target;
            const targetCommand =
                global.client.commands.get(target) ||
                Array.from(global.client.commands.values()).find(
                    cmd => cmd.config.alias?.includes(target)
                );

            return { command: targetCommand, similarity };
        }

        return { command: null, similarity };
    }

    async sendCommandNotFoundMessage(api, threadID, messageID, commandName, similarCommand = null) {
        const prefix = this.getThreadPrefix(threadID);
        let message;

        if (similarCommand) {
            message =
                `⚠️ Lệnh "${commandName}" không tồn tại\n` +
                `✏️ Lệnh gần giống là "${similarCommand.config.name}"\n` +
                `📦 Sử dụng ${prefix}help để xem danh sách lệnh hiện có`;
        } else if (!commandName) {
            message =
                `⚠️ Vui lòng nhập lệnh!\n` +
                `📦 Sử dụng ${prefix}help để xem danh sách lệnh hiện có`;
        } else {
            message =
                `⚠️ Lệnh "${commandName}" không tồn tại\n` +
                `📦 Sử dụng ${prefix}help để xem danh sách lệnh hiện có`;
        }

        await api.sendMessage(
            {
                body: message,
                attachment: global.vdgai?.splice(0, 1)
            },
            threadID,
            (error, info) => {
                if (info && !commandName) {
                    setTimeout(() => {
                        api.unsendMessage(info.messageID);
                    }, 60 * 1000);
                }
            },
            messageID
        );
    }

    checkCooldown(senderID, commandName, cdTime, api, threadID, messageID) {
        if (!global.client.cooldowns) {
            global.client.cooldowns = new Map();
        }

        const isOperator = global.config.operators?.includes(senderID) === true;
        if (isOperator) return true;

        const effectiveCdTime = typeof cdTime === 'number' && cdTime > 0 ? cdTime : 0;
        if (effectiveCdTime === 0) return true;

        const cooldownKey = `${senderID}_${commandName}`;
        const now = Date.now();
        const lastUsed = global.client.cooldowns.get(cooldownKey) || 0;

        if (now - lastUsed < effectiveCdTime * 1000) {
            const remaining = Math.ceil((effectiveCdTime * 1000 - (now - lastUsed)) / 1000);
            api.sendMessage(
                `⏰ Vui lòng chờ ${remaining} giây trước khi dùng lại lệnh này!`,
                threadID,
                messageID
            );
            return false;
        }

        global.client.cooldowns.set(cooldownKey, now);

        setTimeout(() => {
            if (global.client.cooldowns.get(cooldownKey) === now) {
                global.client.cooldowns.delete(cooldownKey);
            }
        }, effectiveCdTime * 1000);

        return true;
    }

    async executeCommand(command, args, context, hasPrefix) {
        const { api, threadID, messageID, senderID, isGroup } = context;

        const userRole = await this.getUserRole(senderID, threadID, isGroup);
        if (command.config.role > userRole) {
            await api.sendMessage(
                '❌ Bạn không có đủ quyền hạn để sử dụng lệnh này',
                threadID,
                messageID
            );
            return true;
        }

        if (
            command.config.cd > 0 &&
            !this.checkCooldown(senderID, command.config.name, command.config.cd, api, threadID, messageID)
        ) {
            return true;
        }

        try {
            const callContext = {
                ...context,
                args: args || [],
                commandName: command.config.name,
                role: userRole,
                hasPrefix,
                prefix: this.getThreadPrefix(threadID)
            };

            await command.call(callContext);
        } catch (error) {
            global.logger.error(`Lỗi khi thực thi lệnh ${command.config.name}:`, error);
            await api.sendMessage(
                '⚠️ Đã xảy ra lỗi khi thực thi lệnh',
                threadID,
                messageID
            );
        }

        return true;
    }

    async handle(context) {
        const { body, senderID, threadID } = context;

        if (!body || typeof body !== 'string') return false;

        const trimmedBody = body.trim();
        const prefix = this.getThreadPrefix(threadID);
        const hasThreadPrefix = this.hasPrefix(trimmedBody, prefix, senderID);

        if (hasThreadPrefix) {
            return await this.handleWithPrefix(trimmedBody, prefix, senderID, context);
        }

        const prefixDisabledMatch = this.findPrefixDisabledCommand(trimmedBody);

        if (prefixDisabledMatch) {
            if (!this.canUsePrefixDisabledCommand(senderID)) {
                return false;
            }

            return await this.handlePrefixDisabledCommand(prefixDisabledMatch, context);
        }

        return false;
    }

    async handleWithPrefix(trimmedBody, prefix, senderID, context) {
        const { api, threadID, messageID } = context;
        const { args, commandName } = this.parseCommandWithPrefix(trimmedBody, prefix, senderID);

        if (!commandName) {
            await this.sendCommandNotFoundMessage(api, threadID, messageID, null);
            return true;
        }

        const command = this.findCommand(commandName);

        if (!command) {
            const { command: similarCommand } = this.findSimilarCommand(commandName);
            await this.sendCommandNotFoundMessage(api, threadID, messageID, commandName, similarCommand);
            return true;
        }

        const isValid = this.isCommandValidWithPrefix(command, commandName, true);
        if (!isValid) {
            await api.sendMessage(
                `⚠️ Lệnh "${commandName}" không khả dụng!`,
                threadID,
                messageID
            );
            return true;
        }

        return await this.executeCommand(command, args, context, true);
    }

    async handlePrefixDisabledCommand(match, context) {
        const { command, args } = match;
        return await this.executeCommand(command, args, context, false);
    }

    async getUserRole(senderID, threadID, isGroup) {
        if (global.config.operators?.includes(senderID)) return 3;
        if (global.config.admins?.includes(senderID)) return 2;

        if (isGroup && threadID) {
            try {
                const threadInfo = await global.api.getThreadInfo(threadID);

                if (threadInfo?.adminIDs?.some(admin => admin.id === senderID)) {
                    return 1;
                }
            } catch (error) {
                global.logger.error('Lỗi khi lấy thông tin nhóm:', error);
            }
        }

        return 0;
    }
}

export default CommandHandler;