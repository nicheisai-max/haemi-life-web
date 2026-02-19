import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

// Manually verify the key is loaded
const API_KEY = process.env.GEMINI_API_KEY;
console.log(`Testing Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'MISSING'}`);

async function test() {
    try {
        const genAI = new GoogleGenerativeAI(API_KEY as string);
        // Try gemini-1.5-flash as it is a newer standard model
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        console.log('Sending request to Gemini...');
        const result = await model.generateContent('Hello, confirm you are working.');
        const response = await result.response;
        const text = response.text();

        console.log('✅ Success! Response:', text);
    } catch (error: any) {
        console.error('❌ Error:', error.message);
        // Fallback check for gemini-pro if flash fails
        try {
            console.log('Retrying with gemini-pro...');
            const genAI = new GoogleGenerativeAI(API_KEY as string);
            const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
            const result = await model.generateContent('Hello code verify.');
            console.log('✅ Success with gemini-pro!', result.response.text());
        } catch (e: any) {
            console.error('❌ Error with gemini-pro:', e.message);
        }
    }
}

test();
