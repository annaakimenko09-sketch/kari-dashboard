import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx';
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

  // Итоги (regions + subdivisions) are identical in both files — use any available
  const itogiData = capsuleFiles?.[0] || spbCapsule || belCapsule;
  // Магазины are region-specific — use the matching file
  const storesData = region === 'СПБ' ? spbCapsule : belCapsule;
  // If no region-specific file, fall back to first available
  const data = itogiData;

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

  // ── Export ────────────────────────────────────────────────────
  function exportItogi() {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['Регион', '% Неотсканировано', '% Неотсканировано пред.неделя', 'Не отскан. арт.', 'Физдоступно арт.'],
      ...regionRows.map(r => [r.region, r.pct, r.pctPrev, r.notScanned, r.available]),
      [],
      ['Регион', 'Подразделение', '% Неотсканировано', '% Неотсканировано пред.неделя', 'Не отскан. арт.', 'Физдоступно арт.'],
      ...subdivRows.map(r => [r.region, r.subdiv, r.pct, r.pctPrev, r.notScanned, r.available]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Итоги');
    XLSX.writeFile(wb, `Капсулы_Итоги_${region}.xlsx`);
  }

  function exportStores() {
    const wb = XLSX.utils.book_new();
    const rows = [
      ['Подразделение', 'Магазин', 'ТЦ', '% Неотсканировано', '% Неотсканировано пред.неделя', 'Не отскан. арт.', 'Физдоступно арт.'],
      ...filteredStores.map(r => [r.subdiv, r.store, r.tc, r.pct, r.pctPrev, r.notScanned, r.available]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Магазины');
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
