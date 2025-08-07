# FILE LOCATION: /docker/dev/Dockerfile
#
# This is a single, reusable Dockerfile for all Node.js/Bun services.
# It handles user permissions and uses Docker layer caching effectively.

# Use Node.js version 22 with Alpine 3.22
FROM node:22-alpine3.22

# Build arguments for user configuration, with default values
ARG UID=1000
ARG GID=1000
ARG UNAME=devuser
ARG GNAME=devgroup

# Create new group and user with specified UID/GID
# This avoids deleting system users and is more direct.
RUN addgroup -g ${GID} ${GNAME} && \
    adduser -D -u ${UID} -G ${GNAME} -s /bin/sh ${UNAME}

# Set HOME environment variable for the new user
ENV HOME /home/${UNAME}

# Install bun globally
RUN npm install -g bun

# Set working directory and ensure proper ownership
WORKDIR /app
RUN chown -R ${UID}:${GID} /app

# Switch to the non-root user for security
USER ${UID}:${GID}

# Copy package files first to leverage Docker cache
COPY --chown=${UID}:${GID} package*.json bun.lockb* ./

# Copy the rest of the source code
COPY --chown=${UID}:${GID} . .

# Note: Dependencies will be installed at runtime by the smart sync script

# Default command to run. This will be overridden by docker-compose,
# but it's good practice to have a default.
CMD ["bun", "run", "dev"]
