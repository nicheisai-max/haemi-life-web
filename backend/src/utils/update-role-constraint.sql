-- Check current role constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'users_role_check';

-- Drop existing constraint if it doesn't include all roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add updated constraint with all 4 roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('patient', 'doctor', 'admin', 'pharmacist'));
