"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendError = exports.sendResponse = void 0;
/**
 * Standardized API Response Wrapper
 */
var sendResponse = function (res, statusCode, success, message, data) {
    if (data === void 0) { data = null; }
    res.status(statusCode).json({
        success: success,
        message: message,
        data: data,
        statusCode: statusCode
    });
};
exports.sendResponse = sendResponse;
var sendError = function (res, statusCode, message, error) {
    if (error === void 0) { error = null; }
    res.status(statusCode).json({
        success: false,
        error: message,
        details: process.env.NODE_ENV === 'development' ? error : undefined,
        statusCode: statusCode
    });
};
exports.sendError = sendError;
