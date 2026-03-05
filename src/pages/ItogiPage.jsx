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

// ─── Sales scoring ───────────────────────────────────────────────────────────
// Key sales columns (0-based): Plan%, TO_LFL, КОП, Margin%, Traffic_LFL
const SALES_SCORE_COLS = [
  { ci: 7, label: 'План %', dir: 1 },
  { ci: 9, label: 'ТО LFL', dir: 1 },
  { ci: 14, label: 'Маржа LFL', dir: 1 },
  { ci: 19, label: 'Трафик LFL', dir: 1 },
  { ci: 22, label: 'КОП', dir: 1 },
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
    // Exclude summary rows — D col (_c3) should be a store name, not КОМПАНИЯ/РЕГИОН
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
  // penalize writeoff
  const base = shipped;
  const pen = writeoff !== null ? writeoff : 0;
  return base - pen * 0.5;
}

// Scanning: scanPct — higher better
function scanScore(row) {
  return pct(row.scanPct);
}

// Capsule: col[9] = % Неотскан — lower better → invert to 100 - pct
function capsuleScore(row) {
  const v = pct(row.notScannedPct ?? row['% Неотскан'] ?? row.pct);
  return v !== null ? 100 - v : null;
}

// ─── Build unified store list with all scores ─────────────────────────────────
function buildStoreScores({
  summaryData,        // вывозы (обувь + кидс combined)
  spbSalesMonth, belSalesMonth,
  spbSalesDay, belSalesDay,
  spbScanning, belScanning,
  spbCapsule, belCapsule,
}) {
  const map = {}; // key: "region|store" → score object

  function key(region, store) {
    return `${region}|${store.toLowerCase()}`;
  }

  function ensure(region, store, subdiv) {
    const k = key(region, store);
    if (!map[k]) map[k] = { region, store, subdiv, _keys: [], vyvozScores: [], scanScores: [], capsuleScores: [], salesMonthScore: null, salesDayScore: null };
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

  // ── Сканирование ──
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
    for (const { row, normScore, store, subdiv } of withScores) {
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

  // ── Compute composite scores ──
  return Object.values(map).map(obj => {
    const vyvozAvg = obj.vyvozScores.length ? avg(...obj.vyvozScores) : null;
    const scanAvg  = obj.scanScores.length  ? avg(...obj.scanScores)  : null;
    const capsAvg  = obj.capsuleScores.length ? avg(...obj.capsuleScores) : null;
    const regScore = avg(...[vyvozAvg, scanAvg, capsAvg].filter(v => v !== null));
    const salesScore = avg(...[obj.salesMonthScore, obj.salesDayScore].filter(v => v !== null));
    return {
      ...obj,
      vyvozAvg, scanAvg, capsAvg,
      regScore, salesScore,
    };
  });
}

// ─── Subdiv problem score (for "проблемные подразделения") ───────────────────
function buildSubdivScores(storeList) {
  const map = {};
  for (const s of storeList) {
    const k = `${s.region}|${s.subdiv}`;
    if (!map[k]) map[k] = { region: s.region, subdiv: s.subdiv, regScores: [], salesScores: [] };
    if (s.regScore !== null) map[k].regScores.push(s.regScore);
    if (s.salesScore !== null) map[k].salesScores.push(s.salesScore);
  }
  return Object.values(map).map(d => ({
    ...d,
    avgRegScore: d.regScores.length ? avg(...d.regScores) : null,
    avgSalesScore: d.salesScores.length ? avg(...d.salesScores) : null,
  }));
}

// ─── UI Components ────────────────────────────────────────────────────────────
const MEDAL = ['🥇', '🥈', '🥉'];

function getRank(i) {
  if (i < 3) return MEDAL[i];
  return `${i + 1}`;
}

function ScoreBar({ value, max = 100, color }) {
  const w = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(w, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono w-9 text-right" style={{ color: 'rgba(255,255,255,0.7)' }}>{value !== null ? value.toFixed(1) : '—'}</span>
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
                <div className="text-xs mt-0.5 flex items-center gap-1.5">
                  <TagBadge label={item.region} color={item.region === 'СПБ' ? '#E91E8C' : '#8b5cf6'} />
                  {item.subdiv && <span style={{ color: 'rgba(255,255,255,0.35)' }}>{item.subdiv}</span>}
                </div>
              </div>
              <div className="w-28 flex-shrink-0">
                <ScoreBar value={val} color={worst ? '#f87171' : accentColor} max={val > 100 ? val : 100} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubdivCard({ region, subdivs, worst = false }) {
  const filtered = subdivs
    .filter(d => d.region === region && d.avgRegScore !== null)
    .sort((a, b) => worst ? a.avgRegScore - b.avgRegScore : b.avgRegScore - a.avgRegScore)
    .slice(0, 7);

  const color = region === 'СПБ' ? '#E91E8C' : '#8b5cf6';

  if (!filtered.length) return <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Нет данных</p>;

  return (
    <div className="space-y-2">
      {filtered.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-5 text-xs text-center flex-shrink-0" style={{ color: worst ? '#f87171' : '#facc15' }}>{i + 1}</span>
          <span className="flex-1 text-sm text-white truncate">{d.subdiv || '—'}</span>
          <div className="w-32 flex-shrink-0">
            <ScoreBar value={d.avgRegScore} color={worst ? '#f87171' : color} max={100} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Insights / conclusions ───────────────────────────────────────────────────
function buildInsights(storeList, subdivScores) {
  const insights = [];

  // Find regions with bad reg scores
  const spbStores = storeList.filter(s => s.region === 'СПБ' && s.regScore !== null);
  const belStores = storeList.filter(s => s.region === 'БЕЛ' && s.regScore !== null);

  for (const [region, stores] of [['СПБ', spbStores], ['БЕЛ', belStores]]) {
    if (!stores.length) continue;
    const avgReg = avg(...stores.map(s => s.regScore));
    if (avgReg !== null) {
      const bad = stores.filter(s => s.regScore < avgReg * 0.7).length;
      if (bad > 0) {
        insights.push({ type: 'warn', region, text: `${region}: ${bad} магазин(ов) значительно ниже среднего по регламентам (ср. балл ${avgReg.toFixed(0)})` });
      }
    }

    // Low scan
    const lowScan = stores.filter(s => s.scanAvg !== null && s.scanAvg < 60);
    if (lowScan.length > 2) {
      insights.push({ type: 'warn', region, text: `${region}: ${lowScan.length} магазин(ов) с адресным сканированием ниже 60%` });
    }

    // High vyvoz performers
    const topVyvoz = stores.filter(s => s.vyvozAvg !== null && s.vyvozAvg > 90);
    if (topVyvoz.length > 0) {
      insights.push({ type: 'ok', region, text: `${region}: ${topVyvoz.length} магазин(ов) с показателем вывозов >90% — отличное исполнение` });
    }
  }

  // Subdiv insights
  const worstSubdivs = subdivScores
    .filter(d => d.avgRegScore !== null)
    .sort((a, b) => a.avgRegScore - b.avgRegScore)
    .slice(0, 3);

  for (const d of worstSubdivs) {
    if (d.avgRegScore < 50) {
      insights.push({ type: 'critical', region: d.region, text: `Подр. ${d.subdiv} (${d.region}): средний балл по регламентам ${d.avgRegScore.toFixed(0)} — требует внимания` });
    }
  }

  return insights;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ItogiPage() {
  const {
    summaryData,
    spbSalesMonth, belSalesMonth,
    spbSalesDay, belSalesDay,
    spbScanning, belScanning,
    spbCapsule, belCapsule,
  } = useData();

  const [activeTab, setActiveTab] = useState('reglaments'); // 'reglaments' | 'sales'
  const [regionFilter, setRegionFilter] = useState('ALL'); // 'ALL' | 'СПБ' | 'БЕЛ'

  const storeList = useMemo(() => buildStoreScores({
    summaryData,
    spbSalesMonth, belSalesMonth,
    spbSalesDay, belSalesDay,
    spbScanning, belScanning,
    spbCapsule, belCapsule,
  }), [summaryData, spbSalesMonth, belSalesMonth, spbSalesDay, belSalesDay, spbScanning, belScanning, spbCapsule, belCapsule]);

  const subdivScores = useMemo(() => buildSubdivScores(storeList), [storeList]);
  const insights = useMemo(() => buildInsights(storeList, subdivScores), [storeList, subdivScores]);

  const hasData = storeList.length > 0;

  // ── Filtered by region ──
  const filtered = regionFilter === 'ALL' ? storeList : storeList.filter(s => s.region === regionFilter);

  // ── Sales TOP/ANTI-TOP ──
  const salesSorted = filtered.filter(s => s.salesScore !== null).sort((a, b) => b.salesScore - a.salesScore);
  const salesTop = salesSorted.slice(0, 15);
  const salesBottom = [...salesSorted].reverse().slice(0, 15);

  // ── Reglaments TOP/ANTI-TOP ──
  const regSorted = filtered.filter(s => s.regScore !== null).sort((a, b) => b.regScore - a.regScore);
  const regTop = regSorted.slice(0, 15);
  const regBottom = [...regSorted].reverse().slice(0, 15);

  // ── Subdiv problem analysis: СПБ and БЕЛ separately ──
  const worstSubdivSpb = subdivScores.filter(d => d.region === 'СПБ' && d.avgRegScore !== null)
    .sort((a, b) => a.avgRegScore - b.avgRegScore).slice(0, 7);
  const worstSubdivBel = subdivScores.filter(d => d.region === 'БЕЛ' && d.avgRegScore !== null)
    .sort((a, b) => a.avgRegScore - b.avgRegScore).slice(0, 7);

  // ── For separate region tables ──
  const spbFiltered = storeList.filter(s => s.region === 'СПБ');
  const belFiltered = storeList.filter(s => s.region === 'БЕЛ');

  function makeRegTop(list) {
    return list.filter(s => s.regScore !== null).sort((a, b) => b.regScore - a.regScore).slice(0, 15);
  }
  function makeRegBottom(list) {
    return list.filter(s => s.regScore !== null).sort((a, b) => a.regScore - b.regScore).slice(0, 15);
  }
  function makeSalesTop(list) {
    return list.filter(s => s.salesScore !== null).sort((a, b) => b.salesScore - a.salesScore).slice(0, 15);
  }
  function makeSalesBottom(list) {
    return list.filter(s => s.salesScore !== null).sort((a, b) => a.salesScore - b.salesScore).slice(0, 15);
  }

  return (
    <div className="flex-1 overflow-auto" style={{ backgroundColor: '#111827', minHeight: '100vh' }}>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* ── Header ── */}
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
              Загрузите файлы продаж, вывозов, сканирования и капсул через раздел «Загрузить данные»
            </p>
          </div>
        )}

        {hasData && (
          <>
            {/* ── Insights ── */}
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

            {/* ── Проблемные подразделения ── */}
            <div>
              <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                Проблемные подразделения
                <span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>по среднему баллу регламентов</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* СПБ */}
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <TagBadge label="СПБ" color="#E91E8C" />
                    <span className="text-sm font-medium text-white">Слабые подразделения</span>
                  </div>
                  <SubdivCard region="СПБ" subdivs={subdivScores} worst />
                  {worstSubdivSpb.length === 0 && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Нет данных</p>}
                </div>
                {/* БЕЛ */}
                <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <TagBadge label="БЕЛ" color="#8b5cf6" />
                    <span className="text-sm font-medium text-white">Слабые подразделения</span>
                  </div>
                  <SubdivCard region="БЕЛ" subdivs={subdivScores} worst />
                  {worstSubdivBel.length === 0 && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Нет данных</p>}
                </div>
              </div>
            </div>

            {/* ── Tabs: Продажи / Регламенты ── */}
            <div>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <h2 className="text-base font-semibold text-white mr-2">ТОП магазинов</h2>
                {/* Tab switcher */}
                <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  {[
                    { key: 'reglaments', label: 'Регламенты', icon: ClipboardCheck },
                    { key: 'sales', label: 'Продажи', icon: BarChart2 },
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
                {/* Region filter */}
                <div className="flex rounded-lg overflow-hidden border ml-2" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                  {['ALL', 'СПБ', 'БЕЛ'].map(r => (
                    <button
                      key={r}
                      onClick={() => setRegionFilter(r)}
                      className="px-3 py-1.5 text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: regionFilter === r ? (r === 'БЕЛ' ? '#8b5cf6' : r === 'СПБ' ? ACCENT : '#374151') : 'transparent',
                        color: regionFilter === r ? 'white' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {r === 'ALL' ? 'Все' : r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Combined TOP-15 + ANTI-TOP-15 */}
              {activeTab === 'reglaments' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <TopTable
                    title="ТОП-15 исполнительных (регламенты)"
                    items={regTop}
                    scoreKey="regScore"
                    scoreName="балл"
                    icon={Award}
                    accentColor="#10b981"
                    worst={false}
                  />
                  <TopTable
                    title="ТОП-15 проблемных (регламенты)"
                    items={regBottom}
                    scoreKey="regScore"
                    scoreName="балл"
                    icon={AlertTriangle}
                    accentColor="#ef4444"
                    worst={true}
                  />
                </div>
              )}

              {activeTab === 'sales' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <TopTable
                    title="ТОП-15 по продажам"
                    items={salesTop}
                    scoreKey="salesScore"
                    scoreName="индекс"
                    icon={TrendingUp}
                    accentColor="#10b981"
                    worst={false}
                  />
                  <TopTable
                    title="ТОП-15 отстающих по продажам"
                    items={salesBottom}
                    scoreKey="salesScore"
                    scoreName="индекс"
                    icon={TrendingDown}
                    accentColor="#ef4444"
                    worst={true}
                  />
                </div>
              )}
            </div>

            {/* ── Отдельно СПБ / БЕЛ ── */}
            <div className="space-y-8">
              {/* СПБ */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TagBadge label="СПБ" color="#E91E8C" />
                  <h2 className="text-base font-semibold text-white">Детализация по СПБ</h2>
                </div>

                <div className="space-y-6">
                  {/* Продажи СПБ */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Продажи</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <TopTable title="ТОП-15 по продажам (СПБ)" items={makeSalesTop(spbFiltered)} scoreKey="salesScore" scoreName="индекс" icon={TrendingUp} accentColor="#10b981" />
                      <TopTable title="Отстающие по продажам (СПБ)" items={makeSalesBottom(spbFiltered)} scoreKey="salesScore" scoreName="индекс" icon={TrendingDown} accentColor="#ef4444" worst />
                    </div>
                  </div>
                  {/* Регламенты СПБ */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Регламенты</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <TopTable title="ТОП-15 по регламентам (СПБ)" items={makeRegTop(spbFiltered)} scoreKey="regScore" scoreName="балл" icon={Award} accentColor="#10b981" />
                      <TopTable title="Проблемные по регламентам (СПБ)" items={makeRegBottom(spbFiltered)} scoreKey="regScore" scoreName="балл" icon={AlertTriangle} accentColor="#ef4444" worst />
                    </div>
                  </div>
                </div>
              </div>

              {/* БЕЛ */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TagBadge label="БЕЛ" color="#8b5cf6" />
                  <h2 className="text-base font-semibold text-white">Детализация по БЕЛ</h2>
                </div>

                <div className="space-y-6">
                  {/* Продажи БЕЛ */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Продажи</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <TopTable title="ТОП-15 по продажам (БЕЛ)" items={makeSalesTop(belFiltered)} scoreKey="salesScore" scoreName="индекс" icon={TrendingUp} accentColor="#10b981" />
                      <TopTable title="Отстающие по продажам (БЕЛ)" items={makeSalesBottom(belFiltered)} scoreKey="salesScore" scoreName="индекс" icon={TrendingDown} accentColor="#ef4444" worst />
                    </div>
                  </div>
                  {/* Регламенты БЕЛ */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>Регламенты</p>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      <TopTable title="ТОП-15 по регламентам (БЕЛ)" items={makeRegTop(belFiltered)} scoreKey="regScore" scoreName="балл" icon={Award} accentColor="#10b981" />
                      <TopTable title="Проблемные по регламентам (БЕЛ)" items={makeRegBottom(belFiltered)} scoreKey="regScore" scoreName="балл" icon={AlertTriangle} accentColor="#ef4444" worst />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
