import chalk from 'chalk';
import moment from 'moment-timezone';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hexToRgb(hex) {
    const namedColors = {
        'cyan': '#00ffff', 'pink': '#ffc0cb', 'gold': '#ffd700', 
        'blue': '#0000ff', 'red': '#ff0000', 'orange': '#ffa500',
        'purple': '#800080', 'white': '#ffffff', 'black': '#000000',
        'yellow': '#ffff00', 'green': '#00ff00', 'indigo': '#4b0082',
        'violet': '#ee82ee'
    };

    if (namedColors[hex.toLowerCase()]) {
        hex = namedColors[hex.toLowerCase()];
    }

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function interpolateColor(color1, color2, factor) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    if (!rgb1 || !rgb2) return '#000000';

    const r = Math.round(rgb1.r + factor * (rgb2.r - rgb1.r));
    const g = Math.round(rgb1.g + factor * (rgb2.g - rgb1.g));
    const b = Math.round(rgb1.b + factor * (rgb2.b - rgb1.b));

    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}

function createGradient(text, colors) {
    if (colors.length === 0) return text;
    if (colors.length === 1) return chalk.hex(colors[0])(text);

    const chars = text.split('');
    let result = '';

    const charsPerColor = Math.ceil(chars.length / (colors.length - 1));

    chars.forEach((char, i) => {
        const colorIndex = Math.min(Math.floor(i / charsPerColor), colors.length - 1);

        if (colorIndex < colors.length - 1) {
            const factor = (i % charsPerColor) / charsPerColor;
            const currentColor = interpolateColor(colors[colorIndex], colors[colorIndex + 1], factor);
            result += chalk.hex(currentColor)(char);
        } else {
            result += chalk.hex(colors[colors.length - 1])(char);
        }
    });

    return result;
}

function getThemeColors(themeName, customColors = null) {
    if (customColors && Array.isArray(customColors) && customColors.length > 0) {
        return customColors;
    }

    const themes = {
        "blue": ["#1affa3", "cyan", "pink", "cyan", "#1affa3"],
        "dream2": ["#a200ff", "#21b5ff", "#a200ff"],
        "dream": ["blue", "pink", "gold", "pink", "blue"],
        "test": ["#243aff", "#4687f0", "#5800d4"],
        "fiery": ["#fc2803", "#fc6f03", "#fcba03"],
        "rainbow": ["red", "orange", "yellow", "green", "blue", "indigo", "violet"],
        "pastel": ["#ffd1dc", "#e0bbff", "#a7c7e7", "#c1e1c1"],
        "cristal": ["#00ffff", "#ff00ff", "#ffff00"],
        "retro": ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2"],
        "teen": ["#ff6b6b", "#ffd166", "#06d6a0", "#118ab2"],
        "flower": ["#ffd1dc", "#e0bbff", "#a7c7e7", "#c1e1c1"],
        "ghost": ["#b19cd9", "#a7c7e7", "#c1e1c1"]
    };

    return themes[themeName] || null;
}

class Logger {
    constructor() {
        this.themeColors = null;
        this.loadConfig();
    }

    loadConfig() {
        try {
            const configPath = path.resolve(__dirname, '../config/config.main.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.theme) {
                    this.themeColors = getThemeColors(config.theme);
                }
            }
        } catch (error) {
            this.themeColors = null;
        }
    }

    formatTime() {
        return moment().tz('Asia/Ho_Chi_Minh').format('HH:mm:ss');
    }

    applyGradient(text) {
        if (!this.themeColors || this.themeColors.length === 0) {
            return text;
        }
        return createGradient(text, this.themeColors);
    }

    call(message, optionsOrLevel, ...args) {
        if (optionsOrLevel === undefined) {
            console.log(this.applyGradient(message), ...args);
            return;
        }

        const timePart = this.applyGradient(`[${this.formatTime()}]`);
        const optionPart = this.applyGradient(optionsOrLevel);
        
        console.log(`${timePart} ${optionPart} › ${message}`, ...args);
    }

    info(message, ...args) {
        this.call(message, 'INFO', ...args);
    }

    success(message, ...args) {
        this.call(message, 'SUCCESS', ...args);
    }

    error(message, ...args) {
        this.call(message, 'ERROR', ...args);
    }

    warn(message, ...args) {
        this.call(message, 'WARNING', ...args);
    }

    debug(message, ...args) {
        try {
            const configPath = path.resolve(__dirname, '../config/config.main.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (config.devMode) {
                    this.call(message, 'DEBUG', ...args);
                }
            }
        } catch (error) {
            if (global.config?.devMode) {
                this.call(message, 'DEBUG', ...args);
            }
        }
    }

    loader(message, type = 'loaded') {
        const option = type === 'success' ? 'SUCCESS' : 'LOADED';
        this.call(message, option);
    }
}

const loggerInstance = new Logger();

const logger = (message, options, ...args) => {
    return loggerInstance.call(message, options, ...args);
};

Object.assign(logger, {
    info: loggerInstance.info.bind(loggerInstance),
    success: loggerInstance.success.bind(loggerInstance),
    error: loggerInstance.error.bind(loggerInstance),
    warn: loggerInstance.warn.bind(loggerInstance),
    debug: loggerInstance.debug.bind(loggerInstance)
});

export default logger;