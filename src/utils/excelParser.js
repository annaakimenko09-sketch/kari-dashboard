import * as XLSX from 'xlsx';

/**
 * Converts Excel serial date number to JS Date
 */
function excelDateToJS(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const utc_days = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  return new Date(utc_value * 1000);
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) return val.toLocaleDateString('ru-RU');
  if (typeof val === 'number') {
    const d = excelDateToJS(val);
    return d ? d.toLocaleDateString('ru-RU') : String(val);
  }
  return String(val);
}

// % columns stored as fractions (0.84 → 84.0)
const PCT_COLUMNS = [
  'Отгружено на чистку %',
  'Вычерк по сборке %',
  'Возврат от агрегатора %',
  'Отгружено товара %',
  'Вычерк + Возврат + Отменено %',
];

function normalizeRow(obj) {
  const result = { ...obj };
  // Apply PCT normalization to all columns whose names look like PCT columns
  for (const key of Object.keys(result)) {
    const keyNorm = key.toLowerCase().replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();
    const isPct = PCT_COLUMNS.some(col => {
      const colNorm = col.toLowerCase().replace(/[,\.]/g, ' ').replace(/\s+/g, ' ').trim();
      return keyNorm === colNorm;
    }) || key.endsWith('%') || key.includes(',%');
    if (isPct && result[key] !== null && result[key] !== undefined) {
      const n = parseFloat(result[key]);
      if (!isNaN(n) && Math.abs(n) <= 1.5 && n !== 0) {
        // stored as fraction, convert to percent
        result[key] = +(n * 100).toFixed(2);
      }
    }
  }
  return result;
}

/**
 * Parse "Отчет" sheet (summary by store)
 * Returns { storeRows, regionTotals }
 * storeRows: individual store rows
 * regionTotals: ИТОГО rows per region (col A = region, col B contains 'ИТОГО')
 */
function parseReportSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const headerIndices = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === 'Регион') {
      headerIndices.push(i);
    }
  }

  if (headerIndices.length === 0) return { storeRows: [], regionTotals: [] };

  const headers = rows[headerIndices[0]];
  const storeRows = [];
  const regionTotals = [];

  for (let i = 0; i < rows.length; i++) {
    if (headerIndices.includes(i)) continue;
    const row = rows[i];
    if (!row || row.every(v => v === null)) continue;

    const regionVal = String(row[0] || '');
    const subdivVal = String(row[1] || '');
    const storeVal = row[2];

    if (regionVal === 'Регион') continue;

    const storeStr = storeVal != null ? String(storeVal) : '';
    const subdivStr = subdivVal;

    // Collect ИТОГО per region (col B has ИТОГО, col C is null or also ИТОГО)
    if (subdivStr.includes('ИТОГО') && regionVal && !storeStr.includes('ИТОГО')) {
      const obj = {};
      headers.forEach((h, idx) => {
        if (h) obj[h] = row[idx];
      });
      // Set the region name to the actual region (col A)
      obj['Регион'] = regionVal;
      regionTotals.push(normalizeRow(obj));
      continue;
    }

    // Also catch global ИТОГО rows (where col A contains ИТОГО)
    if (regionVal.includes('ИТОГО') || storeStr.includes('ИТОГО') || storeStr === 'Kari') continue;
    if (!storeVal) continue;
    if (storeStr === 'Магазин') continue;

    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx];
    });

    storeRows.push(normalizeRow(obj));
  }

  return { storeRows, regionTotals };
}

/**
 * Parse "Детализация" sheet (detail by order)
 */
function parseDetailSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let headerRow = null;
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'Регион') {
      headerRow = rows[i];
      headerIdx = i;
      break;
    }
  }

  if (!headerRow) return [];

  const data = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(v => v === null)) continue;
    if (row[0] === 'Регион') continue;

    const obj = {};
    headerRow.forEach((h, idx) => {
      if (h) {
        let val = row[idx];
        if (h === 'Дата создания') val = formatDate(val);
        obj[h] = val;
      }
    });

    if (!obj['Регион'] && !obj['Магазин']) continue;
    data.push(normalizeRow(obj));
  }

  return data;
}

/**
 * Extract period and title from first rows
 */
function extractMeta(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, range: 0 });
  const title = rows[0]?.[0] ? String(rows[0][0]) : '';
  const period = rows[1]?.[0] ? String(rows[1][0]) : '';
  return { title, period };
}

/**
 * Normalize a column key for fuzzy matching:
 * - lowercase
 * - remove extra spaces, commas, dots
 * - trim
 */
