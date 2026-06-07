import pc from "picocolors";

export type LogLevel = "debug" | "info" | "warn" | "error" | "success";

let verbose = false;

export function setVerbose(value: boolean): void {
  verbose = value;
}

function ts(): string {
  return new Date().toISOString().slice(11, 19);
}

export const logger = {
  debug(message: string, ...rest: unknown[]): void {
    if (!verbose) return;
    console.log(pc.dim(`[${ts()}] debug`), pc.dim(message), ...rest);
  },
  info(message: string, ...rest: unknown[]): void {
    console.log(pc.cyan(`[${ts()}] info `), message, ...rest);
  },
  warn(message: string, ...rest: unknown[]): void {
    console.warn(pc.yellow(`[${ts()}] warn `), pc.yellow(message), ...rest);
  },
  error(message: string, ...rest: unknown[]): void {
    console.error(pc.red(`[${ts()}] error`), pc.red(message), ...rest);
  },
  success(message: string, ...rest: unknown[]): void {
    console.log(pc.green(`[${ts()}] ok   `), pc.green(message), ...rest);
  },
  raw(message: string): void {
    console.log(message);
  },
};

export { pc };
