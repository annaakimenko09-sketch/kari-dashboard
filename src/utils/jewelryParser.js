import * as XLSX from 'xlsx';

/**
 * Parse "Отчет по ЮИ итоги" file.
 *
 * Sheet "OUT" structure:
 *   row 0: period
 *   row 1: subdivision headers [Регион, Подразделение, Кол-во арт, % невыст, Дата]
 *   rows 2..N: subdivision data (until empty row)
 *   empty row
 *   row N+2: store headers [Регион, Подразделение, Магазин, Кол-во арт, % невыст, Дата]
 *   rows N+3..: store data
 *
 * Returns: { fileName, fileRegion, period, subdivisions, stores }
 */
function parseJewelryItogi(wb, fileName) {
  const ws = wb.Sheets['OUT'];
  if (!ws) return null;

  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  const period = raw[0]?.[0]
    ? String(raw[0][0]).replace('Период отчета:', '').replace('Период отчета: ', '').trim()
    : '';

  // Detect region from first data row
  let fileRegion = 'ALL';
  for (let i = 2; i < raw.length; i++) {
    const r = raw[i];
    if (r && r[0]) {
      const reg = String(r[0]).trim().toUpperCase();
      if (reg.includes('СПБ') || reg.includes('SPB')) { fileRegion = 'СПБ'; break; }
      if (reg.includes('БЕЛ') || reg.includes('BEL')) { fileRegion = 'БЕЛ'; break; }
      fileRegion = String(r[0]).trim();
      break;
    }
  }

  const subdivisions = [];
  const stores = [];

  // Detect format by checking row 1 header:
  // New format (colleague): row 1 has "Магазин" at col 2 → only stores section, no subdivisions block
  // Old format: row 1 has "Подразделение" at col 1 with no "Магазин" at col 2, stores appear after second header row
  const headerRow1 = raw[1] || [];
  const isNewFormat = headerRow1[2] === 'Магазин';

  if (isNewFormat) {
    // New format: row 0=period, row 1=headers, rows 2+=store data
    // Cols: 0=Регион, 1=Подразделение, 2=Магазин, 3=Кол-во арт., 4=% невыставленного, 5=Дата
    for (let i = 2; i < raw.length; i++) {
      const r = raw[i];
      if (!r || r.every(v => v === null)) continue;
      if (!r[0] && !r[1]) continue;
      stores.push({
        region:   String(r[0] || '').trim(),
        subdiv:   String(r[1] || '').trim(),
        store:    String(r[2] || '').trim(),
        artCount: toNum(r[3]),
        pct:      parsePct(r[4]),
        lastScan: parseExcelDate(r[5]),
      });
    }
    // Build subdivisions by aggregating stores
    const subdivMap = {};
    for (const s of stores) {
      const key = s.region + '||' + s.subdiv;
      if (!subdivMap[key]) {
        subdivMap[key] = { region: s.region, subdiv: s.subdiv, artCount: 0, pctSum: 0, count: 0, lastScan: s.lastScan };
      }
      subdivMap[key].artCount += s.artCount;
      if (s.pct !== null) { subdivMap[key].pctSum += s.pct; subdivMap[key].count++; }
    }
    for (const key of Object.keys(subdivMap)) {
      const sd = subdivMap[key];
      subdivisions.push({
        region:   sd.region,
        subdiv:   sd.subdiv,
        artCount: sd.artCount,
        pct:      sd.count > 0 ? +(sd.pctSum / sd.count).toFixed(2) : null,
        lastScan: sd.lastScan,
      });
    }
  } else {
    // Old format: subdivisions block first, then stores block after second "Регион" header row
    let storeHeaderIdx = -1;
    for (let i = 3; i < raw.length; i++) {
      const r = raw[i];
      if (r && r[0] === 'Регион' && r[2] === 'Магазин') {
        storeHeaderIdx = i;
        break;
      }
    }

    const subdivEnd = storeHeaderIdx > 0 ? storeHeaderIdx : raw.length;
    for (let i = 2; i < subdivEnd; i++) {
      const r = raw[i];
      if (!r || r.every(v => v === null)) continue;
      if (r[0] === 'Регион') continue;
      if (!r[0] && !r[1]) continue;
      subdivisions.push({
        region:   String(r[0] || '').trim(),
        subdiv:   String(r[1] || '').trim(),
        artCount: toNum(r[2]),
        pct:      parsePct(r[3]),
        lastScan: parseExcelDate(r[4]),
      });
    }

    if (storeHeaderIdx > 0) {
      for (let i = storeHeaderIdx + 1; i < raw.length; i++) {
        const r = raw[i];
        if (!r || r.every(v => v === null)) continue;
        if (r[0] === 'Регион') continue;
        if (!r[0] && !r[1]) continue;
        stores.push({
          region:   String(r[0] || '').trim(),
          subdiv:   String(r[1] || '').trim(),
          store:    String(r[2] || '').trim(),
          artCount: toNum(r[3]),
          pct:      parsePct(r[4]),
          lastScan: parseExcelDate(r[5]),
        });
      }
    }
  }

  return { fileName, fileRegion, period, subdivisions, stores };
}

