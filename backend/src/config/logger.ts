import pino from "pino";
import { isProd } from "./env";

const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "password",
  "passwordHash",
  "newPassword",
  "token",
  "accessToken",
  "refreshToken",
  "*.password",
  "*.passwordHash",
  "*.token",
];

export const logger = pino({
  level: isProd ? "info" : "debug",
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  transport: isProd
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});
