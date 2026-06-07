import dotenv from "dotenv";
import path from "node:path";
import { fs } from "./file.js";

/**
 * Loads environment variables from a `.env.qa` style file if present.
 * Returns the list of files that were loaded so the CLI can report them.
 */
export function loadQaEnv(root: string, files: string[] = [".env.qa", ".env"]): string[] {
  const loaded: string[] = [];
  for (const file of files) {
    const full = path.resolve(root, file);
    if (fs.existsSync(full)) {
      dotenv.config({ path: full, override: false });
      loaded.push(file);
    }
  }
  return loaded;
}

export function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}
