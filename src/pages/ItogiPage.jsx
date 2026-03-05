import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { TrendingUp, TrendingDown, Award, AlertTriangle, BarChart2, ClipboardCheck } from 'lucide-react';

const ACCENT = '#E91E8C';

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

// ─── Sales scoring ────────────────────────────────────────────────────────────
// Показатели: План %, ТО LFL (ci=9), КОП (ci=22), ЮИ % (ci=54), Штук в чеке (ci=33)
// Убраны: маржа LFL (ci=14), трафик LFL (ci=19)
const SALES_SCORE_COLS = [
  { ci: 7,  label: 'План %',        dir: 1 },
  { ci: 9,  label: 'ТО LFL',        dir: 1 },
  { ci: 22, label: 'КОП',           dir: 1 },
  { ci: 54, label: 'ЮИ %',          dir: 1 },
  { ci: 33, label: 'Штук в чеке',   dir: 1 },
];

function salesScore(storeRow) {
  let sum = 0; let cnt = 0;
  for (const { ci, dir } of SALES_SCORE_COLS) {
    const v = parseFloat(storeRow[`_c${ci}`]);
    if (!isNaN(v)) { sum += v * dir; cnt++; }
  }
  return cnt ? sum / cnt : null;
}

// Normalize score to 0-100 percentile within a group
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

// ─── Extract store-level rows from sales files ───────────────────────────────
function extractSalesStores(salesFile) {
  if (!salesFile) return [];
  return (salesFile.data || salesFile.stores || []).filter(r => {
    const d = String(r['_c3'] || r['Магазин'] || '').toUpperCase();
    return d && d !== 'КОМПАНИЯ' && d !== 'РЕГИОН' && d !== 'ИМ' && d !== '';
  });
}

// ─── Регламенты: score per store ─────────────────────────────────────────────

// Вывозы: 'Отгружено товара %' — higher better; 'Вычерк по сборке %' — lower better
function vyvozScore(row) {
  const shipped = pct(row['Отгружено товара %']);
  const writeoff = pct(row['Вычерк по сборке %']);
  if (shipped === null) return null;
  const pen = writeoff !== null ? writeoff : 0;
  return shipped - pen * 0.5;
}

// Сканирование обуви: scanPct = % НЕ отсканированных → чем выше — хуже → инвертируем
// scanPct=100 означает ничего не сканировали → балл=0
// scanPct=0 означает всё отсканировано → балл=100
function scanScore(row) {
  const v = pct(row.scanPct);
  return v !== null ? Math.max(0, 100 - v) : null;
}

// Капсулы: % Неотсканировано — lower better → invert
function capsuleScore(row) {
  const v = pct(row.notScannedPct ?? row['% Неотскан'] ?? row.pct);
  return v !== null ? Math.max(0, 100 - v) : null;
}

// ЮИ: pct = % невыставленного → lower better → invert
function yuiScore(row) {
  const v = pct(row.pct);
  return v !== null ? Math.max(0, 100 - v) : null;
}

