// Fails if server/openapi.json or the generated src/lib/api/schema.d.ts are
// out of date relative to the zod schemas that define the API contract.
// Run with: node scripts/check-openapi-drift.mjs
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(fileURLToPath(import.meta.url), '../..');

function run(command, args, options = {}) {
  execFileSync(command, args, { cwd: rootDir, stdio: 'inherit', shell: true, ...options });
}

run('npm', ['--prefix', 'server', 'run', 'openapi:generate']);
run('npm', ['run', 'api:types']);

try {
  run('git', ['diff', '--exit-code', '--', 'server/openapi.json', 'src/lib/api/schema.d.ts']);
} catch {
  console.error(
    'OpenAPI contract or generated types are out of date. Run npm --prefix server run openapi:generate && npm run api:types and commit.',
  );
  process.exit(1);
}
