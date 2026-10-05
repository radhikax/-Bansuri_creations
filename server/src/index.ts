import 'dotenv/config';
import { validateEnv, EnvValidationError } from './config/env';

try {
  validateEnv();
} catch (err) {
  if (err instanceof EnvValidationError) {
    console.error(err.message);
    process.exit(1);
  }
  throw err;
}

// Imported after validation so a misconfigured process never builds the app.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate late import after env validation
const { default: app } = require('./app') as typeof import('./app');

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
