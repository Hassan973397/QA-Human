import fs from "fs-extra";
import path from "node:path";
import { stableStringify, safeParse } from "./safeJson.js";

export async function ensureDir(dir: string): Promise<void> {
  await fs.ensureDir(dir);
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, stableStringify(data), "utf8");
}

export async function readJson<T = unknown>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return safeParse<T>(content, fallback);
  } catch {
    return fallback;
  }
}

export async function writeText(filePath: string, text: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, text, "utf8");
}

export async function readTextSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  return fs.pathExists(filePath);
}

export async function copyIfMissing(src: string, dest: string): Promise<boolean> {
  if (await fs.pathExists(dest)) return false;
  await fs.ensureDir(path.dirname(dest));
  await fs.copy(src, dest);
  return true;
}

export { fs };
