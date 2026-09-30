import { existsSync, readFileSync } from 'fs';

// Every row in data/applications.md is an application decision. Rows are returned
// as ledger-shaped records with status `evaluated` so they join the role history.
export function loadTrackerRows(path = 'data/applications.md') {
  if (!existsSync(path)) return [];
  const rows = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const cells = line.split('|').map(cell => cell.trim());
    if (cells.length < 6 || !/^\d+$/.test(cells[1])) continue;
    rows.push({ company: cells[3], role: cells[4], status: 'evaluated', date_seen: cells[2], url: '' });
  }
  return rows;
}
