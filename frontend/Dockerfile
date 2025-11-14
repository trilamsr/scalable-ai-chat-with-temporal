# syntax=docker/dockerfile:1.4
# Frontend Production Dockerfile - Optimized multi-stage build for monorepo

# Stage 1: Build stage (shared + frontend)
FROM node:18-alpine AS builder

WORKDIR /app

# Copy root package.json for workspace configuration
COPY package.json ./

# Copy all package files for dependency resolution
COPY shared/package*.json ./shared/
COPY frontend/package*.json ./frontend/
COPY shared/tsconfig.json ./shared/
COPY frontend/tsconfig.json ./frontend/

# Copy frontend configuration files
COPY frontend/tailwind.config.js ./frontend/
COPY frontend/postcss.config.js ./frontend/

# Install all dependencies once (including dev dependencies for building)
RUN --mount=type=cache,target=/root/.npm \
    npm install --workspaces --legacy-peer-deps

# Copy source files
COPY shared/src ./shared/src
COPY frontend/src ./frontend/src
COPY frontend/public ./frontend/public

# Build shared first, then frontend
RUN npm run build --workspace=shared && \
    npm run build --workspace=frontend

# Stage 2: Production runtime with nginx
FROM nginx:alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx || true

# Copy the build output to nginx html directory (no node_modules needed!)
COPY --from=builder /app/frontend/build /usr/share/nginx/html

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Update nginx.conf to run as non-root (create temporary directory for nginx)
RUN mkdir -p /var/cache/nginx /var/run /var/log/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/run /var/log/nginx /usr/share/nginx/html && \
    chmod -R 755 /var/cache/nginx /var/run /var/log/nginx

# Update nginx config to use unprivileged port
RUN sed -i 's/listen\s*80;/listen 8080;/' /etc/nginx/conf.d/default.conf || true

# Switch to non-root user
USER nginx

# Expose port 8080 (unprivileged port)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
