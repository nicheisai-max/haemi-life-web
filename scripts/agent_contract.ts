/**
 * 📜 AGENT EXECUTION CONTRACT (Deterministic Guard)
 * 
 * Rules:
 * 1. Commands must match strict whitelist regex patterns.
 * 2. Unrecognized commands trigger immediate process termination.
 * 3. No arbitrary string interpolation or unknown binaries allowed.
 */

export const ALLOWED_COMMANDS = [
    /^npm\s+run\s+[a-zA-Z0-9:-]+(\s+--prefix\s+[a-z]+)?$/i,
    /^npm\s+ci$/i,
    /^npm\s+install$/i,
    /^git\s+status(\s+-sb|\s+--porcelain)?$/i,
    /^git\s+add\s+.+$/i,
    /^git\s+commit\s+-m\s+".+"(\s+--no-verify)?$/i,
    /^git\s+checkout\s+[a-zA-Z0-9\/-]+$/i,
    /^git\s+checkout\s+-b\s+[a-zA-Z0-9\/-]+$/i,
    /^git\s+rev-parse\s+--abbrev-ref\s+HEAD$/i,
    /^git\s+rev-parse\s+[a-zA-Z0-9]+$/i,
    /^git\s+diff(\s+--staged|\s+--name-only|\s+--cached|\s+--diff-filter=[A-Z]+|\s+--cached\s+--name-only\s+--diff-filter=ACM)?$/i,
    /^git\s+fetch(\s+origin)?(\s+--prune)?$/i,
    /^git\s+pull(\s+origin\s+[a-z]+)?$/i,
    /^git\s+remote\s+prune\s+origin$/i,
    /^git\s+branch(\s+-a)?$/i,
    /^git\s+branch\s+--merged\s+main$/i,
    /^git\s+branch\s+--list\s+".+"$/i,
    /^git\s+branch\s+-[dD]\s+[a-zA-Z0-9\/-]+$/i,
    /^git\s+reset\s+--hard\s+origin\/main$/i,
    /^git\s+clean\s+-fd$/i,
    /^git\s+push\s+origin\s+--delete\s+[a-zA-Z0-9\/-]+\s+--no-verify$/i,
    /^node\s+scripts\/[a-zA-Z0-9_-]+\.js/i,
    /^tsx\s+scripts\/[a-zA-Z0-9_-]+\.ts/i,
    /^npx\s+tsc\s+--noEmit/i,
    /^netstat\s+-ano\s+\|\s+findstr\s+:[0-9]+$/i,
    /^taskkill\s+\/F\s+\/PID\s+[0-9]+\s+\/T$/i,
    /^taskkill\s+\/pid\s+[0-9]+\s+\/f\s+\/t$/i
];

export function validateAgentCommand(command: string): void {
    const isWhitelisted = ALLOWED_COMMANDS.some(pattern => pattern.test(command.trim()));
    
    if (!isWhitelisted) {
        console.error(`🛑 [CONTRACT VIOLATION] Unrecognized or non-deterministic command: "${command}"`);
        console.error('   AI Agent restricted to strict whitelist execution.');
        process.exit(1);
    }
    
    console.log(`📜 [CONTRACT] Validation Passed: ${command}`);
}
