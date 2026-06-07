import type { QaConfig } from "../config/schema.js";
import type { HumanAgent } from "../human/HumanAgent.js";

export interface LoginResult {
  ok: boolean;
  reason?: string;
}

/**
 * Drives the generic login flow for a role using configured selectors + routes.
 * Returns ok=false (rather than throwing) when credentials are missing or the
 * login clearly did not take, so the caller can decide skip vs fail.
 */
export async function performLogin(
  human: HumanAgent,
  role: string,
  config: QaConfig,
): Promise<LoginResult> {
  const creds = config.roles[role];
  if (!creds?.email || !creds?.password) {
    return { ok: false, reason: `No credentials configured for role "${role}".` };
  }

  try {
    await human.open("login");
    await human.fill("emailInput", creds.email);
    await human.fill("passwordInput", creds.password);
    await human.click("loginButton");
    await human.waitForStablePage();
  } catch (error) {
    return { ok: false, reason: `Login flow failed for "${role}": ${(error as Error).message}` };
  }

  // Heuristic success check: we should no longer be sitting on the login page.
  const loginRoute = config.routes.login ?? "/login";
  const url = human.page.url();
  if (url.includes(loginRoute) || /\/(login|signin)\b/i.test(url)) {
    return { ok: false, reason: `Login for "${role}" did not leave the login page (check credentials).` };
  }
  return { ok: true };
}
