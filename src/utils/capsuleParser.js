import * as XLSX from 'xlsx';

/**
 * Parse "Отчет капсулы" file.
 *
 * Sheet "Итоги":
 *   row 2: "Период: DD.MM.YYYY - DD.MM.YYYY"
 *   row 5: headers [null, Регион, Подразделение, % Неотсканировано, % Неотсканировано пред.неделя, Не отскан.арт, Физдост.арт]
 *   rows 6..N: data (region summary rows where col[2]=null, then totals rows)
 *   row ~38: second block headers (subdivisions detail for СПБ/БЕЛ)
 *   rows after: subdivision detail rows
 *
 * Sheet "Магазины":
 *   row 5: headers
 *   rows 6+: data
 *   cols kept: C(2)=Магазин, J(9)=% Неотсканировано, K(10)=% пред.неделя, L(11)=Не отскан.арт, M(12)=Физдост.арт
 *   col B(1) = Регион (for filtering)
 *   col C(2) = Подразделение... wait — let me re-check:
 *   actual cols: [null, Регион, Подразделение, Магазин, ТЦ, Тип, Площадь общ, Площадь Шуз, Площадь Кидз, % Неотскан, % пред, Не отскан.арт, Физдост.арт]
 *   idx:          0      1       2               3        4   5    6             7             8             9          10      11             12
 *   User wants cols C=3(Магазин), J=9(% Неотскан), K=10(% пред), L=11(Не отскан.арт), M=12(Физдост.арт)
 *   Region = col B = idx 1, Подразделение = col C... no:
 *   Excel col A=0, B=1, C=2, D=3... J=9, K=10, L=11, M=12
 *   So: B=Регион(1), C=Подразделение(2), D=Магазин(3), J=%(9), K=%(10), L=арт(11), M=арт(12)
 *   User wants cols C,J,K,L,M = Подразделение + 4 metrics (no Магазин ID?)
 *   Actually re-reading: "оставляй данные со столбцов: C, J, K, L, M"
 *   C=Подразделение(2), J=% Неотскан(9), K=% пред(10), L=Не отскан.арт(11), M=Физдост.арт(12)
 *   Also need Магазин (col D=3) and ТЦ (col E=4) for context
 *
 * Returns: { fileName, fileRegion, period, regions, subdivisions, stores }
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

function str(val) {
  return val !== null && val !== undefined ? String(val).trim() : '';
}

function parseCapsuleFile(wb, fileName) {
  const wsItogi   = wb.Sheets['Итоги'];
  const wsStores  = wb.Sheets['Магазины'];
  if (!wsItogi) return null;

  // ── Итоги sheet ──────────────────────────────────────────────
  const rawIt = XLSX.utils.sheet_to_json(wsItogi, { header: 1, defval: null });

  // Period from row 2
  let period = '';
  for (let i = 2; i <= 4; i++) {
    const cell = rawIt[i]?.[1];
    if (cell && String(cell).includes('Период')) {
      period = String(cell).replace('Период:', '').replace('Период: ', '').trim();
      break;
    }
  }

  // Find all header rows (rows where col[1]==='Регион')
  const headerIdxs = [];
  for (let i = 0; i < rawIt.length; i++) {
    if (rawIt[i]?.[1] === 'Регион') headerIdxs.push(i);
  }

  const regions      = [];
  const subdivisions = [];

  // First block (headerIdxs[0]): region-level rows (col[2] is null or region name, col[2]=null means summary of region)
  if (headerIdxs.length > 0) {
    const blockEnd = headerIdxs.length > 1 ? headerIdxs[1] : rawIt.length;
    for (let i = headerIdxs[0] + 1; i < blockEnd; i++) {
      const r = rawIt[i];
      if (!r || r.every(v => v === null)) continue;
      const region = str(r[1]);
      const subdiv = str(r[2]);
      if (!region || region === 'ИТОГО' || region.startsWith('ИТОГО ')) continue;
      // Only rows where subdiv is empty = region summary row
      if (!subdiv) {
        regions.push({
          region,
          pct:       parsePct(r[3]),
          pctPrev:   parsePct(r[4]),
          notScanned: toNum(r[5]),
          available:  toNum(r[6]),
        });
      }
    }
  }

  // Second block (headerIdxs[1]): subdivision detail rows
  if (headerIdxs.length > 1) {
    for (let i = headerIdxs[1] + 1; i < rawIt.length; i++) {
      const r = rawIt[i];
      if (!r || r.every(v => v === null)) continue;
      const region = str(r[1]);
      const subdiv = str(r[2]);
      if (!region && !subdiv) continue;
      subdivisions.push({
        region,
        subdiv,
        pct:        parsePct(r[3]),
        pctPrev:    parsePct(r[4]),
        notScanned:  toNum(r[5]),
        available:   toNum(r[6]),
      });
    }
  }

  // Detect region from data
  let fileRegion = 'ALL';
  const allRegions = [...regions.map(r => r.region), ...subdivisions.map(r => r.region)];
  const spbCount = allRegions.filter(r => r.toUpperCase().includes('СПБ') || r.toUpperCase().includes('SPB')).length;
  const belCount = allRegions.filter(r => r.toUpperCase().includes('БЕЛ') || r.toUpperCase().includes('BEL')).length;
  if (spbCount > 0 && belCount === 0) fileRegion = 'СПБ';
  else if (belCount > 0 && spbCount === 0) fileRegion = 'БЕЛ';
  // If both present — keep ALL (combined file)

  // ── Магазины sheet ───────────────────────────────────────────
  // Cols (0-based, Excel A=0):
  //   0=A(empty), 1=B(Регион), 2=C(Подразделение), 3=D(Магазин), 4=E(ТЦ),
  //   5=F(Тип), 6=G(Площ.общ), 7=H(Площ.Шуз), 8=I(Площ.Кидз),
  //   9=J(%Неотскан), 10=K(%пред.нед), 11=L(Не отскан.арт), 12=M(Физдост.арт)
  const stores = [];
  if (wsStores) {
    const rawSt = XLSX.utils.sheet_to_json(wsStores, { header: 1, defval: null });
    // Find header row (where col[1]==='Регион')
    let storeHeaderIdx = -1;
    for (let i = 0; i < rawSt.length; i++) {
      if (rawSt[i]?.[1] === 'Регион') { storeHeaderIdx = i; break; }
    }
    const dataStart = storeHeaderIdx >= 0 ? storeHeaderIdx + 1 : 6;
    for (let i = dataStart; i < rawSt.length; i++) {
      const r = rawSt[i];
      if (!r || r.every(v => v === null)) continue;
      const region = str(r[1]);
      if (!region) continue;
      stores.push({
        region,
        subdiv:     str(r[2]),   // C — Подразделение
        store:      str(r[3]),   // D — Магазин (номер)
        tc:         str(r[4]),   // E — ТЦ (название)
        pct:        parsePct(r[9]),   // J — % Неотсканировано
        pctPrev:    parsePct(r[10]),  // K — % пред.неделя
        notScanned:  toNum(r[11]),    // L — Не отскан.арт
        available:   toNum(r[12]),    // M — Физдост.арт
      });
    }
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
