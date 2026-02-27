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

// Gradient: low number = green, high number = red
function gradientStyle(val, min, max) {
  if (val === null || val === undefined || min === max) return {};
  const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
  // ratio=0 → green, ratio=1 → red
  let r, g, b;
  if (ratio <= 0.5) {
    const t = ratio / 0.5;
    r = Math.round(22 + t * (202 - 22));
    g = Math.round(163 + t * (138 - 163));
    b = Math.round(74 + t * (4 - 74));
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = Math.round(202 + t * (220 - 202));
    g = Math.round(138 + t * (38 - 138));
    b = Math.round(4 + t * (38 - 4));
  }
  // Lighten 35% with white
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
    r = Math.round(22 + t * (202 - 22));
    g = Math.round(163 + t * (138 - 163));
    b = Math.round(74 + t * (4 - 74));
  } else {
    const t = (ratio - 0.5) / 0.5;
    r = Math.round(202 + t * (220 - 202));
    g = Math.round(138 + t * (38 - 138));
    b = Math.round(4 + t * (38 - 4));
  }
  const lr = Math.round(r + (255 - r) * 0.35);
  const lg = Math.round(g + (255 - g) * 0.35);
  const lb = Math.round(b + (255 - b) * 0.35);
  const toHex = v => v.toString(16).padStart(2, '0').toUpperCase();
  return { bg: toHex(lr) + toHex(lg) + toHex(lb), fg: '111827' };
}

