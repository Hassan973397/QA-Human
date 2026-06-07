import type { QaConfig } from "../config/schema.js";
import type { AppKnowledgeGraph } from "../knowledge/types.js";
import type { ScenarioReporter } from "../reporting/QaReporter.js";
import type { HumanAgent } from "../human/HumanAgent.js";
import { ScenarioSkip } from "../errors/ScenarioError.js";
import { joinUrl } from "../utils/path.js";
import type { ApiClient, ApiResponse, Humans, ScenarioContext } from "./types.js";

/** Map-backed Humans accessor with typed convenience methods per known role. */
export class HumansImpl implements Humans {
  constructor(private readonly map: Map<string, HumanAgent>) {}

  get(role: string): HumanAgent {
    const human = this.map.get(role);
    if (!human) {
      throw new ScenarioSkip(`Role "${role}" is not available for this scenario.`);
    }
    return human;
  }
  has(role: string): boolean {
    return this.map.has(role);
  }
  guest(): HumanAgent {
    return this.get("guest");
  }
  customer(): HumanAgent {
    return this.get("customer");
  }
  merchant(): HumanAgent {
    return this.get("merchant");
  }
  merchantB(): HumanAgent {
    return this.get("merchantB");
  }
  agent(): HumanAgent {
    return this.get("agent");
  }
  employee(): HumanAgent {
    return this.get("employee");
  }
  admin(): HumanAgent {
    return this.get("admin");
  }
}

/** Minimal fetch-based API client scoped to the app base URL. */
export class HttpApiClient implements ApiClient {
  constructor(private readonly baseUrl: string) {}

  async request(method: string, path: string, init: RequestInit = {}): Promise<ApiResponse> {
    const url = joinUrl(this.baseUrl, path);
    const res = await fetch(url, { ...init, method });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw text */
    }
    return { status: res.status, ok: res.ok, body };
  }
  get(path: string, init?: RequestInit): Promise<ApiResponse> {
    return this.request("GET", path, init);
  }
  post(path: string, body?: unknown, init: RequestInit = {}): Promise<ApiResponse> {
    return this.request("POST", path, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}

export interface BuildContextInput {
  humansMap: Map<string, HumanAgent>;
  graph: AppKnowledgeGraph;
  reporter: ScenarioReporter;
  config: QaConfig;
  sharedMemory: Map<string, unknown>;
}

export function buildScenarioContext(input: BuildContextInput): ScenarioContext {
  const humans = new HumansImpl(input.humansMap);
  const api = new HttpApiClient(input.config.app.baseUrl);

  const skip = (reason: string): never => {
    throw new ScenarioSkip(reason);
  };

  return {
    humans,
    graph: input.graph,
    report: input.reporter,
    config: input.config,
    sharedMemory: input.sharedMemory,
    api,
    skip,
    requireRole(role: string) {
      if (!humans.has(role)) skip(`Required role "${role}" is not available (missing credentials?).`);
      return humans.get(role);
    },
    requireRoute(route: string) {
      const configured = input.config.routes[route];
      if (configured) return configured;
      const discovered = input.graph.routes.find((r) => r.name === route);
      if (discovered) return discovered.path;
      if (route.startsWith("/")) return route;
      return skip(`Required route "${route}" was not found in config or discovery.`);
    },
    requireFeature(feature: string) {
      if (!input.graph.features.includes(feature)) {
        skip(`Feature not detected in discovery: ${feature}`);
      }
    },
  };
}
