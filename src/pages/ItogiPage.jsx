import { useMemo, useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { TrendingUp, TrendingDown, Award, AlertTriangle, BarChart2, ClipboardCheck, Download } from 'lucide-react';
import * as XLSXStyle from 'xlsx-js-style';

const ACCENT = '#E91E8C';

// Закрытые магазины — не участвуют в рейтингах
const CLOSED_STORES = new Set([11788, 11598, 50058, 11292]);

// ─── Helpers ────────────────────────────────────────────────────────────────
function pct(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : +n.toFixed(1);
}

function avg(...vals) {
  const nums = vals.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function fmt(v) {
  if (v === null || v === undefined) return '';
  return parseFloat(v.toFixed(1));
}

function regionOf(row) {
  const r = String(row['Регион'] || row.region || '').toUpperCase();
  if (r.includes('СПБ') || r.includes('SPB')) return 'СПБ';
  if (r.includes('БЕЛ') || r.includes('BEL')) return 'БЕЛ';
  return null;
}

function subdivOf(row) {
  return String(row['Подразделение'] || row.subdiv || '').trim();
}

function storeLabel(row) {
  return String(row['Магазин'] || row.store || row['ТЦ'] || row.tc || '').trim();
}

// Extract numeric store code from strings like "11788 Мега" or "50006"
function extractStoreCode(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function storeId(row) {
  // scanning: store = '11778' (col 2), sales: _c3 = 11778 (col D = Магазин)
  // _c2 = col C = 0/1 flag in sales files — do NOT use for store ID
  const v = row['Код'] || row['КодМагазина'] || row['code'] || row['id']
    || row['store'] || row['_c3'] || '';
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}

// Normalize store label for use as a map key.
// Scanning stores come as "11788 Мега" — we extract the numeric prefix so they
// match sales store keys which are plain "11788".
function storeKey(rawLabel) {
  const code = extractStoreCode(rawLabel);
  if (code !== null) return String(code);
  return rawLabel.toLowerCase();
}

function isClosed(row) {
  const id = storeId(row);
  return id !== null && CLOSED_STORES.has(id);
}

// ─── Excel export ──────────────────────────────────────────────────────────────
const SCORE_COL_INDICES = new Set([4, 5, 6, 7, 8, 9, 10]);

function scoreColor(val) {
  if (val === '' || val === null || val === undefined) return null;
  const v = parseFloat(val);
  if (isNaN(v)) return null;
  const r = Math.round(255 - v * 1.5);
  const g = Math.round(v * 2);
  const b = 60;
  const clamp = x => Math.max(0, Math.min(255, x));
  const toHex = x => clamp(x).toString(16).padStart(2, '0');
  return (toHex(r) + toHex(g) + toHex(b)).toUpperCase();
}

const HEADER_STYLE = {
  fill: { patternType: 'solid', fgColor: { rgb: '1F2937' } },
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: { bottom: { style: 'thin', color: { rgb: '374151' } } },
};

function applySheet(ws, wsData, scoreColSet) {
  wsData[0].forEach((_, ci) => {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c: ci });
    if (ws[addr]) ws[addr].s = HEADER_STYLE;
  });
  for (let ri = 1; ri < wsData.length; ri++) {
    wsData[ri].forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws[addr]) return;
      const isScoreCol = scoreColSet.has(ci);
      const bgHex = isScoreCol ? scoreColor(val) : null;
      ws[addr].s = {
        ...(bgHex ? { fill: { patternType: 'solid', fgColor: { rgb: bgHex } } } : {}),
        font: { color: { rgb: bgHex ? '1F2937' : '374151' }, sz: 10 },
        alignment: { horizontal: ci < 4 ? 'left' : 'center' },
        numFmt: typeof val === 'number' ? '0.0' : '@',
      };
    });
  }
}

