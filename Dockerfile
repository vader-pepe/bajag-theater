# Stage 1: Build Stage
FROM node:18-alpine AS builder

# Install build tools for native modules (if needed)
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Stage 2: Final Stage
FROM alpine:3.18 AS runner

# Install yt-dlp and any runtime dependencies
RUN apk add --no-cache yt-dlp ffmpeg nodejs npm

# Set working directory
WORKDIR /app

# Copy necessary files from the build stage
COPY --from=builder /app /app

# Set environment variables
ENV NODE_ENV=production

# Expose the application's port
EXPOSE 3000

# Command to run your application
CMD ["node", "dist/index.js"]
