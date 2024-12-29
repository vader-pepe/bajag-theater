# Teater Show Downloader

This script processes a cookies file. It can either be run directly on your machine or within a Docker container.

## Usage

### Option 1: Running with Docker

1. **Build the Docker image:**

   To build the Docker image, run the following command:

   ```bash
   docker build -t theater .
   ```
2. **Run the Docker container:**
   To run the script inside a Docker container, use this command. Make sure to set the ```COOKIES``` environment        variable to the path of your cookies file:

   ```bash
   docker run --rm -e COOKIES=/path/to/cookies_file --name theater-container -v ./:/downloads theater
   ```
  - `--rm`: Automatically removes the container after it exits.
  - `-e COOKIES=/path/to/cookies_file`: Sets the `COOKIES` environment variable inside the container.

If the `COOKIES` environment variable is set, the script will use it to locate the cookies file. If not, it will fall back to using a command-line argument (described below).

### Option 2: Running Directly

If you prefer to run the script directly on your local machine:

1. **Make the script executable:**

First, ensure the script is executable. If it's not, run:

```bash
chmod +x script.sh
```

2. **Run the script:**

Execute the script with the path to your cookies file as an argument:
```bash
./script.sh /path/to/cookies_file
```

### Script Behavior

- The script first checks if the `COOKIES` environment variable is set and uses it as the path to the cookies file.
- If `COOKIES` is not set, the script will look for a command-line argument (`$1`) for the file path.
- If neither is provided, the script will print an error message and exit.
- The script then checks if the specified cookies file exists, and if so, it processes the file (currently, it simply prints the file's contents).
