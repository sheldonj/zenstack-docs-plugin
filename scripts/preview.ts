import plugin from '../src';
import { loadDocument } from '@zenstackhq/language';
import fs from 'node:fs';
import path from 'node:path';

const currentDirectory = import.meta.dirname;
const policyPlugin = path.resolve(
  currentDirectory,
  '../../policy/plugin.zmodel',
);
const extraPlugins = fs.existsSync(policyPlugin) ? [policyPlugin] : [];

type PreviewTarget = {
  name: string;
  outputDir: string;
  schemaFile: string;
};

const targets: PreviewTarget[] = [
  {
    name: 'showcase',
    outputDir: path.resolve(currentDirectory, '../preview-output/showcase'),
    schemaFile: path.resolve(currentDirectory, '../zenstack/showcase.zmodel'),
  },
  {
    name: 'verbose',
    outputDir: path.resolve(currentDirectory, '../preview-output/verbose'),
    schemaFile: path.resolve(
      currentDirectory,
      '../zenstack/verbose/schema.zmodel',
    ),
  },
];

async function generateTarget(target: PreviewTarget) {
  console.log(`\n── ${target.name} ──────────────────────────────`);
  const r = await loadDocument(target.schemaFile, extraPlugins);
  if (!r.success) {
    console.error(`Failed to load ${target.name} schema:`, r.errors);
    process.exit(1);
  }

  await plugin.generate({
    defaultOutputPath: target.outputDir,
    model: r.model,
    pluginOptions: {
      diagramFormat: 'svg',
      generateErd: true,
      generateSkill: true,
      output: target.outputDir,
    },
    schemaFile: target.schemaFile,
  });
  console.log(`Output: ${target.outputDir}`);
  listFiles(target.outputDir);
}

function listFiles(dir: string, prefix = '', seen = new Set<string>()) {
  const realDir = fs.realpathSync(dir);
  if (seen.has(realDir)) {
    return;
  }

  seen.add(realDir);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      listFiles(path.join(dir, e.name), prefix + e.name + '/', seen);
    } else {
      console.log('  ' + prefix + e.name);
    }
  }
}

async function run() {
  for (const target of targets) {
    await generateTarget(target);
  }

  console.log('\nDone.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
