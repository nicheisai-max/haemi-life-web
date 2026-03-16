import { execSync } from "child_process"

const MAX_COMMANDS = 200

let commandCount = 0

export function run_safe_command(command: string) {
  commandCount++

  if (commandCount > MAX_COMMANDS) {
    console.error("🛑 WATCHDOG LIMIT EXCEEDED")
    process.exit(1)
  }

  console.log(`[WATCHDOG] ${command}`)

  try {
    execSync(command, { stdio: "inherit" })
  } catch (err) {
    console.error("WATCHDOG EXECUTION FAILURE")
    throw err
  }
}

if (require.main === module) {
  console.log("Watchdog audit mode")
}
