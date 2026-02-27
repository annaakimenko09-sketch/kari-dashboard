import * as XLSX from 'xlsx';

// Columns: A=0 Регион, B=1 Подразделение, C=2 Магазин, D=3 ТЦ,
//          E=4 Рейтинг, F=5 Кол-во ИЗ готовых к выдаче, G=6 Доля сканирования, H=7 Кол-во кликов

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

const SHEET_NAMES = ['День', 'Неделя', 'Месяц'];

// Parse one section of a sheet starting from a known header row
// Returns rows where Магазин (col C) is filled
function parseStoresSection(ws, headerRow, maxRow) {
  const rows = [];
  for (let r = headerRow + 1; r <= maxRow; r++) {
    const get = c => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      return cell ? cell.v : null;
    };
    const region = get(0);
    const subdiv = get(1);
    const store  = get(2);
    const tc     = get(3);
    if (!store) continue;
    const rating   = toNum(get(4));
    const izCount  = toNum(get(5));
    const scanShare = get(6) !== null && get(6) !== undefined ? toNum(get(6)) * 100 : null; // fraction → %
    const clicks   = toNum(get(7));
    rows.push({
      region: region ? String(region) : null,
      subdiv: subdiv ? String(subdiv) : null,
      store:  String(store),
      tc:     tc ? String(tc) : null,
      rating,
      izCount,
      scanShare,
      clicks,
    });
  }
  return rows;
}

function parseSheet(ws) {
  if (!ws) return { period: null, stores: [] };
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Row 0: period header
  const periodCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
  const period = periodCell ? String(periodCell.v) : null;

  // Row 20 = stores header, rows 21+ = store data
  const stores = parseStoresSection(ws, 20, range.e.r);

  return { period, stores };
}

function parseIZFile(wb, fileName) {
  const sheets = {};
  for (const name of SHEET_NAMES) {
    const ws = wb.Sheets[name];
    if (ws) {
      sheets[name] = parseSheet(ws);
    }
  }

  // Determine region from store data
  const allStores = Object.values(sheets).flatMap(s => s.stores);
  const regions = new Set(allStores.map(s => s.region).filter(Boolean));
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
