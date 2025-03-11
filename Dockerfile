# Use an NVENC-enabled FFmpeg image as the base.
# (jrottenberg/ffmpeg:5.1-nvidia is Ubuntu‑based and comes with the right ffmpeg dependencies)
FROM jrottenberg/ffmpeg:5.1-nvidia AS base

# Install Node.js, Python3, and npm (adjust as needed).
RUN apt-get update && \
    apt-get install -y curl python3 nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm globally.
RUN npm install -g pnpm

# (Optional) set PNPM environment variables.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH:/usr/local/bin:/usr/bin"

# Set the working directory and copy your app.
WORKDIR /app
COPY . /app

# Stage: Install production dependencies.
FROM base AS prod-deps
RUN pnpm install --prod

# Stage: Build your app.
FROM base AS build
RUN pnpm install
RUN pnpm build

# Final stage: use the same base (which already has all ffmpeg dependencies)
FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

EXPOSE 3000
CMD ["pnpm", "start"]
