import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./lib/prisma";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`PARTS INVENTORY SYSTEM API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  logger.info(`API docs available at ${env.API_URL}/api/docs`);
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
