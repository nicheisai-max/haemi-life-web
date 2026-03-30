import axios from 'axios';
import { logger } from './logger';

const HEALTH_URL = 'http://localhost:5000/health';
const MAX_RETRIES = 60; // 60 seconds
const RETRY_INTERVAL = 1000;

async function waitForBackend() {
    logger.info(`[WAIT] Waiting for backend at ${HEALTH_URL}...`);

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await axios.get(HEALTH_URL, { timeout: 2000 });
            // We'll update the backend to return status: "up" and database: "connected"
            if (response.status === 200 && response.data.server === 'up' && response.data.database === 'connected') {
                logger.info('\n[WAIT] Backend is UP and Healthy.');
                process.exit(0);
            }
        } catch {
            // Silence errors during polling
        }

        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
    }

    logger.error(`\n[WAIT] Backend failed to become healthy after ${MAX_RETRIES} attempts.`);
    process.exit(1);
}

waitForBackend().catch(err => {
    logger.error(`[WAIT] Poller crashed: ${err.message}`);
    process.exit(1);
});
