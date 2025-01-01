# Use a lightweight base image
FROM python:3.11-alpine

# Set environment variables for non-interactive builds
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install required packages
RUN apk add --no-cache \
    ffmpeg \
    curl \
    bash

# Install yt-dlp via pip
RUN pip install --no-cache-dir yt-dlp

# Create a directory for downloads
WORKDIR /downloads

# copy script from host
COPY script.sh .
RUN ls
RUN chmod +x script.sh

# Volume for persisting downloaded files
VOLUME ["/downloads"]

# Default command 
CMD ["tail","-f","/dev/null"]
