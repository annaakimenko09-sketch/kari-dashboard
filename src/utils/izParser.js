import * as XLSX from 'xlsx';

// Columns: A=0 Регион, B=1 Подразделение, C=2 Магазин, D=3 ТЦ,
//          E=4 Рейтинг, F=5 Кол-во ИЗ готовых к выдаче, G=6 Доля сканирования, H=7 Кол-во кликов

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const SHEET_NAMES = ['День', 'Неделя', 'Месяц'];

function getCell(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  return cell ? cell.v : null;
}

function isHeaderRow(ws, r) {
  const v = getCell(ws, r, 0);
  return v !== null && String(v) === 'Регион';
}

function parseRow(ws, r) {
  const region    = getCell(ws, r, 0);
  const subdiv    = getCell(ws, r, 1);
  const store     = getCell(ws, r, 2);
  const tc        = getCell(ws, r, 3);
  const rating    = toNum(getCell(ws, r, 4));
  const izCount   = toNum(getCell(ws, r, 5));
  const scanRaw   = getCell(ws, r, 6);
  const scanShare = scanRaw !== null && scanRaw !== undefined ? toNum(scanRaw) * 100 : null;
  const clicks    = toNum(getCell(ws, r, 7));
  return {
    region:    region ? String(region) : null,
    subdiv:    subdiv ? String(subdiv) : null,
    store:     store  ? String(store)  : null,
    tc:        tc     ? String(tc)     : null,
    rating,
    izCount,
    scanShare,
    clicks,
  };
}

function parseSheet(ws) {
  if (!ws) return { period: null, regions: [], subdivs: [], stores: [] };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Row 0: period header
  const periodCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  const period = periodCell ? String(periodCell.v) : null;

  // Find all header rows (rows where col A = 'Регион')
  const headerRows = [];
  for (let r = 0; r <= range.e.r; r++) {
    if (isHeaderRow(ws, r)) headerRows.push(r);
  }

  // Section 1: regions (after headerRows[0], until next header or empty)
  const regions = [];
  if (headerRows.length >= 1) {
    const start = headerRows[0] + 1;
    const end   = headerRows.length >= 2 ? headerRows[1] - 1 : range.e.r;
    for (let r = start; r <= end; r++) {
      const v = getCell(ws, r, 0);
      if (!v) continue;
      const row = parseRow(ws, r);
      // Region rows: col B, C, D are empty
      regions.push(row);
    }
  }

  // Section 2: subdivisions (after headerRows[1])
  const subdivs = [];
  if (headerRows.length >= 2) {
    const start = headerRows[1] + 1;
    const end   = headerRows.length >= 3 ? headerRows[2] - 1 : range.e.r;
    for (let r = start; r <= end; r++) {
      const v = getCell(ws, r, 0);
      if (!v) continue;
      const row = parseRow(ws, r);
      // Subdiv rows: col C, D are empty
      subdivs.push(row);
    }
  }

  // Section 3: stores (after headerRows[2])
  const stores = [];
  if (headerRows.length >= 3) {
    const start = headerRows[2] + 1;
    for (let r = start; r <= range.e.r; r++) {
      const store = getCell(ws, r, 2);
      if (!store) continue;
      stores.push(parseRow(ws, r));
    }
  }

  return { period, regions, subdivs, stores };
}

function parseIZFile(wb, fileName) {
  const sheets = {};
  for (const name of SHEET_NAMES) {
    const ws = wb.Sheets[name];
    if (ws) {
      sheets[name] = parseSheet(ws);
    }
  }

  // Determine region from store/subdiv data
  const allStores = Object.values(sheets).flatMap(s => s.stores);
  const allSubdivs = Object.values(sheets).flatMap(s => s.subdivs);
  const regions = new Set([...allStores, ...allSubdivs].map(s => s.region).filter(Boolean));
  const hasSPB = [...regions].some(r => r.toUpperCase().includes('СПБ'));
  const hasBEL = [...regions].some(r => r.toUpperCase().includes('БЕЛ'));
  let fileRegion = 'ALL';
  if (hasSPB && !hasBEL) fileRegion = 'СПБ';
  else if (hasBEL && !hasSPB) fileRegion = 'БЕЛ';

  return { fileName, fileRegion, sheets };
}

export async function parseIZFiles(fileList) {
  const results = [];
  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const parsed = parseIZFile(wb, file.name);
      results.push(parsed);
    } catch (e) {
      console.error('izParser error:', file.name, e);
    }
  }
  return results;
}

export { SHEET_NAMES };
