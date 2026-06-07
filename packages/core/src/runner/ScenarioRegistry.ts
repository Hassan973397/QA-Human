import { ScenarioError } from "../errors/ScenarioError.js";
import type { ScenarioDefinition } from "./types.js";

/** Authoring helper: validates shape and returns the definition unchanged. */
export function scenario(def: ScenarioDefinition): ScenarioDefinition {
  if (!def.id) throw new ScenarioError("Scenario is missing an id.");
  if (typeof def.run !== "function") throw new ScenarioError(`Scenario ${def.id} has no run().`);
  return {
    ...def,
    tags: def.tags ?? [],
    roles: def.roles ?? [],
    severity: def.severity ?? "medium",
  };
}

/** Collects scenarios and supports lookup + filtering for the CLI. */
export class ScenarioRegistry {
  private readonly byId = new Map<string, ScenarioDefinition>();

  add(def: ScenarioDefinition): void {
    this.byId.set(def.id, def);
  }

  addAll(defs: ScenarioDefinition[]): void {
    for (const d of defs) this.add(d);
  }

  all(): ScenarioDefinition[] {
    return Array.from(this.byId.values());
  }

  get(id: string): ScenarioDefinition | undefined {
    return this.byId.get(id);
  }

  /** Filter by id substring, tag, and/or role. */
  filter(opts: { id?: string; tag?: string; role?: string }): ScenarioDefinition[] {
    return this.all().filter((s) => {
      if (opts.id && !s.id.includes(opts.id)) return false;
      if (opts.tag && !s.tags.includes(opts.tag)) return false;
      if (opts.role && !s.roles.includes(opts.role)) return false;
      return true;
    });
  }
}
