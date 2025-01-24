# Stage 1: Build stage
FROM node:20-slim AS build

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json first to utilize Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy only necessary source files
COPY . .

# Build the application (if needed)
RUN npm run build

# Stage 2: Runtime stage
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install required system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip install --no-cache-dir yt-dlp

# Copy built application from build stage
WORKDIR /app
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package*.json /app/

# Install only production dependencies
RUN npm ci --omit=dev --only=production && \
    rm -rf /tmp/* /root/.npm

# Expose application port (adjust as per your app)
EXPOSE 8080

# Default command
CMD ["node", "dist"]
