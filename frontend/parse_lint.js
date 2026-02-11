
import fs from 'fs';

let data = '';
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (chunk) {
    data += chunk;
});

process.stdin.on('end', function () {
    try {
        const start = data.indexOf('[');
        const end = data.lastIndexOf(']');
        if (start === -1 || end === -1) {
            console.log("No JSON found in stdin");
            // Print first 100 chars to debug
            console.log("DATA START:", data.substring(0, 100));
            return;
        }
        const jsonStr = data.substring(start, end + 1);
        const report = JSON.parse(jsonStr);

        report.forEach(file => {
            if (file.errorCount > 0) {
                console.log(`FILE: ${file.filePath}`);
                file.messages.forEach(msg => {
                    if (msg.severity === 2) {
                        console.log(`  Line ${msg.line}: [${msg.ruleId}] ${msg.message}`);
                    }
                });
            }
        });
    } catch (e) {
        console.log("Parse error:", e.message);
    }
});
