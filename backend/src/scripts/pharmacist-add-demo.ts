import { pool } from '../config/db';
import { randomUUID } from 'crypto';

async function addDemoOrders() {
    let client;
    try {
        console.log('--- STARTING ADDITIVE SEEDING (ZERO-POLLUTION) ---');
        
        client = await pool.connect();

        // 1. Get a valid pharmacy ID (Standard Institutional Pharmacy)
        const pharmacyRes = await client.query('SELECT id FROM pharmacies LIMIT 1');
        if (pharmacyRes.rows.length === 0) {
            throw new Error('No pharmacies found. Please run base seed first.');
        }
        const pharmacyId = pharmacyRes.rows[0].id;

        // 2. Get some users to assign orders to
        const usersRes = await client.query('SELECT id, name, role FROM users LIMIT 10');
        console.log(`Found ${usersRes.rows.length} total users in system.`);
        
        const patients = usersRes.rows.filter(u => u.role === 'PATIENT');
        console.log(`Found ${patients.length} users with role PATIENT.`);

        const targetUsers = patients.length >= 2 ? patients : usersRes.rows;
        
        if (targetUsers.length < 2) {
            throw new Error(`Not enough users found for demo. Found ${targetUsers.length} total users.`);
        }
        
        const p1 = targetUsers[0];
        const p2 = targetUsers[1];
        
        console.log(`Using users: ${p1.name} (${p1.role}) and ${p2.name} (${p2.role})`);

        // 3. Define New Government Subsidized Orders
        const govOrders = [
            {
                id: randomUUID(),
                patient_id: p1.id,
                pharmacy_id: pharmacyId,
                status: 'Pending',
                total_amount: 0.00,
                delivery_mode: 'COLLECT',
                is_government_subsidized: true,
                omang_number: '439218312',
                hospital_origin: 'Princess Marina Hospital',
                is_prescription_required: true
            },
            {
                id: randomUUID(),
                patient_id: p2.id,
                pharmacy_id: pharmacyId,
                status: 'Pending',
                total_amount: 0.00,
                delivery_mode: 'COLLECT',
                is_government_subsidized: true,
                omang_number: '782910392',
                hospital_origin: 'Nyangabgwe Referral Hospital',
                is_prescription_required: true
            },
            {
                id: randomUUID(),
                patient_id: p1.id,
                pharmacy_id: pharmacyId,
                status: 'Pending',
                total_amount: 0.00,
                delivery_mode: 'COLLECT',
                is_government_subsidized: true,
                omang_number: '123456789',
                hospital_origin: 'Gaborone Private Hospital',
                is_prescription_required: true
            }
        ];

        // 4. Define New Private / Direct Orders
        const privateOrders = [
            {
                id: randomUUID(),
                patient_id: p2.id,
                pharmacy_id: pharmacyId,
                status: 'Pending',
                total_amount: 245.50,
                delivery_mode: 'HAEMI_DELIVERY',
                is_government_subsidized: false,
                is_prescription_required: false
            },
            {
                id: randomUUID(),
                patient_id: p1.id,
                pharmacy_id: pharmacyId,
                status: 'Pending',
                total_amount: 89.99,
                delivery_mode: 'COLLECT',
                is_government_subsidized: false,
                is_prescription_required: true
            }
        ];

        console.log('Inserting Government Subsidized Orders...');
        for (const order of govOrders) {
            await client.query(`
                INSERT INTO orders (
                    id, patient_id, pharmacy_id, status, total_amount, 
                    delivery_mode, is_government_subsidized, omang_number, 
                    hospital_origin, is_prescription_required
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (id) DO NOTHING
            `, [
                order.id, order.patient_id, order.pharmacy_id, order.status, 
                order.total_amount, order.delivery_mode, order.is_government_subsidized, 
                order.omang_number, order.hospital_origin, order.is_prescription_required
            ]);
        }

        console.log('Inserting Private Direct Orders...');
        for (const order of privateOrders) {
            await client.query(`
                INSERT INTO orders (
                    id, patient_id, pharmacy_id, status, total_amount, 
                    delivery_mode, is_government_subsidized, is_prescription_required
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (id) DO NOTHING
            `, [
                order.id, order.patient_id, order.pharmacy_id, order.status, 
                order.total_amount, order.delivery_mode, order.is_government_subsidized,
                order.is_prescription_required
            ]);
        }

        console.log('--- ADDITIVE SEEDING COMPLETED SUCCESSFULLY ---');
    } catch (err) {
        console.error('Seeding error:', err);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

addDemoOrders();
