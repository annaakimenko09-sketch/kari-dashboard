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

// Determine region by scanning column A values in parsed stores/subdivs
// Returns 'СПБ' | 'БЕЛ' | 'ALL'
function detectRegionByContent(stores, subdivs) {
  const rows = [...(stores || []), ...(subdivs || [])];
  for (const row of rows) {
    const a = String(row['_c0'] || '').toUpperCase().trim();
    if (a.startsWith('СПБ')) return 'СПБ';
    if (a.startsWith('БЕЛ')) return 'БЕЛ';
  }
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
//   row 0: report title in col A
//   row 1: date info in col A
//   row 2: time info in col A  (e.g. "Время: 15:00")
//   row 4: column headers
//   rows 5+: data rows
//     – store rows:    A = subdivision name, B = store number (numeric), C = ТЦ name  (A != B)
//     – subdiv rows:   A = B = C = subdivision name (e.g. "СПБ 1")
//     – blank rows:    separator
//     – region rows:   A = 'ИТОГО', B = 'ИТОГО', C = region label
//
// Returns { periods, fileTime, headers, stores, subdivs, regions }
function parseHourSheet(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Collect period info from rows 0–2
  const periods = [];
  for (let r = 0; r <= 2; r++) {
    const v = getCell(ws, r, 0);
    if (v) periods.push(String(v));
  }

  // Extract time from row 2 col A: "Время: 15:00" → "15:00"
  let fileTime = '';
  const timeRaw = getCell(ws, 2, 0);
  if (timeRaw) {
    const m = String(timeRaw).match(/(\d{1,2}:\d{2})/);
    if (m) fileTime = m[1];
  }

  // Row 4 = column headers
  const headers = [];
  for (let c = 0; c <= range.e.c; c++) {
    const v = getCell(ws, 4, c);
    headers.push(v ? String(v).trim() : `_col${c}`);
  }

  const stores  = [];
  const subdivs = [];
  const regions = [];

  for (let r = 5; r <= range.e.r; r++) {
    const aVal = getCell(ws, r, 0);
    const bVal = getCell(ws, r, 1);
    const cVal = getCell(ws, r, 2);

    // Skip completely empty rows
    if (aVal === null && bVal === null) continue;

    const aStr = aVal !== null ? String(aVal).trim() : '';
    const bStr = bVal !== null ? String(bVal).trim() : '';
    const cStr = cVal !== null ? String(cVal).trim() : '';

    // Skip header-repeat rows: A matches a known column header (e.g. 'Подр', 'ТЦ', 'Магаз')
    if (headers.includes(aStr) || aStr === 'Подр' || aStr === 'Магаз' || aStr === 'ТЦ') continue;

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

    // Skip if A is empty
    if (!aStr) continue;

    const row = { _colCount: headers.length };
    for (let c = 0; c <= range.e.c; c++) {
      const v = getCell(ws, r, c);
      row[headers[c]] = v;
      row[`_c${c}`] = v;
    }

    // Subdivision row: A = B = C (all same non-empty string)
    if (aStr === bStr && aStr === cStr) {
      subdivs.push(row);
    } else {
      stores.push(row);
    }
  }

  return { periods, fileTime, headers, stores, subdivs, regions };
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

    // Determine region: prefer content-based detection, fall back to filename
    const regionByName    = detectRegion(file.name);
    const regionByContent = detectRegionByContent(parsed.stores, parsed.subdivs);
    const fileRegion = (regionByName !== 'ALL') ? regionByName : regionByContent;

    results.push({
      fileName:   file.name,
      fileRegion,
      filePeriod: detectHour(file.name),
      fileTime:   parsed.fileTime,
      ...parsed,
    });
  }

  return results;
}
