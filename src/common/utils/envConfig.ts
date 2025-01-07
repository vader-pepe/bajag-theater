import dotenv from "dotenv";
import { cleanEnv, host, makeValidator, num, port, str, testOnly } from "envalid";

dotenv.config();

const isValidPath = makeValidator((path) => {
  if (!path || typeof path !== "string") {
    throw new Error("Invalid path!");
  }

  const invalidChars = /[<>:"|?*]/;
  if (invalidChars.test(path)) {
    throw new Error("Invalid path!");
  }

  const reservedNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
  if (reservedNames.test(path.split(/[\\/]/).pop() || "")) {
    throw new Error("Invalid path!");
  }

  if (path.length > 260) {
    throw new Error("Too long!");
  }

  if (/[\s.\\/]$/.test(path)) {
    throw new Error("Path ends with an invalid character (space, dot, or slash).");
  }

  return path;
});

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ devDefault: testOnly("test"), choices: ["development", "production", "test"] }),
  HOST: host({ devDefault: testOnly("localhost") }),
  PORT: port({ devDefault: testOnly(3000) }),
  CORS_ORIGIN: str({ devDefault: testOnly("http://localhost:3000") }),
  COMMON_RATE_LIMIT_MAX_REQUESTS: num({ devDefault: testOnly(1000) }),
  COMMON_RATE_LIMIT_WINDOW_MS: num({ devDefault: testOnly(1000) }),
  COOKIES: isValidPath(),
});
