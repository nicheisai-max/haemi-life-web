module.exports = {
    apps: [
        {
            name: 'haemi-life-backend',
            script: 'npm',
            args: 'start',
            // Production Environment
            env: {
                NODE_ENV: 'production',
            },
            // Deployment Hardening
            instances: 1, // Explicitly single instance as requested
            exec_mode: 'fork',
            watch: false,
            autorestart: true,
            max_memory_restart: '500M',
            // Graceful Shutdown Support
            // PM2 will send SIGINT/SIGTERM and wait for our handlers in app.ts to complete
            shutdown_with_message: true,
            kill_timeout: 15000, // Matching our server.timeout
            // Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: 'logs/pm2-error.log',
            out_file: 'logs/pm2-out.log',
            merge_logs: true,
        },
    ],
};
