const https = require('https');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

const fs = require('fs');

https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            fs.writeFileSync('models.json', JSON.stringify(json, null, 2));
            console.log('Saved to models.json');
        } catch (e) {
            console.error('Parse error:', e.message);
            console.log('Raw:', data);
        }
    });
}).on('error', (e) => {
    console.error('Request error:', e.message);
});
