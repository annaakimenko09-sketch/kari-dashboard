import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';

// Color: higher value = red (worse), lower = green (better)
// Exception: c5 (% ПП с правильным ценником) — higher = green (better)
const INVERTED_COLS = new Set(['c5']); // higher is better

function pctColor(val, min, max, colKey) {
  if (val === null || val === undefined) return {};
  if (max === min) return { backgroundColor: '#fef9c3', color: '#713f12' };
  const ratio = (val - min) / (max - min);
  const isInverted = INVERTED_COLS.has(colKey);
  // ratio=1 means max (worst for normal cols, best for inverted)
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

function DataTable({ rows, columns, sortField, sortDir, onToggleSort, colorScales }) {
  if (rows.length === 0) return <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Регион</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Подразделение</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Магазин</th>
            {columns.map(col => (
              <th
                key={col.key}
                className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800 whitespace-nowrap"
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
              <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.region || '—'}</td>
              <td className="px-3 py-2 text-gray-700 text-xs whitespace-nowrap">{r.subdiv || '—'}</td>
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{r.store || '—'}</td>
              {columns.map(col => {
                const scale = colorScales[col.key] || { min: 0, max: 100 };
                return (
                  <td key={col.key} className="px-3 py-2 text-right">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
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

export default function PricingPage({ region }) {
  const { spbPricing, belPricing } = useData();
  const data = region === 'СПБ' ? spbPricing : belPricing;

  const [activeTab, setActiveTab] = useState('regions');
  const [sortField, setSortField] = useState('c0');
  const [sortDir, setSortDir]   = useState('desc');

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
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

  // Color scales per tab
  const colorScales = useMemo(() => {
    const activeRows =
      activeTab === 'regions'  ? sortedRegions  :
      activeTab === 'subdivs'  ? sortedSubdivs  :
      sortedStores;
    const scales = {};
    for (const col of columns) {
      scales[col.key] = buildColorScale(activeRows, col.key);
    }
    return scales;
  }, [activeTab, sortedRegions, sortedSubdivs, sortedStores, columns]);

  function exportToExcel(rows, sheetName) {
    if (!data || rows.length === 0) return;
    const wb = XLSX.utils.book_new();
    const header = ['Регион', 'Подразделение', 'Магазин', ...columns.map(c => c.label)];
    const dataRows = rows.map(r => [r.region, r.subdiv, r.store, ...columns.map(c => r[c.key])]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

    // Conditional formatting via cell styles (xlsx-js-style not available, use background fill via color logic)
    // Build color scale for export
    const scales = {};
    for (const col of columns) scales[col.key] = buildColorScale(rows, col.key);

    // Apply styles to data cells (columns D onwards = col index 3+)
    dataRows.forEach((row, ri) => {
      columns.forEach((col, ci) => {
        const cellAddr = XLSX.utils.encode_cell({ r: ri + 1, c: 3 + ci });
        const val = rows[ri][col.key];
        const sc = scales[col.key];
        const style = pctColor(val, sc.min, sc.max, col.key);
        const cell = ws[cellAddr];
        if (cell && style.backgroundColor) {
          // Convert hex color to ARGB for xlsx
          const hex = style.backgroundColor.replace('#', '');
          cell.s = {
            fill: { fgColor: { rgb: hex.toUpperCase() } },
            font: { color: { rgb: (style.color || '#000000').replace('#', '').toUpperCase() } },
          };
        }
      });
    });

    // Format % columns as number
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let ri = 1; ri <= range.e.r; ri++) {
      for (let ci = 3; ci <= range.e.c; ci++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
        if (ws[addr] && typeof ws[addr].v === 'number') {
          ws[addr].z = '0.0"%"';
        }
      }
    }

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
    sortedStores;

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
            onClick={() => setActiveTab(key)}
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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">{activeSheetName}</h2>
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
        />
      </div>
    </div>
  );
}
