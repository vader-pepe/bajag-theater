import { spawn } from "node:child_process";
import cron from "node-cron";

import { env } from "@/common/utils/envConfig";
import { app, logger } from "@/server";

const server = app.listen(env.PORT, () => {
  const { NODE_ENV, HOST, PORT } = env;
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
    logger.info(`Script output: ${data}`);
    scriptState = { error: false, message: data.toString().trim(), isDownloading: true };
  });

  // Handle script's standard error
  script.stderr.on("data", (data) => {
    const message = data.toString();
    if (message.includes("error") || message.toLowerCase().includes("warning")) {
      logger.error(`Script error: ${data}`);
    }
    logger.info(`Script output: ${data}`);
    scriptState = { error: true, message: data.toString().trim(), isDownloading: false };
  });

  // Handle script exit
  script.on("close", (code) => {
    if (code !== 0) {
      logger.error(`Script exited with code: ${code}`);
      scriptState = { error: true, message: `Script exited with code: ${code}`, isDownloading: false };
    } else {
      logger.info("Script exited normally.");
    }
  });

  return script;
};

// WARNING: for testing purpose!
// cron.schedule("* * * * *", async () => {
//   if (!scriptState.isDownloading) {
//     grabLive();
//   }
// });

// Schedule job from 18:45 to 19:00 Monday to Friday
cron.schedule("45-59 18 * * 1-5", async () => {
  if (!scriptState.isDownloading) {
    grabLive();
  }
});

// Schedule job from 14:00 to 19:00 Saturday and Sunday
cron.schedule("0-59 14-19 * * 6,7", () => {
  if (!scriptState.isDownloading) {
    grabLive();
  }
});

process.on("SIGINT", onCloseSignal);
process.on("SIGTERM", onCloseSignal);
