# syntax=docker/dockerfile:1.4
# Backend Production Dockerfile - Optimized multi-stage build for monorepo

# Stage 1: Build stage (shared + backend)
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root package.json for workspace configuration
COPY package.json ./

# Copy all package files for dependency resolution
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/
COPY shared/tsconfig.json ./shared/
COPY backend/tsconfig.json ./backend/

# Install all dependencies once (including dev dependencies for building)
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspaces

# Copy source files
COPY shared/src ./shared/src
COPY backend/src ./backend/src

# Build shared first, then backend
RUN npm run build --workspace=shared && \
    npm run build --workspace=backend

# Stage 2: Production runtime
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy root package.json for workspace configuration
COPY package.json ./

# Copy package files
COPY shared/package*.json ./shared/
COPY backend/package*.json ./backend/

# Install only production dependencies for backend and shared workspaces
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspace=shared --workspace=backend --omit=dev && \
    npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/backend/dist ./backend/dist

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the WebSocket server port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set working directory to backend
WORKDIR /app/backend

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "dist/server.js"]
