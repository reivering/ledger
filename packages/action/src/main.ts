import { run } from './index.js';

run().then(
  (code) => (process.exitCode = code),
  (e: unknown) => {
    console.log(`::error::ledger: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  },
);
