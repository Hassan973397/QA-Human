import path from "node:path";
import {
  loadQaConfig,
  KnowledgeStore,
  ProjectScanner,
  buildKnowledgeGraph,
  writeText,
  pathExists,
  ensureDir,
  logger,
  pc,
  type AppKnowledgeGraph,
} from "@hasan-qa-humans/core";
import { scenarioTemplates } from "@hasan-qa-humans/scenario-library";
import { getProjectRoot, getQaDir, getScenariosDir, tsxImporter } from "../lib.js";

interface GenerateOptions {
  cwd?: string;
  force?: boolean;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  const root = getProjectRoot(options);
  const { config } = await loadQaConfig({ root, importer: tsxImporter });

  // Load discovery graph; if absent, run a quick discovery so generation is informed.
  const store = new KnowledgeStore(getQaDir(root));
  let graph: AppKnowledgeGraph | null = await store.loadGraph();
  if (!graph) {
    logger.info("No discovery found — running discovery first...");
    const scanner = new ProjectScanner({
      ...config.discovery,
      projectRoot: config.discovery.projectRoot || root,
    });
    graph = buildKnowledgeGraph(config, await scanner.scan());
    await store.saveAll(graph);
  }

  const features = new Set(graph.features);
  const selected = scenarioTemplates.filter((t) => !t.feature || features.has(t.feature));

  const scenariosDir = getScenariosDir(root);
  await ensureDir(scenariosDir);

  let created = 0;
  let skipped = 0;
  for (const tpl of selected) {
    const dest = path.join(scenariosDir, tpl.file);
    if (!options.force && (await pathExists(dest))) {
      logger.raw(`  ${pc.yellow("skip")} ${path.relative(root, dest)} (exists)`);
      skipped++;
      continue;
    }
    await writeText(dest, tpl.content);
    logger.raw(`  ${pc.green("create")} ${path.relative(root, dest)}`);
    created++;
  }

  logger.success(`generate complete — ${created} scenario(s) created, ${skipped} skipped.`);
  logger.info(`Edit them under ${path.relative(root, scenariosDir)}/ then run \`hqa run\`.`);
}
