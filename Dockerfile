# Stage 1: Build Client
FROM oven/bun:1 as client-builder
WORKDIR /app/client
COPY client/package.json client/bun.lockb ./
RUN bun install
COPY client .
RUN bun run build

# Stage 2: Build Server
FROM oven/bun:1 as server-builder
WORKDIR /app/server
COPY server/package.json server/bun.lockb ./

RUN bun install
COPY server .
# Move src files (already in right place)
# Build not strictly necessary for bun but good for checking types?
# Bun runs ts directly.

# Stage 3: Production Image
FROM oven/bun:1-slim
WORKDIR /app

# Copy server dependencies and source
COPY --from=server-builder /app/server/node_modules ./node_modules
COPY --from=server-builder /app/server/src ./src
RUN echo "--- BUILD SCRIPT CHECK ---" && cat ./src/db/migrations/001_multi_user_schema.sql && echo "--- END CHECK ---"
COPY --from=server-builder /app/server/package.json .
COPY --from=server-builder /app/server/tsconfig.json .
COPY --from=server-builder /app/server/apply-migration.ts .
COPY --from=server-builder /app/server/drizzle.config.ts .
COPY CHANGELOG.md .

# Copy built client to a static directory served by Hono
# We need to ensure Hono serves this
COPY --from=client-builder /app/client/dist ./public

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start command
COPY server/start.sh .
RUN chmod +x start.sh

CMD ["./start.sh"]
