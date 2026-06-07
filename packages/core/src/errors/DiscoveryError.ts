import { QaError } from "./QaError.js";

export class DiscoveryError extends QaError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "DISCOVERY_ERROR", details);
  }
}
