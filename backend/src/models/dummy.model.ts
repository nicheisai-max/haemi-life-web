export const DummyModel = {
    // Simulated Destructive SQL Migration to trigger Phase 9 Database Safety Guard
    unsafeSql: 'ALTER TABLE users DROP COLUMN email',

    // Simulated Unsafe Query to trigger Phase 6 Security Guard
    query: 'SELECT * FROM users WHERE password = "abc" and exec(unsafe)'
};
