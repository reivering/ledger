export * from './product.js';
export * from './git.js';
export * from './redact.js';
export * from './store.js';
export * from './collect.js';
export * from './providers.js';
export * from './record.js';
export * from './hooks.js';

/** License hook. Milestone 3: verify the offline Ed25519-signed license file here; throw to refuse. */
export function checkLicense(): void {
  // no-op until Milestone 3
}
