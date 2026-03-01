"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var db_1 = require("../config/db");
var fs_1 = require("fs");
var path_1 = require("path");
var bcrypt_1 = require("bcrypt");
var DEMO_PASSWORD = '123456';
function setupDatabase() {
    return __awaiter(this, void 0, void 0, function () {
        var client, sqlPath, sql, passwordHash, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, 6, 8]);
                    console.log('🔌 Connecting to database...');
                    return [4 /*yield*/, db_1.pool.connect()];
                case 1:
                    client = _a.sent();
                    console.log('📄 Reading init.sql...');
                    sqlPath = path_1.default.join(__dirname, '../db/init.sql');
                    sql = fs_1.default.readFileSync(sqlPath, 'utf8');
                    // Hash the demo password
                    console.log('🔐 Hashing demo password (123456)...');
                    return [4 /*yield*/, bcrypt_1.default.hash(DEMO_PASSWORD, 10)];
                case 2:
                    passwordHash = _a.sent();
                    // Prepare specific SQL execution
                    // We need to pass the password hash to the procedure call
                    // The SQL file defines the procedure `sp_seed_demo_data(p_password_hash)`.
                    // We need to CALL this procedure from this script.
                    console.log('🚀 Executing Schema & Procedures...');
                    // 1. Run the entire Init SQL to define tables and procedures
                    return [4 /*yield*/, client.query(sql)];
                case 3:
                    // 1. Run the entire Init SQL to define tables and procedures
                    _a.sent();
                    console.log('✅ Schema and Procedures created successfully.');
                    // 2. Call the Seed Procedure
                    console.log('🌱 Seeding Demo Data...');
                    return [4 /*yield*/, client.query('CALL sp_seed_demo_data($1)', [passwordHash])];
                case 4:
                    _a.sent();
                    console.log('\n✨ Database Setup Completed Successfully! ✨');
                    console.log('==========================================');
                    console.log("\uD83D\uDD11 Demo Password: ".concat(DEMO_PASSWORD));
                    console.log('   - patient@haemilife.com');
                    console.log('   - doctor@haemilife.com');
                    console.log('   - pharmacist@haemilife.com');
                    console.log('   - admin@haemilife.com');
                    console.log('==========================================\n');
                    return [3 /*break*/, 8];
                case 5:
                    error_1 = _a.sent();
                    console.error('❌ Database Setup Failed:', error_1);
                    process.exit(1);
                    return [3 /*break*/, 8];
                case 6:
                    if (client)
                        client.release();
                    return [4 /*yield*/, db_1.pool.end()];
                case 7:
                    _a.sent();
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    });
}
setupDatabase();
