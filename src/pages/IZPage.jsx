import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx-js-style';
import { Download } from 'lucide-react';
import { SHEET_NAMES } from '../utils/izParser';

const SELECT_CLS = 'text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-gray-400';

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('ru-RU');
  return String(v);
}

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return v.toFixed(1) + '%';
}

// Gradient: low number = red (bad), high number = green (good)
function gradientStyle(val, min, max) {
  if (val === null || val === undefined || min === max) return {};
  const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
  // ratio=0 → red (bad/low), ratio=1 → green (good/high)
  let r, g, b;
  if (ratio <= 0.5) {
    const t = ratio / 0.5;
    r = Math.round(220 + t * (202 - 220));
    g = Math.round(38  + t * (138 - 38));
    b = Math.round(38  + t * (4   - 38));
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = Math.round(202 + t * (22 - 202));
    g = Math.round(138 + t * (163 - 138));
    b = Math.round(4   + t * (74  - 4));
  }
  const lr = Math.round(r + (255 - r) * 0.35);
  const lg = Math.round(g + (255 - g) * 0.35);
  const lb = Math.round(b + (255 - b) * 0.35);
  return { backgroundColor: `rgb(${lr},${lg},${lb})`, color: '#111827' };
}

function gradientHex(val, min, max) {
  if (val === null || val === undefined || min === max) return { bg: 'FFFFFF', fg: '111827' };
  const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
  let r, g, b;
  if (ratio <= 0.5) {
    const t = ratio / 0.5;
    r = Math.round(220 + t * (202 - 220));
    g = Math.round(38  + t * (138 - 38));
    b = Math.round(38  + t * (4   - 38));
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = Math.round(202 + t * (22 - 202));
    g = Math.round(138 + t * (163 - 138));
    b = Math.round(4   + t * (74  - 4));
  }
  const lr = Math.round(r + (255 - r) * 0.35);
  const lg = Math.round(g + (255 - g) * 0.35);
  const lb = Math.round(b + (255 - b) * 0.35);
  const toHex = v => v.toString(16).padStart(2, '0').toUpperCase();
  return { bg: toHex(lr) + toHex(lg) + toHex(lb), fg: '111827' };
}

function getScales(rows) {
  const ratingVals  = rows.map(r => r.rating).filter(v => v !== null);
  const scanVals    = rows.map(r => r.scanShare).filter(v => v !== null);
  return {
    ratingMin: ratingVals.length ? Math.min(...ratingVals) : 0,
    ratingMax: ratingVals.length ? Math.max(...ratingVals) : 0,
    scanMin:   scanVals.length   ? Math.min(...scanVals)   : 0,
    scanMax:   scanVals.length   ? Math.max(...scanVals)   : 0,
  };
}

