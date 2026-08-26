#!/usr/bin/env node

/**
 * Compatibility entry point for existing career-ops automations.
 *
 * The scanner implementation is modular under scanner/: source discovery,
 * normalization, filtering, liveness verification, persistence, and reporting.
 */
import { main } from './scanner/scan.mjs';

main().catch(error => {
  console.error(`Scanner failed: ${error.message}`);
  process.exitCode = 1;
});
