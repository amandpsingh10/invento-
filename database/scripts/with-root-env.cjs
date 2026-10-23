#!/usr/bin/env node
/**
 * Loads the repo-root .env, then runs the command passed as argv, with
 * proper argv-array passing (no shell-string re-parsing of quoted flags).
 *
 * This replaces an earlier dotenv-cli-based setup: chaining
 * `npx dotenv -e ../.env -- npx prisma ...` through npm's own `-w`/`--`
 * argument forwarding intermittently dropped flags (observed: `--name`
 * vanishing from `prisma migrate dev --name init`, which made Prisma fall
 * back to its interactive "enter a migration name" prompt — with no TTY
 * attached in a background/CI run, that hangs forever with no output or
 * error). Spawning directly with an explicit argv array sidesteps that
 * class of bug entirely.
 *
 * Usage (from database/package.json): node scripts/with-root-env.cjs npx prisma migrate dev
 */
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("Usage: with-root-env.cjs <command> [...args]");
  process.exit(1);
}

const result = spawnSync(command, args, {
  stdio: "inherit",
  shell: process.platform === "win32", // resolves npx.cmd/prisma.cmd shims on Windows
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
