import { useState, useMemo } from 'react';
import * as XLSXStyle from 'xlsx-js-style';

// Column layout for «По часу» sheet «Регион»:
// A=0 Подразделение, B=1 Магазин(num), C=2 ТЦ/RegionLabel, D+=3 data columns
// Region rows have A=ИТОГО, B=ИТОГО, C=region label

// Columns to hide per view (0-based indices)
const SKIP_REGIONS = new Set([0, 1]);   // hide A(ИТОГО) and B(ИТОГО), show C(region) + data
const SKIP_SUBDIVS = new Set([]);       // no subdivisions in this format
const SKIP_STORES  = new Set([1]);      // hide B (store number), show A(subdivison) + C(ТЦ) + data

// Sticky column ci per view
const STICKY_COL_CI = {
  regions: 2,  // C — region label
  subdivs: 0,  // not used
  stores:  2,  // C — ТЦ name
};

// Closed stores — never show these
const CLOSED_STORES = new Set([11596, 11787, 50015]);

// Top-15: use ЮИ % column (search by header name)
const YUI_PERCENT_HEADERS = ['ЮИ %', 'Доля ЮИ %', 'ТО ЮИ / ТО'];

// ─── Percent column detection ──────────────────────────────────────────────────
const PERCENT_EXACT = new Set([
  'КОП',
  'КОП обувь',
  'ТО расширения',
  'Штук в чеке к неделе',
  'ТО ЮИ / ТО',
  'Утилизация списания',
]);

function isPercentHeader(h) {
  if (!h) return false;
  if (h.includes('%')) return true;
  if (PERCENT_EXACT.has(h)) return true;
  return /LFL|YTY|Рост|Доля/.test(h);
}

// ─── Gradient helpers ──────────────────────────────────────────────────────────
// 15-stop gradient: плавный переход от красного через жёлтый к зелёному
const COLOR_STOPS = [
  [210,  50,  50],
  [225,  70,  60],
  [238,  92,  68],
  [247, 115,  72],
  [251, 140,  78],
  [253, 165,  85],
  [254, 188,  92],
  [254, 210, 102],
  [255, 230, 118],
  [255, 245, 135],
  [235, 242, 120],
  [200, 232, 110],
  [155, 212,  98],
  [108, 190,  90],
  [ 68, 165,  84],
];

function computeRGB(ratio) {
  const n = COLOR_STOPS.length - 1;
  const pos = ratio * n;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, n);
  const t = pos - lo;
  const [r1, g1, b1] = COLOR_STOPS[lo];
  const [r2, g2, b2] = COLOR_STOPS[hi];
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
}

function gradientStyle(val, min, max, invert) {
  if (min === max || val === null || val === undefined || typeof val !== 'number') return {};
  let ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
  if (invert) ratio = 1 - ratio;
  const [r, g, b] = computeRGB(ratio);
  return { backgroundColor: `rgb(${r},${g},${b})`, color: '#1f2937', fontWeight: '500' };
}

function gradientHex(val, min, max, invert) {
  if (min === max || val === null || val === undefined || typeof val !== 'number') return null;
  let ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
  if (invert) ratio = 1 - ratio;
  const [r, g, b] = computeRGB(ratio);
  return ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0').toUpperCase();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function computeScales(rows, headers, excludeKari = false, kariColCi = 0) {
  const scales = {};
  const scaleRows = excludeKari
    ? rows.filter(r => {
        const name = String(r[`_c${kariColCi}`] || '').toLowerCase();
        return !name.includes('kari') && !name.includes('кари');
      })
    : rows;
  headers.forEach((_, ci) => {
    // Only compute scales for data columns (index 3+)
    if (ci < 3) return;
    const vals = scaleRows
      .map(r => r[`_c${ci}`])
      .filter(v => v !== null && v !== undefined && typeof v === 'number')
      .sort((a, b) => a - b);
    if (vals.length === 0) return;
    const p5  = percentile(vals, 5);
    const p95 = percentile(vals, 95);
    scales[ci] = { min: p5, max: p95 };
  });
  return scales;
}

