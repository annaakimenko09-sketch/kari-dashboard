import * as XLSX from 'xlsx';

/**
 * Parse a "Нет сканирования" Excel file.
 * Returns { region, period, regions, subdivisions, stores }
 * Each row has: Регион, Подразделение, Магазин, ТЦ,
 *   scanPct, scanArt, scanQty,          ← cols E F G (idx 4 5 6)
 *   bindPct, bindArt,                   ← cols H I   (idx 7 8)
 *   seasons:    [ { season, direction, value } ]              ← cols J+ (idx 10..41)
 *   categories: [ { season, direction, category, value } ]    ← cols AQ+ (idx 42+)
 *
 * Header rows:
 *   row 2 (idx 2): season name (e.g. "всесезонный/")
 *   row 3 (idx 3): direction/gender (e.g. "Женская обувь")
 *   row 4 (idx 4): category name (e.g. "003 Мокасины женские")
 *   row 8+:        data rows
 */
function parseSheet(ws, sheetName) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Extract period from row 2 (index 2)
  const periodRow = raw[2] || [];
  const period = periodRow[0] ? String(periodRow[0]).replace('Период отчета: ', '').trim() : '';

  // Header rows
  const seasonRow  = raw[2] || [];  // season name
  const dirRow     = raw[3] || [];  // direction/gender
  const catNameRow = raw[4] || [];  // actual category name (5th row, index 4)

  const maxCols = (raw[8] || raw[4] || []).length;

  // Season cols: indices 10..41
  const seasonCols = [];
  for (let c = 10; c <= 41 && c < maxCols; c++) {
    const s = seasonRow[c] ? String(seasonRow[c]).replace('/', '').trim() : null;
    const d = dirRow[c]    ? String(dirRow[c]).trim() : null;
    if (s && d && s !== '-' && d !== '-' && s !== '0' && d !== '0') {
      seasonCols.push({ colIdx: c, season: s, direction: d });
    }
  }

  // Category cols: indices 42+
  // Row 4 (catNameRow) has the actual shoe type name: "003 Мокасины женские" etc.
  // Row 3 (dirRow) has direction/gender grouping: "Женская обувь" etc.
  // Row 2 (seasonRow) has the season: "всесезонный/" etc.
  const catCols = [];
  for (let c = 42; c < maxCols; c++) {
    const catName   = catNameRow[c] ? String(catNameRow[c]).trim() : null;
    const direction = dirRow[c]     ? String(dirRow[c]).trim() : null;
    const season    = seasonRow[c]  ? String(seasonRow[c]).replace('/', '').trim() : null;
    if (catName && catName !== '-' && catName !== '0') {
      catCols.push({ colIdx: c, category: catName, direction: direction || '', season: season || '' });
    }
  }

  // Data rows start at index 8
  const data = [];
  for (let i = 8; i < raw.length; i++) {
    const row = raw[i];
    if (!row || row.every(v => v === null)) continue;
    const region = row[0] ? String(row[0]).trim() : null;
    if (!region || region === 'Region' || region === 'Регион') continue;

    const obj = {
      region:     region,
      subdiv:     row[1] ? String(row[1]).trim() : null,
      store:      row[2] ? String(row[2]).trim() : null,
      tc:         row[3] ? String(row[3]).trim() : null,
      scanPct:    parsePct(row[4]),
      scanArt:    toNum(row[5]),
      scanQty:    toNum(row[6]),
      bindPct:    parsePct(row[7]),
      bindArt:    toNum(row[8]),
      seasons:    [],
      categories: [],
      _sheet:     sheetName,
    };

    for (const sc of seasonCols) {
      const val = parsePct(raw[i][sc.colIdx]);
      if (val !== null) {
        obj.seasons.push({ season: sc.season, direction: sc.direction, value: val });
      }
    }

    for (const cc of catCols) {
      const val = parsePct(raw[i][cc.colIdx]);
      if (val !== null) {
        obj.categories.push({ season: cc.season, direction: cc.direction, category: cc.category, value: val });
      }
    }

    data.push(obj);
  }

  return { period, data };
}

function parsePct(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return +(val * 100).toFixed(2);
  const s = String(val).replace('%', '').replace(',', '.').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  // Already in percent form (e.g. "80,78%")
  if (n > 1.5 || n === 0) return +n.toFixed(2);
  return +(n * 100).toFixed(2);
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export async function parseScanningFiles(fileList) {
  const results = [];

  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

      // Detect which region this file covers by checking Подразделения sheet
      let fileRegion = 'ALL';
      if (wb.SheetNames.includes('Подразделения')) {
        const ws = wb.Sheets['Подразделения'];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        // First data row is row index 8
        const firstDataRow = rows[8];
        if (firstDataRow && firstDataRow[0]) {
          const r = String(firstDataRow[0]).trim().toUpperCase();
          if (r.includes('СПБ') || r.includes('SPB')) fileRegion = 'СПБ';
          else if (r.includes('БЕЛ') || r.includes('BEL')) fileRegion = 'БЕЛ';
          else fileRegion = r;
        }
      }

      const sheetData = {};
      for (const sn of ['Регионы', 'Подразделения', 'Магазины']) {
        if (wb.SheetNames.includes(sn)) {
          sheetData[sn] = parseSheet(wb.Sheets[sn], sn);
        }
      }

      const period = sheetData['Регионы']?.period || sheetData['Подразделения']?.period || '';

      results.push({
        fileName: file.name,
        fileRegion,
        period,
        regions:       sheetData['Регионы']?.data       || [],
        subdivisions:  sheetData['Подразделения']?.data  || [],
        stores:        sheetData['Магазины']?.data        || [],
      });
    } catch (err) {
      console.error(`Error parsing scanning file ${file.name}:`, err);
    }
  }

  return results;
}
