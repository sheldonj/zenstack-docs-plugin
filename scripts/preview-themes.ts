import { renderMermaid, THEMES } from 'beautiful-mermaid';
import fs from 'node:fs';
import path from 'node:path';

const currentDirectory = import.meta.dirname;
const mmdPath = path.resolve(
  currentDirectory,
  '../preview-output/showcase/schema-erd.mmd',
);
const outDir = path.resolve(currentDirectory, '../preview-output/themes');

async function run() {
  if (!fs.existsSync(mmdPath)) {
    console.error(`Input file not found: ${mmdPath}`);
    console.error(
      'Run `pnpm exec tsx scripts/preview.ts` first to generate the showcase ERD.',
    );
    process.exit(1);
  }

  const mermaidSource = fs.readFileSync(mmdPath, 'utf8');
  fs.mkdirSync(outDir, { recursive: true });

  const themeNames = Object.keys(THEMES);
  console.log(`Rendering ${themeNames.length} themes...\n`);

  for (const name of themeNames) {
    const svg = await renderMermaid(mermaidSource, THEMES[name]);
    const outPath = path.join(outDir, `schema-erd-${name}.svg`);
    fs.writeFileSync(outPath, svg);
    console.log(`  ✓ ${name} → ${path.relative(process.cwd(), outPath)}`);
  }

  const defaultSvg = await renderMermaid(mermaidSource);
  fs.writeFileSync(path.join(outDir, 'schema-erd-default.svg'), defaultSvg);
  console.log('  ✓ default (no theme)');

  const indexLines = [
    '# ERD Theme Preview',
    '',
    `Generated from \`showcase/schema-erd.mmd\` — ${themeNames.length + 1} variants.`,
    '',
  ];

  indexLines.push('## Default', '', '![default](./schema-erd-default.svg)', '');
  for (const name of themeNames) {
    indexLines.push(
      `## ${name}`,
      '',
      `![${name}](./schema-erd-${name}.svg)`,
      '',
    );
  }

  fs.writeFileSync(path.join(outDir, 'index.md'), indexLines.join('\n'));
  console.log(
    `\nWrote index: ${path.relative(process.cwd(), path.join(outDir, 'index.md'))}`,
  );
  console.log('Done.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