// mode: 'reglaments' | 'sales'
function exportStores(items, filename, mode = 'reglaments') {
  const wb = XLSXStyle.utils.book_new();
  let headers, rows, colWidths, scoreColSet;

  if (mode === 'reglaments') {
    headers = ['#', 'Регион', 'Подразделение', 'Магазин', 'ТЦ',
      'Скан.% неотскан', 'ЮИ% невыст', 'Капс.% неотскан', 'ИЗ% скан', 'Цены% ПП без ценн.',
      'Балл скан', 'Балл ЮИ', 'Балл капсул', 'Балл ИЗ', 'Балл цен', 'Балл регламент'];
    rows = items.map((s, i) => [
      i + 1, s.region, s.subdiv || '—', s.store, s.tc || '—',
      fmt(s.scanRaw), fmt(s.yuiRaw), fmt(s.capsRaw), fmt(s.izRaw), fmt(s.pricingRaw),
      fmt(s.scanAvg), fmt(s.yuiAvg), fmt(s.capsAvg), fmt(s.izAvg), fmt(s.pricingAvg),
      fmt(s.regScore),
    ]);
    scoreColSet = new Set([10, 11, 12, 13, 14, 15]);
    colWidths = [
      { wch: 4 }, { wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 22 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
      { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 9 }, { wch: 14 },
    ];
  } else {
    // mode === 'sales'
    const salesLabels = SALES_SCORE_COLS.map(c => c.label);
    headers = ['#', 'Регион', 'Подразделение', 'Магазин', 'ТЦ',
      ...salesLabels, 'Балл продажи'];
    rows = items.map((s, i) => {
      const salesVals = SALES_SCORE_COLS.map(({ ci, isPct }) => {
        if (!s.salesRaw) return '';
        const entry = s.salesRaw.find(e => e.label === SALES_SCORE_COLS.find(c => c.ci === ci)?.label);
        // salesRaw хранится по label — ищем по индексу
        const idx = SALES_SCORE_COLS.findIndex(c => c.ci === ci);
        const raw = s.salesRaw[idx]?.raw ?? null;
        return raw !== null ? (isPct ? parseFloat((raw * 100).toFixed(1)) : parseFloat(raw.toFixed(2))) : '';
      });
      return [i + 1, s.region, s.subdiv || '—', s.store, s.tc || '—',
        ...salesVals, fmt(s.salesScore)];
    });
    const salesScoreColIdx = 5 + SALES_SCORE_COLS.length;
    scoreColSet = new Set([salesScoreColIdx]);
    colWidths = [
      { wch: 4 }, { wch: 6 }, { wch: 14 }, { wch: 28 }, { wch: 22 },
      ...SALES_SCORE_COLS.map(() => ({ wch: 12 })),
      { wch: 13 },
    ];
  }

  const wsData = [headers, ...rows];
  const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
  applySheet(ws, wsData, scoreColSet);
  ws['!cols'] = colWidths;
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Магазины');
  XLSXStyle.writeFile(wb, `${filename}.xlsx`);
}

function exportSubdivs(items, filename) {
  const wb = XLSXStyle.utils.book_new();
  const headers = ['#', 'Подразделение', 'Регионы', 'Балл регламент', 'Балл продажи'];
  const rows = items.map((d, i) => [
    i + 1, d.subdiv || '—', d.regionsLabel,
    fmt(d.avgRegScore), fmt(d.avgSalesScore),
  ]);
  const wsData = [headers, ...rows];
  const ws = XLSXStyle.utils.aoa_to_sheet(wsData);
  wsData[0].forEach((_, ci) => {
    const addr = XLSXStyle.utils.encode_cell({ r: 0, c: ci });
    if (ws[addr]) ws[addr].s = HEADER_STYLE;
  });
  for (let ri = 1; ri < wsData.length; ri++) {
    wsData[ri].forEach((val, ci) => {
      const addr = XLSXStyle.utils.encode_cell({ r: ri, c: ci });
      if (!ws[addr]) return;
      const isScore = ci >= 3;
      const bgHex = isScore ? scoreColor(val) : null;
      ws[addr].s = {
        ...(bgHex ? { fill: { patternType: 'solid', fgColor: { rgb: bgHex } } } : {}),
        font: { color: { rgb: bgHex ? '1F2937' : '374151' }, sz: 10 },
        alignment: { horizontal: ci < 2 ? 'left' : 'center' },
        numFmt: typeof val === 'number' ? '0.0' : '@',
      };
    });
  }
  ws['!cols'] = [{ wch: 4 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Подразделения');
  XLSXStyle.writeFile(wb, `${filename}.xlsx`);
}

// ─── Sales scoring ────────────────────────────────────────────────────────────
const SALES_SCORE_COLS = [
  { ci: 7,  label: 'План %',        dir: 1, isPct: true  },
  { ci: 9,  label: 'ТО LFL',        dir: 1, isPct: true  },
  { ci: 55, label: 'ЮИ %',          dir: 2, isPct: true  }, // double weight
  { ci: 33, label: 'Штук в чеке',   dir: 1, isPct: false },
  { ci: 41, label: 'Доля СБП %',    dir: 1, isPct: true  }, // SPB only; null in BEL → skipped in avg
];

const SALES_SCORE_LABELS = SALES_SCORE_COLS.map(c => c.label).join(' · ');

function salesScore(storeRow) {
  let sum = 0; let cnt = 0;
  for (const { ci, dir } of SALES_SCORE_COLS) {
    const v = parseFloat(storeRow[`_c${ci}`]);
    if (!isNaN(v)) { sum += v * dir; cnt += dir; }
  }
  return cnt ? sum / cnt : null;
}

// Собираем сырые значения продаж для показа в попover
function extractSalesRaw(storeRow) {
  return SALES_SCORE_COLS.map(({ ci, label, isPct }) => {
    const v = parseFloat(storeRow[`_c${ci}`]);
    return { label, raw: isNaN(v) ? null : v, isPct };
  });
}

function normalizeScores(items) {
  const valid = items.filter(x => x.score !== null).sort((a, b) => a.score - b.score);
  if (!valid.length) return items;
  const mn = valid[0].score, mx = valid[valid.length - 1].score;
  const range = mx - mn || 1;
  return items.map(x => ({
    ...x,
    normScore: x.score !== null ? Math.round(((x.score - mn) / range) * 100) : null,
  }));
}

function extractSalesStores(salesFile) {
  if (!salesFile) return [];
  return (salesFile.data || salesFile.stores || []).filter(r => {
    const d = String(r['_c3'] || r['Магазин'] || '').toUpperCase();
    return d && d !== 'КОМПАНИЯ' && d !== 'РЕГИОН' && d !== 'ИМ' && d !== '';
  });
}

// ─── Regulation scores ────────────────────────────────────────────────────────
// Возвращает { score, rawPct } чтобы показывать исходный % в попover

function scanScore(row) {
  const v = pct(row.scanPct);
  if (v === null) return { score: null, raw: null };
  return { score: Math.max(0, 100 - v), raw: v }; // raw = % неотсканированных
}

function yuiScore(row) {
  const v = pct(row.pct);
  if (v === null) return { score: null, raw: null };
  return { score: Math.max(0, 100 - v), raw: v }; // raw = % невыставленных
}

function capsuleScore(row) {
  const v = pct(row.notScannedPct ?? row['% Неотскан'] ?? row.pct);
  if (v === null) return { score: null, raw: null };
  return { score: Math.max(0, 100 - v), raw: v }; // raw = % неотсканировано
}

function izScore(row) {
  const v = pct(row.scanShare);
  if (v === null) return { score: null, raw: null };
  return { score: v, raw: v }; // raw = % сканирования (уже хорошее направление)
}

function pricingScore(row) {
  // Use only c0 = % ПП без ценников (first column from pricing report)
  const raw = pct(row.c0);
  if (raw === null) return { score: null, raw: null };
  return { score: Math.max(0, 100 - raw), raw };
}

// ─── Build unified store list ──────────────────────────────────────────────────
function buildStoreScores({
  spbSalesMonth, belSalesMonth,
  spbScanning, belScanning,
  spbCapsule, belCapsule,
  spbJewelryItogi, belJewelryItogi,
  spbIZ, belIZ,
  spbPricing, belPricing,
}) {
  const map = {};

  // key uses normalized store code (numeric prefix) so "11788 Мега" === "11788"
  function key(region, store) { return `${region}|${storeKey(store)}`; }

  function ensure(region, store, subdiv, tc) {
    const k = key(region, store);
    if (!map[k]) map[k] = {
      region, store, subdiv,
      tc: tc || null,
      scanScores: [], scanRaws: [],
      capsuleScores: [], capsuleRaws: [],
      yuiScores: [], yuiRaws: [],
      izScores: [], izRaws: [],
      pricingScores: [], pricingRaws: [],
      salesMonthScore: null,
      salesRaw: null,
    };
    return map[k];
  }

  for (const sf of [spbScanning, belScanning]) {
    if (!sf) continue;
    const region = sf.fileRegion;
    for (const row of (sf.stores || [])) {
      if (isClosed(row)) continue;
      const store = storeLabel(row);
      if (!store) continue;
      const tc = String(row.tc || row['ТЦ'] || '').trim() || null;
      const { score, raw } = scanScore(row);
      if (score !== null) {
        const obj = ensure(region, store, subdivOf(row), tc);
        if (!obj.tc && tc) obj.tc = tc;
        obj.scanScores.push(score);
        obj.scanRaws.push(raw);
      }
    }
  }

  for (const jf of [spbJewelryItogi, belJewelryItogi]) {
    if (!jf) continue;
    const region = jf.fileRegion === 'ALL' ? null : jf.fileRegion;
    for (const row of (jf.stores || [])) {
      if (isClosed(row)) continue;
      const r = region || regionOf(row);
      if (!r) continue;
      const store = storeLabel(row);
      if (!store) continue;
      const { score, raw } = yuiScore(row);
      if (score !== null) {
        const obj = ensure(r, store, subdivOf(row));
        obj.yuiScores.push(score);
        obj.yuiRaws.push(raw);
      }
    }
  }

  for (const cf of [spbCapsule, belCapsule]) {
    if (!cf) continue;
    const region = cf.fileRegion === 'ALL' ? null : cf.fileRegion;
    for (const row of (cf.stores || [])) {
      if (isClosed(row)) continue;
      const r = region || regionOf(row) || 'СПБ';
      const store = storeLabel(row);
      if (!store) continue;
      const { score, raw } = capsuleScore(row);
      if (score !== null) {
        const obj = ensure(r, store, subdivOf(row));
        obj.capsuleScores.push(score);
        obj.capsuleRaws.push(raw);
      }
    }
  }

  for (const iz of [spbIZ, belIZ]) {
    if (!iz) continue;
    const region = iz.fileRegion === 'ALL' ? null : iz.fileRegion;
    // IZ file has sheets: День / Неделя / Месяц — use Месяц first, then Неделя, then День
    const sheet = iz.sheets?.['Месяц'] || iz.sheets?.['Неделя'] || iz.sheets?.['День'] || null;
    const rows = sheet?.stores || [];
    for (const row of rows) {
      if (isClosed(row)) continue;
      const r = region || regionOf(row);
      if (!r) continue;
      // Use row.store (column C = numeric code like "50006") as primary key.
      // Do NOT fall back to row.tc (column D = TC text) — that would create a wrong key.
      const storeCode = row.store ? String(row.store).trim() : null;
      if (!storeCode) continue;
      const tc = row.tc ? String(row.tc).trim() : null;
      const { score, raw } = izScore(row);
      if (score !== null) {
        const obj = ensure(r, storeCode, subdivOf(row), tc);
        if (!obj.tc && tc) obj.tc = tc;
        obj.izScores.push(score);
        obj.izRaws.push(raw);
      }
    }
  }

  for (const pf of [spbPricing, belPricing]) {
    if (!pf) continue;
    const region = pf.fileRegion === 'ALL' ? null : pf.fileRegion;
    for (const row of (pf.stores || [])) {
      if (isClosed(row)) continue;
      const r = region || regionOf(row);
      if (!r) continue;
      const store = storeLabel(row);
      if (!store) continue;
      const { score, raw } = pricingScore(row);
      if (score !== null) {
        const obj = ensure(r, store, subdivOf(row));
        obj.pricingScores.push(score);
        obj.pricingRaws.push(raw);
      }
    }
  }

  // Продажи — только месяц; нормализуем все магазины СПБ+БЕЛ вместе
  const allSalesStoreRows = [];
  for (const sf of [spbSalesMonth, belSalesMonth]) {
    if (!sf) continue;
    const region = sf.fileRegion;
    for (const r of extractSalesStores(sf).filter(r => !isClosed(r))) {
      allSalesStoreRows.push({
        score: salesScore(r),
        store: String(r['_c3'] || r['Магазин'] || '').trim(),
        subdiv: String(r['_c1'] || r['Подразделение'] || '').trim(),
        tc: String(r['_c4'] || r['ТЦ'] || '').trim() || null,
        rawRow: r,
        region,
      });
    }
  }
  const withScores = normalizeScores(allSalesStoreRows);
  for (const { normScore, store, subdiv, tc, rawRow, region } of withScores) {
    if (!store || normScore === null) continue;
    const obj = ensure(region, store, subdiv, tc);
    obj.salesMonthScore = normScore;
    obj.salesRaw = extractSalesRaw(rawRow);
    if (!obj.subdiv && subdiv) obj.subdiv = subdiv;
    if (!obj.tc && tc) obj.tc = tc;
  }

  return Object.values(map).map(obj => {
    const scanAvg    = obj.scanScores.length    ? avg(...obj.scanScores)    : null;
    const yuiAvg     = obj.yuiScores.length     ? avg(...obj.yuiScores)     : null;
    const capsAvg    = obj.capsuleScores.length ? avg(...obj.capsuleScores) : null;
    const izAvg      = obj.izScores.length      ? avg(...obj.izScores)      : null;
    const pricingAvg = obj.pricingScores.length ? avg(...obj.pricingScores) : null;
    const regScore   = avg(...[scanAvg, yuiAvg, capsAvg, izAvg, pricingAvg].filter(v => v !== null));
    // Сырые значения для попover (берём первый элемент — обычно один файл на магазин)
    const scanRaw    = obj.scanRaws[0]    ?? null;
    const yuiRaw     = obj.yuiRaws[0]     ?? null;
    const capsRaw    = obj.capsuleRaws[0] ?? null;
    const izRaw      = obj.izRaws[0]      ?? null;
    const pricingRaw = obj.pricingRaws[0] ?? null;
    return {
      ...obj,
      scanAvg, yuiAvg, capsAvg, izAvg, pricingAvg,
      scanRaw, yuiRaw, capsRaw, izRaw, pricingRaw,
      regScore,
      salesScore: obj.salesMonthScore, // только месяц
    };
  });
}

// Build subdivision scores using:
// - Regulation scores: from subdivision-level data in each source file (same source as each report tab)
// - Sales scores: from sf.subdivs rows in МЕСЯЦ file (preferred) OR averaged from store scores (fallback)
function buildSubdivScores(storeList, spbSalesMonth, belSalesMonth, {
  spbScanning, belScanning,
  spbJewelryItogi, belJewelryItogi,
  spbCapsule, belCapsule,
  spbIZ, belIZ,
  spbPricing, belPricing,
} = {}) {
  // Step 1: collect regions + fallback sales per subdiv from store list
  const regMap = {};
  for (const s of storeList) {
    const k = s.subdiv || '—';
    if (!regMap[k]) regMap[k] = {
      subdiv: s.subdiv, regions: new Set(),
      salesScores: [], salesRawsByLabel: {},
    };
    regMap[k].regions.add(s.region);
    if (s.salesScore !== null) regMap[k].salesScores.push(s.salesScore);
    if (s.salesRaw) {
      for (const { label, raw } of s.salesRaw) {
        if (raw !== null) {
          if (!regMap[k].salesRawsByLabel[label]) regMap[k].salesRawsByLabel[label] = [];
          regMap[k].salesRawsByLabel[label].push(raw);
        }
      }
    }
  }

  // Step 2: collect regulation data directly from each file's subdivision arrays
  // (same data source used by each report tab)

  // Scan: scanning file subdivisions → row.scanPct = % неотсканированных
  const scanSubdivMap = {};
  for (const sf of [spbScanning, belScanning]) {
    if (!sf) continue;
    const region = sf.fileRegion === 'ALL' ? null : sf.fileRegion;
    for (const row of (sf.subdivisions || [])) {
      const k = String(row.subdiv || '').trim();
      if (!k) continue;
      const r = region || regionOf(row);
      const raw = pct(row.scanPct);
      if (raw === null) continue;
      if (!scanSubdivMap[k]) scanSubdivMap[k] = { raws: [], regions: new Set() };
      scanSubdivMap[k].raws.push(raw);
      if (r) scanSubdivMap[k].regions.add(r);
    }
  }

  // YUI: jewelry file subdivisions → row.pct = % невыставленного
  const yuiSubdivMap = {};
  for (const jf of [spbJewelryItogi, belJewelryItogi]) {
    if (!jf) continue;
    const region = jf.fileRegion === 'ALL' ? null : jf.fileRegion;
    for (const row of (jf.subdivisions || [])) {
      const k = String(row.subdiv || '').trim();
      if (!k) continue;
      const r = region || regionOf(row);
      const raw = pct(row.pct);
      if (raw === null) continue;
      if (!yuiSubdivMap[k]) yuiSubdivMap[k] = { raws: [], regions: new Set() };
      yuiSubdivMap[k].raws.push(raw);
      if (r) yuiSubdivMap[k].regions.add(r);
    }
  }

  // Capsule: capsule file subdivisions → row.pct = % неотсканировано
  const capsSubdivMap = {};
  for (const cf of [spbCapsule, belCapsule]) {
    if (!cf) continue;
    const region = cf.fileRegion === 'ALL' ? null : cf.fileRegion;
    for (const row of (cf.subdivisions || [])) {
      const k = String(row.subdiv || '').trim();
      if (!k) continue;
      const r = region || regionOf(row);
      const raw = pct(row.pct);
      if (raw === null) continue;
      if (!capsSubdivMap[k]) capsSubdivMap[k] = { raws: [], regions: new Set() };
      capsSubdivMap[k].raws.push(raw);
      if (r) capsSubdivMap[k].regions.add(r);
    }
  }

  // IZ: IZ file Месяц sheet subdivs → row.scanShare = % сканирования
  const izSubdivMap = {};
  for (const iz of [spbIZ, belIZ]) {
    if (!iz) continue;
    const region = iz.fileRegion === 'ALL' ? null : iz.fileRegion;
    const sheet = iz.sheets?.['Месяц'] || iz.sheets?.['Неделя'] || iz.sheets?.['День'] || null;
    for (const row of (sheet?.subdivs || [])) {
      const k = String(row.subdiv || '').trim();
      if (!k) continue;
      const r = region || regionOf(row);
      const raw = pct(row.scanShare);
      if (raw === null) continue;
      if (!izSubdivMap[k]) izSubdivMap[k] = { raws: [], regions: new Set() };
      izSubdivMap[k].raws.push(raw);
      if (r) izSubdivMap[k].regions.add(r);
    }
  }

  // Pricing: pricing file subdivisions → pricingScore formula → raw = avg % проблем
  const pricingSubdivMap = {};
  for (const pf of [spbPricing, belPricing]) {
    if (!pf) continue;
    const region = pf.fileRegion === 'ALL' ? null : pf.fileRegion;
    for (const row of (pf.subdivisions || [])) {
      const k = String(row.subdiv || '').trim();
      if (!k) continue;
      const r = region || regionOf(row);
      const { raw } = pricingScore(row);
      if (raw === null) continue;
      if (!pricingSubdivMap[k]) pricingSubdivMap[k] = { raws: [], regions: new Set() };
      pricingSubdivMap[k].raws.push(raw);
      if (r) pricingSubdivMap[k].regions.add(r);
    }
  }

  // Step 3: collect raw sales KPIs from sf.subdivs in МЕСЯЦ files (preferred source)
  // Collect all subdivisions from both files first, then normalize together
  const salesMap = {};
  const allSubdivRows = [];

  for (const sf of [spbSalesMonth, belSalesMonth]) {
    if (!sf || !(sf.subdivs?.length)) continue;
    const region = sf.fileRegion;
    const subdivRows = sf.subdivs.filter(r => {
      const code = extractStoreCode(String(r['_c3'] || r['Магазин'] || ''));
      return !(code !== null && CLOSED_STORES.has(code));
    });
    for (const r of subdivRows) {
      const subdiv = String(r['_c1'] || r['Подразделение'] || '').trim();
      if (!subdiv) continue;
      allSubdivRows.push({ subdiv, score: salesScore(r), rawRow: r, region });
    }
  }

  // Normalize all subdivisions together (SPB + BEL combined)
  const normalized = normalizeScores(allSubdivRows);
  for (const { subdiv, normScore, rawRow, region: reg } of normalized) {
    if (!subdiv) continue;
    if (!salesMap[subdiv]) salesMap[subdiv] = { regions: new Set(), salesScores: [], salesRaws: [] };
    salesMap[subdiv].regions.add(reg);
    if (normScore !== null) salesMap[subdiv].salesScores.push(normScore);
    salesMap[subdiv].salesRaws.push(extractSalesRaw(rawRow));
  }

  const useSalesMapForScores = Object.keys(salesMap).length > 0;

  // Step 4: merge into final subdiv list
  const allKeys = new Set([
    ...Object.keys(regMap),
    ...Object.keys(salesMap),
    ...Object.keys(scanSubdivMap),
    ...Object.keys(yuiSubdivMap),
    ...Object.keys(capsSubdivMap),
    ...Object.keys(izSubdivMap),
    ...Object.keys(pricingSubdivMap),
  ]);

  return Array.from(allKeys).map(k => {
    const reg = regMap[k];
    const sal = salesMap[k];
    const regions = new Set([
      ...(reg?.regions || []),
      ...(sal?.regions || []),
      ...(scanSubdivMap[k]?.regions || []),
      ...(yuiSubdivMap[k]?.regions || []),
      ...(capsSubdivMap[k]?.regions || []),
      ...(izSubdivMap[k]?.regions || []),
      ...(pricingSubdivMap[k]?.regions || []),
    ]);

    // Regulation raw values from file subdivision arrays (matches each report tab's source)
    const avgScanRaw    = scanSubdivMap[k]?.raws.length    ? avg(...scanSubdivMap[k].raws)    : null;
    const avgYuiRaw     = yuiSubdivMap[k]?.raws.length     ? avg(...yuiSubdivMap[k].raws)     : null;
    const avgCapsRaw    = capsSubdivMap[k]?.raws.length    ? avg(...capsSubdivMap[k].raws)    : null;
    const avgIzRaw      = izSubdivMap[k]?.raws.length      ? avg(...izSubdivMap[k].raws)      : null;
    const avgPricingRaw = pricingSubdivMap[k]?.raws.length ? avg(...pricingSubdivMap[k].raws) : null;

    // Regulation scores derived from raw values (same formulas as store-level)
    const scanScore_    = avgScanRaw    !== null ? Math.max(0, 100 - avgScanRaw)    : null;
    const yuiScore_     = avgYuiRaw     !== null ? Math.max(0, 100 - avgYuiRaw)     : null;
    const capsScore_    = avgCapsRaw    !== null ? Math.max(0, 100 - avgCapsRaw)    : null;
    const izScore_      = avgIzRaw      !== null ? avgIzRaw                          : null;
    const pricingScore_ = avgPricingRaw !== null ? Math.max(0, 100 - avgPricingRaw) : null;

    const metricScores = [scanScore_, yuiScore_, capsScore_, izScore_, pricingScore_].filter(v => v !== null);
    const avgRegScore = metricScores.length ? avg(...metricScores) : null;

    // Sales score: prefer file subdivs; fall back to store averages
    const avgSalesScore = useSalesMapForScores
      ? (sal?.salesScores.length ? avg(...sal.salesScores) : null)
      : (reg?.salesScores.length ? avg(...reg.salesScores) : null);

    // Sales raw KPIs: prefer from file subdivs rows; fall back to store averages
    const salesAvgRaw = SALES_SCORE_COLS.map(({ label, isPct }) => {
      if (sal?.salesRaws.length) {
        const vals = sal.salesRaws
          .map(raws => raws.find(e => e.label === label)?.raw ?? null)
          .filter(v => v !== null);
        return { label, raw: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, isPct };
      }
      const vals = reg?.salesRawsByLabel[label] || [];
      return { label, raw: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, isPct };
    });

    return {
      subdiv: reg?.subdiv || k,
      regions,
      regionsLabel: [...regions].sort().join(', '),
      avgRegScore,
      avgSalesScore,
      avgScanRaw, avgYuiRaw, avgCapsRaw, avgIzRaw, avgPricingRaw,
      salesAvgRaw,
    };
  });
}

function buildInsights(storeList, subdivScores) {
  const insights = [];
  for (const region of ['СПБ', 'БЕЛ']) {
    const stores = storeList.filter(s => s.region === region && s.regScore !== null);
    if (!stores.length) continue;
    const avgReg = avg(...stores.map(s => s.regScore));
    if (avgReg !== null) {
      const bad = stores.filter(s => s.regScore < avgReg * 0.7).length;
      if (bad > 0) insights.push({ type: 'warn', text: `${region}: ${bad} магазин(ов) значительно ниже среднего по регламентам (ср. балл ${avgReg.toFixed(0)})` });
    }
    const lowScan = stores.filter(s => s.scanAvg !== null && s.scanAvg < 40);
    if (lowScan.length > 2) insights.push({ type: 'warn', text: `${region}: ${lowScan.length} магазин(ов) с долей неотсканированной обуви >60%` });
    const goodPricing = stores.filter(s => s.pricingAvg !== null && s.pricingAvg > 85);
    if (goodPricing.length > 0) insights.push({ type: 'ok', text: `${region}: ${goodPricing.length} магазин(ов) с отличным соблюдением цен на полупарах (>85 баллов)` });
  }
  const worstSubdivs = subdivScores.filter(d => d.avgRegScore !== null && d.avgRegScore < 50)
    .sort((a, b) => a.avgRegScore - b.avgRegScore).slice(0, 3);
  for (const d of worstSubdivs) {
    insights.push({ type: 'critical', text: `Подр. ${d.subdiv} (${d.regionsLabel}): ср. балл по регламентам ${d.avgRegScore.toFixed(0)} — требует внимания` });
  }
  return insights;
}

// Разбиваем на худших (больше) и лучших (меньше), нет пересечений
// При 9 подразделениях: worst=5, best=4
function getSubdivSplit(subdivs, scoreKey) {
  const all = subdivs
    .filter(d => d[scoreKey] !== null && d[scoreKey] !== undefined)
    .sort((a, b) => b[scoreKey] - a[scoreKey]); // убывание: [лучший...худший]
  const bestCount = Math.floor(all.length / 2);  // 4 при 9
  const worstCount = all.length - bestCount;      // 5 при 9
  const best  = all.slice(0, bestCount);
  const worst = all.slice(bestCount).reverse();   // разворачиваем: самый худший первым
  return { best, worst, bestCount, worstCount };
}

// ─── UI components ──────────────────────────────────────────────────────────────
const MEDAL = ['🥇', '🥈', '🥉'];
function getRank(i) { return i < 3 ? MEDAL[i] : `${i + 1}`; }

function ScoreBar({ value, color, size = 'md' }) {
  const w = Math.min(Math.max(value ?? 0, 0), 100);
  const h = size === 'sm' ? 'h-1' : 'h-1.5';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className={`flex-1 ${h} rounded-full bg-white/10 overflow-hidden`}>
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono w-9 text-right" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {value !== null && value !== undefined ? value.toFixed(1) : '—'}
      </span>
    </div>
  );
}

function TagBadge({ label, color }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: color + '22', color }}>
      {label}
    </span>
  );
}

