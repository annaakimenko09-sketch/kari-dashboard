import { useState, useMemo } from 'react';
import { Upload, X, ChevronDown, ChevronRight, Download } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

// ─── helpers ────────────────────────────────────────────────────────────────

// Inverted scale: higher % = redder (worse). Used in Приёмка only.
function pctColor(v) {
  if (v === null) return 'text-gray-400';
  if (v >= 90) return 'text-red-600';
  if (v >= 80) return 'text-amber-600';
  return 'text-green-600';
}

function pctBg(v) {
  if (v === null) return 'bg-gray-100 text-gray-400';
  if (v >= 90) return 'bg-red-100 text-red-700';
  if (v >= 80) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function fmt(v, decimals = 1) {
  if (v === null || v === undefined) return '—';
  return v.toFixed(decimals) + '%';
}

function fmtNum(v) {
  if (!v) return '—';
  return Number(v).toLocaleString('ru-RU');
}

// ─── Details modal (Seasons + Categories tabs) ─────────────────────────────

function DetailsModal({ title, seasons, categories, onClose }) {
  const hasCategories = categories && categories.length > 0;
  const hasSeasons = seasons && seasons.length > 0;
  const [modalTab, setModalTab] = useState(hasSeasons ? 'seasons' : 'categories');

  const groupedSeasons = useMemo(() => {
    const map = {};
    (seasons || []).forEach(({ season, direction, value }) => {
      if (!map[season]) map[season] = [];
      map[season].push({ direction, value });
    });
    return Object.entries(map);
  }, [seasons]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Детализация по сезонам и категориям</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        {/* Modal tabs — show only if both exist */}
        {hasCategories && hasSeasons && (
          <div className="flex gap-2 px-5 pt-3 flex-shrink-0">
            {[
              { key: 'seasons',    label: 'Сезоны' },
              { key: 'categories', label: 'Категории' },
            ].map(t => (
              <button key={t.key} onClick={() => setModalTab(t.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={modalTab === t.key
                  ? { backgroundColor: '#111827', color: 'white' }
                  : { backgroundColor: '#f3f4f6', color: '#4b5563' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">
          {modalTab === 'seasons' && (
            <>
              {groupedSeasons.map(([season, dirs]) => (
                <div key={season}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{season}</p>
                  <div className="space-y-1">
                    {dirs.map(({ direction, value }) => (
                      <div key={direction} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50">
                        <span className="text-sm text-gray-700">{direction}</span>
                        <span className={`text-sm font-semibold ${pctColor(value)}`}>{fmt(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {groupedSeasons.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Нет данных по сезонам</p>
              )}
            </>
          )}

          {modalTab === 'categories' && (
            <>
              {hasCategories ? (categories || []).map(({ category, value }) => (
                <div key={category} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50">
                  <span className="text-sm text-gray-700">{category}</span>
                  <span className={`text-sm font-semibold ${pctColor(value)}`}>{fmt(value)}</span>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-4">Нет данных по категориям</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Scanning table (regions / subdivisions) ──────────────────────────────

function ScanTable({ rows, labelKey, label, accentColor, tab }) {
  const [modal, setModal] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const sortedRows = useMemo(() => {
    if (!sortCol || !rows) return rows || [];
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? -1, bv = b[sortCol] ?? -1;
      return (av - bv) * dir;
    });
  }, [rows, sortCol, sortDir]);

  if (!rows || rows.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Нет данных</p>;
  }

  const showBind = tab === 'bind';
  const pctField = showBind ? 'bindPct' : 'scanPct';

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="text-xs opacity-30">↕</span>;
    return <span className="text-xs opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{label}</th>
              {showBind ? (
                <>
                  <th
                    className="px-4 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900"
                    onClick={() => handleSort('bindPct')}
                  >
                    <span className="inline-flex items-center gap-1">Нет привязки, % <SortIcon col="bindPct" /></span>
                  </th>
                  <th className="px-4 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">Артикулов</th>
                </>
              ) : (
                <>
                  <th
                    className="px-4 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none hover:text-gray-900"
                    onClick={() => handleSort('scanPct')}
                  >
                    <span className="inline-flex items-center gap-1">Нет скан, % <SortIcon col="scanPct" /></span>
                  </th>
                  <th className="px-4 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">Артикулов</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">Штук</th>
                  <th className="px-4 py-2.5 text-center font-semibold text-gray-600 whitespace-nowrap">Детали</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => {
              const name = row[labelKey] || row.subdiv || row.store || row.region || '—';
              const pct  = row[pctField];
              return (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">{name}</td>
                  {showBind ? (
                    <>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctBg(pct)}`}>
                          {fmt(pct)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{fmtNum(row.bindArt)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctBg(pct)}`}>
                          {fmt(pct)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{fmtNum(row.scanArt)}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{fmtNum(row.scanQty)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {(row.seasons?.length > 0 || row.categories?.length > 0) ? (
                          <button
                            onClick={() => setModal({ title: name, seasons: row.seasons || [], categories: row.categories || [] })}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white transition-colors"
                            style={{ backgroundColor: accentColor }}
                          >
                            <ChevronDown size={11} />
                            Детали
                          </button>
                        ) : '—'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <DetailsModal
          title={modal.title}
          seasons={modal.seasons}
          categories={modal.categories}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ─── Stores section (collapsible by subdivision) ──────────────────────────

function StoresSection({ stores, tab, accentColor }) {
  const [expanded, setExpanded] = useState({});
  const [modal, setModal] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [storeFilter, setStoreFilter] = useState('');

  const showBind = tab === 'bind';
  const pctField = showBind ? 'bindPct' : 'scanPct';

  // Group by subdivision
  const grouped = useMemo(() => {
    const map = {};
    stores.forEach(row => {
      const key = row.subdiv || '—';
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'ru'));
  }, [stores]);

  // Unique sorted store numbers for filter dropdown
  const allStoreNums = useMemo(() => {
    const nums = [...new Set(stores.map(r => r.store).filter(Boolean))];
    return nums.sort((a, b) => {
      const na = parseFloat(a), nb = parseFloat(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, 'ru');
    });
  }, [stores]);

  function toggleGroup(key) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  function sortRows(rows) {
    let filtered = storeFilter ? rows.filter(r => r.store === storeFilter) : rows;
    if (!sortCol) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortCol === 'store') {
        const na = parseFloat(a.store || ''), nb = parseFloat(b.store || '');
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        return String(a.store || '').localeCompare(String(b.store || ''), 'ru') * dir;
      }
      const av = a[sortCol] ?? -1, bv = b[sortCol] ?? -1;
      return (av - bv) * dir;
    });
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <span className="text-xs opacity-30">↕</span>;
    return <span className="text-xs opacity-70">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  if (!stores || stores.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Нет данных по магазинам</p>;
  }

  return (
    <>
      {/* Store filter */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={storeFilter}
          onChange={e => setStoreFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none"
        >
          <option value="">Все магазины</option>
          {allStoreNums.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {storeFilter && (
          <button onClick={() => setStoreFilter('')} className="p-1 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {grouped.map(([subdiv, rows]) => {
        const sorted = sortRows(rows);
        if (sorted.length === 0) return null;
        const isOpen = expanded[subdiv];
        const validPcts = rows.filter(r => r[pctField] !== null).map(r => r[pctField]);
        const avgPct = validPcts.length ? validPcts.reduce((s, v) => s + v, 0) / validPcts.length : 0;

        return (
          <div key={subdiv} className="border border-gray-200 rounded-xl mb-3 overflow-hidden">
            {/* Subdivision header */}
            <button
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              onClick={() => toggleGroup(subdiv)}
            >
              <div className="flex items-center gap-3">
                {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                <span className="font-semibold text-gray-800 text-sm">{subdiv}</span>
                <span className="text-xs text-gray-500">{rows.length} магазинов</span>
              </div>
              <span className={`text-sm font-bold ${pctColor(avgPct)}`}>{fmt(avgPct)} ср.</span>
            </button>

            {/* Stores table */}
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      <th
                        className="px-4 py-2 text-left font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-800"
                        onClick={() => handleSort('store')}
                      >
                        <span className="inline-flex items-center gap-1">Магазин / ТЦ <SortIcon col="store" /></span>
                      </th>
                      {showBind ? (
                        <>
                          <th
                            className="px-4 py-2 text-center font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-800"
                            onClick={() => handleSort('bindPct')}
                          >
                            <span className="inline-flex items-center gap-1">Нет привязки, % <SortIcon col="bindPct" /></span>
                          </th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-500">Артикулов</th>
                        </>
                      ) : (
                        <>
                          <th
                            className="px-4 py-2 text-center font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-800"
                            onClick={() => handleSort('scanPct')}
                          >
                            <span className="inline-flex items-center gap-1">Нет скан, % <SortIcon col="scanPct" /></span>
                          </th>
                          <th
                            className="px-4 py-2 text-center font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-800"
                            onClick={() => handleSort('scanArt')}
                          >
                            <span className="inline-flex items-center gap-1">Артикулов <SortIcon col="scanArt" /></span>
                          </th>
                          <th
                            className="px-4 py-2 text-center font-semibold text-gray-500 cursor-pointer select-none hover:text-gray-800"
                            onClick={() => handleSort('scanQty')}
                          >
                            <span className="inline-flex items-center gap-1">Штук <SortIcon col="scanQty" /></span>
                          </th>
                          <th className="px-4 py-2 text-center font-semibold text-gray-500">Детали</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => {
                      const pct = row[pctField];
                      const storeName = row.store || '—';
                      const tc = row.tc || '';
                      return (
                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <div className="font-medium text-gray-700">{storeName}</div>
                            {tc && <div className="text-gray-400 text-xs mt-0.5">{tc}</div>}
                          </td>
                          {showBind ? (
                            <>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctBg(pct)}`}>
                                  {fmt(pct)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center text-gray-600">{fmtNum(row.bindArt)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${pctBg(pct)}`}>
                                  {fmt(pct)}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center text-gray-600">{fmtNum(row.scanArt)}</td>
                              <td className="px-4 py-2 text-center text-gray-600">{fmtNum(row.scanQty)}</td>
                              <td className="px-4 py-2 text-center">
                                {(row.seasons?.length > 0 || row.categories?.length > 0) ? (
                                  <button
                                    onClick={() => setModal({ title: `${storeName}${tc ? ' — ' + tc : ''}`, seasons: row.seasons || [], categories: row.categories || [] })}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-white"
                                    style={{ backgroundColor: accentColor }}
                                  >
                                    <ChevronDown size={10} />
                                    Детали
                                  </button>
                                ) : '—'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {modal && (
        <DetailsModal
          title={modal.title}
          seasons={modal.seasons}
          categories={modal.categories}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

// ─── Export helpers ───────────────────────────────────────────────────────

function exportScan(rows, filename, tab) {
  const showBind = tab === 'bind';
  const data = rows.map(r => showBind ? ({
    'Регион':               r.region || '',
    'Подразделение':        r.subdiv || '',
    'Магазин':              r.store  || '',
    'ТЦ':                   r.tc     || '',
    'Нет привязки приход, %': r.bindPct != null ? r.bindPct + '%' : '',
    'Нет привязки приход, арт.': r.bindArt || '',
  }) : ({
    'Регион':               r.region || '',
    'Подразделение':        r.subdiv || '',
    'Магазин':              r.store  || '',
    'ТЦ':                   r.tc     || '',
    'Нет скан (без приходов), %': r.scanPct != null ? r.scanPct + '%' : '',
    'Нет скан, артикулов':  r.scanArt || '',
    'Нет скан, штук':       r.scanQty || '',
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Сканирование');
  XLSX.writeFile(wb, filename);
}

// ─── Main template ────────────────────────────────────────────────────────

export default function ScanningTemplate({ scanData, regionLabel, accentColor }) {
  const { loadScanningFiles } = useData();
  const navigate = useNavigate();
  const [tab, setTab] = useState('scan'); // 'scan' | 'bind'
  const [section, setSection] = useState('regions'); // 'regions' | 'subdivisions' | 'stores'

  if (!scanData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-1">Файл сканирования для {regionLabel} не загружен</p>
        <p className="text-xs text-gray-400 mb-3">Загрузите файл «Нет сканирования» для региона {regionLabel}</p>
        <label className="cursor-pointer px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: accentColor }}>
          Загрузить файл
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            multiple
            onChange={e => e.target.files?.length && loadScanningFiles(e.target.files)}
          />
        </label>
      </div>
    );
  }

  const { period, regions, subdivisions, stores } = scanData;

  const currentRows = section === 'regions'      ? regions
                    : section === 'subdivisions'  ? subdivisions
                    : stores;

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Период отчёта</p>
          <p className="font-semibold text-gray-800 text-sm">{period || '—'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 font-medium">&lt; 80% — хорошо</span>
          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 font-medium">80–90% — внимание</span>
          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-medium">≥ 90% — проблема</span>
        </div>
      </div>

      {/* Tab: Сканирование / Привязка приходов */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'scan', label: 'Сканирование' },
          { key: 'bind', label: 'Привязка приходов' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={tab === t.key
              ? { backgroundColor: accentColor, color: 'white' }
              : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#4b5563' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Section switcher */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'regions',       label: 'Регионы' },
          { key: 'subdivisions',  label: 'Подразделения' },
          { key: 'stores',        label: 'Магазины' },
        ].map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={section === s.key
              ? { backgroundColor: '#111827', color: 'white' }
              : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#4b5563' }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Export button */}
      <div className="flex justify-end">
        <button
          onClick={() => exportScan(
            currentRows,
            `Сканирование_${regionLabel}_${section}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`,
            tab
          )}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#16a34a' }}
        >
          <Download size={14} />
          Выгрузить в Excel
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {section === 'stores' ? (
          <div className="p-4">
            <StoresSection stores={stores} tab={tab} accentColor={accentColor} />
          </div>
        ) : (
          <ScanTable
            rows={currentRows}
            labelKey={section === 'regions' ? 'region' : 'subdiv'}
            label={section === 'regions' ? 'Регион / Итого' : 'Подразделение'}
            accentColor={accentColor}
            tab={tab}
          />
        )}
      </div>
    </div>
  );
}
