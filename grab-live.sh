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

# Get the JSON output of the playlist
stdout=$(yt-dlp --cookies $cookies_file --flat-playlist --match-filter "is_live" https://www.youtube.com/@JKT48TV --print-json)

# Transform and filter the live streams
yt_url=$(echo "$stdout" | jq -r 'select(.is_live == true) | .url' | head -n 1)

# Check if a URL was found
if [ -z "$yt_url" ]; then
  echo "No live streams found."
  exit 1
fi

URL="$yt_url"
yt-dlp --live-from-start --cookies $cookies_file --merge-output-format mkv $URL -o output.mkv
