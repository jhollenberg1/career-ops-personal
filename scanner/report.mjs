import { mkdirSync, writeFileSync } from 'fs';

export function writeScanReport(report, { outputDir = 'output/scans' } = {}) {
  mkdirSync(outputDir, { recursive: true });
  const timestamp = report.startedAt.replace(/[:.]/g, '-');
  const path = `${outputDir}/${timestamp}.json`;
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return path;
}

export function printSummary(report) {
  const counts = report.counts;
  console.log(`\nScanner — ${report.startedAt.slice(0, 10)}`);
  console.log('━'.repeat(48));
  console.log(`Companies attempted: ${counts.companiesAttempted}`);
  console.log(`Sources succeeded:   ${counts.sourcesSucceeded}`);
  console.log(`Sources failed:      ${counts.sourcesFailed}`);
  console.log(`No compatible source:${counts.sourcesUnavailable}`);
  console.log(`Jobs discovered:     ${counts.discovered}`);
  console.log(`Filtered:            ${counts.filtered}`);
  console.log(`Suppressed:          ${counts.suppressed}`);
  console.log(`Verified open:       ${counts.verifiedOpen}`);
  console.log(`Verification failed: ${counts.verificationFailed}`);
  console.log(`Queued:              ${counts.queued}`);
  console.log(`Coverage:            ${report.complete ? 'complete' : 'INCOMPLETE — inspect source health'}`);
}
