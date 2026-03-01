"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
var pg_1 = require("pg");
var dotenv_1 = require("dotenv");
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'haemi_life',
    password: process.env.DB_PASSWORD || 'password',
    port: parseInt(process.env.DB_PORT || '5432'),
    // Production Hardening: Explicit Pool Constraints
    max: 20, // Max concurrent connections
    idleTimeoutMillis: 30000, // Close idle clients after 30s
    connectionTimeoutMillis: 2000, // Fail fast if connection cannot be established
});
// Task 1: Pool Error Listener
exports.pool.on('error', function (err) {
    console.error('[DB] Unexpected error on idle client:', err.message);
});
