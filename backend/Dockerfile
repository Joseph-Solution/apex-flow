# Use Node.js LTS version
FROM node:18-alpine

# Build arguments for user configuration
ARG UID=1000
ARG GID=1000
ARG UNAME=apexuser
ARG GNAME=apexgroup

# Remove all default users and groups (except root and essential system ones)
RUN deluser --remove-home node || true
RUN delgroup ping || true
RUN delgroup dialout || true

# Create new group and user with specified UID/GID
RUN addgroup -g ${GID} ${GNAME}
RUN adduser -D -u ${UID} -G ${GNAME} -s /bin/sh ${UNAME}

# Install bun globally
RUN npm install -g bun

# Set working directory
WORKDIR /app

# Change ownership of the working directory
RUN chown -R ${UID}:${GID} /app

# Switch to the new user
USER ${UID}:${GID}

# Copy package files
COPY --chown=${UID}:${GID} package*.json bun.lockb* ./

# Install dependencies
RUN bun install

# Copy source code
COPY --chown=${UID}:${GID} . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["bun", "run", "dev"]