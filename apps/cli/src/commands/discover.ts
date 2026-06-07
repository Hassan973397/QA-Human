import ora from "ora";
import path from "node:path";
import {
  loadQaConfig,
  ProjectScanner,
  buildKnowledgeGraph,
  KnowledgeStore,
  RuleBasedAiAnalyzer,
  logger,
  pc,
} from "@hasan-qa-humans/core";
import { getProjectRoot, getQaDir, tsxImporter } from "../lib.js";

interface DiscoverOptions {
  cwd?: string;
}

export async function discoverCommand(options: DiscoverOptions): Promise<void> {
  const root = getProjectRoot(options);
  const { config } = await loadQaConfig({ root, importer: tsxImporter });

  const spinner = ora("Studying the project (reading files, routes, roles, APIs)...").start();
  const scanner = new ProjectScanner({
    ...config.discovery,
    projectRoot: config.discovery.projectRoot || root,
  });

  let graph;
  try {
    const discovery = await scanner.scan();
    graph = buildKnowledgeGraph(config, discovery);
    spinner.succeed(
      `Discovery complete — scanned ${discovery.filesScanned} files in ${discovery.durationMs}ms.`,
    );
  } catch (error) {
    spinner.fail("Discovery failed.");
    throw error;
  }

  const store = new KnowledgeStore(getQaDir(root));
  const written = await store.saveAll(graph);

  // Summary
  logger.raw("");
  logger.raw(pc.bold("Discovery summary"));
  logger.raw(`  Frameworks:    ${graph.frameworks.join(", ") || "unknown"}`);
  logger.raw(`  Pkg manager:   ${graph.packageManager}`);
  logger.raw(`  Routes:        ${graph.routes.length} (${graph.pages.length} pages)`);
  logger.raw(`  Forms:         ${graph.forms.length}`);
  logger.raw(`  API endpoints: ${graph.apiEndpoints.length}`);
  logger.raw(`  Roles:         ${Object.keys(graph.roles).join(", ") || "none"}`);
  logger.raw(`  Features:      ${graph.features.join(", ") || "none"}`);
  logger.raw(`  Workflows:     ${graph.workflows.map((w) => w.name).join(", ") || "none"}`);

  const analyzer = new RuleBasedAiAnalyzer();
  const notes = analyzer.analyzeDiscovery(graph);
  if (notes.length) {
    logger.raw("");
    logger.raw(pc.bold("Notes"));
    for (const n of notes) logger.raw(`  - ${n}`);
  }

  if (graph.unknowns.length) {
    logger.raw("");
    logger.raw(pc.yellow("Unknowns / needs configuration"));
    for (const u of graph.unknowns) logger.raw(`  - ${u}`);
  }

  logger.raw("");
  logger.raw(pc.bold("Artifacts written"));
  for (const f of written) logger.raw(`  ${pc.dim(path.relative(root, f))}`);
  logger.success("Discovery saved under qa/.hqa/");
}
