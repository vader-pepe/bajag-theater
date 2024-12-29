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
yt-dlp --cookies $cookies_file $URL -o output -f "bestvideo[height=1080][fps=60][vbr=20000]+bestaudio[acodec=aac][abr=140]"
current_date=$(date +"%Y-%m-%d_%H-%M-%S")
mv output "${current_date}"
