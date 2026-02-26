import * as XLSX from 'xlsx';

/**
 * Parse "Отчет капсулы" file.
 *
 * Sheet "Итоги":
 *   row 2 col[1]: "Период: DD.MM.YYYY - DD.MM.YYYY"
 *   All data in col[1..6] (col[0] is always null — merged cell artifact)
 *   Header row: col[1]='Регион', col[2]='Подразделение', col[3]='% Неотсканировано' ...
 *   First data block: region summary rows (col[2]=null) + ИТОГО totals
 *   Second data block (after second header row): subdivision detail rows
 *   Note: first block has a duplicate section — stop at first ИТОГО row
 *
 * Sheet "Магазины":
 *   col[1]=Регион, col[2]=Подразделение, col[3]=Магазин, col[4]=ТЦ
 *   col[9]=% Неотскан, col[10]=% пред.нед, col[11]=Не отскан.арт, col[12]=Физдост.арт
 *
 * Returns: { fileName, period, regions, subdivisions, stores }
 * (single combined file for all regions — no per-region split)
 */

function parsePct(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
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

function s(val) {
  return val !== null && val !== undefined ? String(val).trim() : '';
}

function parseCapsuleFile(wb, fileName) {
  const wsItogi  = wb.Sheets['Итоги'];
  const wsStores = wb.Sheets['Магазины'];
  if (!wsItogi) return null;

  // ── Итоги sheet ──────────────────────────────────────────────
  const rawIt = XLSX.utils.sheet_to_json(wsItogi, { header: 1, defval: null });

  // Period from rows 2-4 col[1]
  let period = '';
  for (let i = 2; i <= 4; i++) {
    const cell = rawIt[i]?.[1];
    if (cell && String(cell).includes('Период')) {
      period = String(cell).replace('Период:', '').replace('Период: ', '').trim();
      break;
    }
  }

  // Find header rows (col[1]==='Регион')
  const headerIdxs = [];
  for (let i = 0; i < rawIt.length; i++) {
    if (rawIt[i]?.[1] === 'Регион') headerIdxs.push(i);
  }

  const regions      = [];
  const subdivisions = [];

  // First block: region-level summary rows
  // Stop at first "ИТОГО" row to avoid the duplicate section
  if (headerIdxs.length > 0) {
    const hardEnd = headerIdxs.length > 1 ? headerIdxs[1] : rawIt.length;
    for (let i = headerIdxs[0] + 1; i < hardEnd; i++) {
      const r = rawIt[i];
      if (!r || r.every(v => v === null)) continue;
      const region = s(r[1]);
      if (!region) continue;
      // Stop at ИТОГО rows — these mark the end of unique region data
      if (region === 'ИТОГО' || region.startsWith('ИТОГО ')) break;
      // Only region summary rows (col[2] is empty = no subdivision)
      const subdiv = s(r[2]);
      if (!subdiv) {
        regions.push({
          region,
          pct:        parsePct(r[3]),
          pctPrev:    parsePct(r[4]),
          notScanned: toNum(r[5]),
          available:  toNum(r[6]),
        });
      }
    }
  }

  // Second block: subdivision detail rows
  if (headerIdxs.length > 1) {
    for (let i = headerIdxs[1] + 1; i < rawIt.length; i++) {
      const r = rawIt[i];
      if (!r || r.every(v => v === null)) continue;
      const region = s(r[1]);
      const subdiv = s(r[2]);
      if (!region && !subdiv) continue;
      subdivisions.push({
        region,
        subdiv,
        pct:        parsePct(r[3]),
        pctPrev:    parsePct(r[4]),
        notScanned: toNum(r[5]),
        available:  toNum(r[6]),
      });
    }
  }

  // ── Магазины sheet ───────────────────────────────────────────
  // col[0]=A(empty), col[1]=B(Регион), col[2]=C(Подразделение), col[3]=D(Магазин),
  // col[4]=E(ТЦ), col[5]=F(Тип), col[6]=G(Площ.общ), col[7]=H(Площ.Шуз), col[8]=I(Площ.Кидз),
  // col[9]=J(%Неотскан), col[10]=K(%пред.нед), col[11]=L(Не отскан.арт), col[12]=M(Физдост.арт)
  const stores = [];
  if (wsStores) {
    const rawSt = XLSX.utils.sheet_to_json(wsStores, { header: 1, defval: null });
    let storeHeaderIdx = -1;
    for (let i = 0; i < rawSt.length; i++) {
      if (rawSt[i]?.[1] === 'Регион') { storeHeaderIdx = i; break; }
    }
    const dataStart = storeHeaderIdx >= 0 ? storeHeaderIdx + 1 : 6;
    for (let i = dataStart; i < rawSt.length; i++) {
      const r = rawSt[i];
      if (!r || r.every(v => v === null)) continue;
      const region = s(r[1]);
      if (!region) continue;
      stores.push({
        region,
        subdiv:     s(r[2]),
        store:      s(r[3]),
        tc:         s(r[4]),
        pct:        parsePct(r[9]),
        pctPrev:    parsePct(r[10]),
        notScanned: toNum(r[11]),
        available:  toNum(r[12]),
      });
    }
  }

  // Determine fileRegion from Магазины sheet (stores are region-specific)
  let fileRegion = 'ALL';
  if (stores.length > 0) {
    const storeRegions = new Set(stores.map(r => r.region).filter(Boolean));
    const hasSPB = [...storeRegions].some(r => r.toUpperCase().includes('СПБ'));
    const hasBEL = [...storeRegions].some(r => r.toUpperCase().includes('БЕЛ'));
    if (hasSPB && !hasBEL) fileRegion = 'СПБ';
    else if (hasBEL && !hasSPB) fileRegion = 'БЕЛ';
  }

  return { fileName, fileRegion, period, regions, subdivisions, stores };
}

export async function parseCapsuleFiles(fileList) {
  const results = [];
  for (const file of fileList) {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
      const result = parseCapsuleFile(wb, file.name);
      if (result) results.push(result);
    } catch (err) {
      console.error(`Ошибка парсинга файла капсул ${file.name}:`, err);
    }
  }
  return results;
}
