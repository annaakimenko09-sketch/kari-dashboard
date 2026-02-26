import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx-js-style';
import { Download } from 'lucide-react';

function pctColor(val, min, max) {
  if (val === null || val === undefined) return {};
  if (max === min) return { backgroundColor: '#fef9c3', color: '#713f12' };
  const ratio = (val - min) / (max - min); // 0=best(low%), 1=worst(high%)
  if (ratio >= 0.67) return { backgroundColor: '#fee2e2', color: '#991b1b' };
  if (ratio >= 0.33) return { backgroundColor: '#fef9c3', color: '#713f12' };
  return { backgroundColor: '#dcfce7', color: '#14532d' };
}

function fmt(val) {
  if (val === null || val === undefined) return '—';
  return val;
}

function fmtPct(val) {
  if (val === null || val === undefined) return '—';
  return val.toFixed(1) + '%';
}

function fmtNum(val) {
  if (val === null || val === undefined) return '—';
  return val.toLocaleString('ru-RU');
}

export default function CapsulePage({ region }) {
  const { spbCapsule, belCapsule, capsuleFiles } = useData();

  // Use the region-specific file for this page (subdivisions differ between files)
  const regionFile = region === 'СПБ' ? spbCapsule : belCapsule;
  // Regions summary (all-regions) is the same in both — use any available as fallback
  const anyFile = capsuleFiles?.[0] || null;
  const data = regionFile || anyFile;
  // Магазины are region-specific — same file
  const storesData = regionFile;

  const [activeTab, setActiveTab] = useState('itogi'); // 'itogi' | 'stores'
  const [regionFilter, setRegionFilter] = useState('');
  const [subdivFilter, setSubdivFilter] = useState('');
  const [sortField, setSortField] = useState('pct');
  const [sortDir, setSortDir]   = useState('desc');

  // ── Итоги data — same for both pages (all-regions summary) ───
  const regionRows = useMemo(() => {
    if (!data) return [];
    return data.regions;
  }, [data]);

  const subdivRows = useMemo(() => {
    if (!data) return [];
    // Filter subdivisions to only the current page's region
    let rows = data.subdivisions.filter(r =>
      r.region && r.region.toUpperCase().includes(region.toUpperCase())
    );
    if (regionFilter) rows = rows.filter(r => r.region === regionFilter);
    return rows;
  }, [data, regionFilter, region]);

  // ── Магазины — region-specific ────────────────────────────────
  const storeRows = useMemo(() => {
    if (!storesData) return [];
    return storesData.stores;
  }, [storesData]);

  // ── Stores tab filtering/sorting ─────────────────────────────
  const filteredStores = useMemo(() => {
    let rows = storeRows;
    if (subdivFilter) rows = rows.filter(r => r.subdiv === subdivFilter);
    return [...rows].sort((a, b) => {
      const av = a[sortField] ?? -1;
      const bv = b[sortField] ?? -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [storeRows, subdivFilter, sortField, sortDir]);

  const subdivOptions = useMemo(() => {
    const set = new Set(storeRows.map(r => r.subdiv).filter(Boolean));
    return Array.from(set).sort();
  }, [storeRows]);

  const regionOptions = useMemo(() => {
    const set = new Set(subdivRows.map(r => r.region).filter(Boolean));
    return Array.from(set).sort();
  }, [subdivRows]);

  // ── Color scales ─────────────────────────────────────────────
  const subdivPcts = subdivRows.map(r => r.pct).filter(v => v !== null);
  const subdivMin = Math.min(...subdivPcts);
  const subdivMax = Math.max(...subdivPcts);

  const storePcts = filteredStores.map(r => r.pct).filter(v => v !== null);
  const storeMin = Math.min(...storePcts);
  const storeMax = Math.max(...storePcts);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
  }

  // ── Export helpers ────────────────────────────────────────────
  function capsuleGradient(val, min, max) {
    if (val === null || val === undefined) return { bg: 'FFFFFF', fg: '000000' };
    if (max === min) return { bg: 'FEF9C3', fg: '000000' };
    const ratio = Math.max(0, Math.min(1, (val - min) / (max - min)));
    // 0=green(best/low%), 1=red(worst/high%)
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
    const toHex = v => v.toString(16).padStart(2, '0').toUpperCase();
    return { bg: toHex(bgR) + toHex(bgG) + toHex(bgB), fg: '000000' };
  }

  function styleHeader(ws, headers) {
    headers.forEach((_, ci) => {
      const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
      if (ws[addr]) {
        ws[addr].s = {
          font: { bold: true, color: { rgb: '374151' } },
          fill: { fgColor: { rgb: 'F3F4F6' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
        };
      }
    });
    ws['!rows'] = [{ hpt: 36 }];
  }

  function applyPctStyle(ws, ri, ci, val, min, max) {
    const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
    if (!ws[addr]) return;
    const { bg, fg } = capsuleGradient(val, min, max);
    ws[addr].s = {
      fill: { fgColor: { rgb: bg } },
      font: { color: { rgb: fg }, bold: false },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    if (typeof ws[addr].v === 'number') {
      ws[addr].v = ws[addr].v / 100;
      ws[addr].t = 'n';
      ws[addr].z = '0.0%';
    }
  }

  function applyTextStyle(ws, ri, ci) {
    const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
    if (ws[addr]) {
      ws[addr].s = { font: { color: { rgb: '374151' } }, alignment: { horizontal: 'center', vertical: 'center' } };
    }
  }

  // ── Export ────────────────────────────────────────────────────
  function exportItogi() {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Регионы
    const regHeader = ['Регион', '% Неотсканировано', '% пред. неделя', 'Не отскан. арт.', 'Физдоступно арт.'];
    const regData = regionRows.map(r => [r.region, r.pct, r.pctPrev, r.notScanned, r.available]);
    const wsReg = XLSX.utils.aoa_to_sheet([regHeader, ...regData]);
    styleHeader(wsReg, regHeader);
    const regPcts = regionRows.map(r => r.pct).filter(v => v != null);
    const regPrevPcts = regionRows.map(r => r.pctPrev).filter(v => v != null);
    const regMin = Math.min(...regPcts), regMax = Math.max(...regPcts);
    const regPrevMin = Math.min(...regPrevPcts), regPrevMax = Math.max(...regPrevPcts);
    regData.forEach((row, ri) => {
      applyTextStyle(wsReg, ri + 1, 0);
      applyPctStyle(wsReg, ri + 1, 1, regionRows[ri].pct, regMin, regMax);
      applyPctStyle(wsReg, ri + 1, 2, regionRows[ri].pctPrev, regPrevMin, regPrevMax);
    });
    wsReg['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsReg, 'Регионы');

    // Sheet 2: Подразделения
    const subHeader = ['Регион', 'Подразделение', '% Неотсканировано', '% пред. неделя', 'Не отскан. арт.', 'Физдоступно арт.'];
    const subData = subdivRows.map(r => [r.region, r.subdiv, r.pct, r.pctPrev, r.notScanned, r.available]);
    const wsSub = XLSX.utils.aoa_to_sheet([subHeader, ...subData]);
    styleHeader(wsSub, subHeader);
    const subPcts = subdivRows.map(r => r.pct).filter(v => v != null);
    const subPrevPcts = subdivRows.map(r => r.pctPrev).filter(v => v != null);
    const subMin = Math.min(...subPcts), subMax = Math.max(...subPcts);
    const subPrevMin = Math.min(...subPrevPcts), subPrevMax = Math.max(...subPrevPcts);
    subData.forEach((row, ri) => {
      applyTextStyle(wsSub, ri + 1, 0);
      applyTextStyle(wsSub, ri + 1, 1);
      applyPctStyle(wsSub, ri + 1, 2, subdivRows[ri].pct, subMin, subMax);
      applyPctStyle(wsSub, ri + 1, 3, subdivRows[ri].pctPrev, subPrevMin, subPrevMax);
    });
    wsSub['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsSub, 'Подразделения');

    XLSX.writeFile(wb, `Капсулы_Итоги_${region}.xlsx`);
  }

  function exportStores() {
    const wb = XLSX.utils.book_new();
    const header = ['Подразделение', 'Магазин', 'ТЦ', '% Неотсканировано', '% пред. неделя', 'Не отскан. арт.', 'Физдоступно арт.'];
    const dataRows = filteredStores.map(r => [r.subdiv, r.store, r.tc, r.pct, r.pctPrev, r.notScanned, r.available]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    styleHeader(ws, header);
    const pcts = filteredStores.map(r => r.pct).filter(v => v != null);
    const prevPcts = filteredStores.map(r => r.pctPrev).filter(v => v != null);
    const pMin = Math.min(...pcts), pMax = Math.max(...pcts);
    const ppMin = Math.min(...prevPcts), ppMax = Math.max(...prevPcts);
    dataRows.forEach((row, ri) => {
      applyTextStyle(ws, ri + 1, 0);
      applyTextStyle(ws, ri + 1, 1);
      applyTextStyle(ws, ri + 1, 2);
      applyPctStyle(ws, ri + 1, 3, filteredStores[ri].pct, pMin, pMax);
      applyPctStyle(ws, ri + 1, 4, filteredStores[ri].pctPrev, ppMin, ppMax);
    });
    ws['!cols'] = [{ wch: 10 }, { wch: 8 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Магазины');
    XLSX.writeFile(wb, `Капсулы_Магазины_${region}.xlsx`);
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">
          Загрузите файл «Отчет капсулы» через «Загрузить данные»
        </p>
      </div>
    );
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Период отчёта (Капсулы)</p>
            <p className="text-base font-bold text-gray-800">{data.period || '—'}</p>
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
        {[['itogi', 'Итоги'], ['stores', 'Магазины']].map(([key, label]) => (
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

      {/* ── ИТОГИ tab ─────────────────────────────────────────── */}
      {activeTab === 'itogi' && (
        <div className="space-y-4">
          {/* Regions block */}
          {regionRows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-700">Регионы</h2>
                <button
                  onClick={exportItogi}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ backgroundColor: '#06b6d4' }}
                >
                  <Download size={13} /> Excel
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Регион</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">% Неотсканировано</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">% пред. неделя</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Не отскан. арт.</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Физдоступно арт.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regionRows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.region}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={pctColor(r.pct, 0, 100)}>
                            {fmtPct(r.pct)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{fmtPct(r.pctPrev)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmtNum(r.notScanned)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmtNum(r.available)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subdivisions block */}
          {subdivRows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold text-gray-700">
                  Подразделения {subdivRows.length > 0 && <span className="text-gray-400 font-normal">({subdivRows.length})</span>}
                </h2>
                {regionOptions.length > 1 && (
                  <select
                    value={regionFilter}
                    onChange={e => setRegionFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                  >
                    <option value="">Все регионы</option>
                    {regionOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Регион</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Подразделение</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">% Неотсканировано</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">% пред. неделя</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Не отскан. арт.</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Физдоступно арт.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subdivRows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-gray-600 text-xs">{r.region}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.subdiv}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded text-xs font-medium" style={pctColor(r.pct, subdivMin, subdivMax)}>
                            {fmtPct(r.pct)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{fmtPct(r.pctPrev)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmtNum(r.notScanned)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">{fmtNum(r.available)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {regionRows.length === 0 && subdivRows.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">Нет данных в файле</p>
          )}
        </div>
      )}

      {/* ── МАГАЗИНЫ tab ──────────────────────────────────────── */}
      {activeTab === 'stores' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
            <h2 className="text-sm font-semibold text-gray-700">
              Магазины {filteredStores.length > 0 && <span className="text-gray-400 font-normal">({filteredStores.length})</span>}
            </h2>
            <div className="flex items-center gap-2">
              {subdivOptions.length > 1 && (
                <select
                  value={subdivFilter}
                  onChange={e => setSubdivFilter(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                >
                  <option value="">Все подразделения</option>
                  {subdivOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              <button
                onClick={exportStores}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ backgroundColor: '#06b6d4' }}
              >
                <Download size={13} /> Excel
              </button>
            </div>
          </div>

          {filteredStores.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Подразделение</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Магазин</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">ТЦ</th>
                    <th
                      className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                      onClick={() => toggleSort('pct')}
                    >
                      % Неотскан <SortIcon field="pct" />
                    </th>
                    <th
                      className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                      onClick={() => toggleSort('pctPrev')}
                    >
                      % пред. нед <SortIcon field="pctPrev" />
                    </th>
                    <th
                      className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                      onClick={() => toggleSort('notScanned')}
                    >
                      Не отскан. арт <SortIcon field="notScanned" />
                    </th>
                    <th
                      className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-800"
                      onClick={() => toggleSort('available')}
                    >
                      Физдоступно арт <SortIcon field="available" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{fmt(r.subdiv)}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{fmt(r.store)}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{fmt(r.tc)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={pctColor(r.pct, storeMin, storeMax)}>
                          {fmtPct(r.pct)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600 text-xs">{fmtPct(r.pctPrev)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtNum(r.notScanned)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtNum(r.available)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
