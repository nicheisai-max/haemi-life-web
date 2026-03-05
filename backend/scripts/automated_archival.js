const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = path.join(__dirname, '..', 'backups', 'archives');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const auditArchive = path.join(BACKUP_DIR, `audit_logs_archive_${timestamp}.sql`);
const chatArchive = path.join(BACKUP_DIR, `chat_history_archive_${timestamp}.sql`);

const pgDumpPath = '"C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe"';
const dbUrl = '-U postgres -h localhost -p 5432 digital_health_pharmacy_hub';

const commands = [
    {
        name: 'Audit Logs',
        cmd: `SET PGPASSWORD=Deepti@8143&& ${pgDumpPath} ${dbUrl} -t audit_logs > "${auditArchive}"`
    },
    {
        name: 'Chat History',
        cmd: `SET PGPASSWORD=Deepti@8143&& ${pgDumpPath} ${dbUrl} -t conversations -t messages -t message_reactions -t message_attachments > "${chatArchive}"`
    }
];

console.log('Starting automated enterprise archival process...');

commands.forEach(({ name, cmd }) => {
    exec(cmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`[ERROR] Failed to archive ${name}:`, error.message);
            return;
        }
        console.log(`[SUCCESS] ${name} archived successfully.`);
    });
});
