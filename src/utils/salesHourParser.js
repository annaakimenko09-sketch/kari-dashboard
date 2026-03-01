import * as XLSX from 'xlsx';

// Re-export gradient column sets — will be defined based on the actual column layout
// A=0 Подразделение, B=1 Магазин(num), C=2 ТЦ, D=3 ...data cols start
// For regions rows: A=ИТОГО, B=ИТОГО, C=название региона, D=...data
// We keep COLS_HIGH_GOOD/BAD as empty sets initially; page will compute from headers
export const COLS_HIGH_GOOD = new Set([]);
export const COLS_HIGH_BAD  = new Set([]);

// Determine region from filename
function detectRegion(name) {
  const n = name.toUpperCase();
  if (n.includes('СПБ') || n.includes('SPB')) return 'СПБ';
  if (n.includes('БЕЛ') || n.includes('BEL')) return 'БЕЛ';
  return 'ALL';
}

// Extract hour from filename: looks for _12, _15, _18, _22
// Returns '12' | '15' | '18' | '22' | '00'
function detectHour(name) {
  const n = name.replace(/\s+/g, '_');
  const match = n.match(/[_\s(]?(12|15|18|22)[_\s).]/);
  if (match) return match[1];
  const suffix = n.match(/[_\s](12|15|18|22)\.xlsx?$/i);
  if (suffix) return suffix[1];
  return '00';
}

function getCell(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  return cell ? cell.v : null;
}

// Parse the «Регион» sheet from an hourly sales report.
//
// Sheet structure (0-indexed rows):
//   row 0–2: period/title info in col A
//   row 4:   column headers
//   rows 5+: data rows
//     – store rows:  A = subdivision name (non-empty, NOT 'ИТОГО')
//                    B = store number (numeric)
//                    C = ТЦ / store name
//     – blank rows:  separator between stores section and regions section
//     – region rows: A = 'ИТОГО', B = 'ИТОГО', C = region label (Итого по...)
//
// Returns { periods, headers, stores, subdivs: [], regions }
function parseHourSheet(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Collect period info from rows 0–2
  const periods = [];
  for (let r = 0; r <= 2; r++) {
    const v = getCell(ws, r, 0);
    if (v) periods.push(String(v));
  }

  // Row 4 = column headers
  const headers = [];
  for (let c = 0; c <= range.e.c; c++) {
    const v = getCell(ws, 4, c);
    headers.push(v ? String(v).trim() : `_col${c}`);
  }

  const stores  = [];
  const regions = [];

  for (let r = 5; r <= range.e.r; r++) {
    const aVal = getCell(ws, r, 0);
    const bVal = getCell(ws, r, 1);

    // Skip completely empty rows
    if (aVal === null && bVal === null) continue;

    const aStr = aVal !== null ? String(aVal).trim() : '';

    // Region/total row: A contains 'ИТОГО' (case-insensitive)
    if (aStr.toUpperCase() === 'ИТОГО') {
      const row = { _colCount: headers.length };
      for (let c = 0; c <= range.e.c; c++) {
        const v = getCell(ws, r, c);
        row[headers[c]] = v;
        row[`_c${c}`] = v;
      }
      regions.push(row);
      continue;
    }

    // Store row: A = subdivision name, B = store number, C = ТЦ
    // Skip if A is empty (stray empty row)
    if (!aStr) continue;

    const row = { _colCount: headers.length };
    for (let c = 0; c <= range.e.c; c++) {
      const v = getCell(ws, r, c);
      row[headers[c]] = v;
      row[`_c${c}`] = v;
    }
    stores.push(row);
  }

  return { periods, headers, stores, subdivs: [], regions };
}

export async function parseSalesHourFiles(fileList) {
  const results = [];

  for (const file of Array.from(fileList)) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // Try 'Регион' first, then 'Рег', then first available sheet
    let sheetName = null;
    if (wb.SheetNames.includes('Регион'))      sheetName = 'Регион';
    else if (wb.SheetNames.includes('Рег'))    sheetName = 'Рег';
    else if (wb.SheetNames.length > 0)         sheetName = wb.SheetNames[0];

    if (!sheetName) continue;

    const ws = wb.Sheets[sheetName];
    const parsed = parseHourSheet(ws);

    results.push({
      fileName:   file.name,
      fileRegion: detectRegion(file.name),
      filePeriod: detectHour(file.name),
      ...parsed,
    });
  }

  return results;
}