// ─── Format cell value for display ────────────────────────────────────────────
function fmtVal(v, header) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    if (header === 'ТО руб.') return Math.round(v).toLocaleString('ru-RU');
    if (isPercentHeader(header)) {
      const pct = v * 100;
      return pct.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + '%';
    }
    if (Number.isInteger(v)) return v.toLocaleString('ru-RU');
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  }
  return String(v);
}

// ─── SortableTable ─────────────────────────────────────────────────────────────
function SortableTable({
  rows,
  headers,
  skipCols,
  showFilters = false,
  filterState = {},
  onFilterChange,
  stickyColCi,
  subdivOptions = [],
  excludeKariFromScales = false,
  // kariColCi: column index used to detect Kari row (default 0, regions use 2)
  kariColCi = 0,
}) {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const scales = useMemo(
    () => computeScales(rows, headers, excludeKariFromScales, kariColCi),
    [rows, headers, excludeKariFromScales, kariColCi]
  );

  function handleSort(h) {
    if (sortField === h) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(h);
      setSortDir('asc');
    }
  }

  const visibleHeaders = headers.filter((_, ci) => !skipCols.has(ci));

  const sorted = useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv), 'ru')
        : String(bv).localeCompare(String(av), 'ru');
    });
  }, [rows, sortField, sortDir]);

  const subdivHeader = headers[1] || '';

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse" style={{ tableLayout: 'auto', minWidth: '600px' }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {visibleHeaders.map((h, i) => {
              const ci = headers.indexOf(h);
              const isSticky = ci === stickyColCi;
              const isTextCol = ci <= 4 && !skipCols.has(ci);
              return (
                <th
                  key={i}
                  onClick={() => handleSort(h)}
                  className="px-2 py-1.5 text-center font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                  style={{
                    fontSize: '11px',
                    minWidth: isTextCol ? '100px' : '50px',
                    maxWidth: isSticky ? '150px' : '90px',
                    verticalAlign: 'top',
                    padding: '4px',
                    ...(isSticky ? {
                      position: 'sticky',
                      left: 0,
                      zIndex: 3,
                      backgroundColor: '#f9fafb',
                      boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                    } : {}),
                  }}
                >
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.25' }}>
                    {h}{sortField === h ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </div>
                </th>
              );
            })}
          </tr>
          {showFilters && (
            <tr className="bg-gray-50 border-b border-gray-200">
              {visibleHeaders.map((h, i) => {
                const ci = headers.indexOf(h);
                const isSticky = ci === stickyColCi;
                const isTextCol = ci <= 4;
                const isSubdivCol = h === subdivHeader && subdivOptions.length > 0;

                const stickyStyle = isSticky ? {
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  backgroundColor: '#f9fafb',
                  boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                } : {};

                if (!isTextCol) return <th key={i} className="px-1 py-0.5" style={stickyStyle} />;

                if (isSubdivCol) {
                  return (
                    <th key={i} className="px-1 py-0.5" style={stickyStyle}>
                      <select
                        value={filterState[h] || ''}
                        onChange={e => onFilterChange(h, e.target.value)}
                        className="w-full text-xs px-1 py-0.5 border border-gray-300 rounded bg-white"
                      >
                        <option value="">Все</option>
                        {subdivOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </th>
                  );
                }

                return (
                  <th key={i} className="px-1 py-0.5" style={stickyStyle}>
                    <input
                      type="text"
                      value={filterState[h] || ''}
                      onChange={e => onFilterChange(h, e.target.value)}
                      placeholder="Фильтр"
                      className="w-full text-xs px-1 py-0.5 border border-gray-300 rounded"
                    />
                  </th>
                );
              })}
            </tr>
          )}
        </thead>
        <tbody>
          {sorted.map((row, ri) => {
            const rowName = String(row[`_c${kariColCi}`] || '').toLowerCase();
            const isKariRow = rowName.includes('kari') || rowName.includes('кари');
            return (
              <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">
                {visibleHeaders.map((h, i) => {
                  const ci = headers.indexOf(h);
                  const val = row[`_c${ci}`];
                  const isSticky = ci === stickyColCi;
                  let gradBg = null;
                  // Apply gradient to all numeric data columns (index 3+)
                  if (!isKariRow && ci >= 3 && typeof val === 'number' && scales[ci]) {
                    const gs = gradientStyle(val, scales[ci].min, scales[ci].max, false);
                    gradBg = gs.backgroundColor;
                  }
                  return (
                    <td
                      key={i}
                      className="px-2 py-1 text-center"
                      style={{
                        fontSize: '11px',
                        ...(gradBg && !isSticky ? { backgroundColor: gradBg, color: '#1f2937', fontWeight: '500' } : {}),
                        ...(isSticky ? {
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          backgroundColor: '#ffffff',
                          boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                        } : {}),
                      }}
                    >
                      {fmtVal(row[h], h)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={visibleHeaders.length} className="px-4 py-8 text-center text-gray-400">
                Нет данных
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Top15 sub-table (sortable) ────────────────────────────────────────────────
// Show: subdivision(0), ТЦ(2), and first 8 data cols (3–10)
function getTop15Cols(headers) {
  const fixed = [0, 2];
  const data = headers
    .map((_, ci) => ci)
    .filter(ci => ci >= 3)
    .slice(0, 8);
  return [...fixed, ...data];
}

function Top15SubTable({ rows, headers, scales, label, labelColor }) {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir]   = useState('desc');

  const top15Cols = useMemo(() => getTop15Cols(headers), [headers]);
  const visHeaders = top15Cols.map(ci => headers[ci]).filter(Boolean);

  function handleSort(h) {
    if (sortField === h) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(h);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv), 'ru')
        : String(bv).localeCompare(String(av), 'ru');
    });
  }, [rows, sortField, sortDir]);

  return (
    <div>
      <div className="px-3 py-1.5 text-xs font-semibold" style={{ color: labelColor, backgroundColor: labelColor + '15' }}>
        {label}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs w-full border-collapse" style={{ minWidth: '600px' }}>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {visHeaders.map((h, i) => (
                <th
                  key={i}
                  onClick={() => handleSort(h)}
                  className="px-2 py-1.5 text-center font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                  style={{ fontSize: '11px', minWidth: i <= 2 ? '100px' : '70px', verticalAlign: 'top', padding: '4px' }}
                >
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.25' }}>
                    {h}{sortField === h ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">
                {top15Cols.map((ci, i) => {
                  const h = headers[ci];
                  if (!h) return null;
                  const val = row[`_c${ci}`];
                  let style = {};
                  if (ci >= 3 && typeof val === 'number' && scales[ci]) {
                    style = gradientStyle(val, scales[ci].min, scales[ci].max, false);
                  }
                  return (
                    <td key={i} className="px-2 py-1 text-center" style={{ ...style, fontSize: '11px' }}>
                      {fmtVal(row[h], h)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={visHeaders.length} className="px-4 py-4 text-center text-gray-400">Нет данных</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Top15 table — ranked by ЮИ % ─────────────────────────────────────────────
function Top15Table({ stores, headers }) {
  // Find ЮИ % column header dynamically
  const yuiHeader = useMemo(() => {
    for (const h of YUI_PERCENT_HEADERS) {
      if (headers.includes(h)) return h;
    }
    return null;
  }, [headers]);

  const withYui = useMemo(() => {
    if (!yuiHeader) return [];
    return (stores || []).filter(row => {
      const v = row[yuiHeader];
      return v !== null && v !== undefined && typeof v === 'number';
    });
  }, [stores, yuiHeader]);

  const byYui = useMemo(() => {
    if (!yuiHeader) return [];
    return [...withYui].sort((a, b) => (b[yuiHeader] ?? -Infinity) - (a[yuiHeader] ?? -Infinity));
  }, [withYui, yuiHeader]);

  const best15  = byYui.slice(0, 15);
  const worst15 = [...byYui].reverse().slice(0, 15);

  const scales = useMemo(() => computeScales(stores || [], headers), [stores, headers]);

  if (!yuiHeader) {
    return <div className="p-6 text-gray-400 text-sm">Столбец ЮИ % не найден в данных.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Top15SubTable rows={best15}  headers={headers} scales={scales} label={`15 лучших по ${yuiHeader}`}  labelColor="#16a34a" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Top15SubTable rows={worst15} headers={headers} scales={scales} label={`15 худших по ${yuiHeader}`} labelColor="#dc2626" />
      </div>
    </div>
  );
}

// ─── Excel export ──────────────────────────────────────────────────────────────
function exportToExcel(fileData, title, filteredStores) {
  const wb = XLSXStyle.utils.book_new();

  const views = [
    { label: 'Регионы',       rows: fileData.regions,  skipCols: SKIP_REGIONS },
    { label: 'Подразделения', rows: fileData.subdivs,  skipCols: SKIP_SUBDIVS },
    { label: 'Магазины',      rows: filteredStores,    skipCols: SKIP_STORES  },
  ];

  const headers = fileData.headers;

  views.forEach(({ label, rows, skipCols }) => {
    if (!rows || rows.length === 0) return;

    const isRegionsView = label === 'Регионы';
    const kariColCiExport = isRegionsView ? 2 : 0;
    const visHeaders = headers.filter((_, ci) => !skipCols.has(ci));
    const visIndices = headers.map((_, ci) => ci).filter(ci => !skipCols.has(ci));

    const scales = computeScales(rows, headers, isRegionsView, kariColCiExport);

    const wsData = [visHeaders];
    rows.forEach(row => {
      wsData.push(visHeaders.map(h => {
        const v = row[h];
        if (typeof v !== 'number') return v !== null && v !== undefined ? v : '';
        if (h === 'ТО руб.') return Math.round(v);
        if (isPercentHeader(h)) return parseFloat((v * 100).toFixed(1));
        return Number.isInteger(v) ? v : parseFloat(v.toFixed(0));
      }));
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

    for (let ri = 1; ri < wsData.length; ri++) {
      visIndices.forEach((ci, vci) => {
        const cellAddr = XLSXStyle.utils.encode_cell({ r: ri, c: vci });
        if (!ws[cellAddr]) return;
        const cellVal = ws[cellAddr].v;
        if (typeof cellVal !== 'number') return;

        const row = rows[ri - 1];
        const val = row[`_c${ci}`];
        const rowName = String(row[`_c${kariColCiExport}`] || '').toLowerCase();
        const isKariRow = rowName.includes('kari') || rowName.includes('кари');
        let bgHex = null;
        // Apply gradient to all numeric data columns (index 3+)
        if (!isKariRow && ci >= 3 && typeof val === 'number' && scales[ci]) {
          bgHex = gradientHex(val, scales[ci].min, scales[ci].max, false);
        }

        ws[cellAddr].s = {
          ...(bgHex ? { fill: { patternType: 'solid', fgColor: { rgb: bgHex } } } : {}),
          font: { color: { rgb: '1F2937' } },
          alignment: { horizontal: 'center' },
          numFmt: '# ##0',
        };
      });
    }

    XLSXStyle.utils.book_append_sheet(wb, ws, label.substring(0, 31));
  });

  XLSXStyle.writeFile(wb, `${title}.xlsx`);
}

// ─── Main SalesHourPage component ──────────────────────────────────────────────
export default function SalesHourPage({ fileData, title }) {
  const [activeView, setActiveView] = useState('regions');
  const [storeFilters, setStoreFilters] = useState({});
  const [subdivFilters, setSubdivFilters] = useState({});

  if (!fileData) {
    return (
      <div className="p-6 text-gray-500 text-sm">
        Загрузите файл отчёта по продажам по часу ({title}).
      </div>
    );
  }

  const { headers, stores: rawStores, subdivs, regions, periods } = fileData;
  const periodInfo = periods && periods.length > 0 ? periods[0] : '';

  // Filter out closed stores — store number is in column B (index 1)
  const storeNumHeader = headers[1] || '';
  const stores = useMemo(() => {
    return (rawStores || []).filter(row => {
      const storeNum = row[storeNumHeader];
      const n = storeNum !== null && storeNum !== undefined ? Number(storeNum) : NaN;
      return !CLOSED_STORES.has(n);
    });
  }, [rawStores, storeNumHeader]);

  // Subdivision name is in column A (index 0)
  const subdivHeader = headers[0] || '';
  const subdivOptions = useMemo(() => {
    if (!stores || !subdivHeader) return [];
    const vals = stores
      .map(r => r[subdivHeader])
      .filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    return [...new Set(vals)].sort((a, b) => String(a).localeCompare(String(b), 'ru'));
  }, [stores, subdivHeader]);

  const filteredStores = useMemo(() => {
    return stores.filter(row =>
      Object.entries(storeFilters).every(([h, val]) => {
        if (!val) return true;
        const v = row[h];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [stores, storeFilters]);

  const filteredSubdivs = useMemo(() => {
    return (subdivs || []).filter(row =>
      Object.entries(subdivFilters).every(([h, val]) => {
        if (!val) return true;
        const v = row[h];
        return v !== null && v !== undefined && String(v).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [subdivs, subdivFilters]);

  const tabCounts = {
    regions: regions?.length ?? 0,
    subdivs: subdivs?.length ?? 0,
    stores:  stores?.length ?? 0,
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">{title}</h1>
          {periodInfo && <p className="text-xs text-gray-500 mt-0.5">{periodInfo}</p>}
        </div>
        <button
          onClick={() => exportToExcel(fileData, title, filteredStores)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
          style={{ backgroundColor: '#16a34a' }}
        >
          Выгрузить Excel
        </button>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'regions', label: 'Регионы' },
          { key: 'subdivs', label: 'Подразделения' },
          { key: 'stores',  label: 'Магазины' },
          { key: 'top15',   label: 'Топ-15 ЮИ %' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveView(tab.key)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeView === tab.key
                ? 'border-[#16a34a] text-[#16a34a]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {tab.key !== 'top15' && (
              <span className="ml-1 text-gray-400 font-normal">({tabCounts[tab.key]})</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={activeView !== 'top15' ? 'bg-white rounded-xl border border-gray-200 overflow-hidden' : ''}>
        {activeView === 'regions' && (
          <SortableTable
            rows={regions || []}
            headers={headers}
            skipCols={SKIP_REGIONS}
            stickyColCi={STICKY_COL_CI.regions}
            excludeKariFromScales={true}
            kariColCi={2}
          />
        )}
        {activeView === 'subdivs' && (
          <SortableTable
            rows={filteredSubdivs}
            headers={headers}
            skipCols={SKIP_SUBDIVS}
            stickyColCi={STICKY_COL_CI.subdivs}
          />
        )}
        {activeView === 'stores' && (
          <SortableTable
            rows={filteredStores}
            headers={headers}
            skipCols={SKIP_STORES}
            showFilters={true}
            filterState={storeFilters}
            onFilterChange={(h, v) => setStoreFilters(prev => ({ ...prev, [h]: v }))}
            stickyColCi={STICKY_COL_CI.stores}
            subdivOptions={subdivOptions}
          />
        )}
        {activeView === 'top15' && (
          <div className="space-y-6">
            <Top15Table
              stores={stores}
              headers={headers}
            />
          </div>
        )}
      </div>
    </div>
  );
}
