# Stage 0: Get NVENC-enabled FFmpeg from a prebuilt image
FROM willprice/nvidia-ffmpeg AS nvffmpeg

# Stage 1: Base application image
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install python3 (ffmpeg is omitted here so we can use the one from nvffmpeg)
RUN apt-get update && apt-get install -y python3 && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm
WORKDIR /app
COPY . /app

# Stage 2: Install production dependencies
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod 

# Stage 3: Build your app (install all dependencies and build to /app/dist)
FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install 
# Run your build command to generate /app/dist
RUN pnpm build

# Stage 4: Final image
FROM base AS final
# Copy the NVENC-enabled ffmpeg binary and its libraries from nvffmpeg stage
COPY --from=nvffmpeg /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=nvffmpeg /usr/local/lib /usr/local/lib

# Copy over the Node.js app's node_modules and build output
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

EXPOSE 3000
CMD [ "pnpm", "start" ]