// ─── Build unified store list with all scores ─────────────────────────────────
function buildStoreScores({
  summaryData,
  spbSalesMonth, belSalesMonth,
  spbSalesDay, belSalesDay,
  spbScanning, belScanning,
  spbCapsule, belCapsule,
  spbJewelryItogi, belJewelryItogi,
}) {
  const map = {};

  function key(region, store) {
    return `${region}|${store.toLowerCase()}`;
  }

  function ensure(region, store, subdiv) {
    const k = key(region, store);
    if (!map[k]) map[k] = {
      region, store, subdiv,
      vyvozScores: [], scanScores: [], capsuleScores: [], yuiScores: [],
      salesMonthScore: null, salesDayScore: null,
    };
    return map[k];
  }

  // ── Вывозы ──
  for (const row of (summaryData || [])) {
    const region = regionOf(row);
    if (!region) continue;
    const store = storeLabel(row);
    if (!store) continue;
    const subdiv = subdivOf(row);
    const s = vyvozScore(row);
    if (s !== null) ensure(region, store, subdiv).vyvozScores.push(s);
  }

  // ── Сканирование обуви ──
  for (const sf of [spbScanning, belScanning]) {
    if (!sf) continue;
    const region = sf.fileRegion;
    for (const row of (sf.stores || [])) {
      const store = storeLabel(row);
      if (!store) continue;
      const subdiv = subdivOf(row);
      const s = scanScore(row);
      if (s !== null) ensure(region, store, subdiv).scanScores.push(s);
    }
  }

  // ── Капсулы ──
  for (const cf of [spbCapsule, belCapsule]) {
    if (!cf) continue;
    const region = cf.fileRegion === 'ALL' ? null : cf.fileRegion;
    for (const row of (cf.stores || [])) {
      const r = region || regionOf(row) || 'СПБ';
      const store = storeLabel(row);
      if (!store) continue;
      const subdiv = subdivOf(row);
      const s = capsuleScore(row);
      if (s !== null) ensure(r, store, subdiv).capsuleScores.push(s);
    }
  }

  // ── ЮИ ──
  for (const jf of [spbJewelryItogi, belJewelryItogi]) {
    if (!jf) continue;
    const region = jf.fileRegion === 'ALL' ? null : jf.fileRegion;
    for (const row of (jf.stores || [])) {
      const r = region || regionOf(row);
      if (!r) continue;
      const store = storeLabel(row);
      if (!store) continue;
      const subdiv = subdivOf(row);
      const s = yuiScore(row);
      if (s !== null) ensure(r, store, subdiv).yuiScores.push(s);
    }
  }

  // ── Продажи — месяц ──
  for (const sf of [spbSalesMonth, belSalesMonth]) {
    if (!sf) continue;
    const region = sf.fileRegion;
    const stores = extractSalesStores(sf);
    const withScores = normalizeScores(stores.map(r => ({
      row: r, score: salesScore(r),
      store: String(r['_c3'] || r['Магазин'] || '').trim(),
      subdiv: String(r['_c1'] || r['Подразделение'] || '').trim(),
    })));
    for (const { normScore, store, subdiv } of withScores) {
      if (!store || normScore === null) continue;
      const obj = ensure(region, store, subdiv);
      obj.salesMonthScore = normScore;
      if (!obj.subdiv && subdiv) obj.subdiv = subdiv;
    }
  }

  // ── Продажи — день ──
  for (const sf of [spbSalesDay, belSalesDay]) {
    if (!sf) continue;
    const region = sf.fileRegion;
    const stores = extractSalesStores(sf);
    const withScores = normalizeScores(stores.map(r => ({
      row: r, score: salesScore(r),
      store: String(r['_c3'] || r['Магазин'] || '').trim(),
      subdiv: String(r['_c1'] || r['Подразделение'] || '').trim(),
    })));
    for (const { normScore, store, subdiv } of withScores) {
      if (!store || normScore === null) continue;
      const obj = ensure(region, store, subdiv);
      obj.salesDayScore = normScore;
      if (!obj.subdiv && subdiv) obj.subdiv = subdiv;
    }
  }

  // ── Composite ──
  return Object.values(map).map(obj => {
    const vyvozAvg   = obj.vyvozScores.length   ? avg(...obj.vyvozScores)   : null;
    const scanAvg    = obj.scanScores.length     ? avg(...obj.scanScores)    : null;
    const capsAvg    = obj.capsuleScores.length  ? avg(...obj.capsuleScores) : null;
    const yuiAvg     = obj.yuiScores.length      ? avg(...obj.yuiScores)     : null;
    const regScore   = avg(...[vyvozAvg, scanAvg, capsAvg, yuiAvg].filter(v => v !== null));
    const salesScore = avg(...[obj.salesMonthScore, obj.salesDayScore].filter(v => v !== null));
    return { ...obj, vyvozAvg, scanAvg, capsAvg, yuiAvg, regScore, salesScore };
  });
}

// ─── Subdiv problem score ─────────────────────────────────────────────────────
// СПБ и БЕЛ объединяем в один список
function buildSubdivScores(storeList) {
  const map = {};
  for (const s of storeList) {
    // Ключ только по подразделению (без региона) — объединяем СПБ и БЕЛ вместе
    const k = s.subdiv || '—';
    if (!map[k]) map[k] = { subdiv: s.subdiv, regions: new Set(), regScores: [], salesScores: [] };
    map[k].regions.add(s.region);
    if (s.regScore !== null) map[k].regScores.push(s.regScore);
    if (s.salesScore !== null) map[k].salesScores.push(s.salesScore);
  }
  return Object.values(map).map(d => ({
    ...d,
    regionsLabel: [...d.regions].sort().join(', '),
    avgRegScore:   d.regScores.length   ? avg(...d.regScores)   : null,
    avgSalesScore: d.salesScores.length ? avg(...d.salesScores) : null,
  }));
}

