const fs = require('fs');
const path = require('path');

// Purge all .js files in src to prevent module resolution conflicts
const srcDir = path.join(__dirname, '../backend/src');

function purgeJs(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            purgeJs(fullPath);
        } else if (file.endsWith('.js')) {
            fs.unlinkSync(fullPath);
            console.log(`Deleted stale artifact: ${fullPath}`);
        }
    });
}

try {
    purgeJs(srcDir);
} catch (e) {
    // Silent fail if path not found
}
