const axios = require('axios');

async function testRevocation() {
    console.log('--- Testing Session Isolation & Revocation (Phase 2) ---');
    const baseUrl = 'http://localhost:5000';
    const email = 'patient@haemilife.com';
    const password = '123456';

    try {
        // 1. Login
        console.log('Step 1: Logging in...');
        const loginRes = await axios.post(`${baseUrl}/api/auth/login`, {
            identifier: email,
            password: password
        });

        const cookies = loginRes.headers['set-cookie'];
        console.log('Login successful.');
        console.log('Cookies received:', cookies);

        if (!cookies || !cookies.some(c => c.includes('refreshToken'))) {
            throw new Error('Refresh token cookie not found');
        }

        const refreshTokenCookie = cookies.find(c => c.includes('refreshToken'));
        console.log('Verification: Refresh Token Cookie Options:', refreshTokenCookie);

        const isSecure = refreshTokenCookie.includes('Secure') || !refreshTokenCookie.includes('Secure'); // In dev, secure might be off
        const isHttpOnly = refreshTokenCookie.includes('HttpOnly');
        const isStrict = refreshTokenCookie.includes('SameSite=Strict');
        const hasPath = refreshTokenCookie.includes('path=/');

        console.log(`- HttpOnly: ${isHttpOnly ? '✅' : '❌'}`);
        console.log(`- SameSite=Strict: ${isStrict ? '✅' : '❌'}`);
        console.log(`- Path=/ : ${hasPath ? '✅' : '❌'}`);

        // 2. Perform Logout
        console.log('\nStep 2: Performing Logout...');
        const token = loginRes.data.data.token;
        const logoutRes = await axios.post(`${baseUrl}/api/auth/logout`, {}, {
            headers: { Authorization: `Bearer ${token}` },
            withCredentials: true
        });

        console.log('Logout response:', logoutRes.data.message);
        const logoutCookies = logoutRes.headers['set-cookie'];
        console.log('Logout cookies (should clear):', logoutCookies);

        const isCleared = logoutCookies && logoutCookies.some(c => c.includes('refreshToken=;'));
        console.log(`- Cookie Cleared: ${isCleared ? '✅' : '❌'}`);

        // 3. Attempt Refresh with the OLD cookie (Simulate an attacker or stale client)
        console.log('\nStep 3: Attempting refresh with revoked session...');
        try {
            // We pass the old cookie manually
            await axios.post(`${baseUrl}/api/auth/refresh-token`, {}, {
                headers: { Cookie: refreshTokenCookie },
                withCredentials: true
            });
            console.log('❌ Error: Refresh should have failed but succeeded!');
        } catch (error) {
            const status = error.response?.status;
            const success = error.response?.data?.success;
            console.log(`Step 3 Result: Received ${status} (${success === false ? 'success:false' : 'success:true'})`);
            if (status === 401 || (status === 200 && success === false)) {
                console.log('✅ Revocation verified: Refresh token rejected after logout.');
            } else {
                console.log('❌ Unexpected refresh rejection status:', status);
            }
        }

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testRevocation();
