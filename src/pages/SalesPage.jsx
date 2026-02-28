import { useState, useMemo } from 'react';
import * as XLSXStyle from 'xlsx-js-style';
import { COLS_HIGH_GOOD, COLS_HIGH_BAD } from '../utils/salesParser';

// Columns to hide per view (0-based indices matching Рег sheet headers)
// A=0 Регион, B=1 Подразделение, C=2 (0/1 flag), D=3 Магазин, E=4 ТЦ
const SKIP_REGIONS = new Set([1, 2, 3]);        // hide B, C, D
const SKIP_SUBDIVS = new Set([0, 2, 3, 4]);     // hide A, C, D, E  → only Подразделение + metrics
const SKIP_STORES  = new Set([0, 2]);            // hide A, C

// ─── Gradient helpers ──────────────────────────────────────────────────────────
// Pastel scale: red(248,105,107) → white(255,255,255) → green(99,190,123)
// ratio 0 = red, 0.5 = white, 1 = green
function computeRGB(ratio) {
  const RED   = [248, 105, 107];
  const WHITE = [255, 255, 255];
  const GREEN = [99,  190, 123];
  let r, g, b;
  if (ratio <= 0.5) {
    const t = ratio / 0.5;
    r = Math.round(RED[0] + (WHITE[0] - RED[0]) * t);
    g = Math.round(RED[1] + (WHITE[1] - RED[1]) * t);
    b = Math.round(RED[2] + (WHITE[2] - RED[2]) * t);
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = Math.round(WHITE[0] + (GREEN[0] - WHITE[0]) * t);
    g = Math.round(WHITE[1] + (GREEN[1] - WHITE[1]) * t);
    b = Math.round(WHITE[2] + (GREEN[2] - WHITE[2]) * t);
  }
  return [r, g, b];
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

// ─── Scale computation — per-column, from the rows being displayed ─────────────
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

// ─── Format cell value for display ────────────────────────────────────────────
function fmtVal(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toLocaleString('ru-RU');
    return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  }
  return String(v);
}

// ─── SortableTable ─────────────────────────────────────────────────────────────
function SortableTable({ rows, headers, skipCols, showFilters = false, filterState = {}, onFilterChange }) {
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  // Compute scales from the rows passed in (per-view, per-column)
  const scales = useMemo(() => computeScales(rows, headers), [rows, headers]);

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

  // Which visible columns should show filter inputs (string/text columns only)
  const textColIndices = new Set(
    headers
      .map((_, ci) => ci)
      .filter(ci => !skipCols.has(ci) && ci <= 4)
  );

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full border-collapse" style={{ tableLayout: 'auto', minWidth: '600px' }}>
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {visibleHeaders.map((h, i) => (
              <th
                key={i}
                onClick={() => handleSort(h)}
                className="px-2 py-1.5 text-center font-semibold text-gray-600 cursor-pointer select-none hover:bg-gray-100"
                style={{ fontSize: '11px', maxWidth: '80px', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2', verticalAlign: 'bottom' }}
              >
                {h}
                {sortField === h ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
          {showFilters && (
            <tr className="bg-gray-50 border-b border-gray-200">
              {visibleHeaders.map((h, i) => {
                const ci = headers.indexOf(h);
                if (!textColIndices.has(ci)) return <th key={i} className="px-1 py-0.5" />;
                return (
                  <th key={i} className="px-1 py-0.5">
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
                let style = {};
                if (typeof val === 'number' && scales[ci]) {
                  const invert = COLS_HIGH_BAD.has(ci);
                  if (COLS_HIGH_GOOD.has(ci) || COLS_HIGH_BAD.has(ci)) {
                    style = gradientStyle(val, scales[ci].min, scales[ci].max, invert);
                  }
                }
                return (
                  <td key={i} className="px-2 py-1 text-center" style={{ ...style, fontSize: '11px' }}>
                    {fmtVal(row[h])}
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

// ─── Excel export ──────────────────────────────────────────────────────────────
function exportToExcel(fileData, title) {
  const wb = XLSXStyle.utils.book_new();

  const views = [
    { label: 'Регионы',      rows: fileData.regions, skipCols: SKIP_REGIONS },
    { label: 'Подразделения', rows: fileData.subdivs, skipCols: SKIP_SUBDIVS },
    { label: 'Магазины',     rows: fileData.stores,  skipCols: SKIP_STORES  },
  ];

  const headers = fileData.headers;

  views.forEach(({ label, rows, skipCols }) => {
    if (!rows || rows.length === 0) return;

    const visHeaders = headers.filter((_, ci) => !skipCols.has(ci));
    const visIndices = headers.map((_, ci) => ci).filter(ci => !skipCols.has(ci));

    // Per-view, per-column scales
    const scales = computeScales(rows, headers);

    const wsData = [visHeaders];
    rows.forEach(row => {
      wsData.push(visHeaders.map(h => {
        const v = row[h];
        return v !== null && v !== undefined ? v : '';
      }));
    });

    const ws = XLSXStyle.utils.aoa_to_sheet(wsData);

    for (let ri = 1; ri < wsData.length; ri++) {
      visIndices.forEach((ci, vci) => {
        const row = rows[ri - 1];
        const val = row[`_c${ci}`];
        if (typeof val !== 'number') return;
        if (!scales[ci]) return;
        if (!COLS_HIGH_GOOD.has(ci) && !COLS_HIGH_BAD.has(ci)) return;

        const invert = COLS_HIGH_BAD.has(ci);
        const hex = gradientHex(val, scales[ci].min, scales[ci].max, invert);
        if (!hex) return;

        const cellAddr = XLSXStyle.utils.encode_cell({ r: ri, c: vci });
        if (!ws[cellAddr]) ws[cellAddr] = { v: val, t: 'n' };
        ws[cellAddr].s = {
          fill: { patternType: 'solid', fgColor: { rgb: hex } },
          font: { color: { rgb: '111827' } },
          alignment: { horizontal: 'center' },
        };
      });
    }

    XLSXStyle.utils.book_append_sheet(wb, ws, label.substring(0, 31));
  });

  XLSXStyle.writeFile(wb, `${title}.xlsx`);
}

// ─── Main SalesPage component ──────────────────────────────────────────────────
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

  const { headers, stores, subdivs, regions, periods } = fileData;
  const periodInfo = periods && periods.length > 0 ? periods[0] : '';

  const filteredStores = useMemo(() => {
    return (stores || []).filter(row =>
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
          onClick={() => exportToExcel(fileData, title)}
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
            <span className="ml-1 text-gray-400 font-normal">({tabCounts[tab.key]})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {activeView === 'regions' && (
          <SortableTable
            rows={regions || []}
            headers={headers}
            skipCols={SKIP_REGIONS}
          />
        )}
        {activeView === 'subdivs' && (
          <SortableTable
            rows={filteredSubdivs}
            headers={headers}
            skipCols={SKIP_SUBDIVS}
            showFilters={true}
            filterState={subdivFilters}
            onFilterChange={(h, v) => setSubdivFilters(prev => ({ ...prev, [h]: v }))}
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
          />
        )}
      </div>
    </div>
  );
}
