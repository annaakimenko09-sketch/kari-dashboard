import * as XLSX from 'xlsx';
import { COLS_HIGH_GOOD, COLS_HIGH_BAD, parseRegSheet } from './salesParser';

export { COLS_HIGH_GOOD, COLS_HIGH_BAD };

// Determine region from filename
function detectRegion(name) {
  const n = name.toUpperCase();
  if (n.includes('СПБ') || n.includes('SPB')) return 'СПБ';
  if (n.includes('БЕЛ') || n.includes('BEL')) return 'БЕЛ';
  return 'ALL';
}

// Extract hour from filename: looks for _12, _15, _18, _22 or 12_, 15_, 18_, 22_
// Returns '12' | '15' | '18' | '22' | '00'
function detectHour(name) {
  const n = name.replace(/\s+/g, '_');
  const match = n.match(/[_\s(]?(12|15|18|22)[_\s).]/);
  if (match) return match[1];
  // Try plain suffix like "...12.xlsx"
  const suffix = n.match(/[_\s](12|15|18|22)\.xlsx?$/i);
  if (suffix) return suffix[1];
  return '00';
}

export async function parseSalesHourFiles(fileList) {
  const results = [];

  for (const file of Array.from(fileList)) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // Try 'Рег' first, then fall back to first available sheet
    const sheetName = wb.SheetNames.includes('Рег')
      ? 'Рег'
      : wb.SheetNames[0];

    if (!sheetName) continue;

    console.log('[salesHourParser] file:', file.name, '| sheet:', sheetName, '| sheets:', wb.SheetNames);

    const ws = wb.Sheets[sheetName];
    const parsed = parseRegSheet(ws);

    console.log('[salesHourParser] parsed stores:', parsed.stores?.length, '| subdivs:', parsed.subdivs?.length, '| regions:', parsed.regions?.length);

    results.push({
      fileName: file.name,
      fileRegion: detectRegion(file.name),
      filePeriod: detectHour(file.name),
      ...parsed,
    });
  }

  return results;
}
