import * as XLSX from 'xlsx';

// Seasons in Наполненность sheet — each starts at these col indices (row 0 header)
// Each season has 8 sub-columns:
// [0] Лимит по плану продаж, пар
// [1] В магазинах, пар
// [2] Запас к лимиту
// [3] Доля в остатке, %
// [4] Остаток к продаже магазина
// [5] Продажи за 7 дней
// [6] Оборачиваемость
// [7] Текущий SellOut
const FILLING_SEASONS = [
  { key: 'vsesez',     label: 'Всесезонный',               startCol: 31 },
  { key: 'vsesez_tap', label: 'Всесезонный (тапочки)',      startCol: 39 },
  { key: 'demi_high',  label: 'Демисезонный (высокий)',     startCol: 47 },
  { key: 'demi_low',   label: 'Демисезонный (низкий)',      startCol: 55 },
  { key: 'demi_boot',  label: 'Демисезонный (сапоги)',      startCol: 63 },
  { key: 'zima',       label: 'Зима',                       startCol: 71 },
  { key: 'leto_cl',    label: 'Лето (закрытое)',             startCol: 79 },
  { key: 'leto_op',    label: 'Лето (открытое)',             startCol: 87 },
];

const FILLING_SUB_KEYS = [
  { key: 'limit',     label: 'Лимит по плану продаж, пар' },
  { key: 'inStore',   label: 'В магазинах, пар' },
  { key: 'reserve',   label: 'Запас к лимиту' },
  { key: 'sharePct',  label: 'Доля в остатке, %' },
  { key: 'remSale',   label: 'Остаток к продаже' },
  { key: 'sales7',    label: 'Продажи за 7 дней' },
  { key: 'turnover',  label: 'Оборачиваемость' },
  { key: 'sellout',   label: 'Текущий Sell Out' },
];

// В пути sheet — seasons start at these col indices
// Each season has 6 sub-columns:
// [0] В Заказах Отгружено
// [1] В заказах Создано
// [2] В Журналах сборки (Сортируется)
// [3] ВК ПП на складе
// [4] В Кросс-dok заказах
// [5] В пути всего
const TRANSIT_SEASONS = [
  { key: 'vsesez',     label: 'Всесезонный',               startCol: 10 },
  { key: 'vsesez_tap', label: 'Всесезонный (тапочки)',      startCol: 16 },
  { key: 'demi_high',  label: 'Демисезонный (высокий)',     startCol: 22 },
  { key: 'demi_low',   label: 'Демисезонный (низкий)',      startCol: 28 },
  { key: 'demi_boot',  label: 'Демисезонный (сапоги)',      startCol: 34 },
  { key: 'zima',       label: 'Зима',                       startCol: 40 },
  { key: 'leto_cl',    label: 'Лето (закрытое)',             startCol: 46 },
  { key: 'leto_op',    label: 'Лето (открытое)',             startCol: 52 },
];

const TRANSIT_SUB_KEYS = [
  { key: 'shipped',   label: 'В заказах Отгружено' },
  { key: 'created',   label: 'В заказах Создано' },
  { key: 'assembling',label: 'В журналах сборки' },
  { key: 'stock',     label: 'ВК ПП на складе' },
  { key: 'crossdok',  label: 'В Кросс-dok заказах' },
  { key: 'total',     label: 'В пути всего' },
];

