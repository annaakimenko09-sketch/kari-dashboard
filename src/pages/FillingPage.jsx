import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx-js-style';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';
import { FILLING_SEASONS, FILLING_SUB_KEYS, TRANSIT_SEASONS, TRANSIT_SUB_KEYS } from '../utils/fillingParser';

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


// Expanded row showing seasonal breakdown
function ExpandedRow({ store, colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="space-y-4">
          {/* Наполненность seasonal data */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Наполненность по сезонам</p>
            <div className="overflow-x-auto">
              <table className="text-xs w-full" style={{ tableLayout: 'auto' }}>
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Метрика</th>
                    {FILLING_SEASONS.map(s => (
                      <th key={s.key} className="text-center px-2 py-1.5 text-gray-500 font-semibold whitespace-nowrap">{s.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FILLING_SUB_KEYS.map(sub => (
                    <tr key={sub.key} className="border-b border-gray-100 hover:bg-gray-100">
                      <td className="px-2 py-1 text-gray-600 font-medium whitespace-nowrap">{sub.label}</td>
                      {FILLING_SEASONS.map(s => {
                        const val = store.seasons?.[s.key]?.[sub.key];
                        const display = (sub.key === 'sharePct' || sub.key === 'sellout')
                          ? fmtPct(val)
                          : fmtNum(val);
                        return (
                          <td key={s.key} className="px-2 py-1 text-center text-gray-700">
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* В пути seasonal data */}
          {store.transitSeasons && (
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">В пути по сезонам</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full" style={{ tableLayout: 'auto' }}>
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Метрика</th>
                      {TRANSIT_SEASONS.map(s => (
                        <th key={s.key} className="text-center px-2 py-1.5 text-gray-500 font-semibold whitespace-nowrap">
                          {FILLING_SEASONS.find(f => f.key === s.key)?.label || s.key}
                        </th>
                      ))}
                      <th className="text-center px-2 py-1.5 text-gray-700 font-bold whitespace-nowrap bg-gray-100">Итого</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TRANSIT_SUB_KEYS.map(sub => {
                      // Sum across all seasons for this sub-key
                      const rowTotal = TRANSIT_SEASONS.reduce((sum, s) => {
                        const v = store.transitSeasons?.[s.key]?.[sub.key];
                        return sum + (v !== null && v !== undefined ? v : 0);
                      }, 0);
                      return (
                        <tr key={sub.key} className="border-b border-gray-100 hover:bg-gray-100">
                          <td className="px-2 py-1 text-gray-600 font-medium whitespace-nowrap">{sub.label}</td>
                          {TRANSIT_SEASONS.map(s => {
                            const val = store.transitSeasons?.[s.key]?.[sub.key];
                            return (
                              <td key={s.key} className="px-2 py-1 text-center text-gray-700">
                                {fmtNum(val)}
                              </td>
                            );
                          })}
                          <td className="px-2 py-1 text-center font-semibold text-gray-800 bg-gray-50">
                            {fmtNum(rowTotal || null)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Transit grand totals */}
              {store.transitTotal && (
                <div className="flex gap-4 mt-2 text-xs">
                  <div className="bg-blue-50 rounded-lg px-3 py-2 border border-blue-100">
                    <p className="text-blue-400 mb-0.5">Всего в пути (итого)</p>
                    <p className="font-bold text-blue-800">{fmtNum(store.transitTotal.totalInTransit)}</p>
                  </div>
                  <div className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <p className="text-gray-400 mb-0.5">В заказах Отгружено</p>
                    <p className="font-bold text-gray-800">{fmtNum(store.transitTotal.shipped)}</p>
                  </div>
                  <div className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                    <p className="text-gray-400 mb-0.5">В заказах Создано</p>
                    <p className="font-bold text-gray-800">{fmtNum(store.transitTotal.created)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function FillingPage({ region }) {
  const { spbFilling, belFilling } = useData();
  const data = region === 'СПБ' ? spbFilling : belFilling;

  const [subdivFilter, setSubdivFilter]   = useState('');
  const [storeFilter, setStoreFilter]     = useState('');
  const [expandedRows, setExpandedRows]   = useState(new Set());
  const [sortField, setSortField]         = useState('fillPctMax');
  const [sortDir, setSortDir]             = useState('desc');

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function toggleRow(storeKey) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(storeKey)) next.delete(storeKey);
      else next.add(storeKey);
      return next;
    });
  }

  const subdivOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.stores.map(s => s.subdiv).filter(Boolean));
    return Array.from(set).sort();
  }, [data]);

  const storeOptions = useMemo(() => {
    if (!data) return [];
    let rows = data.stores;
    if (subdivFilter) rows = rows.filter(s => s.subdiv === subdivFilter);
    const set = new Set(rows.map(s => s.store).filter(Boolean));
    return Array.from(set).sort();
  }, [data, subdivFilter]);

  const filteredSorted = useMemo(() => {
    if (!data) return [];
    let rows = [...data.stores];
    if (subdivFilter) rows = rows.filter(s => s.subdiv === subdivFilter);
    if (storeFilter)  rows = rows.filter(s => s.store === storeFilter);
    rows.sort((a, b) => {
      const av = a[sortField] ?? -Infinity;
      const bv = b[sortField] ?? -Infinity;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return rows;
  }, [data, subdivFilter, storeFilter, sortField, sortDir]);

  function SortIcon({ field }) {
    if (sortField !== field) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  }

  // Excel export
  function exportToExcel() {
    if (!data || filteredSorted.length === 0) return;
    const wb = XLSX.utils.book_new();

    const toHex = v => v.toString(16).padStart(2, '0').toUpperCase();
    function gradientColor(val, min, max) {
      if (val === null || val === undefined || max === min) return { bg: 'FFFFFF', fg: '374151' };
      const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
      let r, g, b;
      if (ratio <= 0.5) {
        const t = ratio / 0.5;
        r = Math.round(22  + t * (202 - 22));
        g = Math.round(163 + t * (138 - 163));
        b = Math.round(74  + t * (4   - 74));
      } else {
        const t = (ratio - 0.5) / 0.5;
        r = Math.round(202 + t * (220 - 202));
        g = Math.round(138 + t * (38  - 138));
        b = Math.round(4   + t * (38  - 4));
      }
      const bgR = Math.round(r + (255 - r) * 0.30);
      const bgG = Math.round(g + (255 - g) * 0.30);
      const bgB = Math.round(b + (255 - b) * 0.30);
      return { bg: toHex(bgR) + toHex(bgG) + toHex(bgB), fg: '000000' };
    }

    const headerStyle = {
      font: { bold: true, color: { rgb: '374151' } },
      fill: { fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
    };

    // Sheet 1: Магазины (main metrics)
    {
      const headers = ['Подразделение', 'Магазин', 'Наименование', 'Категория', '% напол. MAX', 'План MAX, пар', 'План, пар', 'Последних пар'];
      const metricCols = ['fillPctMax', 'planPairsMax', 'planPairsN', 'lastPairs'];
      const rows = filteredSorted.map(s => [
        s.subdiv, s.store, s.name, s.cat,
        s.fillPctMax, s.planPairsMax, s.planPairsN, s.lastPairs,
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

      headers.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (ws[addr]) ws[addr].s = headerStyle;
      });

      const exportScales = {};
      for (const col of metricCols) {
        const vals = filteredSorted.map(s => s[col]).filter(v => v !== null && v !== undefined);
        exportScales[col] = { min: Math.min(...vals), max: Math.max(...vals) };
      }

      rows.forEach((row, ri) => {
        // Label cols
        [0, 1, 2, 3].forEach(ci => {
          const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          if (ws[addr]) ws[addr].s = { font: { color: { rgb: '374151' } }, alignment: { horizontal: 'center', vertical: 'center' } };
        });
        // Metric cols with gradient
        metricCols.forEach((col, mi) => {
          const addr = XLSX.utils.encode_cell({ r: ri + 1, c: 4 + mi });
          const val = filteredSorted[ri][col];
          const sc = exportScales[col];
          const { bg, fg } = gradientColor(val, sc.min, sc.max);
          if (ws[addr]) {
            ws[addr].s = {
              fill: { fgColor: { rgb: bg } },
              font: { color: { rgb: fg } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          }
        });
      });

      ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
      ws['!rows'] = [{ hpt: 36 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Магазины');
    }

    // Sheet 2: Наполненность по сезонам
    {
      const seasonLabels = FILLING_SEASONS.map(s => s.label);
      const subLabels = FILLING_SUB_KEYS.map(s => s.label);

      // Row 0: store info headers + merged season labels
      const row0 = ['Подразделение', 'Магазин', 'Наименование', ...seasonLabels.flatMap(sl => Array(FILLING_SUB_KEYS.length).fill(sl))];
      // Row 1: sub-key labels
      const row1 = ['', '', '', ...seasonLabels.flatMap(() => subLabels)];

      const dataRows = filteredSorted.map(s => [
        s.subdiv, s.store, s.name,
        ...FILLING_SEASONS.flatMap(season =>
          FILLING_SUB_KEYS.map(sub => s.seasons?.[season.key]?.[sub.key] ?? null)
        ),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([row0, row1, ...dataRows]);

      // Merge season header cells
      ws['!merges'] = [];
      FILLING_SEASONS.forEach((_, si) => {
        const start = 3 + si * FILLING_SUB_KEYS.length;
        const end   = start + FILLING_SUB_KEYS.length - 1;
        ws['!merges'].push({ s: { r: 0, c: start }, e: { r: 0, c: end } });
      });

      // Style header rows
      row0.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (ws[addr]) ws[addr].s = headerStyle;
      });
      row1.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 1, c: ci });
        if (ws[addr]) ws[addr].s = { ...headerStyle, font: { color: { rgb: '374151' } }, fill: { fgColor: { rgb: 'F9FAFB' } } };
      });

      // Style data
      dataRows.forEach((row, ri) => {
        [0, 1, 2].forEach(ci => {
          const addr = XLSX.utils.encode_cell({ r: ri + 2, c: ci });
          if (ws[addr]) ws[addr].s = { alignment: { horizontal: 'center', vertical: 'center' } };
        });
        for (let ci = 3; ci < row.length; ci++) {
          const addr = XLSX.utils.encode_cell({ r: ri + 2, c: ci });
          if (ws[addr]) ws[addr].s = { alignment: { horizontal: 'center', vertical: 'center' } };
        }
      });

      const colWidths = [{ wch: 14 }, { wch: 10 }, { wch: 28 },
        ...Array(FILLING_SEASONS.length * FILLING_SUB_KEYS.length).fill({ wch: 12 })];
      ws['!cols'] = colWidths;
      ws['!rows'] = [{ hpt: 36 }, { hpt: 32 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Наполненность по сезонам');
    }

    // Sheet 3: В пути по сезонам
    {
      const seasonLabels = TRANSIT_SEASONS.map(s => FILLING_SEASONS.find(f => f.key === s.key)?.label || s.key);
      const subLabels = TRANSIT_SUB_KEYS.map(s => s.label);

      const row0 = ['Подразделение', 'Магазин', 'Всего в пути', 'Отгружено', 'Создано',
        ...seasonLabels.flatMap(sl => Array(TRANSIT_SUB_KEYS.length).fill(sl))];
      const row1 = ['', '', '', '', '',
        ...seasonLabels.flatMap(() => subLabels)];

      const dataRows = filteredSorted.map(s => [
        s.subdiv, s.store,
        s.transitTotal?.totalInTransit ?? null,
        s.transitTotal?.shipped ?? null,
        s.transitTotal?.created ?? null,
        ...TRANSIT_SEASONS.flatMap(season =>
          TRANSIT_SUB_KEYS.map(sub => s.transitSeasons?.[season.key]?.[sub.key] ?? null)
        ),
      ]);

      const ws = XLSX.utils.aoa_to_sheet([row0, row1, ...dataRows]);

      ws['!merges'] = [];
      TRANSIT_SEASONS.forEach((_, si) => {
        const start = 5 + si * TRANSIT_SUB_KEYS.length;
        const end   = start + TRANSIT_SUB_KEYS.length - 1;
        ws['!merges'].push({ s: { r: 0, c: start }, e: { r: 0, c: end } });
      });

      row0.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (ws[addr]) ws[addr].s = headerStyle;
      });
      row1.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 1, c: ci });
        if (ws[addr]) ws[addr].s = { ...headerStyle, font: { color: { rgb: '374151' } }, fill: { fgColor: { rgb: 'F9FAFB' } } };
      });

      dataRows.forEach((row, ri) => {
        row.forEach((_, ci) => {
          const addr = XLSX.utils.encode_cell({ r: ri + 2, c: ci });
          if (ws[addr]) ws[addr].s = { alignment: { horizontal: 'center', vertical: 'center' } };
        });
      });

      const colWidths = [{ wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
        ...Array(TRANSIT_SEASONS.length * TRANSIT_SUB_KEYS.length).fill({ wch: 12 })];
      ws['!cols'] = colWidths;
      ws['!rows'] = [{ hpt: 36 }, { hpt: 32 }];
      XLSX.utils.book_append_sheet(wb, ws, 'В пути по сезонам');
    }

    const suffix = subdivFilter ? `_${subdivFilter}` : storeFilter ? `_${storeFilter}` : '';
    XLSX.writeFile(wb, `Наполненность_${region}${suffix}.xlsx`);
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">
          Загрузите файл «Наполненность магазинов» через «Загрузить данные»
        </p>
      </div>
    );
  }

  const COL_SPAN = 9; // subdiv + store + name + cat + 4 metrics + chevron

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Наполненность обувь — {region}</p>
            <p className="text-base font-bold text-gray-800">{data.fileName}</p>
          </div>
          <div className="text-xs text-gray-500">
            Магазинов: <span className="font-semibold text-gray-800">{filteredSorted.length}</span>
            {(subdivFilter || storeFilter) && ` из ${data.stores.length}`}
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700">Магазины</h2>
            {subdivOptions.length > 1 && (
              <select
                value={subdivFilter}
                onChange={e => { setSubdivFilter(e.target.value); setStoreFilter(''); setExpandedRows(new Set()); }}
                className={SELECT_CLS}
              >
                <option value="">Все подразделения</option>
                {subdivOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {storeOptions.length > 1 && (
              <select
                value={storeFilter}
                onChange={e => setStoreFilter(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">Все магазины</option>
                {storeOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {(subdivFilter || storeFilter) && (
              <span className="text-xs text-gray-400">{filteredSorted.length} из {data.stores.length}</span>
            )}
          </div>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#3b82f6' }}
          >
            <Download size={13} /> Excel
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="text-sm w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 60 }} />
              <col style={{ width: 200 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-2 py-2.5" />
                <th
                  className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                  onClick={() => toggleSort('subdiv')}
                >
                  Подразделение <SortIcon field="subdiv" />
                </th>
                <th
                  className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                  onClick={() => toggleSort('store')}
                >
                  Магазин <SortIcon field="store" />
                </th>
                <th className="text-left px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Наименование
                </th>
                <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Категория
                </th>
                <th
                  className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                  style={{ lineHeight: '1.3', whiteSpace: 'normal' }}
                  onClick={() => toggleSort('fillPctMax')}
                >
                  % напол. MAX <SortIcon field="fillPctMax" />
                </th>
                <th
                  className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                  style={{ lineHeight: '1.3', whiteSpace: 'normal' }}
                  onClick={() => toggleSort('planPairsMax')}
                >
                  План MAX, пар <SortIcon field="planPairsMax" />
                </th>
                <th
                  className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                  style={{ lineHeight: '1.3', whiteSpace: 'normal' }}
                  onClick={() => toggleSort('planPairsN')}
                >
                  План, пар <SortIcon field="planPairsN" />
                </th>
                <th
                  className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                  style={{ lineHeight: '1.3', whiteSpace: 'normal' }}
                  onClick={() => toggleSort('lastPairs')}
                >
                  Последних пар <SortIcon field="lastPairs" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSorted.length === 0 && (
                <tr>
                  <td colSpan={COL_SPAN} className="text-center py-8 text-gray-400 text-sm">Нет данных</td>
                </tr>
              )}
              {filteredSorted.map((store, i) => {
                const rowKey = store.store || String(i);
                const isExpanded = expandedRows.has(rowKey);
                return [
                  <tr
                    key={rowKey}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50' : ''}`}
                    onClick={() => toggleRow(rowKey)}
                  >
                    <td className="px-2 py-2 text-center">
                      {isExpanded
                        ? <ChevronDown size={14} className="text-gray-400 mx-auto" />
                        : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-600">{store.subdiv || '—'}</td>
                    <td className="px-2 py-2 text-center text-xs font-semibold text-gray-800">{store.store || '—'}</td>
                    <td className="px-2 py-2 text-left text-xs text-gray-700 truncate">{store.name || '—'}</td>
                    <td className="px-2 py-2 text-center text-xs text-gray-500">{store.cat || '—'}</td>
                    <td className="px-2 py-2 text-center text-xs font-medium text-gray-800">
                      {store.fillPctMax !== null && store.fillPctMax !== undefined ? fmtPct(store.fillPctMax) : '—'}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">
                      {fmtNum(store.planPairsMax)}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">
                      {fmtNum(store.planPairsN)}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-700">
                      {fmtNum(store.lastPairs)}
                    </td>
                  </tr>,
                  isExpanded && (
                    <ExpandedRow key={`${rowKey}-expanded`} store={store} colSpan={COL_SPAN} />
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
