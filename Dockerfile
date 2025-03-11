#############################
# Stage 0: Get NVENC‑enabled FFmpeg
#############################
# Use a prebuilt FFmpeg image that’s built with NVENC support.
FROM jrottenberg/ffmpeg:5.1-nvidia AS nvffmpeg
# (We do not run any apt commands here—we simply use this image to copy its FFmpeg binary and libraries)

#############################
# Stage 1: Base application image (Node)
#############################
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install only the essentials (here: python3 is installed)
RUN apt-get update && \
    apt-get install -y python3 && \
    rm -rf /var/lib/apt/lists/*
    
# Install pnpm globally
RUN npm install -g pnpm

# Set work directory and copy app code
WORKDIR /app
COPY . /app

#############################
# Stage 2: Install production dependencies
#############################
FROM base AS prod-deps
# Use mount cache if available (optional)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod 

#############################
# Stage 3: Build the application
#############################
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install
# Run your build command (assumes it generates /app/dist)
RUN pnpm build

#############################
# Stage 4: Final image
#############################
FROM base AS final
# Copy NVENC‑enabled ffmpeg binary and its libraries from the nvffmpeg stage
COPY --from=nvffmpeg /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=nvffmpeg /usr/local/lib /usr/local/lib

# Copy Node modules and build output from earlier stages
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

EXPOSE 3000
CMD ["pnpm", "start"]