// Total "В пути" block — columns BG(58), BH(59), BL(63)
// BG=Всего в пути (header), BH=В заказах Отгружено итого, BI=В заказах Создано итого, BL=Всего в пути итого
const TRANSIT_TOTAL_COLS = {
  totalInTransit: 63, // BL — Всего в пути
  shipped:        58, // BG — В заказах Отгружено
  created:        59, // BH — В заказах Создано
};

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function parseFilling(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const stores = [];

  // Row 1 = headers, row 2 = grand total (skip), row 3 = region total (skip), rows 4+ = stores
  for (let r = 4; r <= range.e.r; r++) {
    const get = c => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell ? cell.v : null;
    };

    const subdiv = get(2);   // C
    const store  = get(8);   // I (store number)
    const name   = get(4);   // E (наименование магазина)
    const cat    = get(7);   // H (категория магазина)

    // Skip empty rows and total rows
    if (!store && !subdiv) continue;
    if (!store) continue;

    // Main metrics (cols L=11, M=12, N=13, AA=26)
    // fillPctMax stored as fraction in Excel (e.g. 1.27 = 127%) — multiply by 100
    const fillPctMaxRaw = toNum(get(11));
    const fillPctMax   = fillPctMaxRaw !== null ? fillPctMaxRaw * 100 : null; // L — % наполненности MAX
    const planPairsMax = toNum(get(12)); // M — Плановое количество MAX
    const planPairsN   = toNum(get(13)); // N — Плановое количество
    const lastPairs    = toNum(get(26)); // AA — Последних пар

    // Seasonal data
    // sharePct and sellout are stored as fractions (0.329 = 32.9%) — multiply by 100
    const seasons = {};
    for (const season of FILLING_SEASONS) {
      const s = {};
      FILLING_SUB_KEYS.forEach((sub, idx) => {
        const raw = toNum(get(season.startCol + idx));
        if ((sub.key === 'sharePct' || sub.key === 'sellout') && raw !== null) {
          s[sub.key] = raw * 100;
        } else {
          s[sub.key] = raw;
        }
      });
      seasons[season.key] = s;
    }

    stores.push({
      subdiv: subdiv ? String(subdiv) : null,
      store:  store ? String(store) : null,
      name:   name ? String(name) : null,
      cat:    cat ? String(cat) : null,
      fillPctMax,
      planPairsMax,
      planPairsN,
      lastPairs,
      seasons,
    });
  }
  return stores;
}

function parseTransit(ws) {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const stores = [];

  // Same structure: row 1=headers, row 2=grand total, row 3=region total, rows 4+=stores
  for (let r = 3; r <= range.e.r; r++) {
    const get = c => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell ? cell.v : null;
    };

    const store = get(8); // I (Магазин — store number)
    if (!store) continue;

    const seasons = {};
    for (const season of TRANSIT_SEASONS) {
      const s = {};
      TRANSIT_SUB_KEYS.forEach((sub, idx) => {
        s[sub.key] = toNum(get(season.startCol + idx));
      });
      seasons[season.key] = s;
    }

    // Total В пути block
    const transitTotal = {
      totalInTransit: toNum(get(TRANSIT_TOTAL_COLS.totalInTransit)),
      shipped:        toNum(get(TRANSIT_TOTAL_COLS.shipped)),
      created:        toNum(get(TRANSIT_TOTAL_COLS.created)),
    };

    stores.push({
      store: String(store),
      seasons,
      transitTotal,
    });
  }
  return stores;
}

function parseFillingFile(wb, fileName) {
  const wsF = wb.Sheets['Наполненность'];
  const wsT = wb.Sheets['В пути'];

  if (!wsF) throw new Error(`Лист "Наполненность" не найден в ${fileName}`);

  const fillingStores = parseFilling(wsF);
  const transitStores = wsT ? parseTransit(wsT) : [];

  // Merge transit data into filling by store key
  const transitMap = {};
  for (const t of transitStores) {
    transitMap[String(t.store)] = t;
  }
  for (const s of fillingStores) {
    const t = transitMap[String(s.store)];
    if (t) {
      s.transitSeasons = t.seasons;
      s.transitTotal   = t.transitTotal;
    } else {
      s.transitSeasons = null;
      s.transitTotal   = null;
    }
  }

  // Determine fileRegion from subdiv values
  const subdivs = new Set(fillingStores.map(s => s.subdiv).filter(Boolean));
  const hasSPB = [...subdivs].some(s => s.toUpperCase().includes('СПБ'));
  const hasBEL = [...subdivs].some(s => s.toUpperCase().includes('БЕЛ'));
  let fileRegion = 'ALL';
  if (hasSPB && !hasBEL) fileRegion = 'СПБ';
  else if (hasBEL && !hasSPB) fileRegion = 'БЕЛ';

  // Unique subdivisions list
  const subdivList = [...new Set(fillingStores.map(s => s.subdiv).filter(Boolean))].sort();

  return { fileName, fileRegion, stores: fillingStores, subdivList };
}

export async function parseFillingFiles(fileList) {
  const results = [];
  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const parsed = parseFillingFile(wb, file.name);
      results.push(parsed);
    } catch (e) {
      console.error('fillingParser error:', file.name, e);
    }
  }
  return results;
}

export { FILLING_SEASONS, FILLING_SUB_KEYS, TRANSIT_SEASONS, TRANSIT_SUB_KEYS };
