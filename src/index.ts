import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import YTDlpWrap from "yt-dlp-wrap";

import { transformInput } from "@/common/utils/dataMapping";
import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";
import { getFormattedDate } from "./common/utils/date";

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

setInterval(async () => {
  const cookiesPath = path.resolve("cookies/cookies");
  const date = getFormattedDate();
  const mkvOutput = `video/${date}.mkv`;
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
      logger.info("Starting stream download");
      await writeFile("isDownloading", "true");

      const video = ytDlpWrap.exec([
        "--live-from-start",
        url,
        "--cookies",
        cookiesPath,
        "--merge-output-format",
        "mkv",
        "--postprocessor-args",
        "-c:a aac -b:a 128k",
        "-o",
        mkvOutput,
      ]);

      video
        .on("progress", (progress) => {
          logger.info(`Progress: ${progress.percent}% | Speed: ${progress.currentSpeed} | ETA: ${progress.eta}`);
        })
        .on("ytDlpEvent", (eventType, eventData) => {
          logger.info(`Event: ${eventType} | Data: ${JSON.stringify(eventData)}`);
        })
        .on("error", async (error) => {
          logger.error("Download error occurred", error);
          await writeFile("isDownloading", "false");
        })
        .on("close", async () => {
          logger.info("Stream download completed or process ended");
          await writeFile("isDownloading", "false");

          // Clear URL after successful download
          logger.info("Clearing URL after successful download...");
          await writeFile("url", "");
        });

      logger.info(`Download process started with PID: ${video?.ytDlpProcess?.pid}`);
    }
  } else {
    logger.info("Livestream is ended.");
  }
}, 60 * 1000);

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