// ─── Metric row в попover: название — исходное значение — балл ────────────────
// rawLabel: что означает сырое число (например «% неотсканировано»)
function MetricRow({ label, rawVal, rawLabel, score, color, inverted = false }) {
  const hasData = score !== null && score !== undefined;
  return (
    <div className="flex items-start gap-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <span className="text-xs w-20 flex-shrink-0 leading-tight" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <div className="flex-1 min-w-0">
        {hasData ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              {rawVal !== null && rawVal !== undefined ? (
                <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {rawVal.toFixed(1)}% {rawLabel && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{rawLabel}</span>}
                </span>
              ) : (
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
              )}
              <span className="text-xs ml-auto flex-shrink-0 font-mono" style={{ color }}>
                балл: {score.toFixed(1)}
              </span>
            </div>
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(score, 0), 100)}%`, backgroundColor: color }} />
            </div>
          </>
        ) : (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>нет данных</span>
        )}
      </div>
    </div>
  );
}

// ─── Store popover ─────────────────────────────────────────────────────────────
function StorePopover({ store, x, y, mode = 'reglaments' }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + w > vw - 12) left = x - w - 16;
    if (left < 8) left = 8;
    if (top + h > vh - 12) top = vh - h - 12;
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [x, y]);

  const regionColor = store.region === 'СПБ' ? '#E91E8C' : '#8b5cf6';

  // Цвет балла: выше 70 = зелёный, 40-70 = жёлтый, ниже 40 = красный
  function scoreColor(v) {
    if (v === null || v === undefined) return '#6b7280';
    if (v >= 70) return '#34d399';
    if (v >= 40) return '#fbbf24';
    return '#f87171';
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 9999,
        width: 320,
        backgroundColor: '#111827',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3" style={{ backgroundColor: '#1f2937', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-sm font-semibold text-white leading-tight">{store.store}</div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <TagBadge label={store.region} color={regionColor} />
          {store.subdiv && (
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{store.subdiv}</span>
          )}
        </div>
      </div>

      {/* Регламенты */}
      {mode === 'reglaments' && (
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Регламенты</p>
          {store.regScore !== null && (
            <span className="text-xs font-bold" style={{ color: scoreColor(store.regScore) }}>
              итого {store.regScore.toFixed(1)}
            </span>
          )}
        </div>
        <MetricRow label="Скан. обувь"  rawVal={store.scanRaw}    rawLabel="% неотскан."  score={store.scanAvg}    color={scoreColor(store.scanAvg)} />
        <MetricRow label="ЮИ"           rawVal={store.yuiRaw}     rawLabel="% невыст."    score={store.yuiAvg}     color={scoreColor(store.yuiAvg)} />
        <MetricRow label="Капсулы"      rawVal={store.capsRaw}    rawLabel="% неотскан."  score={store.capsAvg}    color={scoreColor(store.capsAvg)} />
        <MetricRow label="ИЗ"           rawVal={store.izRaw}      rawLabel="% скан."      score={store.izAvg}      color={scoreColor(store.izAvg)} />
        <MetricRow label="Цены"         rawVal={store.pricingRaw} rawLabel="% ПП без ценн."    score={store.pricingAvg} color={scoreColor(store.pricingAvg)} />
      </div>
      )}

      {/* Продажи */}
      {mode === 'sales' && (
      <div className="px-4 pt-2 pb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Продажи (месяц)</p>
          {store.salesScore !== null && (
            <span className="text-xs font-bold" style={{ color: scoreColor(store.salesScore) }}>
              балл {store.salesScore.toFixed(1)}
            </span>
          )}
        </div>
        {store.salesRaw ? (
          <div>
            {store.salesRaw.map(({ label, raw, isPct }) => {
              const display = raw !== null
                ? (isPct ? (raw * 100).toFixed(1) + '%' : raw.toFixed(2))
                : null;
              return (
                <div key={label} className="flex items-center gap-2 py-0.5">
                  <span className="text-xs w-24 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                  <span className="text-xs font-mono" style={{ color: display !== null ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.2)' }}>
                    {display !== null ? display : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>нет данных</span>
        )}
      </div>
      )}
    </div>
  );
}

// ─── Subdiv popover ────────────────────────────────────────────────────────────
// mode: 'reglaments' | 'sales' — определяет что показывать
// subdiv object now contains pre-computed avgScanRaw, avgYuiRaw etc. from buildSubdivScores
function SubdivPopover({ subdiv, storeList, mode, x, y }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    if (!ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + w > vw - 12) left = x - w - 16;
    if (left < 8) left = 8;
    if (top + h > vh - 12) top = vh - h - 12;
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [x, y]);

  function scoreColor(v) {
    if (v === null || v === undefined) return '#6b7280';
    if (v >= 70) return '#34d399';
    if (v >= 40) return '#fbbf24';
    return '#f87171';
  }

  // Магазины этого подразделения (для счётчика)
  const stores = storeList.filter(s => (s.subdiv || '—') === (subdiv.subdiv || '—'));

  // Regulation raw values come from pre-computed fields in subdiv object
  const scanRaw    = subdiv.avgScanRaw    ?? null;
  const yuiRaw     = subdiv.avgYuiRaw     ?? null;
  const capsRaw    = subdiv.avgCapsRaw    ?? null;
  const izRaw      = subdiv.avgIzRaw      ?? null;
  const pricingRaw = subdiv.avgPricingRaw ?? null;

  // Regulation scores: derived from raw values (same formulas as store scores)
  const scanAvg    = scanRaw    !== null ? Math.max(0, 100 - scanRaw)    : null;
  const yuiAvg     = yuiRaw     !== null ? Math.max(0, 100 - yuiRaw)     : null;
  const capsAvg    = capsRaw    !== null ? Math.max(0, 100 - capsRaw)    : null;
  const izAvg      = izRaw      !== null ? izRaw                          : null; // IZ: higher = better
  const pricingAvg = pricingRaw !== null ? Math.max(0, 100 - pricingRaw) : null;

  // Sales raw values from pre-computed salesAvgRaw (from sf.subdivs in file)
  const salesAvgRaw = subdiv.salesAvgRaw || SALES_SCORE_COLS.map(({ label, isPct }) => ({ label, raw: null, isPct }));

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        zIndex: 9999,
        width: 340,
        backgroundColor: '#111827',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3" style={{ backgroundColor: '#1f2937', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="text-sm font-semibold text-white">{subdiv.subdiv || '—'}</div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{subdiv.regionsLabel}</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            {stores.length} магазин{stores.length === 1 ? '' : stores.length < 5 ? 'а' : 'ов'}
          </span>
        </div>
      </div>

      {mode === 'reglaments' && (
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Регламенты (среднее)</p>
            {subdiv.avgRegScore !== null && subdiv.avgRegScore !== undefined && (
              <span className="text-xs font-bold" style={{ color: scoreColor(subdiv.avgRegScore) }}>
                итого {subdiv.avgRegScore.toFixed(1)}
              </span>
            )}
          </div>
          <MetricRow label="Скан. обувь" rawVal={scanRaw}    rawLabel="% неотскан."  score={scanAvg}    color={scoreColor(scanAvg)} />
          <MetricRow label="ЮИ"          rawVal={yuiRaw}     rawLabel="% невыст."    score={yuiAvg}     color={scoreColor(yuiAvg)} />
          <MetricRow label="Капсулы"     rawVal={capsRaw}    rawLabel="% неотскан."  score={capsAvg}    color={scoreColor(capsAvg)} />
          <MetricRow label="ИЗ"          rawVal={izRaw}      rawLabel="% скан."      score={izAvg}      color={scoreColor(izAvg)} />
          <MetricRow label="Цены"        rawVal={pricingRaw} rawLabel="% ПП без ценн."    score={pricingAvg} color={scoreColor(pricingAvg)} />
        </div>
      )}

      {mode === 'sales' && (
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>Продажи (среднее)</p>
            {subdiv.avgSalesScore !== null && subdiv.avgSalesScore !== undefined && (
              <span className="text-xs font-bold" style={{ color: scoreColor(subdiv.avgSalesScore) }}>
                балл {subdiv.avgSalesScore.toFixed(1)}
              </span>
            )}
          </div>
          {salesAvgRaw.map(({ label, raw, isPct }) => {
            const display = raw !== null
              ? (isPct ? (raw * 100).toFixed(1) + '%' : raw.toFixed(2))
              : null;
            return (
              <div key={label} className="flex items-center gap-2 py-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-xs w-24 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }}>{label}</span>
                <span className="text-xs font-mono" style={{ color: display !== null ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.2)' }}>
                  {display !== null ? display : '—'}
                </span>
              </div>
            );
          })}
          {subdiv.avgSalesScore !== null && subdiv.avgSalesScore !== undefined && (
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-3">
              <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(subdiv.avgSalesScore, 0), 100)}%`, backgroundColor: scoreColor(subdiv.avgSalesScore) }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TopTable with export + popover ─────────────────────────────────────────────
