// Fails if any app/src source file uses a colour outside the brand palette
// (Tailwind default palette utilities, raw hex, or rgb()/hsl()/oklch() literals).
// Run with: node scripts/check-palette.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');

const SCAN_DIRS = ['app', 'src'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);

// Paths (relative to rootDir, POSIX-style) to skip entirely.
const EXCLUDE_PREFIXES = [
  'src/styles/theme.css',
  'src/styles/palette.ts',
  'src/components/ui/',
  'src/components/figma/',
  'src/lib/api/schema.d.ts',
];

function isExcluded(relPath) {
  if (/\.test\.[tj]sx?$/.test(relPath)) return true;
  return EXCLUDE_PREFIXES.some((prefix) =>
    prefix.endsWith('/') ? relPath.startsWith(prefix) : relPath === prefix,
  );
}

function listFiles(dir) {
  const absDir = path.join(rootDir, dir);
  let entries;
  try {
    entries = readdirSync(absDir, { recursive: true });
  } catch {
    return [];
  }
  return entries
    .map((entry) => path.join(dir, entry).split(path.sep).join('/'))
    .filter((relPath) => {
      if (!SCAN_EXTENSIONS.has(path.extname(relPath))) return false;
      const absPath = path.join(rootDir, relPath);
      try {
        if (!statSync(absPath).isFile()) return false;
      } catch {
        return false;
      }
      return !isExcluded(relPath);
    });
}

const TAILWIND_UTILITY_PREFIXES =
  '(?:bg|text|border|fill|stroke|ring|outline|from|via|to|decoration|placeholder|caret|accent|shadow)';

const TAILWIND_DEFAULT_COLOR_NAMES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose', 'black', 'white',
];

const UTILITY_RE = new RegExp(
  `\\b${TAILWIND_UTILITY_PREFIXES}-(${TAILWIND_DEFAULT_COLOR_NAMES.join('|')})(?:\\b|-|/)`,
  'g',
);
// Exactly 3, 4, 6 or 8 hex digits, not immediately preceded/followed by
// another alphanumeric — so URL fragments like href="#featured" (a run of
// hex-looking letters that continues into non-hex letters) don't false-positive.
const HEX_RE = /(?<![0-9a-zA-Z])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z])/g;
const CSS_FUNC_RE = /(rgb|rgba|hsl|oklch)\(/g;

function findAll(re, line) {
  return [...line.matchAll(re)].map((m) => m[0]);
}

function main() {
  const files = SCAN_DIRS.flatMap(listFiles).sort();
  const findings = [];

  for (const file of files) {
    const content = readFileSync(path.join(rootDir, file), 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNo = index + 1;
      const tokens = [
        ...findAll(UTILITY_RE, line),
        ...findAll(HEX_RE, line),
        ...findAll(CSS_FUNC_RE, line),
      ];
      for (const token of tokens) {
        findings.push(`${file}:${lineNo}: ${token}`);
      }
    });
  }

  if (findings.length > 0) {
    console.error('Palette check failed. Non-brand colours found:\n');
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }

  console.log('Palette check passed: no non-brand colours found.');
}

main();
