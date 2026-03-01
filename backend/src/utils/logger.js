"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var fs_1 = require("fs");
var path_1 = require("path");
var LOG_DIR = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(LOG_DIR)) {
    fs_1.default.mkdirSync(LOG_DIR);
}
var getTimestamp = function () { return new Date().toISOString(); };
// Basic PHI Masking
function maskPHI(obj) {
    if (typeof obj === 'string') {
        // Mask emails
        var masked = obj.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi, '***@***.***');
        // Mask potential phone numbers (simple heuristics)
        masked = masked.replace(/(\d{3})\d{3}(\d{4})/g, '$1***$2');
        return masked;
    }
    if (typeof obj === 'object' && obj !== null) {
        var isArr = Array.isArray(obj);
        var newObj = (isArr ? [] : {});
        var inputObj = obj;
        for (var key in inputObj) {
            if (Object.prototype.hasOwnProperty.call(inputObj, key)) {
                // Sensitive keys to always mask fully
                if (/password|token|secret|credit_?card/i.test(key)) {
                    newObj[key] = '[REDACTED]';
                }
                else {
                    newObj[key] = maskPHI(inputObj[key]);
                }
            }
        }
        return isArr ? Object.values(newObj) : newObj;
    }
    return obj;
}
exports.logger = {
    info: function (message, meta) {
        var maskedMeta = meta ? maskPHI(meta) : undefined;
        var log = { timestamp: getTimestamp(), level: 'INFO', message: message, meta: maskedMeta };
        // console.log(`[INFO] ${message}`, maskedMeta || '');
        appendToFile(log);
    },
    warn: function (message, meta) {
        var maskedMeta = meta ? maskPHI(meta) : undefined;
        var log = { timestamp: getTimestamp(), level: 'WARN', message: message, meta: maskedMeta };
        console.warn("[WARN] ".concat(message), maskedMeta || '');
        appendToFile(log);
    },
    error: function (message, meta) {
        var maskedMeta = meta ? maskPHI(meta) : undefined;
        var log = { timestamp: getTimestamp(), level: 'ERROR', message: message, meta: maskedMeta };
        console.error("[ERROR] ".concat(message), maskedMeta || '');
        appendToFile(log);
    },
    auth: function (message, meta) {
        var maskedMeta = meta ? maskPHI(meta) : undefined;
        var log = { timestamp: getTimestamp(), level: 'AUTH', message: message, meta: maskedMeta };
        // console.log(`[AUTH] ${message}`, maskedMeta || '');
        appendToFile(log, 'auth.log');
    }
};
function appendToFile(log, filename) {
    if (filename === void 0) { filename = 'app.log'; }
    try {
        var logLine = JSON.stringify(log) + '\n';
        if (!fs_1.default.existsSync(LOG_DIR)) {
            fs_1.default.mkdirSync(LOG_DIR);
        }
        fs_1.default.appendFileSync(path_1.default.join(LOG_DIR, filename), logLine);
    }
    catch (err) {
        console.error('Failed to write to log file', err);
    }
}