function TopTable({ title, items, scoreKey, scoreName, icon: Icon, accentColor, worst = false, onExport, onHover, mode = 'reglaments' }) {
  if (!items.length) {
    return (
      <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
        <div className="flex items-center gap-2 mb-3">
          <Icon size={15} style={{ color: accentColor }} />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Нет данных</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#1f2937' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Icon size={15} style={{ color: accentColor }} />
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className="ml-auto text-xs mr-3" style={{ color: 'rgba(255,255,255,0.35)' }}>{scoreName}</span>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
            title="Выгрузить в Excel"
          >
            <Download size={11} />
            Excel
          </button>
        )}
      </div>
      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {items.map((item, i) => {
          const val = item[scoreKey];
          return (
            <div
              key={i}
              className="px-4 py-2.5 flex items-center gap-3 cursor-default"
              style={{ transition: 'background 0.1s' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
                if (onHover) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onHover(item, rect, mode);
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '';
                if (onHover) onHover(null, null, mode);
              }}
            >
              <span className="w-6 text-center text-sm flex-shrink-0" style={{ color: worst ? '#f87171' : '#facc15' }}>
                {worst ? i + 1 : getRank(i)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white leading-tight truncate">{item.store}</div>
                {item.tc && (
                  <div className="text-xs leading-tight truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.tc}</div>
                )}
                <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <TagBadge label={item.region} color={item.region === 'СПБ' ? '#E91E8C' : '#8b5cf6'} />
                  {item.subdiv && <span style={{ color: 'rgba(255,255,255,0.35)' }}>{item.subdiv}</span>}
                </div>
              </div>
              <div className="w-28 flex-shrink-0">
                <ScoreBar value={val ?? 0} color={worst ? '#f87171' : accentColor} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubdivList({ items, worst = false, scoreKey = 'avgRegScore', onExport, onHover, subdivMode = 'reglaments' }) {
  if (!items.length) return <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Нет данных</p>;
  return (
    <div>
      {onExport && (
        <div className="flex justify-end mb-2">
          <button
            onClick={onExport}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}
            title="Выгрузить в Excel"
          >
            <Download size={11} />
            Excel
          </button>
        </div>
      )}
      <div className="space-y-2">
        {items.map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg px-2 -mx-2 cursor-default"
            style={{ transition: 'background 0.1s' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
              if (onHover) {
                const rect = e.currentTarget.getBoundingClientRect();
                onHover(d, rect, subdivMode);
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '';
              if (onHover) onHover(null, null, subdivMode);
            }}
          >
            <span className="w-5 text-xs text-center flex-shrink-0" style={{ color: worst ? '#f87171' : '#facc15' }}>{i + 1}</span>
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="text-sm text-white truncate">{d.subdiv || '—'}</span>
              <span className="text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{d.regionsLabel}</span>
            </div>
            <div className="w-32 flex-shrink-0">
              <ScoreBar value={d[scoreKey]} color={worst ? '#f87171' : '#10b981'} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function ItogiPage() {
  const {
    spbSalesMonth, belSalesMonth,
    spbScanning, belScanning,
    spbCapsule, belCapsule,
    spbJewelryItogi, belJewelryItogi,
    spbIZ, belIZ,
    spbPricing, belPricing,
  } = useData();

  // Основная вкладка ТОП: регламенты / продажи
  const [activeTab, setActiveTab]   = useState('reglaments');
  // Суб-вкладка ТОП: худшие / лучшие
  const [topSubTab, setTopSubTab]   = useState('worst');
  // Вкладка детализации СПБ и БЕЛ — общий переключатель регламенты/продажи для каждого
  const [spbDetailTab, setSpbDetailTab] = useState('reglaments');
  const [belDetailTab, setBelDetailTab] = useState('reglaments');
  // Суб-вкладка худшие/лучшие в детализации
  const [spbSubTab, setSpbSubTab]   = useState('worst');
  const [belSubTab, setBelSubTab]   = useState('worst');

  // Popover — магазин
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimerRef = useRef(null);

  function handleHover(store, rect, mode) {
    clearTimeout(tooltipTimerRef.current);
    if (!store) {
      tooltipTimerRef.current = setTimeout(() => setTooltip(null), 80);
      return;
    }
    tooltipTimerRef.current = setTimeout(() => {
      setTooltip({ store, x: rect.right + 8, y: rect.top, mode: mode || 'reglaments' });
    }, 120);
  }

  // Popover — подразделение
  const [subdivTooltip, setSubdivTooltip] = useState(null);
  const subdivTimerRef = useRef(null);

  function handleSubdivHover(subdiv, rect, mode) {
    clearTimeout(subdivTimerRef.current);
    if (!subdiv) {
      subdivTimerRef.current = setTimeout(() => setSubdivTooltip(null), 80);
      return;
    }
    subdivTimerRef.current = setTimeout(() => {
      setSubdivTooltip({ subdiv, mode: mode || 'reglaments', x: rect.right + 8, y: rect.top });
    }, 120);
  }

  useEffect(() => () => {
    clearTimeout(tooltipTimerRef.current);
    clearTimeout(subdivTimerRef.current);
  }, []);

  const storeList = useMemo(() => buildStoreScores({
    spbSalesMonth, belSalesMonth,
    spbScanning, belScanning, spbCapsule, belCapsule,
    spbJewelryItogi, belJewelryItogi, spbIZ, belIZ, spbPricing, belPricing,
  }), [spbSalesMonth, belSalesMonth,
       spbScanning, belScanning, spbCapsule, belCapsule,
       spbJewelryItogi, belJewelryItogi, spbIZ, belIZ, spbPricing, belPricing]);

  const subdivScores = useMemo(() => buildSubdivScores(storeList, spbSalesMonth, belSalesMonth, {
    spbScanning, belScanning,
    spbJewelryItogi, belJewelryItogi,
    spbCapsule, belCapsule,
    spbIZ, belIZ,
    spbPricing, belPricing,
  }), [storeList, spbSalesMonth, belSalesMonth,
       spbScanning, belScanning, spbJewelryItogi, belJewelryItogi,
       spbCapsule, belCapsule, spbIZ, belIZ, spbPricing, belPricing]);
  const insights     = useMemo(() => buildInsights(storeList, subdivScores), [storeList, subdivScores]);

  const hasData = storeList.length > 0;
  const spbStores = storeList.filter(s => s.region === 'СПБ');
  const belStores = storeList.filter(s => s.region === 'БЕЛ');

  // ТОП-15 общий (СПБ+БЕЛ)
  const regTop    = storeList.filter(s => s.regScore   !== null).sort((a,b) => b.regScore   - a.regScore).slice(0,15);
  const regBottom = storeList.filter(s => s.regScore   !== null).sort((a,b) => a.regScore   - b.regScore).slice(0,15);
  const salTop    = storeList.filter(s => s.salesScore !== null).sort((a,b) => b.salesScore - a.salesScore).slice(0,15);
  const salBottom = storeList.filter(s => s.salesScore !== null).sort((a,b) => a.salesScore - b.salesScore).slice(0,15);

  function makeRegTop(list)    { return list.filter(s=>s.regScore!==null).sort((a,b)=>b.regScore-a.regScore).slice(0,15); }
  function makeRegBottom(list) { return list.filter(s=>s.regScore!==null).sort((a,b)=>a.regScore-b.regScore).slice(0,15); }
  function makeSalTop(list)    { return list.filter(s=>s.salesScore!==null).sort((a,b)=>b.salesScore-a.salesScore).slice(0,15); }
  function makeSalBottom(list) { return list.filter(s=>s.salesScore!==null).sort((a,b)=>a.salesScore-b.salesScore).slice(0,15); }

  const regSubdivSplit = useMemo(() => getSubdivSplit(subdivScores, 'avgRegScore'),   [subdivScores]);
  const salSubdivSplit = useMemo(() => getSubdivSplit(subdivScores, 'avgSalesScore'), [subdivScores]);

  function SubTabToggle({ value, onChange }) {
    return (
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        {[
          { key: 'worst', label: 'Худшие', color: '#f87171' },
          { key: 'best',  label: 'Лучшие', color: '#10b981' },
        ].map(({ key, label, color }) => (
          <button key={key} onClick={() => onChange(key)} className="px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: value === key ? color + '33' : 'transparent',
              color: value === key ? color : 'rgba(255,255,255,0.45)',
              borderRight: key === 'worst' ? '1px solid rgba(255,255,255,0.12)' : undefined,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  function TypeTabToggle({ value, onChange }) {
    return (
      <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
        {[
          { key: 'reglaments', label: 'Регламенты', icon: ClipboardCheck },
          { key: 'sales',      label: 'Продажи',    icon: BarChart2 },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => onChange(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: value === key ? ACCENT : 'transparent',
              color: value === key ? 'white' : 'rgba(255,255,255,0.5)',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto" style={{ backgroundColor: '#111827', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Итоги</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Сводный анализ: СПБ и БЕЛ — продажи, регламенты, подразделения
          </p>
        </div>

        {!hasData && (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#1f2937' }}>
            <BarChart2 size={32} className="mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.2)' }} />
            <p className="text-white font-medium">Данные не загружены</p>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Загрузите файлы продаж, сканирования, ЮИ и капсул через «Загрузить данные»
            </p>
          </div>
        )}

        {hasData && (
          <>
            {/* Выводы */}
            {insights.length > 0 && (
              <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                  Выводы и аномалии
                </h2>
                <div className="space-y-2">
                  {insights.map((ins, i) => {
                    const color = ins.type === 'ok' ? '#10b981' : ins.type === 'critical' ? '#ef4444' : '#f59e0b';
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{ins.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Подразделения */}
            <div>
              <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                Подразделения
                <span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  СПБ + БЕЛ вместе · баллы 0–100 (выше = лучше)
                </span>
              </h2>
              <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Регламенты = адресное обувь + ЮИ + капсулы + ИЗ + цены на полупарах
              </p>

              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Регламенты</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#f87171' }}>
                    Худшие подразделения (топ-{regSubdivSplit.worstCount})
                  </p>
                  <SubdivList
                    items={regSubdivSplit.worst.slice(0, 5)} worst scoreKey="avgRegScore"
                    onExport={() => exportSubdivs(regSubdivSplit.worst.slice(0, 5), 'Итоги_подразделения_регламенты_худшие')}
                    onHover={handleSubdivHover}
                  />
                </div>
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#10b981' }}>
                    Лучшие подразделения (топ-{regSubdivSplit.bestCount})
                  </p>
                  <SubdivList
                    items={regSubdivSplit.best.slice(0, 4)} scoreKey="avgRegScore"
                    onExport={() => exportSubdivs(regSubdivSplit.best.slice(0, 4), 'Итоги_подразделения_регламенты_лучшие')}
                    onHover={handleSubdivHover}
                  />
                </div>
              </div>

              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Продажи (месяц)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#f87171' }}>
                    Худшие подразделения (топ-{salSubdivSplit.worstCount})
                  </p>
                  <SubdivList
                    items={salSubdivSplit.worst.slice(0, 5)} worst scoreKey="avgSalesScore"
                    onExport={() => exportSubdivs(salSubdivSplit.worst.slice(0, 5), 'Итоги_подразделения_продажи_худшие')}
                    onHover={handleSubdivHover} subdivMode="sales"
                  />
                </div>
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: '#10b981' }}>
                    Лучшие подразделения (топ-{salSubdivSplit.bestCount})
                  </p>
                  <SubdivList
                    items={salSubdivSplit.best.slice(0, 4)} scoreKey="avgSalesScore"
                    onExport={() => exportSubdivs(salSubdivSplit.best.slice(0, 4), 'Итоги_подразделения_продажи_лучшие')}
                    onHover={handleSubdivHover} subdivMode="sales"
                  />
                </div>
              </div>
            </div>

            {/* ТОП-15 магазинов */}
            <div>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <h2 className="text-base font-semibold text-white">ТОП магазинов (СПБ + БЕЛ)</h2>
                <TypeTabToggle value={activeTab} onChange={setActiveTab} />
                <SubTabToggle value={topSubTab} onChange={setTopSubTab} />
              </div>

              {activeTab === 'sales' && (
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Показатели продаж: <span style={{ color: 'rgba(255,255,255,0.6)' }}>{SALES_SCORE_LABELS}</span>
                </p>
              )}
              {activeTab === 'reglaments' && (
                <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Показатели регламентов: <span style={{ color: 'rgba(255,255,255,0.6)' }}>адресное обувь · ЮИ · капсулы · ИЗ · цены на полупарах</span>
                </p>
              )}

              {activeTab === 'reglaments' && topSubTab === 'best'  && (
                <TopTable title="ТОП-15 исполнительных (регламенты)" items={regTop} scoreKey="regScore" scoreName="балл"
                  icon={Award} accentColor="#10b981"
                  onExport={() => exportStores(regTop, 'Итоги_ТОП15_регламенты_лучшие')}
                  onHover={handleHover} />
              )}
              {activeTab === 'reglaments' && topSubTab === 'worst' && (
                <TopTable title="ТОП-15 проблемных (регламенты)" items={regBottom} scoreKey="regScore" scoreName="балл"
                  icon={AlertTriangle} accentColor="#ef4444" worst
                  onExport={() => exportStores(regBottom, 'Итоги_ТОП15_регламенты_худшие')}
                  onHover={handleHover} />
              )}
              {activeTab === 'sales' && topSubTab === 'best'  && (
                <TopTable title="ТОП-15 лучших (продажи, месяц)" items={salTop} scoreKey="salesScore" scoreName="балл"
                  icon={TrendingUp} accentColor="#10b981"
                  onExport={() => exportStores(salTop, 'Итоги_ТОП15_продажи_лучшие', 'sales')}
                  onHover={handleHover} mode="sales" />
              )}
              {activeTab === 'sales' && topSubTab === 'worst' && (
                <TopTable title="ТОП-15 отстающих (продажи, месяц)" items={salBottom} scoreKey="salesScore" scoreName="балл"
                  icon={TrendingDown} accentColor="#ef4444" worst
                  onExport={() => exportStores(salBottom, 'Итоги_ТОП15_продажи_худшие', 'sales')}
                  onHover={handleHover} mode="sales" />
              )}
            </div>

            {/* Детализация по регионам */}
            <div className="space-y-10">
              {[
                { region: 'СПБ', color: '#E91E8C', stores: spbStores, detailTab: spbDetailTab, setDetailTab: setSpbDetailTab, subTab: spbSubTab, setSubTab: setSpbSubTab },
                { region: 'БЕЛ', color: '#8b5cf6', stores: belStores, detailTab: belDetailTab, setDetailTab: setBelDetailTab, subTab: belSubTab, setSubTab: setBelSubTab },
              ].map(({ region, color, stores, detailTab, setDetailTab, subTab, setSubTab }) => (
                <div key={region}>
                  <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <TagBadge label={region} color={color} />
                    <h2 className="text-base font-semibold text-white">Магазины — {region}</h2>
                    <TypeTabToggle value={detailTab} onChange={setDetailTab} />
                    <SubTabToggle value={subTab} onChange={setSubTab} />
                  </div>

                  {detailTab === 'sales' && (
                    <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>{SALES_SCORE_LABELS}</p>
                  )}

                  {detailTab === 'reglaments' && subTab === 'best' && (
                    <TopTable title={`ТОП-15 по регламентам (${region})`} items={makeRegTop(stores)}
                      scoreKey="regScore" scoreName="балл" icon={Award} accentColor="#10b981"
                      onExport={() => exportStores(makeRegTop(stores), `Итоги_${region}_регламенты_лучшие`)}
                      onHover={handleHover} />
                  )}
                  {detailTab === 'reglaments' && subTab === 'worst' && (
                    <TopTable title={`Проблемные по регламентам (${region})`} items={makeRegBottom(stores)}
                      scoreKey="regScore" scoreName="балл" icon={AlertTriangle} accentColor="#ef4444" worst
                      onExport={() => exportStores(makeRegBottom(stores), `Итоги_${region}_регламенты_худшие`)}
                      onHover={handleHover} />
                  )}
                  {detailTab === 'sales' && subTab === 'best' && (
                    <TopTable title={`ТОП-15 по продажам (${region})`} items={makeSalTop(stores)}
                      scoreKey="salesScore" scoreName="балл" icon={TrendingUp} accentColor="#10b981"
                      onExport={() => exportStores(makeSalTop(stores), `Итоги_${region}_продажи_лучшие`, 'sales')}
                      onHover={handleHover} mode="sales" />
                  )}
                  {detailTab === 'sales' && subTab === 'worst' && (
                    <TopTable title={`Отстающие по продажам (${region})`} items={makeSalBottom(stores)}
                      scoreKey="salesScore" scoreName="балл" icon={TrendingDown} accentColor="#ef4444" worst
                      onExport={() => exportStores(makeSalBottom(stores), `Итоги_${region}_продажи_худшие`, 'sales')}
                      onHover={handleHover} mode="sales" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Store popover */}
      {tooltip && (
        <StorePopover store={tooltip.store} x={tooltip.x} y={tooltip.y} mode={tooltip.mode || 'reglaments'} />
      )}

      {/* Subdiv popover */}
      {subdivTooltip && (
        <SubdivPopover subdiv={subdivTooltip.subdiv} storeList={storeList} mode={subdivTooltip.mode} x={subdivTooltip.x} y={subdivTooltip.y} />
      )}
    </div>
  );
}
