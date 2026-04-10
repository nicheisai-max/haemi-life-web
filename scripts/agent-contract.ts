const ALLOWED_COMMAND_PREFIXES = [
  "git",
  "npm",
  "node",
  "npx",
  "tsx"
]

export function validateAgentCommand(command: string) {
  const normalized = command.trim()

  const allowed = ALLOWED_COMMAND_PREFIXES.some(prefix =>
    normalized.startsWith(prefix)
  )

  if (!allowed) {
    console.error(`🛑 GOVERNANCE CONTRACT VIOLATION: ${command}`)
    process.exit(1)
  }

  console.log(`📜 CONTRACT OK: ${command}`)
}

if (require.main === module) {
  console.log("Governance contract audit mode")
}
