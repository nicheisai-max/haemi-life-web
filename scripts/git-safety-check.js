const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

function checkHistory() {
    if (process.env.SANDBOX_MODE === 'true') {
        console.log("⚠️ Enterprise Safety Guard: Destructive operation safely permitted within Sandbox Mode.");
        return;
    }

    const dangerousCommands = ['reset --hard', 'clean -fd', 'push --force', 'rebase --hard'];

    const historyFiles = [
        path.join(os.homedir(), '.bash_history'),
        path.join(os.homedir(), '.zsh_history'),
        path.join(os.homedir(), 'AppData', 'Roaming', 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine', 'ConsoleHost_history.txt')
    ];

    for (const file of historyFiles) {
        if (fs.existsSync(file)) {
            try {
                const content = fs.readFileSync(file, 'utf8');
                // Check only recent history to avoid infinite block (last 20 lines)
                const lines = content.split('\n').filter(Boolean).slice(-20);
                for (const line of lines) {
                    for (const cmd of dangerousCommands) {
                        if (line.includes(cmd)) {
                            console.error(`\n❌ Enterprise Safety Guard: Destructive Git command detected.`);
                            console.error(`Blocked command found in history: ${cmd}`);
                            console.error(`Run with SANDBOX_MODE=true to bypass if this is intentional.`);
                            process.exit(1);
                        }
                    }
                }
            } catch (err) {
                // Ignore read errors
            }
        }
    }

    console.log("✅ Enterprise Safety Guard: No destructive commands detected in recent history.");
}

checkHistory();