export default function IZPage({ region }) {
  const { spbIZ, belIZ } = useData();
  const data = region === 'СПБ' ? spbIZ : belIZ;

  const [activeSheet, setActiveSheet] = useState('День');
  const [subdivFilter, setSubdivFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [sortField, setSortField] = useState('rating');
  const [sortDir, setSortDir] = useState('asc');

  const sheetData = useMemo(() => {
    if (!data) return [];
    return data.sheets?.[activeSheet]?.stores || [];
  }, [data, activeSheet]);

  const period = data?.sheets?.[activeSheet]?.period || null;

  const subdivOptions = useMemo(() => {
    const s = new Set(sheetData.map(r => r.subdiv).filter(Boolean));
    return [...s].sort();
  }, [sheetData]);

  const storeOptions = useMemo(() => {
    const filtered = subdivFilter ? sheetData.filter(r => r.subdiv === subdivFilter) : sheetData;
    const s = new Set(filtered.map(r => r.store).filter(Boolean));
    return [...s].sort();
  }, [sheetData, subdivFilter]);

  const filteredSorted = useMemo(() => {
    let rows = sheetData;
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
  }, [sheetData, subdivFilter, storeFilter, sortField, sortDir]);

  // Gradient scales
  const ratingVals  = filteredSorted.map(r => r.rating).filter(v => v !== null);
  const scanVals    = filteredSorted.map(r => r.scanShare).filter(v => v !== null);
  const ratingMin   = ratingVals.length ? Math.min(...ratingVals) : 0;
  const ratingMax   = ratingVals.length ? Math.max(...ratingVals) : 0;
  const scanMin     = scanVals.length   ? Math.min(...scanVals)   : 0;
  const scanMax     = scanVals.length   ? Math.max(...scanVals)   : 0;

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function SortIcon({ field }) {
    if (sortField !== field) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function exportToExcel() {
    if (!data || filteredSorted.length === 0) return;
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

    // Export each sheet
    for (const sheetName of SHEET_NAMES) {
      const stores = data.sheets?.[sheetName]?.stores || [];
      if (stores.length === 0) continue;

      // Apply same filters
      let rows = stores;
      if (subdivFilter) rows = rows.filter(r => r.subdiv === subdivFilter);
      if (storeFilter)  rows = rows.filter(r => r.store === storeFilter);

      const rVals = rows.map(r => r.rating).filter(v => v !== null);
      const sVals = rows.map(r => r.scanShare).filter(v => v !== null);
      const rMin = rVals.length ? Math.min(...rVals) : 0;
      const rMax = rVals.length ? Math.max(...rVals) : 0;
      const sMin = sVals.length ? Math.min(...sVals) : 0;
      const sMax = sVals.length ? Math.max(...sVals) : 0;

      const headers = ['Регион', 'Подразделение', 'Магазин', 'ТЦ', 'Рейтинг', 'Кол-во ИЗ', 'Доля сканирования', 'Кол-во кликов'];
      const dataRows = rows.map(r => [
        r.region, r.subdiv, r.store, r.tc,
        r.rating,
        r.izCount,
        r.scanShare !== null ? r.scanShare / 100 : '',
        r.clicks,
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

      headers.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (ws[addr]) ws[addr].s = headerStyle;
      });

      dataRows.forEach((row, ri) => {
        for (let ci = 0; ci < headers.length; ci++) {
          const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          if (!ws[addr]) continue;

          if (ci === 4) {
            // Рейтинг — gradient
            const { bg, fg } = gradientHex(rows[ri].rating, rMin, rMax);
            ws[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { color: { rgb: fg } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (ci === 6) {
            // Доля сканирования — gradient, format as %
            const { bg, fg } = gradientHex(rows[ri].scanShare, sMin, sMax);
            ws[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { color: { rgb: fg } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
            if (typeof ws[addr].v === 'number') {
              ws[addr].t = 'n';
              ws[addr].z = '0.0%';
            }
          } else {
            ws[addr].s = cellStyle;
          }
        }
      });

      ws['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 8 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
      ws['!rows'] = [{ hpt: 36 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
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
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Адресное ИЗ — {region}</h1>
          {period && <p className="text-xs text-gray-400 mt-0.5">{period}</p>}
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
          style={{ backgroundColor: '#2563eb' }}
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
              activeSheet === name
                ? 'text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            style={activeSheet === name ? { backgroundColor: '#2563eb' } : {}}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
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

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full text-xs" style={{ tableLayout: 'auto' }}>
          <thead>
            <tr className="border-b border-gray-200" style={{ backgroundColor: '#F9FAFB' }}>
              {[
                { key: 'region',    label: 'Регион' },
                { key: 'subdiv',    label: 'Подразделение' },
                { key: 'store',     label: 'Магазин' },
                { key: 'tc',        label: 'ТЦ' },
                { key: 'rating',    label: 'Рейтинг' },
                { key: 'izCount',   label: 'Кол-во ИЗ готовых к выдаче' },
                { key: 'scanShare', label: 'Доля сканирования' },
                { key: 'clicks',    label: 'Кол-во кликов' },
              ].map(col => (
                <th
                  key={col.key}
                  className="px-3 py-2.5 text-center font-semibold text-gray-500 cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}<SortIcon field={col.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((row, i) => (
              <tr key={`${row.store}-${i}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-3 py-2 text-center text-gray-600">{row.region || '—'}</td>
                <td className="px-3 py-2 text-center text-gray-600">{row.subdiv || '—'}</td>
                <td className="px-3 py-2 text-center font-semibold text-gray-800">{row.store}</td>
                <td className="px-3 py-2 text-left text-gray-700 max-w-[200px] truncate">{row.tc || '—'}</td>
                <td
                  className="px-3 py-2 text-center font-semibold"
                  style={gradientStyle(row.rating, ratingMin, ratingMax)}
                >
                  {fmtNum(row.rating)}
                </td>
                <td className="px-3 py-2 text-center text-gray-700">{fmtNum(row.izCount)}</td>
                <td
                  className="px-3 py-2 text-center font-semibold"
                  style={gradientStyle(row.scanShare, scanMin, scanMax)}
                >
                  {fmtPct(row.scanShare)}
                </td>
                <td className="px-3 py-2 text-center text-gray-700">{fmtNum(row.clicks)}</td>
              </tr>
            ))}
            {filteredSorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Нет данных</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
