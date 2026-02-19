import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY is missing in .env');
    process.exit(1);
}

console.log(`Using API Key: ${API_KEY.substring(0, 10)}...`);

async function test() {
    try {
        const genAI = new GoogleGenerativeAI(API_KEY as string);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });

        console.log('Sending request to Gemini...');
        const result = await model.generateContent('Hello, are you working?');
        const response = await result.response;
        const text = response.text();

        console.log('✅ Response received:', text);
    } catch (error: any) {
        console.error('❌ Error testing Gemini:', error.message);
        if (error.response) {
            console.error('Response data:', error.response);
        }
    }
}

test();
