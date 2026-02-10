import { pool } from '../config/db';

async function updateRoleConstraint() {
    console.log('🔧 Updating role constraint...\n');

    try {
        // Drop existing constraint
        await pool.query('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
        console.log('✅ Dropped old constraint (if it existed)');

        // Add new constraint with all 4 roles
        await pool.query(`
      ALTER TABLE users 
      ADD CONSTRAINT users_role_check 
      CHECK (role IN ('patient', 'doctor', 'admin', 'pharmacist'))
    `);
        console.log('✅ Added new constraint with all roles (patient, doctor, admin, pharmacist)\n');
    } catch (error) {
        console.error('❌ Error updating constraint:', error);
    } finally {
        await pool.end();
    }
}

updateRoleConstraint();
