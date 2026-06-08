import { scenario } from "@hasan-qa-humans/core";

/**
 * Probes discovered parameterless GET endpoints using an authenticated session
 * (falling back to guest) and flags any HTTP 5xx. Strictly read-only and never
 * touches production thanks to the safety guard already enforced by the runner.
 */
export default scenario({
  id: "api.basicHealth",
  title: "API basic health (authenticated GET probes)",
  roles: ["admin", "merchant", "customer", "guest"],
  tags: ["api", "smoke"],
  severity: "high",
  run: async ({ humans, graph, skip }) => {
    const role = ["admin", "merchant", "customer"].find((r) => humans.has(r)) ?? "guest";
    const human = humans.get(role);

    const endpoints = graph.apiEndpoints
      .filter((e) => (e.method === "GET" || e.method === "ANY") && e.path.startsWith("/"))
      .filter((e) => !e.path.includes(":") && !e.path.includes("["))
      .slice(0, 15);

    if (endpoints.length === 0) {
      skip("No parameterless GET endpoints were discovered to probe.");
    }

    const failures: string[] = [];
    for (const ep of endpoints) {
      const res = await human.apiGet(ep.path);
      if (res.status >= 500) failures.push(`${ep.path} → ${res.status}`);
    }

    if (failures.length > 0) {
      throw new Error(`API endpoints returned server errors: ${failures.join(", ")}`);
    }
  },
});
