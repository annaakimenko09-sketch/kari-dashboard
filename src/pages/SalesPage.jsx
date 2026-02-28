import { useState, useMemo } from 'react';
import * as XLSXStyle from 'xlsx-js-style';
import { COLS_HIGH_GOOD, COLS_HIGH_BAD } from '../utils/salesParser';

// Columns to hide per view (0-based indices matching Рег sheet headers)
// A=0 Регион, B=1 Подразделение, C=2 (0/1 flag), D=3 Магазин, E=4 ТЦ
const SKIP_REGIONS = new Set([1, 2, 3, 4]);
const SKIP_SUBDIVS = new Set([0, 2, 3, 4]);
const SKIP_STORES  = new Set([0, 2]);

// Sticky column ci per view
const STICKY_COL_CI = {
  regions: 0,  // A — Регион
  subdivs: 1,  // B — Подразделение
  stores:  4,  // E — ТЦ
};

// Closed stores — never show these
const CLOSED_STORES = new Set([11596, 11787, 50015]);

// ТО LFL column index
const TO_LFL_CI = 9;
const TO_LFL_HEADER = 'ТО LFL';

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
const COLOR_STOPS = [
  [248, 105, 107],
  [255, 167,  83],
  [255, 235, 132],
  [ 99, 190, 123],
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

function computeScales(rows, headers, skipFirstForCols = new Set()) {
  const scales = {};
  headers.forEach((_, ci) => {
    const sourceRows = skipFirstForCols.has(ci) ? rows.slice(1) : rows;
    const vals = sourceRows
      .map(r => r[`_c${ci}`])
      .filter(v => v !== null && v !== undefined && typeof v === 'number');
    if (vals.length === 0) return;
    scales[ci] = { min: Math.min(...vals), max: Math.max(...vals) };
  });
  return scales;
}

// ─── Format cell value for display ────────────────────────────────────────────
const TO_RUB_CI = 5;

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
  skipFirstGradientForCols,
  stickyColCi,
  subdivOptions = [],
}) {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const scales = useMemo(
    () => computeScales(rows, headers, skipFirstGradientForCols || new Set()),
    [rows, headers, skipFirstGradientForCols]
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

  // Width per column: first 3 visible cols in stores are wider
  function colWidth(ci, viewSticky) {
    if (ci === viewSticky) return '130px';
    // Магазин (ci=3) and ТЦ (ci=4) — wider for stores
    if (ci === 3) return '70px';
    return '70px';
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse" style={{ tableLayout: 'auto', minWidth: '600px' }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {visibleHeaders.map((h, i) => {
              const ci = headers.indexOf(h);
              const isSticky = ci === stickyColCi;
              // First 3 text cols (Подразделение/Магазин/ТЦ) get min 100px
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
          {sorted.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">
              {visibleHeaders.map((h, i) => {
                const ci = headers.indexOf(h);
                const val = row[`_c${ci}`];
                const isSticky = ci === stickyColCi;
                let style = {};
                const isFirstRow = ri === 0;
                const skipGrad = isFirstRow && skipFirstGradientForCols && skipFirstGradientForCols.has(ci);
                if (!skipGrad && typeof val === 'number' && scales[ci]) {
                  if (COLS_HIGH_GOOD.has(ci) || COLS_HIGH_BAD.has(ci)) {
                    style = gradientStyle(val, scales[ci].min, scales[ci].max, COLS_HIGH_BAD.has(ci));
                  }
                }
                return (
                  <td
                    key={i}
                    className="px-2 py-1 text-center"
                    style={{
                      ...style,
                      fontSize: '11px',
                      ...(isSticky ? {
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        backgroundColor: style.backgroundColor || '#ffffff',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                      } : {}),
                    }}
                  >
                    {fmtVal(row[h], h)}
                  </td>
                );
              })}
            </tr>
          ))}
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

// ─── Top15 table ───────────────────────────────────────────────────────────────
// Shows top-15 best and top-15 worst by ТО LFL for a given region filter
function Top15Table({ stores, headers, regionLabel }) {
  const lflHeader = TO_LFL_HEADER;

  // Determine visible cols for top15: Подразделение, Магазин, ТЦ + ТО LFL + a few key metrics
  // Show: B(1 Подразд), D(3 Магазин), E(4 ТЦ), F(5 ТО руб), J(9 ТО LFL), H(7 План %), I(8 Рост в ТО)
  const TOP15_COLS = [1, 3, 4, 5, 7, 8, 9];

  const visHeaders = TOP15_COLS.map(ci => headers[ci]).filter(Boolean);

  const withLfl = useMemo(() => {
    return (stores || []).filter(row => {
      const v = row[lflHeader];
      return v !== null && v !== undefined && typeof v === 'number';
    });
  }, [stores, lflHeader]);

  const sorted = useMemo(() => {
    return [...withLfl].sort((a, b) => {
      const av = a[lflHeader] ?? -Infinity;
      const bv = b[lflHeader] ?? -Infinity;
      return bv - av; // desc: best first
    });
  }, [withLfl, lflHeader]);

  const best15  = sorted.slice(0, 15);
  const worst15 = [...sorted].reverse().slice(0, 15);

  const scales = useMemo(() => computeScales(stores || [], headers), [stores, headers]);

  function renderRows(rows, label, labelColor) {
    return (
      <div>
        <div className="px-3 py-1.5 text-xs font-semibold" style={{ color: labelColor, backgroundColor: labelColor + '15' }}>
          {label}
        </div>
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {visHeaders.map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-center font-semibold text-gray-600"
                  style={{ fontSize: '11px', minWidth: i <= 2 ? '100px' : '70px', verticalAlign: 'top' }}>
                  <div style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.25' }}>{h}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50">
                {TOP15_COLS.map((ci, i) => {
                  const h = headers[ci];
                  if (!h) return null;
                  const val = row[`_c${ci}`];
                  let style = {};
                  if (typeof val === 'number' && scales[ci]) {
                    if (COLS_HIGH_GOOD.has(ci) || COLS_HIGH_BAD.has(ci)) {
                      style = gradientStyle(val, scales[ci].min, scales[ci].max, COLS_HIGH_BAD.has(ci));
                    }
                  }
                  return (
                    <td key={i} className="px-2 py-1 text-center" style={{ ...style, fontSize: '11px' }}>
                      {fmtVal(row[h], h)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={visHeaders.length} className="px-4 py-4 text-center text-gray-400">Нет данных</td></tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-gray-700 px-1">{regionLabel}</h2>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        {renderRows(best15, '15 лучших по ТО LFL', '#16a34a')}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
        {renderRows(worst15, '15 худших по ТО LFL', '#dc2626')}
      </div>
    </div>
  );
}

// ─── Excel export ──────────────────────────────────────────────────────────────
function exportToExcel(fileData, title, filteredStores) {
  const wb = XLSXStyle.utils.book_new();

  const views = [
    { label: 'Регионы',       rows: fileData.regions,  skipCols: SKIP_REGIONS, skipFirstGrad: new Set([TO_RUB_CI]) },
    { label: 'Подразделения', rows: fileData.subdivs,  skipCols: SKIP_SUBDIVS, skipFirstGrad: new Set() },
    { label: 'Магазины',      rows: filteredStores,    skipCols: SKIP_STORES,  skipFirstGrad: new Set() },
  ];

  const headers = fileData.headers;

  views.forEach(({ label, rows, skipCols, skipFirstGrad }) => {
    if (!rows || rows.length === 0) return;

    const visHeaders = headers.filter((_, ci) => !skipCols.has(ci));
    const visIndices = headers.map((_, ci) => ci).filter(ci => !skipCols.has(ci));

    const scales = computeScales(rows, headers, skipFirstGrad);

    const wsData = [visHeaders];
    rows.forEach(row => {
      wsData.push(visHeaders.map(h => {
        const v = row[h];
        if (typeof v !== 'number') return v !== null && v !== undefined ? v : '';
        // All numbers: integer (no decimals), spaces as thousands separator
        if (h === 'ТО руб.') return Math.round(v);
        if (isPercentHeader(h)) return parseFloat((v * 100).toFixed(1));
        // Other numbers: round to integer
        return Number.isInteger(v) ? v : parseFloat(v.toFixed(0));
      }));
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

    // Apply number format with space thousands separator to all numeric cells
    for (let ri = 1; ri < wsData.length; ri++) {
      visIndices.forEach((ci, vci) => {
        const cellAddr = XLSXStyle.utils.encode_cell({ r: ri, c: vci });
        if (!ws[cellAddr]) return;
        const cellVal = ws[cellAddr].v;
        if (typeof cellVal !== 'number') return;

        const row = rows[ri - 1];
        const val = row[`_c${ci}`];
        const invert = COLS_HIGH_BAD.has(ci);
        let bgHex = null;
        if (typeof val === 'number' && scales[ci] && (COLS_HIGH_GOOD.has(ci) || COLS_HIGH_BAD.has(ci))) {
          if (!(ri === 1 && skipFirstGrad.has(ci))) {
            bgHex = gradientHex(val, scales[ci].min, scales[ci].max, invert);
          }
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

// ─── Main SalesPage component ──────────────────────────────────────────────────
const REGIONS_SKIP_FIRST_GRAD = new Set([TO_RUB_CI]);

export default function SalesPage({ fileData, title }) {
  const [activeView, setActiveView] = useState('regions');
  const [storeFilters, setStoreFilters] = useState({});
  const [subdivFilters, setSubdivFilters] = useState({});

  if (!fileData) {
    return (
      <div className="p-6 text-gray-500 text-sm">
        Загрузите файл отчёта по продажам ({title}).
      </div>
    );
  }

  const { headers, stores: rawStores, subdivs, regions, periods } = fileData;
  const periodInfo = periods && periods.length > 0 ? periods[0] : '';

  // Filter out closed stores
  const storeHeader = headers[3] || '';
  const stores = useMemo(() => {
    return (rawStores || []).filter(row => {
      const storeNum = row[storeHeader];
      const n = storeNum !== null && storeNum !== undefined ? Number(storeNum) : NaN;
      return !CLOSED_STORES.has(n);
    });
  }, [rawStores, storeHeader]);

  const subdivHeader = headers[1] || '';
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
          { key: 'top15',   label: 'Топ-15 LFL' },
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
            skipFirstGradientForCols={REGIONS_SKIP_FIRST_GRAD}
            stickyColCi={STICKY_COL_CI.regions}
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
              regionLabel={title}
            />
          </div>
        )}
      </div>
    </div>
  );
}
