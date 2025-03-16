import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YTDlpWrap from "yt-dlp-wrap";

import { parseNetscapeCookies, transformInput } from "@/common/utils/dataMapping";
import { getFormattedDate } from "@/common/utils/date";
import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";

const { NODE_ENV, HOST, PORT } = env;
const server = app.listen(env.PORT, () => {
  logger.info(`Server (${NODE_ENV}) running on port http://${HOST}:${PORT}`);
});

const onCloseSignal = () => {
  logger.info("sigint received, shutting down");
  server.close(() => {
    logger.info("server closed");
    process.exit();
  });
  setTimeout(() => process.exit(1), 10000).unref(); // Force shutdown after 10s
};

async function getLatestYTDlpVersion() {
  const raw = await fetch("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest");
  const json = await raw.json();
  return json?.tag_name as string;
}

async function ensureLatestYTDlp() {
  const localVersion = await getLocalYTDlpVersion();
  const latestVersion = await getLatestYTDlpVersion();

  if (!latestVersion) {
    logger.warn("Unable to fetch the latest yt-dlp version. Skipping update check.");
    return;
  }

  if (localVersion.trim() !== latestVersion.trim()) {
    logger.info(`Updating yt-dlp: Local version (${localVersion}) != Latest version (${latestVersion})`);
    try {
      await YTDlpWrap.downloadFromGithub();
      logger.info("yt-dlp has been updated to the latest version.");
    } catch (error) {
      logger.error("Error updating yt-dlp:", error);
    }
  } else {
    logger.info("yt-dlp is already up-to-date.");
  }
}

async function getLocalYTDlpVersion() {
  const ytdlPath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlPath}/yt-dlp`);
  const version = await ytDlpWrap.execPromise(["--version"]);
  return version;
}

async function downloadStream(
  url: string,
  quality: string,
  cookiesPath: string,
  outputFile: string,
  maxRetries = 3,
): Promise<void> {
  let attempts = 0;

  while (attempts < maxRetries) {
    attempts++;
    logger.info(`Starting stream download attempt ${attempts}`);
    // Mark as downloading (for your service logic)
    await writeFile("isDownloading", "true");

    // Build the Streamlink arguments.
    // Using --hls-live-restart to start the stream from the beginning.
    // The --player= option forces Streamlink to not launch any external player.
    const args: string[] = ["--hls-live-restart", url, quality, "--no-config", "--player=", "-o", outputFile];

    // If a cookie file is provided, read and parse it, then pass each cookie.
    if (cookiesPath) {
      try {
        const cookieContent = await readFile(cookiesPath, "utf-8");
        const cookies = parseNetscapeCookies(cookieContent);
        cookies.forEach((cookie) => {
          args.push("--http-cookie");
          args.push(cookie);
        });
      } catch (err) {
        logger.error("Error reading cookie file:", err);
        await writeFile("isDownloading", "false");
        throw err;
      }
    }

    // Log the complete command for debugging.
    const commandStr = `streamlink ${args.map((arg) => `"${arg}"`).join(" ")}`;
    logger.info(`Executing command:${commandStr}`);

    // Spawn the Streamlink process.
    const proc = spawn("streamlink", args);

    // Optionally listen to stdout for progress information.
    proc.stdout.on("data", (data: Buffer) => {
      logger.info(`Progress: ${data.toString()}`);
    });
    // Log any error output.
    proc.stderr.on("data", (data: Buffer) => {
      logger.error(`Streamlink error output: ${data.toString()}`);
    });

    // Wait for the process to complete.
    const exitCode: number = await new Promise((resolve) => {
      proc.on("close", resolve);
    });

    if (exitCode === 0) {
      logger.info("Stream download completed successfully.");
      await writeFile("isDownloading", "false");
      // Clear URL or perform any post-download cleanup.
      await writeFile("url", "");
      break;
    } else {
      logger.error(`Download failed with exit code ${exitCode}. Retrying in 10 seconds...`);
      await writeFile("isDownloading", "false");
      // Wait before retrying.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  if (attempts >= maxRetries) {
    logger.error("Exceeded maximum retry attempts. Download failed.");
  }
}

setInterval(async () => {
  const cookiesPath = path.resolve("cookies/cookies");
  const date = getFormattedDate();
  const output = `video/${date}.ts`;
  const channel = env.isProd ? "https://www.youtube.com/@JKT48TV" : "https://www.youtube.com/@LofiGirl";
  const ytdlPath = path.resolve(".");
  const ytDlpWrap = new YTDlpWrap(`${ytdlPath}/yt-dlp`);

  const isDownloading = (await readFile("isDownloading", "utf8").catch(() => "")) === "true";
  let url = await readFile("url", "utf8").catch(() => "");

  await ensureLatestYTDlp();
  const checkLivestream = async (url: string, cookiesPath: string, ytDlpWrap: YTDlpWrap): Promise<boolean> => {
    if (!url) {
      logger.error("URL is missing. Skipping livestream status check.");
      return false;
    }

    try {
      const live_status = await ytDlpWrap.execPromise(["--print", "is_live", "--cookies", cookiesPath, url]);
      return live_status.trim() === "True"; // true if livestream is ongoing
    } catch (error) {
      logger.error("Error while checking livestream status:");
      logger.error(error);
      return false;
    }
  };

  // Fetch URL if not present
  if (!url) {
    logger.info(`Fetching URL for ${channel}`);
    try {
      const stdout = await ytDlpWrap.execPromise([
        "--cookies",
        cookiesPath,
        "--flat-playlist",
        "--match-filter",
        "is_live",
        channel,
        "--print-json",
      ]);

      const altered = transformInput(stdout);
      const filtered = altered.filter((item) => item.is_live === true);
      const tempUrl = filtered?.[0]?.url || "";
      if (!tempUrl) {
        logger.info("No live stream found");
        return;
      }
      logger.info(`URL found: ${tempUrl}`);
      await writeFile("url", tempUrl);
      url = tempUrl;
    } catch (error) {
      logger.error("Error fetching URL:", error);
      logger.error(error);
      return;
    }
  }

  // Check if livestream is ongoing
  const livestreamOngoing = await checkLivestream(url, cookiesPath, ytDlpWrap);

  if (livestreamOngoing) {
    logger.info(`Livestream found. ${isDownloading ? "Download process already started" : "Downloading"}`);

    // Start download if not already downloading
    if (!isDownloading) {
      await downloadStream(url, "best", cookiesPath, output, 20);
    }
  }
}, 60 * 1000);

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
