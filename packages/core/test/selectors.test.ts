import { test } from "node:test";
import assert from "node:assert/strict";
import { SelectorRegistry } from "../src/selectors/SelectorRegistry.js";
import { SelectorResolver } from "../src/selectors/SelectorResolver.js";
import { looksLikeSelector, hintsForLabel } from "../src/selectors/selectorHints.js";

test("registry seeds default named selectors and merges hints", () => {
  const registry = new SelectorRegistry([
    { name: "loginButton", candidates: ['[data-testid="x"]'], source: "config" },
  ]);
  assert.ok(registry.has("loginButton"));
  assert.ok(registry.has("emailInput"));
  // config candidate is merged ahead of defaults
  assert.equal(registry.candidates("loginButton")?.[0], '[data-testid="x"]');
});

test("resolver returns named candidates for a known selector", () => {
  const resolver = new SelectorResolver(new SelectorRegistry());
  const candidates = resolver.candidatesFor("loginButton");
  assert.ok(candidates.length > 0);
  assert.ok(candidates.some((c) => c.includes('button[type="submit"]')));
});

test("resolver treats a raw selector as its own only candidate", () => {
  const resolver = new SelectorResolver(new SelectorRegistry());
  assert.deepEqual(resolver.candidatesFor('button.add[data-x="1"]'), ['button.add[data-x="1"]']);
});

test("resolver synthesizes hints for an unknown label", () => {
  const resolver = new SelectorResolver(new SelectorRegistry());
  const candidates = resolver.candidatesFor("Place Order");
  assert.deepEqual(candidates, hintsForLabel("Place Order"));
  assert.ok(candidates.some((c) => c.startsWith("text=")));
});

test("looksLikeSelector distinguishes selectors from plain labels", () => {
  assert.equal(looksLikeSelector("#id"), true);
  assert.equal(looksLikeSelector('[data-testid="x"]'), true);
  assert.equal(looksLikeSelector("text=Login"), true);
  assert.equal(looksLikeSelector("plainlabel"), false);
});