function normalizeKey(k) {
  return String(k)
    .toLowerCase()
    .replace(/[,\.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Precomputed normalized key → original key cache per row (stored on row itself)
const _normCache = new WeakMap();

function getNormMap(row) {
  if (_normCache.has(row)) return _normCache.get(row);
  const map = {};
  for (const k of Object.keys(row)) {
    map[normalizeKey(k)] = k;
  }
  _normCache.set(row, map);
  return map;
}

/**
 * Universal field getter — handles both "Отгружено, шт" and "Отгружено шт" naming
 */
export function getField(row, key) {
  if (row[key] !== undefined && row[key] !== null) return row[key];
  // try without comma+space
  const alt1 = key.replace(', ', ' ');
  if (row[alt1] !== undefined && row[alt1] !== null) return row[alt1];
  // try without space after comma
  const alt2 = key.replace(', ', ',');
  if (row[alt2] !== undefined && row[alt2] !== null) return row[alt2];
  // fuzzy match via normalization (handles any whitespace/comma variation)
  const normMap = getNormMap(row);
  const normKey = normalizeKey(key);
  if (normMap[normKey] !== undefined) {
    const v = row[normMap[normKey]];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

export function getNum(row, key) {
  const v = getField(row, key);
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/**
 * Main parser function
 */
export async function parseExcelFiles(fileList) {
  const results = [];

  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

      const fname = file.name;
      const isKids = fname.includes('кидс') || fname.includes('Кидс') || fname.toLowerCase().includes('kids');
      const isWeekly = fname.includes('Неделя') || fname.toLowerCase().includes('week');
      const productGroup = isKids ? 'Кидс' : 'Обувь';
      const reportType = isWeekly ? 'Неделя' : 'Месяц';

      let summary = [];
      let detail = [];
      let meta = { title: '', period: '' };

      let regionTotals = [];

      if (wb.SheetNames.includes('Отчет')) {
        const ws = wb.Sheets['Отчет'];
        meta = extractMeta(ws);
        const parsed = parseReportSheet(ws);
        summary = parsed.storeRows.map(r => ({
          ...r,
          _productGroup: productGroup,
          _reportType: reportType,
          _file: fname,
        }));
        regionTotals = parsed.regionTotals.map(r => ({
          ...r,
          _productGroup: productGroup,
          _reportType: reportType,
          _file: fname,
        }));
      }

      if (wb.SheetNames.includes('Детализация')) {
        const ws = wb.Sheets['Детализация'];
        detail = parseDetailSheet(ws).map(r => ({
          ...r,
          _productGroup: productGroup,
          _reportType: reportType,
          _file: fname,
        }));
      }

      // Sub-sheets for kids (Одежда для детей)
      const subSheets = wb.SheetNames.filter(n => n !== 'Отчет' && n !== 'Детализация');
      for (const sheetName of subSheets) {
        const ws = wb.Sheets[sheetName];
        if (sheetName.includes('Отчет')) {
          const subGroup = sheetName.replace('Отчет', '').trim() || productGroup;
          const parsed = parseReportSheet(ws);
          const subRows = parsed.storeRows.map(r => ({
            ...r,
            _productGroup: subGroup,
            _reportType: reportType,
            _file: fname,
          }));
          const subTotals = parsed.regionTotals.map(r => ({
            ...r,
            _productGroup: subGroup,
            _reportType: reportType,
            _file: fname,
          }));
          summary = [...summary, ...subRows];
          regionTotals = [...regionTotals, ...subTotals];
        } else if (sheetName.includes('Детализация')) {
          const subGroup = sheetName.replace('Детализация', '').trim() || productGroup;
          const subRows = parseDetailSheet(ws).map(r => ({
            ...r,
            _productGroup: subGroup,
            _reportType: reportType,
            _file: fname,
          }));
          detail = [...detail, ...subRows];
        }
      }

      results.push({ fileName: fname, title: meta.title, period: meta.period, productGroup, reportType, summary, detail, regionTotals });
    } catch (err) {
      console.error(`Error parsing ${file.name}:`, err);
    }
  }

  return results;
}

export function mergeSummaryData(parsedFiles) {
  return parsedFiles.flatMap(f => f.summary);
}

export function mergeDetailData(parsedFiles) {
  return parsedFiles.flatMap(f => f.detail);
}

export function mergeRegionTotals(parsedFiles) {
  return parsedFiles.flatMap(f => f.regionTotals || []);
}

export function getUniqueValues(data, key) {
  const vals = new Set();
  data.forEach(row => {
    const v = getField(row, key);
    if (v !== null && v !== undefined && v !== '') vals.add(String(v));
  });
  return Array.from(vals).sort();
}
