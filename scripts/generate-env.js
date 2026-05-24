#!/usr/bin/env node
/**
 * Fill empty .env.local keys with safe local-dev defaults.
 * Does NOT overwrite non-empty values.
 */
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const ENV_PATH = path.join(process.cwd(), ".env.local");
const EXAMPLE_PATH = path.join(process.cwd(), ".env.example");

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function serializeEnv(map, templateContent) {
  const lines = [];
  const written = new Set();

  if (templateContent) {
    for (const line of templateContent.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) {
        lines.push("");
        continue;
      }
      if (trimmed.startsWith("#")) {
        lines.push(line);
        continue;
      }
      const eq = trimmed.indexOf("=");
      if (eq === -1) {
        lines.push(line);
        continue;
      }
      const key = trimmed.slice(0, eq);
      if (map.has(key)) {
        lines.push(`${key}=${map.get(key)}`);
        written.add(key);
      } else {
        lines.push(line);
      }
    }
  }

  for (const [key, value] of map.entries()) {
    if (!written.has(key)) lines.push(`${key}=${value}`);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64");
}

function main() {
  if (!fs.existsSync(ENV_PATH) && fs.existsSync(EXAMPLE_PATH)) {
    fs.copyFileSync(EXAMPLE_PATH, ENV_PATH);
    console.log("✓ Created .env.local from .env.example");
  }

  if (!fs.existsSync(ENV_PATH)) {
    console.error("No .env.local found. Copy .env.example first.");
    process.exit(1);
  }

  const template = fs.existsSync(EXAMPLE_PATH) ? fs.readFileSync(EXAMPLE_PATH, "utf8") : "";
  const content = fs.readFileSync(ENV_PATH, "utf8");
  const env = parseEnv(content);

  const defaults = {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/reviseai",
    BETTER_AUTH_SECRET: randomSecret(),
    CRON_SECRET: randomSecret(24),
    NEXT_PUBLIC_ENABLE_LOGIN_SKIP: "true",
  };

  let changed = 0;
  for (const [key, value] of Object.entries(defaults)) {
    const current = env.get(key);
    if (current === undefined || current === "") {
      env.set(key, value);
      changed++;
      console.log(`✓ Set ${key}${key.includes("SECRET") ? " (generated)" : ""}`);
    }
  }

  fs.writeFileSync(ENV_PATH, serializeEnv(env, template || content));
  console.log(`\n${changed ? "Environment updated." : "No empty keys needed defaults."}`);
}

main();
