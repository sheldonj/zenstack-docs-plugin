import { renderErdSvg } from './erd';

type DiagramFile = {
  content: string;
  filename: string;
};

type DiagramResult = {
  markdown: string;
  svgFiles: DiagramFile[];
};

const MERMAID_BLOCK_RE = /```mermaid\n(.*?)```/gsu;

/**
 * Extracts inline Mermaid code blocks from markdown, renders each to SVG,
 * and replaces the blocks with image references to companion SVG files.
 */
export async function processDiagrams(
  markdown: string,
  baseName: string,
  format: 'both' | 'mermaid' | 'svg',
  theme?: string,
): Promise<DiagramResult> {
  if (format === 'mermaid') {
    return { markdown, svgFiles: [] };
  }

  const blocks: Array<{ fullMatch: string; source: string }> = [];
  let match: null | RegExpExecArray;
  const re = new RegExp(MERMAID_BLOCK_RE.source, MERMAID_BLOCK_RE.flags);
  while ((match = re.exec(markdown)) !== null) {
    blocks.push({ fullMatch: match[0]!, source: match[1]! });
  }

  if (blocks.length === 0) {
    return { markdown, svgFiles: [] };
  }

  const svgFiles: DiagramFile[] = [];
  let result = markdown;

  for (let index = 0; index < blocks.length; index++) {
    const { fullMatch, source } = blocks[index]!;
    const suffix = blocks.length > 1 ? `-${index + 1}` : '';
    const svgFilename = `${baseName}-diagram${suffix}.svg`;

    const svg = await renderErdSvg(source, theme);
    if (!svg) {
      continue;
    }

    svgFiles.push({ content: svg, filename: svgFilename });

    const imgRef = `![diagram](./${svgFilename})`;

    if (format === 'svg') {
      result = result.replace(fullMatch, imgRef);
    } else {
      const replacement = [
        imgRef,
        '',
        '<details>',
        '<summary>Mermaid source</summary>',
        '',
        fullMatch,
        '',
        '</details>',
      ].join('\n');
      result = result.replace(fullMatch, replacement);
    }
  }

  return { markdown: result, svgFiles };
}