// ─── Insights ─────────────────────────────────────────────────────────────────
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
    // Низкое сканирование обуви (scanAvg < 40 после инверсии означает >60% не отсканировано)
    const lowScan = stores.filter(s => s.scanAvg !== null && s.scanAvg < 40);
    if (lowScan.length > 2) insights.push({ type: 'warn', text: `${region}: ${lowScan.length} магазин(ов) с долей неотсканированной обуви >60%` });
    // Хорошие вывозы
    const topVyvoz = stores.filter(s => s.vyvozAvg !== null && s.vyvozAvg > 90);
    if (topVyvoz.length > 0) insights.push({ type: 'ok', text: `${region}: ${topVyvoz.length} магазин(ов) с показателем вывозов >90%` });
  }

  // Слабые подразделения
  const worstSubdivs = subdivScores.filter(d => d.avgRegScore !== null && d.avgRegScore < 50)
    .sort((a, b) => a.avgRegScore - b.avgRegScore).slice(0, 3);
  for (const d of worstSubdivs) {
    insights.push({ type: 'critical', text: `Подр. ${d.subdiv} (${d.regionsLabel}): ср. балл по регламентам ${d.avgRegScore.toFixed(0)} — требует внимания` });
  }

  return insights;
}

// ─── UI ───────────────────────────────────────────────────────────────────────
const MEDAL = ['🥇', '🥈', '🥉'];
function getRank(i) { return i < 3 ? MEDAL[i] : `${i + 1}`; }

