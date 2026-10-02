import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildOpenApiDocument } from '../src/openapi/registry';

writeFileSync(resolve(__dirname, '../openapi.json'), JSON.stringify(buildOpenApiDocument(), null, 2) + '\n');
console.log('wrote server/openapi.json');