/**
 * Parse "Невыставленный товар" file.
 *
 * Sheet "Итог по магазину": summary per store
 *   cols: Регион, Подразделение, Магазин, ТЦ, Физические запасы, Кол-во кликов, Кол-во невыставленного
 *
 * Sheet "OUT": detail per article
 *   cols: Регион, Подразделение, Магазин, ТЦ, Группа, Товар(артикул), Наименование, Ячейка, Фото URL
 *
 * Returns: { fileName, period, summary, detail }
 */
function parseUnexposed(wb, fileName) {
  const wsSummary = wb.Sheets['Итог по магазину'];
  const wsDetail  = wb.Sheets['OUT'];

  if (!wsSummary || !wsDetail) return null;

  const rawSum = XLSX.utils.sheet_to_json(wsSummary, { header: 1, defval: null });
  const rawDet = XLSX.utils.sheet_to_json(wsDetail,  { header: 1, defval: null });

  const period = rawDet[0]?.[0]
    ? String(rawDet[0][0]).replace('Период отчета: ', '').trim()
    : '';

  // Summary: row 0 = headers, rows 1+ = data
  const summary = [];
  for (let i = 1; i < rawSum.length; i++) {
    const r = rawSum[i];
    if (!r || !r[0]) continue;
    summary.push({
      region:      String(r[0] || '').trim(),
      subdiv:      String(r[1] || '').trim(),
      store:       String(r[2] || '').trim(),
      tc:          String(r[3] || '').trim(),
      stockQty:    toNum(r[4]),
      clickQty:    toNum(r[5]),
      unexposedQty: toNum(r[6]),
    });
  }

  // Detail: row 0 = period, row 1 = headers, rows 2+ = data
  const detail = [];
  for (let i = 2; i < rawDet.length; i++) {
    const r = rawDet[i];
    if (!r || !r[0]) continue;
    const group = String(r[4] || '').trim();
    detail.push({
      region:   String(r[0] || '').trim(),
      subdiv:   String(r[1] || '').trim(),
      store:    String(r[2] || '').trim(),
      tc:       String(r[3] || '').trim(),
      group,
      isGold:   isGoldGroup(group),
      article:  String(r[5] || '').trim(),
      name:     String(r[6] || '').trim(),
      cell:     String(r[7] || '').trim(),
      photoUrl: String(r[8] || '').trim(),
    });
  }

  return { fileName, period, summary, detail };
}

function isGoldGroup(group) {
  const g = group.toLowerCase();
  return g.includes('золото') || g.includes('золот') || g.includes('gold');
}

function parsePct(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    // If > 1.5, treat as already percent
    if (val > 1.5) return +val.toFixed(2);
    return +(val * 100).toFixed(2);
  }
  const str = String(val);
  const hasPercent = str.includes('%');
  const n = parseFloat(str.replace('%', '').replace(',', '.').trim());
  if (isNaN(n)) return null;
  if (hasPercent) return +n.toFixed(2);
  if (n > 1.5 || n === 0) return +n.toFixed(2);
  return +(n * 100).toFixed(2);
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(',', '.').replace(/\s/g, ''));
  return isNaN(n) ? 0 : n;
}

// Excel serial date → readable string "DD.MM.YYYY"
function parseExcelDate(val) {
  if (!val) return '—';
  if (val === '-' || val === '—') return '—';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    // Excel epoch: Jan 1 1900 = 1, but has off-by-2 bug (counts 1900 as leap year)
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const day   = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year  = d.getUTCFullYear();
    return `${day}.${month}.${year}`;
  }
  return String(val);
}

export async function parseJewelryFiles(fileList) {
  const itogiResults = [];
  const unexposedResults = [];

  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const name = file.name.toLowerCase();

      const isItogi     = name.includes('юи') || name.includes('ювелир') || name.includes('итог');
      const isUnexposed = name.includes('невыставленн');

      if (isItogi) {
        const result = parseJewelryItogi(wb, file.name);
        if (result) itogiResults.push(result);
      } else if (isUnexposed) {
        const result = parseUnexposed(wb, file.name);
        if (result) unexposedResults.push(result);
      }
    } catch (err) {
      console.error(`Ошибка парсинга файла ЮИ ${file.name}:`, err);
    }
  }

  return { itogiResults, unexposedResults };
}
