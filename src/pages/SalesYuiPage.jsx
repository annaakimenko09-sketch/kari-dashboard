import { useState, useMemo } from 'react';
import * as XLSXStyle from 'xlsx-js-style';
import {
  YUI_COLS_HIGH_GOOD,
  YUI_COLS_HIGH_BAD,
  YUI_PERCENT_COLS,
  YUI_INTEGER_COLS,
} from '../utils/salesYuiParser';

// Column visibility per view
// A=0 Регион(файла), B=1 Подразделение, C=2 Магазин, D=3 ТЦ
// В разделе Регионы: col A = «СПБ»/«БЕЛ» (регион файла), col B = «ИТОГО», col C = «РЕГИОН», col D = реальное название (Итого по СИБ и т.д.)
// В разделе Подразделения: col A = регион файла, col C = «ИМ», col D = ТЦ
// → Регионы: показываем col D (sticky) + метрики; скрываем A,B,C
// → Подразделения: показываем col B (sticky) + метрики; скрываем A,C (col D оставляем)
// → Магазины: показываем col B,C,D + метрики; скрываем A
const SKIP_REGIONS = new Set([0, 1, 2]);   // скрыть A(регион файла), B(ИТОГО), C(РЕГИОН)
const SKIP_SUBDIVS = new Set([0, 2]);      // скрыть A(регион файла), C(ИМ)
const SKIP_STORES  = new Set([0]);         // скрыть A(регион файла)

// Sticky column ci per view
const STICKY_COL_CI = {
  regions: 3,  // ТЦ — содержит «Итого по СИБ», «Итого по СПБ» и т.д.
  subdivs: 1,  // Подразделение
  stores:  3,  // ТЦ
};

// Closed stores
const CLOSED_STORES = new Set([11596, 11787, 50015]);

// Top-15 column for ЮИ
const TOP15_HEADER = 'Доля ЮИ %';
const TOP15_CI = 4;

// Top-15 visible columns: Подразд(1), Магазин(2), ТЦ(3), Доля ЮИ%(4), ТО ЮИ/ТО(5), План%(9), ТО ЮИ руб.(12)
const TOP15_COLS = [1, 2, 3, 4, 5, 9, 12];

// ─── Format helpers ────────────────────────────────────────────────────────────
function fmtVal(v, ci) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    if (YUI_INTEGER_COLS.has(ci)) return Math.round(v).toLocaleString('ru-RU');
    if (YUI_PERCENT_COLS.has(ci)) {
      const pct = v * 100;
      return pct.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + '%';
    }
    if (Number.isInteger(v)) return v.toLocaleString('ru-RU');
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  }
  return String(v);
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

function computeScales(rows, headers) {
  const scales = {};
  headers.forEach((_, ci) => {
    const vals = rows
      .map(r => r[`_c${ci}`])
      .filter(v => v !== null && v !== undefined && typeof v === 'number');
    if (vals.length === 0) return;
    scales[ci] = { min: Math.min(...vals), max: Math.max(...vals) };
  });
  return scales;
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
  labelOverrides = {},  // { ci: 'Новый заголовок' }
  hideCols = new Set(), // дополнительные ci для скрытия (runtime, напр. для БЕЛ)
}) {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const scales = useMemo(() => computeScales(rows, headers), [rows, headers]);

  function handleSort(h) {
    if (sortField === h) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(h);
      setSortDir('asc');
    }
  }

  const effectiveSkip = hideCols.size > 0
    ? new Set([...skipCols, ...hideCols])
    : skipCols;
  const visibleHeaders = headers.filter((_, ci) => !effectiveSkip.has(ci));

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
              const isTextCol = ci <= 3 && !effectiveSkip.has(ci);
              const displayLabel = labelOverrides[ci] || h;
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
                    {displayLabel}{sortField === h ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
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
                const isTextCol = ci <= 3;
                const isSubdivCol = h === subdivHeader && subdivOptions.length > 0;

                const stickyStyle = isSticky ? {
                  position: 'sticky', left: 0, zIndex: 3,
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
                if (typeof val === 'number' && scales[ci]) {
                  if (YUI_COLS_HIGH_GOOD.has(ci) || YUI_COLS_HIGH_BAD.has(ci)) {
                    style = gradientStyle(val, scales[ci].min, scales[ci].max, YUI_COLS_HIGH_BAD.has(ci));
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
                        position: 'sticky', left: 0, zIndex: 1,
                        backgroundColor: style.backgroundColor || '#ffffff',
                        boxShadow: '2px 0 4px rgba(0,0,0,0.08)',
                      } : {}),
                    }}
                  >
                    {fmtVal(val, ci)}
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

