import type { QaConfig } from "../config/schema.js";
import type { AppKnowledgeGraph } from "../knowledge/types.js";
import type { ScenarioReporter } from "../reporting/QaReporter.js";
import type { SelectorResolver } from "../selectors/SelectorResolver.js";
import type { RoleContext } from "../runner/types.js";
import { HumanAgent } from "./HumanAgent.js";
import { HumanMemory } from "./HumanMemory.js";
import type { ArtifactSink } from "./types.js";

export interface HumanFactoryDeps {
  resolver: SelectorResolver;
  graph: AppKnowledgeGraph;
  config: QaConfig;
  artifacts: ArtifactSink;
  sharedMemory: Map<string, unknown>;
}

/** Turns engine-provided RoleContexts into ready-to-drive HumanAgents. */
export class HumanFactory {
  constructor(private readonly deps: HumanFactoryDeps) {}

  create(roleContext: RoleContext, reporter: ScenarioReporter): HumanAgent {
    return new HumanAgent({
      role: roleContext.role,
      page: roleContext.page,
      context: roleContext.context,
      memory: new HumanMemory(this.deps.sharedMemory),
      reporter,
      resolver: this.deps.resolver,
      graph: this.deps.graph,
      config: this.deps.config,
      artifacts: this.deps.artifacts,
    });
  }
}
