import * as XLSX from 'xlsx';

// Sheet name
const SHEET_NAME = 'Доля в продажах';

// Columns where "higher = better" (green)
// All metric cols except Скидка % (30) and Оборачиваемость (28,29)
export const YUI_COLS_HIGH_GOOD = new Set([
  4,  // Доля ЮИ %
  5,  // ТО ЮИ / ТО
  6,  // Рассрочка, %
  7,  // Доля Серебра %
  8,  // Доля Золота %
  9,  // План %
  10, // План серебро %
  11, // План золото %
  12, // ТО ЮИ руб.
  13, // ТО Серебро руб.
  14, // ТО Золото руб.
  15, // ТО Серебро LFL
  16, // ТО Золото LFL
  17, // Ср.чек
  18, // Ср.чек LFL
  19, // Ср.цена Серебро
  20, // Ср.цена Золото
  21, // Ср.цена Серебро LFL
  22, // Ср.цена Золото LFL
  23, // Штук в чеке
  24, // ТО Серебро штук
  25, // ТО Золото штук
  26, // ТО Серебро штук LFL
  27, // ТО Золото штук LFL
  31, // Маржа Серебро %
  32, // Маржа Золото %
  33, // Маржа Серебро LFL
  34, // Маржа Золото LFL
  35, // Доля чеков Спасибо в ТО ЮИ
  36, // Выдано подарков %
  37, // Выдано подарков
  38, // ТО \ подарок
  39, // Конв. подарков
  40, // Ср.чек с подарком
]);

// Columns where "higher = worse" (red)
export const YUI_COLS_HIGH_BAD = new Set([
  28, // Оборачиваемость Серебро шт, нед
  29, // Оборачиваемость Золото шт, нед
  30, // Скидка %
]);

// % columns stored as decimals
export const YUI_PERCENT_COLS = new Set([
  4,  // Доля ЮИ %
  5,  // ТО ЮИ / ТО
  6,  // Рассрочка, %
  7,  // Доля Серебра %
  8,  // Доля Золота %
  9,  // План %
  10, // План серебро %
  11, // План золото %
  15, // ТО Серебро LFL
  16, // ТО Золото LFL
  18, // Ср.чек LFL
  21, // Ср.цена Серебро LFL
  22, // Ср.цена Золото LFL
  26, // ТО Серебро штук LFL
  27, // ТО Золото штук LFL
  30, // Скидка %
  31, // Маржа Серебро %
  32, // Маржа Золото %
  33, // Маржа Серебро LFL
  34, // Маржа Золото LFL
  35, // Доля чеков Спасибо в ТО ЮИ
  36, // Выдано подарков %
  39, // Конв. подарков
]);

// Integer (no decimal) columns
export const YUI_INTEGER_COLS = new Set([12, 13, 14, 17, 19, 20, 23, 24, 25, 37, 38, 40]);

function detectRegion(name) {
  const n = name.toUpperCase();
  if (n.includes('СПБ') || n.includes('SPB')) return 'СПБ';
  if (n.includes('БЕЛ') || n.includes('BEL')) return 'БЕЛ';
  return 'ALL';
}

function detectPeriod(name) {
  const n = name.toUpperCase();
  if (n.startsWith('ДЕНЬ') || n.includes('ДЕНЬ_') || n.includes('DAY')) return 'ДЕНЬ';
  if (n.startsWith('МЕСЯЦ') || n.includes('МЕСЯЦ_') || n.includes('MONTH')) return 'МЕСЯЦ';
  return 'ДЕНЬ';
}

function getCell(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  return cell ? cell.v : null;
}

function parseSheet(ws, fileRegion) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Collect period info from rows 0-2
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

  // Find section separator rows (where col A === 'Регион') after row 4
  const headerRowIndices = [4];
  for (let r = 5; r <= range.e.r; r++) {
    const v = getCell(ws, r, 0);
    if (v !== null && String(v).trim() === 'Регион') {
      headerRowIndices.push(r);
    }
  }

  function parseSection(startRow, endRow, isSummary = false) {
    const rows = [];
    for (let r = startRow; r <= endRow; r++) {
      const aVal = getCell(ws, r, 0);
      const dVal = getCell(ws, r, 3);
      if (aVal === null && dVal === null) continue;
      if (!isSummary) {
        const dStr = dVal !== null ? String(dVal).trim().toUpperCase() : '';
        if (dStr === 'КОМПАНИЯ' || dStr === 'РЕГИОН' || dStr === 'ИМ') continue;
      }
      const row = { _colCount: headers.length };
      for (let c = 0; c <= range.e.c; c++) {
        const v = getCell(ws, r, c);
        row[headers[c]] = v;
        row[`_c${c}`] = v;
      }
      rows.push(row);
    }
    return rows;
  }

  let stores = [], subdivs = [], regions = [];

  if (headerRowIndices.length === 1) {
    stores = parseSection(5, range.e.r);
  } else if (headerRowIndices.length === 2) {
    stores = parseSection(5, headerRowIndices[1] - 1);
    regions = parseSection(headerRowIndices[1] + 1, range.e.r, true);
  } else if (headerRowIndices.length >= 3) {
    stores = parseSection(5, headerRowIndices[1] - 1);
    subdivs = parseSection(headerRowIndices[1] + 1, headerRowIndices[2] - 1);
    regions = parseSection(headerRowIndices[2] + 1, range.e.r, true);
  }

  return { periods, headers, stores, subdivs, regions };
}

export async function parseSalesYuiFiles(fileList) {
  const results = [];

  for (const file of Array.from(fileList)) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    if (!wb.SheetNames.includes(SHEET_NAME)) continue;

    const ws = wb.Sheets[SHEET_NAME];
    // Detect region from content (row 5, col 0) if not in filename
    let fileRegion = detectRegion(file.name);
    if (fileRegion === 'ALL') {
      // Try to detect from first data row
      const firstRegion = ws[XLSX.utils.encode_cell({ r: 5, c: 0 })];
      if (firstRegion) {
        const rv = String(firstRegion.v).toUpperCase();
        if (rv.includes('СПБ')) fileRegion = 'СПБ';
        else if (rv.includes('БЕЛ')) fileRegion = 'БЕЛ';
      }
    }

    const filePeriod = detectPeriod(file.name);
    const parsed = parseSheet(ws, fileRegion);

    results.push({
      fileName: file.name,
      fileRegion,
      filePeriod,
      ...parsed,
    });
  }

  return results;
}
