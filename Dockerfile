# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=20.10.0
FROM node:${NODE_VERSION}-slim as base

LABEL runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install pnpm
ARG PNPM_VERSION=9
RUN npm install -g pnpm@$PNPM_VERSION

# Throw-away build stage to reduce size of final image
FROM base as build

# Install node modules
COPY --link package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy application code
COPY --link . .

# Build application
RUN pnpm run build

# Remove development dependencies
RUN pnpm prune --prod

# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

EXPOSE 3000

# Run the dist/index.js file
CMD ["node", "dist/index.js"]
