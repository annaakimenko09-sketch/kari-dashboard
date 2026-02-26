import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx-js-style';
import { Download } from 'lucide-react';

// Color: higher value = red (worse), lower = green (better)
// Exception: c5 (% ПП с правильным ценником) — higher = green (better)
const INVERTED_COLS = new Set(['c5']); // higher is better

function pctColor(val, min, max, colKey) {
  if (val === null || val === undefined) return {};
  if (max === min) return { backgroundColor: '#fef9c3', color: '#713f12' };
  const ratio = (val - min) / (max - min);
  const isInverted = INVERTED_COLS.has(colKey);
  const badRatio = isInverted ? 1 - ratio : ratio;
  if (badRatio >= 0.67) return { backgroundColor: '#fee2e2', color: '#991b1b' };
  if (badRatio >= 0.33) return { backgroundColor: '#fef9c3', color: '#713f12' };
  return { backgroundColor: '#dcfce7', color: '#14532d' };
}

function fmtPct(val) {
  if (val === null || val === undefined) return '—';
  return val.toFixed(1) + '%';
}

function buildColorScale(rows, colKey) {
  const vals = rows.map(r => r[colKey]).filter(v => v !== null);
  return {
    min: Math.min(...vals),
    max: Math.max(...vals),
  };
}

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) return <span className="ml-1 opacity-30">↕</span>;
  return <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
}

