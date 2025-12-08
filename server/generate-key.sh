# Generate a secure master encryption key
bun run -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
