const axios = require('axios');

async function testRole(role, email) {
    console.log(`\n--- Testing ${role} (${email}) ---`);
    try {
        console.log('Logging in...');
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            identifier: email,
            password: '123456'
        });

        const token = loginRes.data.data.token;
        console.log('Login successful.');

        console.log('Fetching profile...');
        const profileRes = await axios.get('http://localhost:5000/api/profiles/me', {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        console.log('Profile Response Summary:', {
            id: profileRes.data.data.id,
            role: profileRes.data.data.role,
            fullName: profileRes.data.data.profile?.fullName,
            hasMetadata: !!profileRes.data.data.profile?.metadata
        });

        if (profileRes.data.success && profileRes.data.data.profile) {
            console.log(`✅ ${role} verify PASSED`);
        } else {
            console.log(`❌ ${role} verify FAILED`);
        }

    } catch (error) {
        console.error(`❌ ${role} verify ERROR:`, error.response?.data || error.message);
    }
}

async function runTests() {
    await testRole('Patient', 'patient@haemilife.com');
    await testRole('Doctor', 'doctor@haemilife.com');
    process.exit(0);
}

runTests();
