-- Check if doctors exist in the database
SELECT u.id, u.name, u.role, dp.specialization, dp.is_verified
FROM users u
LEFT JOIN doctor_profiles dp ON u.id = dp.user_id
WHERE u.role = 'doctor'
LIMIT 10;

-- Check conversations
SELECT c.id, c.created_at, c.updated_at
FROM conversations c
LIMIT 10;

-- Check conversation participants with user names
SELECT cp.conversation_id, cp.user_id, u.name, u.role
FROM conversation_participants cp
JOIN users u ON cp.user_id = u.id
ORDER BY cp.conversation_id
LIMIT 20;
