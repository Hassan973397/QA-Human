import type { ScenarioDefinition } from "@hasan-qa-humans/core";

import authLogin from "./auth/login.js";
import pageSmoke from "./smoke/pageSmoke.js";
import blankScreenCheck from "./smoke/blankScreenCheck.js";
import customerCreateOrder from "./ecommerce/customerCreateOrder.js";
import merchantManageOrder from "./ecommerce/merchantManageOrder.js";
import merchantBlockCustomer from "./ecommerce/merchantBlockCustomer.js";
import blockedCustomerCannotOrder from "./ecommerce/blockedCustomerCannotOrder.js";
import orderLifecycle from "./ecommerce/orderLifecycle.js";
import rolePermissions from "./security/rolePermissions.js";
import tenantIsolation from "./security/tenantIsolation.js";
import unauthenticatedAccess from "./security/unauthenticatedAccess.js";

export {
  authLogin,
  pageSmoke,
  blankScreenCheck,
  customerCreateOrder,
  merchantManageOrder,
  merchantBlockCustomer,
  blockedCustomerCannotOrder,
  orderLifecycle,
  rolePermissions,
  tenantIsolation,
  unauthenticatedAccess,
};

/** Every built-in scenario, in a sensible default execution order. */
export const builtinScenarios: ScenarioDefinition[] = [
  authLogin,
  blankScreenCheck,
  pageSmoke,
  customerCreateOrder,
  merchantManageOrder,
  merchantBlockCustomer,
  blockedCustomerCannotOrder,
  orderLifecycle,
  rolePermissions,
  unauthenticatedAccess,
  tenantIsolation,
];

/** Look up built-in scenarios by id, with substring fallback. */
export function findBuiltins(ids: string[]): ScenarioDefinition[] {
  const out: ScenarioDefinition[] = [];
  for (const id of ids) {
    const exact = builtinScenarios.find((s) => s.id === id);
    if (exact) {
      out.push(exact);
      continue;
    }
    out.push(...builtinScenarios.filter((s) => s.id.includes(id)));
  }
  return out;
}

/** Templates used by `hqa generate` to scaffold user scenario files. */
export { scenarioTemplates } from "./templates.js";