function ScoreBar({ value, color }) {
  const w = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono w-9 text-right" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {value !== null ? value.toFixed(1) : '—'}
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

function TopTable({ title, items, scoreKey, scoreName, icon: Icon, accentColor, worst = false }) {
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
        <span className="ml-auto text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{scoreName}</span>
      </div>
      <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
        {items.map((item, i) => {
          const val = item[scoreKey];
          return (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
              <span className="w-6 text-center text-sm flex-shrink-0" style={{ color: worst ? '#f87171' : '#facc15' }}>
                {worst ? i + 1 : getRank(i)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white leading-tight truncate">{item.store}</div>
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

// Подразделения — СПБ+БЕЛ вместе
// scoreKey: 'avgRegScore' | 'avgSalesScore'
function SubdivTable({ subdivs, worst = false, scoreKey = 'avgRegScore' }) {
  const sorted = subdivs
    .filter(d => d[scoreKey] !== null && d[scoreKey] !== undefined)
    .sort((a, b) => worst ? a[scoreKey] - b[scoreKey] : b[scoreKey] - a[scoreKey])
    .slice(0, 9);

  if (!sorted.length) return <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Нет данных</p>;

  return (
    <div className="space-y-2">
      {sorted.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
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
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ItogiPage() {
  const {
    summaryData,
    spbSalesMonth, belSalesMonth,
    spbSalesDay, belSalesDay,
    spbScanning, belScanning,
    spbCapsule, belCapsule,
    spbJewelryItogi, belJewelryItogi,
  } = useData();

  const [activeTab, setActiveTab] = useState('reglaments');

  const storeList = useMemo(() => buildStoreScores({
    summaryData,
    spbSalesMonth, belSalesMonth,
    spbSalesDay, belSalesDay,
    spbScanning, belScanning,
    spbCapsule, belCapsule,
    spbJewelryItogi, belJewelryItogi,
  }), [summaryData, spbSalesMonth, belSalesMonth, spbSalesDay, belSalesDay,
       spbScanning, belScanning, spbCapsule, belCapsule, spbJewelryItogi, belJewelryItogi]);

  const subdivScores = useMemo(() => buildSubdivScores(storeList), [storeList]);
  const insights     = useMemo(() => buildInsights(storeList, subdivScores), [storeList, subdivScores]);

  const hasData = storeList.length > 0;

  const spbStores = storeList.filter(s => s.region === 'СПБ');
  const belStores = storeList.filter(s => s.region === 'БЕЛ');

  // Combined (СПБ+БЕЛ) sorted lists
  const regTop    = storeList.filter(s => s.regScore   !== null).sort((a,b) => b.regScore   - a.regScore).slice(0,15);
  const regBottom = storeList.filter(s => s.regScore   !== null).sort((a,b) => a.regScore   - b.regScore).slice(0,15);
  const salTop    = storeList.filter(s => s.salesScore !== null).sort((a,b) => b.salesScore - a.salesScore).slice(0,15);
  const salBottom = storeList.filter(s => s.salesScore !== null).sort((a,b) => a.salesScore - b.salesScore).slice(0,15);

  function makeRegTop(list)    { return list.filter(s=>s.regScore!==null).sort((a,b)=>b.regScore-a.regScore).slice(0,15); }
  function makeRegBottom(list) { return list.filter(s=>s.regScore!==null).sort((a,b)=>a.regScore-b.regScore).slice(0,15); }
  function makeSalTop(list)    { return list.filter(s=>s.salesScore!==null).sort((a,b)=>b.salesScore-a.salesScore).slice(0,15); }
  function makeSalBottom(list) { return list.filter(s=>s.salesScore!==null).sort((a,b)=>a.salesScore-b.salesScore).slice(0,15); }

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
              Загрузите файлы продаж, вывозов, сканирования, ЮИ и капсул через «Загрузить данные»
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

            {/* Подразделения — СПБ и БЕЛ вместе, 2 блока: регламенты и продажи */}
            <div>
              <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                Подразделения
                <span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  СПБ + БЕЛ вместе
                </span>
              </h2>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Баллы 0–100: выше = лучше. Регламенты = вывозы + сканирование обуви + капсулы + ЮИ. Продажи = план%, ТО LFL, КОП, ЮИ%, штук в чеке.
              </p>

              {/* Регламенты */}
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Регламенты</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-4" style={{ color: '#f87171' }}>Слабые подразделения</p>
                  <SubdivTable subdivs={subdivScores} worst scoreKey="avgRegScore" />
                </div>
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-4" style={{ color: '#10b981' }}>Сильные подразделения</p>
                  <SubdivTable subdivs={subdivScores} worst={false} scoreKey="avgRegScore" />
                </div>
              </div>

              {/* Продажи */}
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Продажи</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-4" style={{ color: '#f87171' }}>Слабые подразделения</p>
                  <SubdivTable subdivs={subdivScores} worst scoreKey="avgSalesScore" />
                </div>
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <p className="text-xs font-semibold mb-4" style={{ color: '#10b981' }}>Сильные подразделения</p>
                  <SubdivTable subdivs={subdivScores} worst={false} scoreKey="avgSalesScore" />
                </div>
              </div>
            </div>

            {/* ТОП магазинов — СПБ+БЕЛ вместе */}
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <h2 className="text-base font-semibold text-white mr-2">ТОП магазинов (СПБ + БЕЛ)</h2>
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  {[
                    { key: 'reglaments', label: 'Регламенты', icon: ClipboardCheck },
                    { key: 'sales',      label: 'Продажи',    icon: BarChart2 },
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: activeTab === key ? ACCENT : 'transparent',
                        color: activeTab === key ? 'white' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'reglaments' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <TopTable title="ТОП-15 исполнительных" items={regTop}    scoreKey="regScore"   scoreName="балл"   icon={Award}         accentColor="#10b981" />
                  <TopTable title="ТОП-15 проблемных"      items={regBottom} scoreKey="regScore"   scoreName="балл"   icon={AlertTriangle}  accentColor="#ef4444" worst />
                </div>
              )}
              {activeTab === 'sales' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <TopTable title="ТОП-15 лучших по продажам"     items={salTop}    scoreKey="salesScore" scoreName="индекс" icon={TrendingUp}     accentColor="#10b981" />
                  <TopTable title="ТОП-15 отстающих по продажам"  items={salBottom} scoreKey="salesScore" scoreName="индекс" icon={TrendingDown}   accentColor="#ef4444" worst />
                </div>
              )}
            </div>

            {/* Детализация по магазинам — СПБ отдельно, БЕЛ отдельно */}
            <div className="space-y-10">
              {[
                { region: 'СПБ', color: '#E91E8C', stores: spbStores },
                { region: 'БЕЛ', color: '#8b5cf6', stores: belStores },
              ].map(({ region, color, stores }) => (
                <div key={region}>
                  <div className="flex items-center gap-2 mb-5">
                    <TagBadge label={region} color={color} />
                    <h2 className="text-base font-semibold text-white">Магазины — {region}</h2>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Продажи</p>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <TopTable title={`ТОП-15 по продажам (${region})`}        items={makeSalTop(stores)}    scoreKey="salesScore" scoreName="индекс" icon={TrendingUp}    accentColor="#10b981" />
                        <TopTable title={`Отстающие по продажам (${region})`}     items={makeSalBottom(stores)} scoreKey="salesScore" scoreName="индекс" icon={TrendingDown}  accentColor="#ef4444" worst />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Регламенты</p>
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <TopTable title={`ТОП-15 по регламентам (${region})`}     items={makeRegTop(stores)}    scoreKey="regScore"   scoreName="балл"   icon={Award}          accentColor="#10b981" />
                        <TopTable title={`Проблемные по регламентам (${region})`} items={makeRegBottom(stores)} scoreKey="regScore"   scoreName="балл"   icon={AlertTriangle}  accentColor="#ef4444" worst />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
