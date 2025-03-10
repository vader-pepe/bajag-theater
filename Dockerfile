# Stage 1: Build stage
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Copy the rest of the application code
COPY . .

# Copy package.json and package-lock.json
COPY package*.json ./

RUN npm i -g pnpm

# Install Node.js dependencies
RUN pnpm install --omit=dev

# Build the application (if needed)
RUN pnpm run build

# Stage 2: Runtime stage
FROM python:3.11-alpine

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install required packages for yt-dlp and Node.js runtime
RUN apk add --no-cache \
    ffmpeg \
    curl \
    bash \
    nodejs \
    npm

# Install yt-dlp
RUN pip install --no-cache-dir yt-dlp

# Copy the application from the build stage
WORKDIR /app
COPY --from=build /app /app

# Install production dependencies
RUN pnpm ci --omit=dev

# Expose application port (adjust as per your app)
EXPOSE 8080

# Default command
CMD ["node", "dist"]
