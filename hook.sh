#!/bin/bash

# Wrapper script
main_command="$1"
shift
args="$@"
current_date=$(date +"%Y-%m-%d_%H-%M-%S")

# Run the main command
$main_command $args

# Check the exit status of the command
if [ $? -eq 0 ]; then
  echo "Command executed successfully. Running the hook..."
  ffmpeg -i video/output.m3u8 -c copy -f matroska video/output.mkv
  mv video/output.mkv video/"${current_date}.mkv"
  echo "Post-command hook executed."
else
  echo "Command failed. Hook skipped."
fi
