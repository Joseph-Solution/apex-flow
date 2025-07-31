# Use Node.js version 22 with Alpine 3.22
FROM node:22-alpine3.22

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

# Set HOME environment variable
ENV HOME /home/${UNAME}

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
RUN bun install --frozen-lockfile

# Copy source code
COPY --chown=${UID}:${GID} . .

# Ensure dependencies are available (reinstall if needed)
RUN bun install

# Make startup script executable
RUN chmod +x scripts/startup.sh

# Default command (can be overridden by docker-compose)
CMD ["./scripts/startup.sh", "bun", "run", "dev"]