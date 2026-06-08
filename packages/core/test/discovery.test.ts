import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import type { DetectorContext, ScannedFile } from "../src/discovery/types.js";
import { detectRoutes } from "../src/discovery/RouteDetector.js";
import { detectRoles } from "../src/discovery/RoleDetector.js";
import { detectApiEndpoints } from "../src/discovery/ApiDetector.js";
import { detectForms } from "../src/discovery/FormDetector.js";

function makeCtx(files: Array<{ relPath: string; content: string }>): DetectorContext {
  const scanned: ScannedFile[] = files.map((f) => ({
    absPath: `/proj/${f.relPath}`,
    relPath: f.relPath,
    ext: path.extname(f.relPath),
    content: f.content,
  }));
  return { root: "/proj", files: scanned, byPath: new Map(scanned.map((f) => [f.relPath, f])) };
}

test("detectRoutes finds Next.js pages-router routes", () => {
  const routes = detectRoutes(makeCtx([{ relPath: "pages/login.tsx", content: "export default function L(){}" }]));
  const login = routes.find((r) => r.path === "/login");
  assert.ok(login, "expected /login route");
  assert.equal(login?.kind, "page");
});

test("detectRoutes finds Next.js app-router nested routes", () => {
  const routes = detectRoutes(
    makeCtx([{ relPath: "src/app/dashboard/orders/page.tsx", content: "export default function P(){}" }]),
  );
  assert.ok(routes.some((r) => r.path === "/dashboard/orders" && r.kind === "page"));
});

test("detectRoutes finds React Router <Route path>", () => {
  const routes = detectRoutes(
    makeCtx([{ relPath: "src/App.tsx", content: '<Route path="/store" element={<Store/>} />' }]),
  );
  assert.ok(routes.some((r) => r.path === "/store"));
});

test("detectRoles extracts roles from an enum", () => {
  const content = `export enum Role {\n  Admin = "admin",\n  Merchant = "merchant",\n  Customer = "customer",\n}`;
  const { roles } = detectRoles(makeCtx([{ relPath: "src/auth/roles.ts", content }]));
  assert.ok(roles.admin, "admin role");
  assert.ok(roles.merchant, "merchant role");
  assert.ok(roles.customer, "customer role");
});

test("detectApiEndpoints finds express routes and flags auth", () => {
  const content = `import {requireAuth} from "./mw";\nrouter.get("/api/orders", requireAuth, (req,res)=>{});\nrouter.post("/api/customers/:id/block", requireAuth, (req,res)=>{});`;
  const endpoints = detectApiEndpoints(makeCtx([{ relPath: "src/server/orders.ts", content }]));
  const get = endpoints.find((e) => e.method === "GET" && e.path === "/api/orders");
  assert.ok(get, "GET /api/orders");
  assert.equal(get?.authGuarded, true);
});

test("detectForms identifies a login form by its password field", () => {
  const content = `<form><input type="email" name="email"><input type="password" name="password"><button type="submit">Login</button></form>`;
  const forms = detectForms(makeCtx([{ relPath: "src/Login.tsx", content }]));
  assert.equal(forms.length, 1);
  assert.equal(forms[0]?.purpose, "login");
  assert.ok(forms[0]!.fields.length >= 2);
});
