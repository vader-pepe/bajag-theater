# !/bin/bash

# Check if the COOKIES environment variable is set and not empty
if [ -n "$COOKIES" ]; then
  cookies_file="$COOKIES"
else
  # If COOKIES is not set, check for the command-line argument
  if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <cookies_file> or set the COOKIES environment variable."
    exit 1
  fi
  cookies_file="$1"
fi

# Check if the specified file exists
if [ ! -f "$cookies_file" ]; then
  echo "Error: The file '$cookies_file' does not exist."
  exit 1
fi

URL="https://www.youtube.com/@JKT48TV/live"
yt-dlp --cookies $cookies_file $URL -o - | ffmpeg -i pipe:0 -c:v libx264 -preset veryslow -crf 18 -c:a aac -b:a 192k -profile:v high -level 4.1 -s 1920x1080 -pix_fmt yuv420p -fflags nobuffer -probesize 32 -hls_time 2 -hls_list_size 0 -f hls video/output.m3u8
