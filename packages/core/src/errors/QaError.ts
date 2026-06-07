/**
 * Base error for all Hasan QA Humans failures. Carries a machine-readable code
 * and optional structured details so reporters can classify problems.
 */
export class QaError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code = "QA_ERROR", details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
