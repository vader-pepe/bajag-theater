import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import cron from "node-cron";

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

let scriptState = { error: false, message: "Script running smoothly", isDownloading: false };
// Function to start the Bash script and retain its state
const grabLive = () => {
  const script = spawn("sh", ["hook.sh", "sh", "grab-live.sh"], { shell: true });

  // Handle script's standard output
  script.stdout.on("data", (data) => {
    logger.info(`Script output on stdout: ${data}`);
    const message = data.toString();
    if (message.toLowerCase().includes("error")) {
      scriptState = { error: true, message: data.toString().trim(), isDownloading: false };
    }
  });

  // Handle script's standard error
  script.stderr.on("data", (data) => {
    const message = data.toString();
    const constant = "Downloading 1 format";
    if (message.includes(constant)) {
      logger.info("downloading has been started");
      scriptState = { error: true, message: data.toString().trim(), isDownloading: true };
    }
    if (message.toLowerCase().includes("error") || message.toLowerCase().includes("warning")) {
      logger.error(`Script error: ${data}`);
      scriptState = { error: true, message: data.toString().trim(), isDownloading: false };
    } else {
      scriptState = { error: false, message: data.toString().trim(), isDownloading: false };
      logger.info(`Script output on stderr: ${data}`);
    }
    scriptState = { error: false, message: data.toString().trim(), isDownloading: false };
  });

  // Handle script exit
  script.on("close", (code) => {
    if (code !== 0) {
      logger.error(`Script exited with code: ${code}`);
      scriptState = { error: true, message: `Script exited with code: ${code}`, isDownloading: false };
    } else {
      scriptState = { error: false, message: `Script exited with code: ${code}`, isDownloading: false };
      logger.info("Script exited normally.");
    }
  });

  return script;
};

// cron.schedule("* * * * *", async () => {
//   if (!scriptState.isDownloading) {
//     logger.info("Trying to grab live stream");
//     grabLive();
//   }
//
//   logger.info("Grabbing show schedule");
//   const raw = await fetch("https://jkt48.com/calendar/list?lang=id");
//   const data = await raw.text();
//   writeFileSync("src/calendar.html", data);
// });

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