// Reusable compact table for regions/subdivs/stores
function DataTable({ rows, columns, scales, sortField, sortDir, onSort }) {
  function SortIcon({ field }) {
    if (sortField !== field) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
      <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
        <thead>
          <tr className="border-b border-gray-200" style={{ backgroundColor: '#F9FAFB' }}>
            {columns.map(col => (
              <th
                key={col.key}
                className="px-3 py-2.5 text-center font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => onSort && onSort(col.key)}
              >
                {col.label}{onSort && <SortIcon field={col.key} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
              {columns.map(col => {
                if (col.key === 'rating') {
                  return (
                    <td key={col.key} className="px-3 py-2 text-center font-semibold"
                      style={gradientStyle(row.rating, scales.ratingMin, scales.ratingMax)}>
                      {fmtNum(row.rating)}
                    </td>
                  );
                }
                if (col.key === 'scanShare') {
                  return (
                    <td key={col.key} className="px-3 py-2 text-center font-semibold"
                      style={gradientStyle(row.scanShare, scales.scanMin, scales.scanMax)}>
                      {fmtPct(row.scanShare)}
                    </td>
                  );
                }
                if (col.key === 'tc') {
                  return <td key={col.key} className="px-3 py-2 text-left text-gray-700 max-w-[200px] truncate">{row.tc || '—'}</td>;
                }
                return (
                  <td key={col.key} className="px-3 py-2 text-center text-gray-700">
                    {row[col.key] !== null && row[col.key] !== undefined ? fmtNum(row[col.key]) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">Нет данных</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function IZPage({ region }) {
  const { spbIZ, belIZ } = useData();
  const data = region === 'СПБ' ? spbIZ : belIZ;

  const [activeSheet, setActiveSheet] = useState('День');
  const [subdivFilter, setSubdivFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [sortField, setSortField] = useState('rating');
  const [sortDir, setSortDir] = useState('asc');

  const activeSheetData = useMemo(() => {
    if (!data) return { regions: [], subdivs: [], stores: [] };
    return data.sheets?.[activeSheet] || { regions: [], subdivs: [], stores: [] };
  }, [data, activeSheet]);

  const period = data?.sheets?.[activeSheet]?.period || null;

  const subdivOptions = useMemo(() => {
    const s = new Set(activeSheetData.stores.map(r => r.subdiv).filter(Boolean));
    return [...s].sort();
  }, [activeSheetData]);

  const storeOptions = useMemo(() => {
    const filtered = subdivFilter
      ? activeSheetData.stores.filter(r => r.subdiv === subdivFilter)
      : activeSheetData.stores;
    const s = new Set(filtered.map(r => r.store).filter(Boolean));
    return [...s].sort();
  }, [activeSheetData, subdivFilter]);

  const filteredSorted = useMemo(() => {
    let rows = activeSheetData.stores;
    if (subdivFilter) rows = rows.filter(r => r.subdiv === subdivFilter);
    if (storeFilter)  rows = rows.filter(r => r.store === storeFilter);

    rows = [...rows].sort((a, b) => {
      const av = a[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      const bv = b[sortField] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv), 'ru')
        : String(bv).localeCompare(String(av), 'ru');
    });
    return rows;
  }, [activeSheetData, subdivFilter, storeFilter, sortField, sortDir]);

  const storeScales = useMemo(() => getScales(filteredSorted), [filteredSorted]);
  const regionScales = useMemo(() => getScales(activeSheetData.regions), [activeSheetData]);
  const subdivScales = useMemo(() => getScales(activeSheetData.subdivs), [activeSheetData]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  const REGION_COLS = [
    { key: 'region',    label: 'Регион' },
    { key: 'rating',    label: 'Рейтинг' },
    { key: 'izCount',   label: 'Кол-во ИЗ готовых к выдаче' },
    { key: 'scanShare', label: 'Доля сканирования' },
    { key: 'clicks',    label: 'Кол-во кликов' },
  ];

  const SUBDIV_COLS = [
    { key: 'region',    label: 'Регион' },
    { key: 'subdiv',    label: 'Подразделение' },
    { key: 'rating',    label: 'Рейтинг' },
    { key: 'izCount',   label: 'Кол-во ИЗ готовых к выдаче' },
    { key: 'scanShare', label: 'Доля сканирования' },
    { key: 'clicks',    label: 'Кол-во кликов' },
  ];

  const STORE_COLS = [
    { key: 'region',    label: 'Регион' },
    { key: 'subdiv',    label: 'Подразделение' },
    { key: 'store',     label: 'Магазин' },
    { key: 'tc',        label: 'ТЦ' },
    { key: 'rating',    label: 'Рейтинг' },
    { key: 'izCount',   label: 'Кол-во ИЗ готовых к выдаче' },
    { key: 'scanShare', label: 'Доля сканирования' },
    { key: 'clicks',    label: 'Кол-во кликов' },
  ];

  function exportToExcel() {
    if (!data) return;
    const wb = XLSX.utils.book_new();

    const headerStyle = {
      font: { bold: true, color: { rgb: '374151' } },
      fill: { fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
    };
    const cellStyle = {
      font: { color: { rgb: '374151' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };

    function applySheet(rows, headers, colKeys, scales, sheetName) {
      if (rows.length === 0) return;
      const ratingIdx  = colKeys.indexOf('rating');
      const scanIdx    = colKeys.indexOf('scanShare');

      const dataRows = rows.map(r => colKeys.map(k => {
        if (k === 'scanShare') return r.scanShare !== null ? r.scanShare / 100 : '';
        return r[k] !== null && r[k] !== undefined ? r[k] : '';
      }));

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

      headers.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (ws[addr]) ws[addr].s = headerStyle;
      });

      dataRows.forEach((_, ri) => {
        for (let ci = 0; ci < headers.length; ci++) {
          const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          if (!ws[addr]) continue;
          if (ci === ratingIdx) {
            const { bg, fg } = gradientHex(rows[ri].rating, scales.ratingMin, scales.ratingMax);
            ws[addr].s = { fill: { fgColor: { rgb: bg } }, font: { color: { rgb: fg } }, alignment: { horizontal: 'center', vertical: 'center' } };
          } else if (ci === scanIdx) {
            const { bg, fg } = gradientHex(rows[ri].scanShare, scales.scanMin, scales.scanMax);
            ws[addr].s = { fill: { fgColor: { rgb: bg } }, font: { color: { rgb: fg } }, alignment: { horizontal: 'center', vertical: 'center' } };
            if (typeof ws[addr].v === 'number') { ws[addr].t = 'n'; ws[addr].z = '0.0%'; }
          } else {
            ws[addr].s = cellStyle;
          }
        }
      });

      ws['!rows'] = [{ hpt: 36 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    for (const sheetName of SHEET_NAMES) {
      const sheet = data.sheets?.[sheetName];
      if (!sheet) continue;

      const regScales  = getScales(sheet.regions);
      const subScales  = getScales(sheet.subdivs);
      let storeRows = sheet.stores;
      if (subdivFilter) storeRows = storeRows.filter(r => r.subdiv === subdivFilter);
      if (storeFilter)  storeRows = storeRows.filter(r => r.store  === storeFilter);
      const sScales = getScales(storeRows);

      applySheet(sheet.regions, ['Регион', 'Рейтинг', 'Кол-во ИЗ', 'Доля сканирования', 'Кол-во кликов'],
        ['region', 'rating', 'izCount', 'scanShare', 'clicks'], regScales, `${sheetName} - Регионы`);

      applySheet(sheet.subdivs, ['Регион', 'Подразделение', 'Рейтинг', 'Кол-во ИЗ', 'Доля сканирования', 'Кол-во кликов'],
        ['region', 'subdiv', 'rating', 'izCount', 'scanShare', 'clicks'], subScales, `${sheetName} - Подразд.`);

      applySheet(storeRows, ['Регион', 'Подразделение', 'Магазин', 'ТЦ', 'Рейтинг', 'Кол-во ИЗ', 'Доля сканирования', 'Кол-во кликов'],
        ['region', 'subdiv', 'store', 'tc', 'rating', 'izCount', 'scanShare', 'clicks'], sScales, `${sheetName} - Магазины`);
    }

    XLSX.writeFile(wb, `АдресноеИЗ_${region}.xlsx`);
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">
          Загрузите файл «Рейтинг сканирования адресного хранения зоны Интернет заказов» через «Загрузить данные»
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Адресное ИЗ — {region}</h1>
          {period && <p className="text-xs text-gray-400 mt-0.5">{period}</p>}
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ backgroundColor: '#0891b2' }}
        >
          <Download size={13} />
          Выгрузить в Excel
        </button>
      </div>

      {/* Sheet tabs */}
      <div className="flex gap-1">
        {SHEET_NAMES.map(name => (
          <button
            key={name}
            onClick={() => setActiveSheet(name)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSheet === name ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={activeSheet === name ? { backgroundColor: '#0891b2' } : {}}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Regions table */}
      {activeSheetData.regions.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Регионы</h2>
          <DataTable
            rows={activeSheetData.regions}
            columns={REGION_COLS}
            scales={regionScales}
          />
        </div>
      )}

      {/* Subdivisions table */}
      {activeSheetData.subdivs.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Подразделения</h2>
          <DataTable
            rows={activeSheetData.subdivs}
            columns={SUBDIV_COLS}
            scales={subdivScales}
          />
        </div>
      )}

      {/* Stores: filters + table */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Магазины</h2>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select
            className={SELECT_CLS}
            value={subdivFilter}
            onChange={e => { setSubdivFilter(e.target.value); setStoreFilter(''); }}
          >
            <option value="">Все подразделения</option>
            {subdivOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            className={SELECT_CLS}
            value={storeFilter}
            onChange={e => setStoreFilter(e.target.value)}
          >
            <option value="">Все магазины</option>
            {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(subdivFilter || storeFilter) && (
            <button
              className="text-xs text-gray-400 hover:text-gray-600 underline"
              onClick={() => { setSubdivFilter(''); setStoreFilter(''); }}
            >
              Сбросить
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">{filteredSorted.length} магазинов</span>
        </div>

        <DataTable
          rows={filteredSorted}
          columns={STORE_COLS}
          scales={storeScales}
          sortField={sortField}
          sortDir={sortDir}
          onSort={toggleSort}
        />
      </div>
    </div>
  );
}