// ─── Top15 sub-table (sortable) ────────────────────────────────────────────────
function Top15SubTable({ rows, headers, scales, label, labelColor }) {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  const visHeaders = TOP15_COLS.map(ci => headers[ci]).filter(Boolean);

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
        <table className="text-xs w-full border-collapse" style={{ minWidth: '500px' }}>
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
                {TOP15_COLS.map((ci, i) => {
                  const h = headers[ci];
                  if (!h) return null;
                  const val = row[`_c${ci}`];
                  let style = {};
                  if (typeof val === 'number' && scales[ci]) {
                    if (YUI_COLS_HIGH_GOOD.has(ci) || YUI_COLS_HIGH_BAD.has(ci)) {
                      style = gradientStyle(val, scales[ci].min, scales[ci].max, YUI_COLS_HIGH_BAD.has(ci));
                    }
                  }
                  return (
                    <td key={i} className="px-2 py-1 text-center" style={{ ...style, fontSize: '11px' }}>
                      {fmtVal(val, ci)}
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

function Top15Table({ stores, headers }) {
  const withVal = useMemo(() => {
    return (stores || []).filter(row => {
      const v = row[TOP15_HEADER];
      return v !== null && v !== undefined && typeof v === 'number';
    });
  }, [stores]);

  const byVal = useMemo(() => {
    return [...withVal].sort((a, b) => (b[TOP15_HEADER] ?? -Infinity) - (a[TOP15_HEADER] ?? -Infinity));
  }, [withVal]);

  const best15  = byVal.slice(0, 15);
  const worst15 = [...byVal].reverse().slice(0, 15);
  const scales  = useMemo(() => computeScales(stores || [], headers), [stores, headers]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Top15SubTable rows={best15}  headers={headers} scales={scales} label="15 лучших по Доля ЮИ %"  labelColor="#16a34a" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <Top15SubTable rows={worst15} headers={headers} scales={scales} label="15 худших по Доля ЮИ %" labelColor="#dc2626" />
      </div>
    </div>
  );
}

// ─── Excel export ──────────────────────────────────────────────────────────────
function exportToExcel(fileData, title, filteredStores, extraHideCols = new Set()) {
  const wb = XLSXStyle.utils.book_new();
  const views = [
    { label: 'Регионы',       rows: fileData.regions, skipCols: SKIP_REGIONS },
    { label: 'Подразделения', rows: fileData.subdivs, skipCols: SKIP_SUBDIVS },
    { label: 'Магазины',      rows: filteredStores,   skipCols: SKIP_STORES  },
  ];
  const headers = fileData.headers;

  views.forEach(({ label, rows, skipCols }) => {
    if (!rows || rows.length === 0) return;
    const effectiveSkip = extraHideCols.size > 0 ? new Set([...skipCols, ...extraHideCols]) : skipCols;
    const visHeaders = headers.filter((_, ci) => !effectiveSkip.has(ci));
    const visIndices = headers.map((_, ci) => ci).filter(ci => !effectiveSkip.has(ci));
    const scales = computeScales(rows, headers);

    const wsData = [visHeaders];
    rows.forEach(row => {
      wsData.push(visHeaders.map((h, vi) => {
        const ci = visIndices[vi];
        const v = row[h];
        if (typeof v !== 'number') return v !== null && v !== undefined ? v : '';
        if (YUI_INTEGER_COLS.has(ci)) return Math.round(v);
        if (YUI_PERCENT_COLS.has(ci)) return parseFloat((v * 100).toFixed(1));
        return Number.isInteger(v) ? v : parseFloat(v.toFixed(0));
      }));
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

    for (let ri = 1; ri < wsData.length; ri++) {
      visIndices.forEach((ci, vci) => {
        const cellAddr = XLSXStyle.utils.encode_cell({ r: ri, c: vci });
        if (!ws[cellAddr]) return;
        if (typeof ws[cellAddr].v !== 'number') return;
        const val = rows[ri - 1][`_c${ci}`];
        let bgHex = null;
        if (typeof val === 'number' && scales[ci] && (YUI_COLS_HIGH_GOOD.has(ci) || YUI_COLS_HIGH_BAD.has(ci))) {
          bgHex = gradientHex(val, scales[ci].min, scales[ci].max, YUI_COLS_HIGH_BAD.has(ci));
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

// ─── Main SalesYuiPage ─────────────────────────────────────────────────────────
export default function SalesYuiPage({ fileData, title }) {
  const [activeView, setActiveView] = useState('regions');
  const [storeFilters, setStoreFilters] = useState({});

  if (!fileData) {
    return (
      <div className="p-6 text-gray-500 text-sm">
        Загрузите файл отчёта ЮИ ({title}).
      </div>
    );
  }

  const { headers, stores: rawStores, subdivs, regions, periods, fileRegion } = fileData;
  const periodInfo = periods && periods.length > 0 ? periods[0] : '';

  // БЕЛ: скрываем Рассрочка % (ci=6) во всех таблицах
  const isBel = fileRegion === 'БЕЛ';
  const belHideCols = isBel ? new Set([6]) : new Set();

  // Для таблицы Регионов col D (ci=3) содержит реальное название (Итого по СИБ и т.д.)
  const regionLabelOverrides = { 3: 'Регион' };

  // Filter closed stores (col 2 = Магазин)
  const storeHeader = headers[2] || '';
  const stores = useMemo(() => {
    return (rawStores || []).filter(row => {
      const n = row[storeHeader];
      return !CLOSED_STORES.has(Number(n));
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

  const tabCounts = {
    regions: regions?.length ?? 0,
    subdivs: subdivs?.length ?? 0,
    stores:  stores?.length ?? 0,
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-800">{title}</h1>
          {periodInfo && <p className="text-xs text-gray-500 mt-0.5">{periodInfo}</p>}
        </div>
        <button
          onClick={() => exportToExcel(fileData, title, filteredStores, belHideCols)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
          style={{ backgroundColor: '#16a34a' }}
        >
          Выгрузить Excel
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'regions', label: 'Регионы' },
          { key: 'subdivs', label: 'Подразделения' },
          { key: 'stores',  label: 'Магазины' },
          { key: 'top15',   label: 'Топ-15 Доля ЮИ' },
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

      <div className={activeView !== 'top15' ? 'bg-white rounded-xl border border-gray-200 overflow-hidden' : ''}>
        {activeView === 'regions' && (
          <SortableTable
            rows={regions || []}
            headers={headers}
            skipCols={SKIP_REGIONS}
            stickyColCi={STICKY_COL_CI.regions}
            labelOverrides={regionLabelOverrides}
            hideCols={belHideCols}
          />
        )}
        {activeView === 'subdivs' && (
          <SortableTable
            rows={subdivs || []}
            headers={headers}
            skipCols={SKIP_SUBDIVS}
            stickyColCi={STICKY_COL_CI.subdivs}
            hideCols={belHideCols}
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
            hideCols={belHideCols}
          />
        )}
        {activeView === 'top15' && (
          <Top15Table stores={stores} headers={headers} />
        )}
      </div>
    </div>
  );
}
