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
  if (val instanceof Date) {
    return val.toLocaleDateString('ru-RU');
  }
  if (typeof val === 'number') {
    const d = excelDateToJS(val);
    return d ? d.toLocaleDateString('ru-RU') : String(val);
  }
  return String(val);
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

/**
 * Parse "Отчет" sheet (summary by store)
 * Layout: rows 0-1 title/period, row 2 headers, row 3+ data (with repeated headers blocks)
 */
function parseReportSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find header rows (row with "Регион" in first cell or "Магазин" in 3rd cell)
  const headerIndices = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[0] === 'Регион' || (row[2] === 'Магазин')) {
      headerIndices.push(i);
    }
  }

  if (headerIndices.length === 0) return [];

  const headers = rows[headerIndices[0]];
  const data = [];

  for (let i = 0; i < rows.length; i++) {
    // Skip header rows
    if (headerIndices.includes(i)) continue;
    const row = rows[i];
    if (!row || row.every(v => v === null)) continue;

    // Skip total/summary rows (they have "ИТОГО" or "Kari" in магазин column)
    const storeVal = row[2];
    if (!storeVal) continue;
    const storeStr = String(storeVal);
    if (
      storeStr.includes('ИТОГО') ||
      storeStr === 'Kari' ||
      storeStr === 'Магазин'
    ) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx];
    });
    data.push(obj);
  }

  return data;
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
    if (row[0] === 'Регион') continue; // repeated header

    const obj = {};
    headerRow.forEach((h, idx) => {
      if (h) {
        let val = row[idx];
        // Format dates
        if (h === 'Дата создания') val = formatDate(val);
        obj[h] = val;
      }
    });

    if (!obj['Регион'] && !obj['Магазин']) continue;
    data.push(obj);
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
 * Main parser function
 * Returns { files: [ { fileName, title, period, productGroup, reportType, summary: [], detail: [] } ] }
 */
export async function parseExcelFiles(fileList) {
  const results = [];

  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });

      // Determine product group and report type from filename
      const fname = file.name;
      const isKids = fname.includes('кидс') || fname.includes('Кидс') || fname.toLowerCase().includes('kids');
      const isWeekly = fname.includes('Неделя') || fname.toLowerCase().includes('week');
      const productGroup = isKids ? 'Кидс' : 'Обувь';
      const reportType = isWeekly ? 'Неделя' : 'Месяц';

      // Parse main Отчет sheet
      let summary = [];
      let detail = [];
      let meta = { title: '', period: '' };

      if (wb.SheetNames.includes('Отчет')) {
        const ws = wb.Sheets['Отчет'];
        meta = extractMeta(ws);
        summary = parseReportSheet(ws);
        // Tag each row
        summary = summary.map(r => ({ ...r, _productGroup: productGroup, _reportType: reportType, _file: fname }));
      }

      if (wb.SheetNames.includes('Детализация')) {
        const ws = wb.Sheets['Детализация'];
        detail = parseDetailSheet(ws);
        detail = detail.map(r => ({ ...r, _productGroup: productGroup, _reportType: reportType, _file: fname }));
      }

      // Also parse sub-sheets for kids (Одежда для детей)
      const subSheets = wb.SheetNames.filter(n => n !== 'Отчет' && n !== 'Детализация');
      for (const sheetName of subSheets) {
        const ws = wb.Sheets[sheetName];
        if (sheetName.includes('Отчет')) {
          const subRows = parseReportSheet(ws);
          const subGroup = sheetName.replace('Отчет', '').trim() || productGroup;
          summary = [
            ...summary,
            ...subRows.map(r => ({ ...r, _productGroup: subGroup, _reportType: reportType, _file: fname })),
          ];
        } else if (sheetName.includes('Детализация')) {
          const subRows = parseDetailSheet(ws);
          const subGroup = sheetName.replace('Детализация', '').trim() || productGroup;
          detail = [
            ...detail,
            ...subRows.map(r => ({ ...r, _productGroup: subGroup, _reportType: reportType, _file: fname })),
          ];
        }
      }

      results.push({
        fileName: fname,
        title: meta.title,
        period: meta.period,
        productGroup,
        reportType,
        summary,
        detail,
      });
    } catch (err) {
      console.error(`Error parsing ${file.name}:`, err);
    }
  }

  return results;
}

/**
 * Merge all summary rows from multiple parsed files
 */
export function mergeSummaryData(parsedFiles) {
  return parsedFiles.flatMap(f => f.summary);
}

/**
 * Merge all detail rows
 */
export function mergeDetailData(parsedFiles) {
  return parsedFiles.flatMap(f => f.detail);
}

/**
 * Get unique values for a column
 */
export function getUniqueValues(data, key) {
  const vals = new Set();
  data.forEach(row => {
    if (row[key] !== null && row[key] !== undefined && row[key] !== '') {
      vals.add(String(row[key]));
    }
  });
  return Array.from(vals).sort();
}
