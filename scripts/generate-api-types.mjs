// Generates src/lib/api/schema.d.ts from server/openapi.json.
// Run with: npm run api:types
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');
const specPath = path.join(rootDir, 'server', 'openapi.json');
const outPath = path.join(rootDir, 'src', 'lib', 'api', 'schema.d.ts');

const spec = JSON.parse(await fs.readFile(specPath, 'utf-8'));
const ast = await openapiTS(spec);
const contents = astToString(ast);

const header = '// GENERATED from server/openapi.json — do not edit; run npm run api:types\n';

await fs.writeFile(outPath, header + contents);
console.log(`Wrote ${path.relative(rootDir, outPath)}`);
