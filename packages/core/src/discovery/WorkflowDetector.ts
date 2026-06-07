import type { ApiEndpoint, RouteNode, WorkflowNode } from "../knowledge/types.js";
import type { DetectorContext } from "./types.js";

interface WorkflowInputs {
  routes: RouteNode[];
  apiEndpoints: ApiEndpoint[];
  features: string[];
}

/**
 * Infers high-level workflows by looking at which routes, endpoints and
 * features were discovered. Each workflow records *why* it was inferred and a
 * confidence level so the report can be honest about assumptions.
 */
export function detectWorkflows(ctx: DetectorContext, inputs: WorkflowInputs): WorkflowNode[] {
  const workflows: WorkflowNode[] = [];
  const has = (re: RegExp) =>
    inputs.routes.some((r) => re.test(r.path)) ||
    inputs.apiEndpoints.some((e) => re.test(e.path)) ||
    inputs.features.some((f) => re.test(f));

  const sources = (re: RegExp): string[] =>
    [
      ...inputs.routes.filter((r) => re.test(r.path)).map((r) => r.source),
      ...inputs.apiEndpoints.filter((e) => re.test(e.path)).map((e) => e.source),
    ].slice(0, 6);

  if (has(/login|auth|signin/i)) {
    workflows.push({
      name: "login",
      steps: [
        { description: "Open login page" },
        { description: "Fill credentials" },
        { description: "Submit and reach an authenticated area" },
      ],
      confidence: "high",
      detectedFrom: sources(/login|auth|signin/i),
    });
  }

  if (has(/cart|checkout|order/i)) {
    workflows.push({
      name: "create_order",
      steps: [
        { description: "Browse store / products" },
        { description: "Add item to cart" },
        { description: "Open checkout and submit order" },
      ],
      confidence: has(/checkout/i) ? "high" : "medium",
      detectedFrom: sources(/cart|checkout|order|product/i),
    });
  }

  if (has(/order/i)) {
    workflows.push({
      name: "update_order_status",
      steps: [
        { description: "Open an order from the merchant view" },
        { description: "Change its status" },
        { description: "Verify the new status persists" },
      ],
      confidence: "medium",
      detectedFrom: sources(/order|status/i),
    });
  }

  if (has(/block|ban|suspend/i)) {
    workflows.push({
      name: "block_customer",
      steps: [
        { description: "Open a customer record" },
        { description: "Trigger block/ban action" },
        { description: "Verify the customer is blocked" },
      ],
      confidence: "medium",
      detectedFrom: sources(/block|ban|suspend|customer/i),
    });
  }

  if (has(/assign|agent|driver|delivery|courier/i)) {
    workflows.push({
      name: "delivery_assignment",
      steps: [
        { description: "Assign an agent/driver to an order" },
        { description: "Agent updates delivery status" },
      ],
      confidence: "low",
      detectedFrom: sources(/assign|agent|driver|delivery|courier/i),
    });
  }

  if (has(/tenant|merchant_?id|store_?id|org/i)) {
    workflows.push({
      name: "tenant_isolation",
      steps: [
        { description: "Tenant A owns a resource" },
        { description: "Tenant B attempts to access it directly" },
        { description: "Access must be denied" },
      ],
      confidence: "medium",
      detectedFrom: sources(/tenant|merchant|store|org/i),
    });
  }

  return workflows;
}
