import * as XLSX from 'xlsx';

// Колонки регионов в файле «По регионам» — начинаются с G (индекс 6, 0-based)
// и идут подряд до последней заполненной колонки в строке заголовка (обычно S — ЮГ)
const REGION_START_COL = 6;
const REGION_END_COL = 18; // S — ЮГ

// Блок «Доля в продажах (в штуках)» — та же сетка регионов, начинается с AT (индекс 45, 0-based)
const SALES_SHARE_COL_OFFSET = 39; // AT(45) - G(6) = 39

const HEADER_ROW = 3;        // Excel-строка 4 — заголовки регионов
const SUMMARY_START_ROW = 5; // Excel-строка 6 — «Общий итог»
const SUMMARY_END_ROW = 42;  // Excel-строка 43 — последняя строка свода
const DETAIL_START_ROW = 47; // Excel-строка 48 — начало детального списка артикулов

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function readValuesAt(ws, r, regions, colOffset) {
  const values = {};
  for (const reg of regions) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: reg.col + colOffset })];
    values[reg.label] = toNum(cell ? cell.v : null);
  }
  return values;
}

function parseRegionGrowthSheet(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const get = (r, c) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    return cell ? cell.v : null;
  };

  // Заголовок / период — A1
  const titleRaw = get(0, 0);
  const title = titleRaw ? String(titleRaw).replace(/\s+/g, ' ').trim() : null;

  // Регионы — из строки заголовка (G..S)
  const regions = [];
  for (let c = REGION_START_COL; c <= REGION_END_COL; c++) {
    const label = get(HEADER_ROW, c);
    if (label !== null && label !== undefined && String(label).trim() !== '') {
      regions.push({ col: c, label: String(label).trim() });
    }
  }
  if (regions.length === 0) return null;

  // Сводная таблица (строки 6-43) — остатки и доля в продажах, штук
  let grandTotal = null;
  const seasons = [];
  let shareGrandTotal = null;
  const shareSeasons = [];

  for (let r = SUMMARY_START_ROW; r <= SUMMARY_END_ROW; r++) {
    const a = get(r, 0);
    const b = get(r, 1);
    if (!a && !b) continue;

    const values = readValuesAt(ws, r, regions, 0);
    const shareValues = readValuesAt(ws, r, regions, SALES_SHARE_COL_OFFSET);

    if (a && String(a).trim() === 'Общий итог') {
      grandTotal = { values };
      shareGrandTotal = { values: shareValues };
    } else if (a) {
      seasons.push({ label: String(a).trim(), total: values, directions: [] });
      shareSeasons.push({ label: String(a).trim(), total: shareValues, directions: [] });
    } else if (b && seasons.length > 0) {
      seasons[seasons.length - 1].directions.push({ label: String(b).trim(), values });
      shareSeasons[shareSeasons.length - 1].directions.push({ label: String(b).trim(), values: shareValues });
    }
  }

  // Детальный список артикулов (с строки 48) — остатки и доля в продажах, штук
  const details = [];
  const shareDetails = [];
  for (let r = DETAIL_START_ROW; r <= range.e.r; r++) {
    const season = get(r, 0);
    const direction = get(r, 1);
    const article = get(r, 2);
    if (!season || !article) continue;

    const values = readValuesAt(ws, r, regions, 0);
    const shareValues = readValuesAt(ws, r, regions, SALES_SHARE_COL_OFFSET);
    details.push({
      season: String(season).trim(),
      direction: direction ? String(direction).trim() : null,
      article: String(article).trim(),
      values,
    });
    shareDetails.push({
      season: String(season).trim(),
      direction: direction ? String(direction).trim() : null,
      article: String(article).trim(),
      values: shareValues,
    });
  }

  return {
    title,
    regions: regions.map(r => r.label),
    grandTotal,
    seasons,
    details,
    salesShare: {
      grandTotal: shareGrandTotal,
      seasons: shareSeasons,
      details: shareDetails,
    },
  };
}

function parseRegionGrowthFile(wb, fileName) {
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Лист не найден в ${fileName}`);

  const parsed = parseRegionGrowthSheet(ws);
  if (!parsed) throw new Error(`Не удалось распознать структуру файла ${fileName}`);

  return { fileName, fileRegion: 'ALL', ...parsed };
}

export async function parseRegionGrowthFiles(fileList) {
  const results = [];
  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const parsed = parseRegionGrowthFile(wb, file.name);
      results.push(parsed);
    } catch (e) {
      console.error('regionGrowthParser error:', file.name, e);
    }
  }
  return results;
}
