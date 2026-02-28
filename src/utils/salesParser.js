import * as XLSX from 'xlsx';

// Columns where "higher = better" (green) — col indices (0-based) from the Рег sheet
// F,H,I,J,K,L,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,AA,AB,AC,AD,AE,AF,AG,AH,AI,AJ,AK,AL,AM,AN,AO,AP,AQ,AR,AS,AT,AU,AV,AW,AY,AZ,BA,BB,BC,BD,BE,BF,BG,BH,BI,BJ,BK,BL,BM,BN,BO,BP,BQ,BR,BS,BU,BV,BW,BX
// Note: user used Excel letters A=1, so F=5(0-based)
export const COLS_HIGH_GOOD = new Set([
  5,  // F - ТО руб.
  7,  // H - План %
  8,  // I - Рост к периоду в ТО
  9,  // J - ТО LFL
  10, // K - ТО расширения
  11, // L - Рост пл-ди, %
  13, // N - Маржа %
  14, // O - Маржа LFL
  15, // P - Маржа % USD
  16, // Q - ТО/посетитель
  17, // R - ТО/посетитель LFL
  18, // S - Трафик
  19, // T - Трафик LFL
  20, // U - Трафик YTY расширение
  21, // V - Трафик YTY
  22, // W - КОП
  23, // X - Рост к периоду в КОП
  24, // Y - КОП LFL
  25, // Z - КОП обувь
  26, // AA - Рост к периоду в КОП обувь
  27, // AB - Ср. чек
  28, // AC - Ср. чек LFL
  29, // AD - Ср. чек обувь
  30, // AE - Ср. чек обувь LFL
  31, // AF - Пар в чеке
  32, // AG - Пар в чеке LFL
  33, // AH - Штук в чеке
  34, // AI - Штук в чеке к неделе
  35, // AJ - Ср. пара
  36, // AK - Ср. пара LFL
  37, // AL - Остатки обуви LFL
  38, // AM - Продажи обуви LFL
  39, // AN - Рассрочка %
  40, // AO - Рассрочка YTY %
  41, // AP - Доля СБП %
  42, // AQ - Конв. об. косм. %
  43, // AR - Конв. стельки %
  44, // AS - Рост к периоду Конв. стельки %
  45, // AT - Кожа %
  46, // AU - Доля РС %
  47, // AV - Кожа % шт
  48, // AW - Кожа % в остатках шт
  50, // AY - Аксесс %
  51, // AZ - Аксесс YTY %
  52, // BA - Кидз %
  53, // BB - Одежда vs Обувь (кидс)
  54, // BC - ТО ЮИ / ТО
  55, // BD - ЮИ %
  56, // BE - Серебро %
  57, // BF - Золото %
  58, // BG - Кари Home, %
  59, // BH - МБТ, %
  60, // BI - Косм, %
  61, // BJ - Спорт, %
  62, // BK - Сумки %
  63, // BL - Сумки LFL
  64, // BM - Доля чеков Спасибо в ТО
  65, // BN - Утилизация списания
  66, // BO - Повт. покуп. LFL
  67, // BP - Повт. покуп. %
  68, // BQ - Конв. новых клиентов %
  69, // BR - e-mail %
  70, // BS - Качество подбора товара
  72, // BU - Кол-во товаров заказано
  73, // BV - Доля ИЗ в ТО, %
  74, // BW - ТО YTY
  75, // BX - Средний ТО
  // МЕСЯЦ extra col (index 72 shifts everything):
  // handled dynamically in page
]);

// Columns where "higher = worse" (red)
// G=6(0-based), M=12, AX=49, BT=71
export const COLS_HIGH_BAD = new Set([
  6,  // G - Место в ТО
  12, // M - Скидка %
  49, // AX - Кожа оборач., нед
  71, // BT - Ср. время сборки ИЗ ч.
]);

// Determine region from filename
function detectRegion(name) {
  const n = name.toUpperCase();
  if (n.includes('СПБ') || n.includes('SPB')) return 'СПБ';
  if (n.includes('БЕЛ') || n.includes('BEL')) return 'БЕЛ';
  return 'ALL';
}

// Determine period type from filename
function detectPeriod(name) {
  const n = name.toUpperCase();
  if (n.includes('ДЕНЬ') || n.includes('DAY') || n.startsWith('ДЕНЬ')) return 'ДЕНЬ';
  if (n.includes('МЕСЯЦ') || n.includes('MONTH')) return 'МЕСЯЦ';
  return 'ДЕНЬ';
}

function getCell(ws, r, c) {
  const cell = ws[XLSX.utils.encode_cell({ r, c })];
  return cell ? cell.v : null;
}

function parseRegSheet(ws) {
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

  // Find all repeated header rows (where cell A == 'Регион') after row 4
  const headerRowIndices = [4];
  for (let r = 5; r <= range.e.r; r++) {
    const v = getCell(ws, r, 0);
    if (v !== null && String(v).trim() === 'Регион') {
      headerRowIndices.push(r);
    }
  }

  // Parse a section of data rows between two header row boundaries
  function parseSection(startRow, endRow) {
    const rows = [];
    for (let r = startRow; r <= endRow; r++) {
      const aVal = getCell(ws, r, 0);
      const dVal = getCell(ws, r, 3);
      // Skip empty rows and summary rows (КОМПАНИЯ/ИТОГО marker)
      if (aVal === null && dVal === null) continue;
      // Skip rows where D = 'КОМПАНИЯ' or 'РЕГИОН' or 'ИМ' (totals)
      const dStr = dVal !== null ? String(dVal).trim().toUpperCase() : '';
      if (dStr === 'КОМПАНИЯ' || dStr === 'РЕГИОН' || dStr === 'ИМ') continue;

      const row = { _colCount: headers.length };
      for (let c = 0; c <= range.e.c; c++) {
        const v = getCell(ws, r, c);
        row[headers[c]] = v;
        row[`_c${c}`] = v; // store by index too for gradient
      }
      rows.push(row);
    }
    return rows;
  }

  // Parse totals/summary section (regions + company)
  function parseSummarySection(startRow, endRow) {
    const rows = [];
    for (let r = startRow; r <= endRow; r++) {
      const aVal = getCell(ws, r, 0);
      const dVal = getCell(ws, r, 3);
      if (aVal === null && dVal === null) continue;
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
    // Only one header — all data is stores
    stores = parseSection(5, range.e.r);
  } else if (headerRowIndices.length === 2) {
    // Two headers: stores then regions/subdivs mixed
    stores = parseSection(5, headerRowIndices[1] - 1);
    regions = parseSummarySection(headerRowIndices[1] + 1, range.e.r);
  } else if (headerRowIndices.length >= 3) {
    // Three headers: stores | subdivs | regions
    stores = parseSection(5, headerRowIndices[1] - 1);
    subdivs = parseSection(headerRowIndices[1] + 1, headerRowIndices[2] - 1);
    regions = parseSummarySection(headerRowIndices[2] + 1, range.e.r);
  }

  return { periods, headers, stores, subdivs, regions };
}

export async function parseSalesFiles(fileList) {
  const results = [];

  for (const file of Array.from(fileList)) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    const sheetName = 'Рег';
    if (!wb.SheetNames.includes(sheetName)) continue;

    const ws = wb.Sheets[sheetName];
    const parsed = parseRegSheet(ws);

    results.push({
      fileName: file.name,
      fileRegion: detectRegion(file.name),
      filePeriod: detectPeriod(file.name),
      ...parsed,
    });
  }

  return results;
}
