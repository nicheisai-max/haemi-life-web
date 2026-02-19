import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
// Removed axios import

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'a9f3c1b4e7d8a21f9d2c3a8e6b4f91a7c2d9f0e4a1b8c6d7e5f3a2b9c4d8e';
const BASE_URL = 'http://localhost:5000/api/clinical-copilot/chat';

const generateToken = (role: string) => {
    return jwt.sign({ id: '123', role }, JWT_SECRET, { expiresIn: '1h' });
};

async function testRateLimit() {
    console.log('\n--- Testing Rate Limit (Doctor Role) ---');
    console.log('Using token logic with secret ending in ...' + JWT_SECRET.slice(-4));

    // Generate a valid token
    const token = generateToken('doctor');

    let successCount = 0;
    let rateLimitedCount = 0;

    // Send 25 requests. Limit is 20/min.
    // We expect at least the last few to fail with 429.
    for (let i = 0; i < 25; i++) {
        try {
            const response = await fetch(BASE_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query: 'test' })
            });

            if (response.status === 200 || response.status === 201) {
                process.stdout.write('.');
                successCount++;
            } else if (response.status === 429) {
                process.stdout.write('x');
                rateLimitedCount++;
            } else {
                process.stdout.write(`[${response.status}]`);
                const text = await response.text();
                // console.error(`Unexpected status ${response.status}:`, text);
            }
        } catch (error: any) {
            console.error('Fetch error:', error.message);
        }
    }
    console.log(`\nResults: Success: ${successCount}, Rate Limited: ${rateLimitedCount}`);
}

async function testRoleAccess() {
    console.log('\n--- Testing Role Access (Patient Role) ---');
    const token = generateToken('patient');
    try {
        const response = await fetch(BASE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ query: 'test' })
        });

        if (response.status === 403) {
            console.log('✅ Success: Patient was denied access (403).');
        } else {
            console.log(`❌ Failed: Patient received status ${response.status}`);
            const text = await response.text();
            console.log('Response:', text);
        }
    } catch (error: any) {
        console.error('Fetch error during role check:', error.message);
    }
}

async function run() {
    await testRoleAccess();
    await testRateLimit();
}

run();
