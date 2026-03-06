import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'nicheisai-max/haemi-life-web';
const HEAD = 'ai/sandbox-devops-upgrade-2026-03-06';
const BASE = 'main';

async function createPR() {
    try {
        const response = await axios.post(`https://api.github.com/repos/${REPO}/pulls`, {
            title: 'feat(ci): enterprise devops infrastructure upgrade',
            head: HEAD,
            base: BASE,
            body: 'Automated PR for Enterprise DevOps Infrastructure Upgrade. This includes security scanning, caching, auto-rollback, bundle guards, and PR labels.'
        }, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });
        console.log('PR successfully created:', response.data.html_url);
        console.log('PR_URL=' + response.data.html_url);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Failed to create PR:', error.response?.data || error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
        process.exit(1);
    }
}

createPR();