// labelCols: which text columns to show before the % columns
function DataTable({ rows, columns, sortField, sortDir, onToggleSort, colorScales, labelCols }) {
  if (rows.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>;
  return (
    <div className="overflow-x-auto">
      <table className="text-sm" style={{ tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr className="border-b border-gray-100">
            {labelCols.map(lc => (
              <th key={lc.key} className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ width: lc.width || 90, wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.2' }}>
                {lc.label}
              </th>
            ))}
            {columns.map(col => (
              <th
                key={col.key}
                className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                style={{ width: 100, whiteSpace: 'normal', lineHeight: '1.2', wordBreak: 'break-word' }}
                onClick={() => onToggleSort(col.key)}
              >
                {col.label} <SortIcon field={col.key} sortField={sortField} sortDir={sortDir} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              {labelCols.map(lc => (
                <td key={lc.key} className="px-2 py-2 text-center text-gray-700 text-xs font-medium" style={{ wordBreak: 'break-word' }}>
                  {r[lc.key] || '—'}
                </td>
              ))}
              {columns.map(col => {
                const scale = colorScales[col.key] || { min: 0, max: 100 };
                return (
                  <td key={col.key} className="px-2 py-2 text-center">
                    <span
                      className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                      style={pctColor(r[col.key], scale.min, scale.max, col.key)}
                    >
                      {fmtPct(r[col.key])}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Label columns per tab
const LABEL_COLS = {
  regions: [{ key: 'region', label: 'Регион', width: 80 }],
  subdivs: [{ key: 'region', label: 'Регион', width: 70 }, { key: 'subdiv', label: 'Подразделение', width: 110 }],
  stores:  [{ key: 'region', label: 'Регион', width: 60 }, { key: 'subdiv', label: 'Подразд.', width: 90 }, { key: 'store', label: 'Магазин', width: 120 }],
};

const SELECT_CLS = 'text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-gray-400';

export default function PricingPage({ region }) {
  const { spbPricing, belPricing } = useData();
  const data = region === 'СПБ' ? spbPricing : belPricing;

  const [activeTab, setActiveTab] = useState('regions');
  const [sortField, setSortField] = useState('c0');
  const [sortDir, setSortDir]   = useState('desc');

  // Filters for stores tab
  const [storeSubdivFilter, setStoreSubdivFilter] = useState('');
  const [storeNameFilter, setStoreNameFilter]     = useState('');

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  // Reset store filters when switching tabs
  function handleTabChange(key) {
    setActiveTab(key);
    if (key !== 'stores') {
      setStoreSubdivFilter('');
      setStoreNameFilter('');
    }
  }

  const columns = data?.columns || [];

  const sortedRegions = useMemo(() => {
    if (!data) return [];
    return [...data.regions].sort((a, b) => {
      const av = a[sortField] ?? -1;
      const bv = b[sortField] ?? -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [data, sortField, sortDir]);

  const sortedSubdivs = useMemo(() => {
    if (!data) return [];
    return [...data.subdivisions].sort((a, b) => {
      const av = a[sortField] ?? -1;
      const bv = b[sortField] ?? -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [data, sortField, sortDir]);

  const sortedStores = useMemo(() => {
    if (!data) return [];
    return [...data.stores].sort((a, b) => {
      const av = a[sortField] ?? -1;
      const bv = b[sortField] ?? -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [data, sortField, sortDir]);

  // Subdivision options for stores filter
  const subdivOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.stores.map(r => r.subdiv).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  // Store name options — filtered by selected subdiv
  const storeOptions = useMemo(() => {
    if (!data) return [];
    let rows = data.stores;
    if (storeSubdivFilter) rows = rows.filter(r => r.subdiv === storeSubdivFilter);
    const set = new Set(rows.map(r => r.store).filter(Boolean));
    return Array.from(set).sort();
  }, [data, storeSubdivFilter]);

  // Filtered+sorted stores (for table display and export)
  const filteredStores = useMemo(() => {
    let rows = sortedStores;
    if (storeSubdivFilter) rows = rows.filter(r => r.subdiv === storeSubdivFilter);
    if (storeNameFilter)   rows = rows.filter(r => r.store === storeNameFilter);
    return rows;
  }, [sortedStores, storeSubdivFilter, storeNameFilter]);

  // Color scales per tab (use filteredStores for stores tab)
  const colorScales = useMemo(() => {
    const activeRows =
      activeTab === 'regions'  ? sortedRegions  :
      activeTab === 'subdivs'  ? sortedSubdivs  :
      filteredStores;
    const scales = {};
    for (const col of columns) {
      scales[col.key] = buildColorScale(activeRows, col.key);
    }
    return scales;
  }, [activeTab, sortedRegions, sortedSubdivs, filteredStores, columns]);

  function exportToExcel(rows, sheetName) {
    if (!data || rows.length === 0) return;
    const labelCols = LABEL_COLS[activeTab];
    const wb = XLSX.utils.book_new();
    const header = [...labelCols.map(lc => lc.label), ...columns.map(c => c.label)];
    const dataRows = rows.map(r => [...labelCols.map(lc => r[lc.key]), ...columns.map(c => r[c.key])]);
    const labelCount = labelCols.length;
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

    // Style header row
    header.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (ws[addr]) {
        ws[addr].s = {
          font: { bold: true, color: { rgb: '374151' } },
          fill: { fgColor: { rgb: 'F3F4F6' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: {
            bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
          },
        };
      }
    });

    // Build color scales per column
    const scales = {};
    for (const col of columns) scales[col.key] = buildColorScale(rows, col.key);

    // Gradient color: interpolate green→yellow→red (or reverse for inverted cols)
    function gradientColor(val, min, max, colKey) {
      if (val === null || val === undefined) return { bg: 'FFFFFF', fg: '374151' };
      if (max === min) return { bg: 'FEF9C3', fg: '713F12' };
      const ratio = (val - min) / (max - min); // 0=min, 1=max
      const isInverted = INVERTED_COLS.has(colKey);
      // badRatio: 0=best(green), 1=worst(red)
      const badRatio = isInverted ? 1 - ratio : ratio;

      let r, g, b;
      if (badRatio <= 0.5) {
        // green (#16a34a) → yellow (#ca8a04)
        const t = badRatio / 0.5;
        r = Math.round(22  + t * (202 - 22));
        g = Math.round(163 + t * (138 - 163));
        b = Math.round(74  + t * (4   - 74));
      } else {
        // yellow (#ca8a04) → red (#dc2626)
        const t = (badRatio - 0.5) / 0.5;
        r = Math.round(202 + t * (220 - 202));
        g = Math.round(138 + t * (38  - 138));
        b = Math.round(4   + t * (38  - 4));
      }

      // Light background tint: mix color with white at 25%
      const bgR = Math.round(r + (255 - r) * 0.65);
      const bgG = Math.round(g + (255 - g) * 0.65);
      const bgB = Math.round(b + (255 - b) * 0.65);

      const toHex = v => v.toString(16).padStart(2, '0').toUpperCase();
      return {
        bg: toHex(bgR) + toHex(bgG) + toHex(bgB),
        fg: toHex(r) + toHex(g) + toHex(b),
      };
    }

    dataRows.forEach((row, ri) => {
      // Style label cells
      labelCols.forEach((lc, ci) => {
        const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
        if (ws[addr]) {
          ws[addr].s = {
            font: { color: { rgb: '374151' } },
            alignment: { horizontal: 'center', vertical: 'center' },
          };
        }
      });

      // Style % cells with gradient
      columns.forEach((col, ci) => {
        const addr = XLSX.utils.encode_cell({ r: ri + 1, c: labelCount + ci });
        const val = rows[ri][col.key];
        const sc = scales[col.key];
        const { bg, fg } = gradientColor(val, sc.min, sc.max, col.key);
        if (ws[addr]) {
          ws[addr].s = {
            fill: { fgColor: { rgb: bg } },
            font: { color: { rgb: fg }, bold: false },
            alignment: { horizontal: 'center', vertical: 'center' },
            numFmt: '0.0%',
          };
          // Store as fraction for proper % format
          if (typeof ws[addr].v === 'number') {
            ws[addr].v = ws[addr].v / 100;
            ws[addr].t = 'n';
            ws[addr].z = '0.0%';
          }
        }
      });
    });

    // Column widths
    const colWidths = [
      ...labelCols.map(lc => ({ wch: lc.key === 'store' ? 12 : lc.key === 'subdiv' ? 10 : 8 })),
      ...columns.map(() => ({ wch: 16 })),
    ];
    ws['!cols'] = colWidths;

    // Row height for header
    ws['!rows'] = [{ hpt: 40 }];

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Цены_полупары_${region}_${sheetName}.xlsx`);
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">
          Загрузите файл «Рейтинг переоценки и выставления полупарков» через «Загрузить данные»
        </p>
      </div>
    );
  }

  const TABS = [
    { key: 'regions', label: `Регионы (${sortedRegions.length})` },
    { key: 'subdivs', label: `Подразделения (${sortedSubdivs.length})` },
    { key: 'stores',  label: `Магазины (${sortedStores.length})` },
  ];

  const activeRows =
    activeTab === 'regions' ? sortedRegions :
    activeTab === 'subdivs' ? sortedSubdivs :
    filteredStores;

  const activeSheetName =
    activeTab === 'regions' ? 'Регионы' :
    activeTab === 'subdivs' ? 'Подразделения' :
    'Магазины';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Цены на полупарах — {region}</p>
            <p className="text-base font-bold text-gray-800">{data.fileName}</p>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-md" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>Хуже — красный</span>
            <span className="px-2 py-1 rounded-md" style={{ backgroundColor: '#fef9c3', color: '#713f12' }}>Средний — жёлтый</span>
            <span className="px-2 py-1 rounded-md" style={{ backgroundColor: '#dcfce7', color: '#14532d' }}>Лучше — зелёный</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700">{activeSheetName}</h2>
            {/* Filters — only for stores tab */}
            {activeTab === 'stores' && (
              <>
                {subdivOptions.length > 1 && (
                  <select
                    value={storeSubdivFilter}
                    onChange={e => { setStoreSubdivFilter(e.target.value); setStoreNameFilter(''); }}
                    className={SELECT_CLS}
                  >
                    <option value="">Все подразделения</option>
                    {subdivOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {storeOptions.length > 1 && (
                  <select
                    value={storeNameFilter}
                    onChange={e => setStoreNameFilter(e.target.value)}
                    className={SELECT_CLS}
                  >
                    <option value="">Все магазины</option>
                    {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {(storeSubdivFilter || storeNameFilter) && (
                  <span className="text-xs text-gray-400">{filteredStores.length} из {sortedStores.length}</span>
                )}
              </>
            )}
          </div>
          <button
            onClick={() => exportToExcel(activeRows, activeSheetName)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#f97316' }}
          >
            <Download size={13} /> Excel
          </button>
        </div>
        <DataTable
          rows={activeRows}
          columns={columns}
          sortField={sortField}
          sortDir={sortDir}
          onToggleSort={toggleSort}
          colorScales={colorScales}
          labelCols={LABEL_COLS[activeTab]}
        />
      </div>
    </div>
  );
}
