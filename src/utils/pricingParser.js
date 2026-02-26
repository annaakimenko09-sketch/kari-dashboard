import * as XLSX from 'xlsx';

/**
 * Parse "Рейтинг переоценки и выставления полупарков" file.
 *
 * All three sheets (Регионы, Подразделения, Магазины) share the same structure:
 *   row 0: headers — col[0]=Регион, col[1]=Подразделение, col[2]=Магазин,
 *           col[3..8] = 6 % columns
 *   rows 1+: data rows (values are fractions 0-1, need ×100)
 *
 * fileRegion is determined from sheet "Магазины" col[0].
 *
 * Returns: { fileName, fileRegion, columns, regions, subdivisions, stores }
 *   columns: array of { key, label } for col indices 3..8
 */

const COLUMN_LABELS = [
  { key: 'c0', label: '% ПП без ценников' },
  { key: 'c1', label: '% не отскан. ценников на полупарок' },
  { key: 'c2', label: '% не напечатанных ценников при приёмке' },
  { key: 'c3', label: '% не напечатанных цен при переоценке' },
  { key: 'c4', label: '% не отскан. ценников навесной обуви' },
  { key: 'c5', label: '% ПП с правильным ценником' },
];

function parsePct(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    // Values are fractions 0-1 in this file
    if (val > 1.5) return +val.toFixed(2);       // already %
    return +(val * 100).toFixed(2);
  }
  const str = String(val);
  const hasPercent = str.includes('%');
  const n = parseFloat(str.replace('%', '').replace(',', '.').trim());
  if (isNaN(n)) return null;
  if (hasPercent) return +n.toFixed(2);
  if (n > 1.5) return +n.toFixed(2);
  return +(n * 100).toFixed(2);
}

function s(val) {
  return val !== null && val !== undefined ? String(val).trim() : '';
}

function parseSheet(ws) {
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const rows = [];
  for (let i = 1; i < raw.length; i++) {   // skip header row 0
    const r = raw[i];
    if (!r || r.every(v => v === null)) continue;
    const region = s(r[0]);
    if (!region) continue;
    rows.push({
      region,
      subdiv: s(r[1]),
      store:  s(r[2]),
      c0: parsePct(r[3]),
      c1: parsePct(r[4]),
      c2: parsePct(r[5]),
      c3: parsePct(r[6]),
      c4: parsePct(r[7]),
      c5: parsePct(r[8]),
    });
  }
  return rows;
}

function parsePricingFile(wb, fileName) {
  const wsRegions  = wb.Sheets['Регионы'];
  const wsSubdivs  = wb.Sheets['Подразделения'];
  const wsStores   = wb.Sheets['Магазины'];

  const regions      = parseSheet(wsRegions);
  const subdivisions = parseSheet(wsSubdivs);
  const stores       = parseSheet(wsStores);

  // Determine fileRegion from Магазины sheet col[0]
  let fileRegion = 'ALL';
  if (stores.length > 0) {
    const storeRegions = new Set(stores.map(r => r.region).filter(Boolean));
    const hasSPB = [...storeRegions].some(r => r.toUpperCase().includes('СПБ'));
    const hasBEL = [...storeRegions].some(r => r.toUpperCase().includes('БЕЛ'));
    if (hasSPB && !hasBEL) fileRegion = 'СПБ';
    else if (hasBEL && !hasSPB) fileRegion = 'БЕЛ';
  }

  return { fileName, fileRegion, columns: COLUMN_LABELS, regions, subdivisions, stores };
}

export async function parsePricingFiles(fileList) {
  const results = [];
  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const result = parsePricingFile(wb, file.name);
      if (result) results.push(result);
    } catch (err) {
      console.error(`Ошибка парсинга файла цен на полупарах ${file.name}:`, err);
    }
  }
  return results;
}
