/**
 * Shared dashboard template for Obuv and Kids
 */

import { useMemo, useState, useCallback } from 'react';
import { getField, getNum } from '../utils/excelParser';
import { Truck, Package, AlertTriangle, CheckCircle, TrendingDown, Upload, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useData } from '../context/DataContext';

function KpiCard({ title, value, subtitle, icon: Icon, accentColor, accent = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex gap-3 items-start
        ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      style={accent ? { borderLeft: `4px solid ${accentColor}` } : {}}
    >
      <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: accent ? `${accentColor}15` : '#f3f4f6' }}>
        <Icon size={18} style={{ color: accent ? accentColor : '#9ca3af' }} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-sm font-medium text-gray-700 mt-0.5 truncate">{title}</div>
        {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, pct, accentColor }) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : accentColor;
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
      <div className="w-36 text-xs text-gray-600 truncate flex-shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
      </div>
      <div className="w-20 text-xs font-semibold text-gray-900 text-right flex-shrink-0">{value?.toLocaleString('ru-RU') ?? '—'}</div>
      <div className="w-12 text-xs font-medium text-right flex-shrink-0" style={{ color }}>{pct.toFixed(0)}%</div>
    </div>
  );
}

function SectionTitle({ children, accentColor }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-1 h-4 rounded-full" style={{ backgroundColor: accentColor }} />
      <h2 className="text-sm font-semibold text-gray-800">{children}</h2>
    </div>
  );
}

function Tab({ active, onClick, children, accentColor }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
      style={active
        ? { backgroundColor: accentColor, color: 'white' }
        : { backgroundColor: '#f3f4f6', color: '#4b5563' }
      }
    >
      {children}
    </button>
  );
}

// Sortable table header cell
function SortTh({ label, colKey, sortKey, sortDir, onSort, className = '' }) {
  const active = sortKey === colKey;
  return (
    <th
      className={`px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 ${className}`}
      onClick={() => onSort(colKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? (sortDir === 'asc' ? <ChevronUp size={11} className="text-gray-500" /> : <ChevronDown size={11} className="text-gray-500" />)
          : <ChevronDown size={10} className="text-gray-300" />
        }
      </div>
    </th>
  );
}

function PctBadgeShip({ pct }) {
  const color = pct >= 90 ? 'bg-green-100 text-green-700' : pct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct.toFixed(1)}%</span>;
}

// Writeoff: higher = worse = more red
function PctBadgeWriteoff({ pct }) {
  const color = pct <= 5 ? 'bg-green-100 text-green-700' : pct <= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>{pct.toFixed(1)}%</span>;
}

// All columns from the report sheet to show in store table
const ALL_COLUMNS = [
  { key: 'Магазин',                       label: 'Магазин' },
  { key: 'ТЦ',                            label: 'ТЦ' },
  { key: 'Всего к вывозу шт',             label: 'К вывозу' },
  { key: 'Отгружено шт',                  label: 'Отгружено' },
  { key: 'Кол-во вывозов',                label: 'Вывозов' },
  { key: 'Отгружено товара %',            label: 'Отгр.%' },
  { key: 'Вычерк по сборке %',            label: 'Вычерк%' },
  { key: 'Возврат от агрегатора %',       label: 'Возврат%' },
  { key: 'Вычерк + Возврат + Отменено %', label: 'В+В+О%' },
  { key: 'Дней сборки',                   label: 'Дн.сборки' },
  { key: 'Дней отгрузки',                 label: 'Дн.отгр.' },
  { key: 'Осталось отгрузить пар шт',     label: 'Остаток' },
  { key: 'Получено шт',                   label: 'Получено' },
  { key: 'Возврат от агрегатора шт',      label: 'Возврат шт' },
  { key: 'Вычерк шт',                     label: 'Вычерк шт' },
  { key: 'Отгружено на чистку %',         label: 'На чистку%' },
];

function renderTableCell(row, col) {
  const val = getField(row, col.key);
  if (val === null || val === undefined) return <span className="text-gray-300 text-xs">—</span>;
  if (col.key.includes('Вычерк') && col.key.endsWith('%')) {
    const n = parseFloat(val);
    if (!isNaN(n)) return <PctBadgeWriteoff pct={n} />;
  }
  if (col.key.endsWith('%')) {
    const n = parseFloat(val);
    if (!isNaN(n)) {
      const isShipPct = col.key.includes('Отгружено');
      const isGood = isShipPct ? n >= 90 : n <= 5;
      const isWarn = isShipPct ? n >= 70 : n <= 15;
      const color = isGood ? 'bg-green-100 text-green-700' : isWarn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
      return <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${color}`}>{n.toFixed(1)}%</span>;
    }
  }
  const n = parseFloat(val);
  if (!isNaN(n)) return <span className="text-xs text-gray-700">{n.toLocaleString('ru-RU')}</span>;
  return <span className="text-xs text-gray-700">{val}</span>;
}

function useSortState(defaultKey = '', defaultDir = 'desc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);
  const handleSort = useCallback((key) => {
    setSortKey(prev => {
      if (prev === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
      else { setSortDir('desc'); }
      return key;
    });
  }, []);
  const sortFn = useCallback((arr) => {
    if (!sortKey) return arr;
    return [...arr].sort((a, b) => {
      const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
      const an = parseFloat(av), bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv), 'ru')
        : String(bv).localeCompare(String(av), 'ru');
    });
  }, [sortKey, sortDir]);
  return { sortKey, sortDir, handleSort, sortFn };
}

// Modal: all orders for a store from Детализация
function StoreOrdersModal({ storeName, detailData, accentColor, onClose }) {
  const orders = useMemo(() =>
    detailData.filter(r => String(r['Магазин'] || '').trim() === storeName),
    [detailData, storeName]
  );

  function getOrderNum(row) {
    for (const key of Object.keys(row)) {
      const v = String(row[key] || '');
      if (v.startsWith('RU') || v.startsWith('Ru')) return v;
    }
    for (const key of Object.keys(row)) {
      const k = key.toLowerCase();
      if (k.includes('номер') || k.includes('заказ')) {
        const v = String(row[key] || '');
        if (v && v !== '0') return v;
      }
    }
    return '—';
  }

  function getDate(row) {
    const v = row['Дата создания'];
    if (!v) return '—';
    if (v instanceof Date) return v.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return String(v);
  }

  function getQty(row) {
    for (const key of Object.keys(row)) {
      const k = key.toLowerCase();
      if (k.includes('количество') || k.includes('кол-во') || k.includes('пар')) {
        const n = parseFloat(row[key]);
        if (!isNaN(n) && n > 0) return n;
      }
    }
    return null;
  }

  function getDest(row) {
    return String(row['Куда перебрасываем'] || row['Куда'] || row['Комментарий (логист)'] || row['Комментарий'] || '—').trim() || '—';
  }

  const totalQty = orders.reduce((s, r) => s + (getQty(r) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">{storeName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{orders.length} заказов · {totalQty > 0 ? `${totalQty.toLocaleString('ru-RU')} пар` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        {/* Table */}
        <div className="overflow-y-auto flex-1">
          {orders.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">Нет данных по заказам в Детализации</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Заказ</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Дата</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Статус</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Кол-во</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Куда</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((row, i) => {
                  const status = String(row['Статус'] || '—');
                  const isCancelled = status.toLowerCase().includes('отмен');
                  const qty = getQty(row);
                  return (
                    <tr key={i} className={`hover:bg-gray-50 ${isCancelled ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-xs font-semibold ${isCancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {getOrderNum(row)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{getDate(row)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isCancelled ? 'bg-gray-100 text-gray-500' :
                          status.toLowerCase().includes('получено') || status.toLowerCase().includes('отгружено') ? 'bg-green-100 text-green-700' :
                          'bg-blue-50 text-blue-700'
                        }`}>{status}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-gray-800">
                        {qty != null ? qty.toLocaleString('ru-RU') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 hidden sm:table-cell max-w-[120px] truncate">{getDest(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardTemplate({
  summary,
  regionTotals,
  parsedFiles,
  accentColor,
  groupLabel,
  navigate,
  controlPath,
  vyvozPath,
}) {
  const { detailData } = useData();
  const [groupView, setGroupView] = useState('subdivision');
  const [storeSearch, setStoreSearch] = useState('');
  const [storeRegionFilter, setStoreRegionFilter] = useState('');
  const [storeSubdivFilter, setStoreSubdivFilter] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);

  // Sort states for region and subdivision tables
  const regionSort = useSortState('shipped', 'desc');
  const subdivSort = useSortState('shipped', 'desc');
  // Sort state for store table
  const [storeSortKey, setStoreSortKey] = useState('');
  const [storeSortDir, setStoreSortDir] = useState('desc');

  function handleStoreSort(key) {
    if (storeSortKey === key) setStoreSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setStoreSortKey(key); setStoreSortDir('desc'); }
  }

  // Filter only SPB stores for subdivision detail
  const spbSummary = useMemo(() => summary.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('SPB');
  }), [summary]);

  const kpi = useMemo(() => {
    const sumTotals = (key) => regionTotals.reduce((s, r) => s + getNum(r, key), 0);
    const sumAll = (key) => summary.reduce((s, r) => s + getNum(r, key), 0);

    const hasRT = regionTotals.length > 0;
    const totalToShip    = hasRT ? sumTotals('Всего к вывозу шт')         : sumAll('Всего к вывозу шт');
    const totalShipped   = hasRT ? sumTotals('Отгружено шт')              : sumAll('Отгружено шт');
    const totalReceived  = hasRT ? sumTotals('Получено шт')               : sumAll('Получено шт');
    const totalReturn    = hasRT ? sumTotals('Возврат от агрегатора шт')  : sumAll('Возврат от агрегатора шт');
    const totalWriteoff  = hasRT ? sumTotals('Вычерк шт')                : sumAll('Вычерк шт');
    const totalShipments = hasRT ? sumTotals('Кол-во вывозов')            : sumAll('Кол-во вывозов');
    const totalRemaining = hasRT ? sumTotals('Осталось отгрузить пар шт') : sumAll('Осталось отгрузить пар шт');
    const avgPct = totalToShip > 0 ? (totalShipped / totalToShip * 100) : 0;

    const problemStores = spbSummary.filter(r => {
      const sp = getNum(r, 'Отгружено товара %');
      const wp = getNum(r, 'Вычерк по сборке %');
      return (sp > 0 && sp < 80) || wp > 15;
    }).length;

    // Group by helper — accumulates all needed fields
    const groupBy = (data, key) => {
      const map = {};
      data.forEach(r => {
        const k = String(r[key] || getField(r, key) || 'Неизвестно');
        if (!map[k]) map[k] = { name: k, shipped: 0, toShip: 0, received: 0, shipments: 0, remaining: 0, writeoff: 0, stores: new Set() };
        map[k].shipped   += getNum(r, 'Отгружено шт');
        map[k].toShip    += getNum(r, 'Всего к вывозу шт');
        map[k].received  += getNum(r, 'Получено шт');
        map[k].shipments += getNum(r, 'Кол-во вывозов');
        map[k].remaining += getNum(r, 'Осталось отгрузить пар шт');
        map[k].writeoff  += getNum(r, 'Вычерк шт');
        map[k].stores.add(r['Магазин']);
      });
      return Object.values(map)
        .map(v => ({ ...v, storeCount: v.stores.size, pct: v.toShip > 0 ? v.shipped / v.toShip * 100 : 0 }))
        .sort((a, b) => b.shipped - a.shipped);
    };

    // Region data from regionTotals (accurate ИТОГО rows)
    let byRegion;
    if (hasRT) {
      const rmap = {};
      regionTotals.forEach(r => {
        const k = String(r['Регион'] || 'Неизвестно');
        if (!rmap[k]) rmap[k] = { name: k, shipped: 0, toShip: 0, received: 0, shipments: 0, remaining: 0, writeoff: 0, storeCount: 0 };
        rmap[k].shipped   += getNum(r, 'Отгружено шт');
        rmap[k].toShip    += getNum(r, 'Всего к вывозу шт');
        rmap[k].received  += getNum(r, 'Получено шт');
        rmap[k].shipments += getNum(r, 'Кол-во вывозов');
        rmap[k].remaining += getNum(r, 'Осталось отгрузить пар шт');
        rmap[k].writeoff  += getNum(r, 'Вычерк шт');
      });
      const storeCounts = {};
      summary.forEach(r => {
        const k = String(r['Регион'] || 'Неизвестно');
        if (!storeCounts[k]) storeCounts[k] = new Set();
        storeCounts[k].add(r['Магазин']);
      });
      byRegion = Object.values(rmap).map(r => ({
        ...r,
        storeCount: storeCounts[r.name]?.size || 0,
        pct: r.toShip > 0 ? r.shipped / r.toShip * 100 : 0,
      }));
    } else {
      byRegion = groupBy(summary, 'Регион');
    }

    return {
      totalToShip, totalShipped, totalReceived, totalReturn, totalWriteoff,
      totalShipments, totalRemaining, avgPct, problemStores,
      storesCount: new Set(spbSummary.map(r => r['Магазин'])).size,
      byRegion,
      bySubdivision: groupBy(spbSummary, 'Подразделение'),
      byProductGroup: groupBy(summary, '_productGroup'),
    };
  }, [summary, regionTotals, spbSummary]);

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 border" style={{ backgroundColor: `${accentColor}15`, borderColor: `${accentColor}40` }}>
          <Upload size={28} style={{ color: accentColor }} />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Нет данных</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-xs">Загрузите Excel-файлы с отчётами вывозов</p>
        <button
          onClick={() => navigate('/upload')}
          className="px-5 py-2 text-white rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: accentColor }}
        >
          Загрузить файлы
        </button>
      </div>
    );
  }

  // Group bar data
  const groupData = groupView === 'subdivision' ? kpi.bySubdivision
    : groupView === 'region' ? kpi.byRegion
    : kpi.byProductGroup;
  const maxShipped = Math.max(...groupData.map(d => d.shipped), 1);

  // Store table filtered
  const storeRegions = [...new Set(summary.map(r => r['Регион']).filter(Boolean))].sort();
  const storeSubdivs = [...new Set(spbSummary.map(r => r['Подразделение']).filter(Boolean))].sort();

  const storeRows = useMemo(() => {
    let data = summary;
    if (storeRegionFilter) data = data.filter(r => r['Регион'] === storeRegionFilter);
    if (storeSubdivFilter) data = data.filter(r => r['Подразделение'] === storeSubdivFilter);
    if (storeSearch) {
      const q = storeSearch.toLowerCase();
      data = data.filter(r => String(r['Магазин'] || '').toLowerCase().includes(q) || String(r['ТЦ'] || '').toLowerCase().includes(q));
    }
    if (storeSortKey) {
      data = [...data].sort((a, b) => {
        const av = getField(a, storeSortKey) ?? a[storeSortKey];
        const bv = getField(b, storeSortKey) ?? b[storeSortKey];
        const an = parseFloat(av), bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return storeSortDir === 'asc' ? an - bn : bn - an;
        return storeSortDir === 'asc'
          ? String(av || '').localeCompare(String(bv || ''), 'ru')
          : String(bv || '').localeCompare(String(av || ''), 'ru');
      });
    }
    return data;
  }, [summary, storeRegionFilter, storeSubdivFilter, storeSearch, storeSortKey, storeSortDir]);

  // Filter detail data for this product group
  const groupDetail = useMemo(() => {
    if (groupLabel === 'Обувь') return detailData.filter(r => r._productGroup === 'Обувь');
    if (groupLabel === 'Кидс') return detailData.filter(r => r._productGroup !== 'Обувь');
    return detailData;
  }, [detailData, groupLabel]);

  // Sorted region and subdivision data
  const sortedRegions = regionSort.sortFn(kpi.byRegion);
  const sortedSubdivs = subdivSort.sortFn(kpi.bySubdivision);

  // Table column definitions for region/subdiv
  const groupTableCols = [
    { key: 'toShip',    label: 'К вывозу' },
    { key: 'shipped',   label: 'Отгружено' },
    { key: 'pct',       label: '% отгр.' },
    { key: 'received',  label: 'Получено' },
    { key: 'remaining', label: 'Остаток' },
    { key: 'writeoff',  label: 'Вычерк шт' },
    { key: 'storeCount',label: 'Маг.' },
  ];

  return (
    <div className="space-y-5">

      {/* File badges */}
      <div className="flex flex-wrap gap-2">
        {parsedFiles.filter(f => groupLabel === 'Кидс' ? f.productGroup !== 'Обувь' : f.productGroup === 'Обувь').map(f => (
          <span key={f.fileName} className="inline-flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-600 border border-gray-200">
            <Package size={11} className="mr-1.5" style={{ color: accentColor }} />
            {f.productGroup} · {f.period || f.fileName}
          </span>
        ))}
      </div>

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Всего к вывозу"  value={kpi.totalToShip.toLocaleString('ru-RU')}   subtitle="шт · все регионы"  icon={Package}       accentColor={accentColor} accent />
        <KpiCard title="Отгружено"        value={kpi.totalShipped.toLocaleString('ru-RU')}  subtitle={`шт · ср. ${kpi.avgPct.toFixed(1)}%`} icon={Truck} accentColor={accentColor} accent onClick={() => navigate(vyvozPath)} />
        <KpiCard title="Получено"         value={kpi.totalReceived.toLocaleString('ru-RU')} subtitle="шт · все регионы"  icon={CheckCircle}   accentColor={accentColor} accent />
        <KpiCard title="Проблемных"       value={kpi.problemStores}                         subtitle={`из ${kpi.storesCount} маг. СПБ`} icon={AlertTriangle} accentColor={accentColor} accent={kpi.problemStores > 0} onClick={() => navigate(controlPath)} />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Кол-во вывозов"  value={kpi.totalShipments.toLocaleString('ru-RU')}  subtitle="заказов · все регионы"   icon={Truck}          accentColor={accentColor} />
        <KpiCard title="Остаток"          value={kpi.totalRemaining.toLocaleString('ru-RU')}  subtitle="шт · нераспределено"     icon={Package}        accentColor={accentColor} />
        <KpiCard title="Возврат"          value={kpi.totalReturn.toLocaleString('ru-RU')}     subtitle="шт · все регионы"        icon={TrendingDown}   accentColor={accentColor} />
        <KpiCard title="Вычерк"           value={kpi.totalWriteoff.toLocaleString('ru-RU')}   subtitle="шт · все регионы"        icon={AlertTriangle}  accentColor={accentColor} />
      </div>

      {/* Group bar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <SectionTitle accentColor={accentColor}>Отгружено по группировке</SectionTitle>
          <div className="flex gap-1.5 flex-wrap">
            <Tab active={groupView === 'subdivision'}  onClick={() => setGroupView('subdivision')}  accentColor={accentColor}>Подразделения СПБ</Tab>
            <Tab active={groupView === 'region'}       onClick={() => setGroupView('region')}       accentColor={accentColor}>Все регионы</Tab>
            {kpi.byProductGroup.length > 1 && (
              <Tab active={groupView === 'productGroup'} onClick={() => setGroupView('productGroup')} accentColor={accentColor}>Группы товаров</Tab>
            )}
          </div>
        </div>
        <div className="space-y-0">
          {groupData.map(d => (
            <BarRow key={d.name} label={d.name} value={d.shipped} max={maxShipped} pct={d.pct} accentColor={accentColor} />
          ))}
          {groupData.length === 0 && <p className="text-sm text-gray-400 py-4 text-center">Нет данных</p>}
        </div>
      </div>

      {/* Region + Subdivision tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* By region */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle accentColor={accentColor}>По регионам — все данные</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 text-gray-500" style={{ borderColor: `${accentColor}30` }}>
                  <SortTh label="Регион"    colKey="name"       sortKey={regionSort.sortKey} sortDir={regionSort.sortDir} onSort={regionSort.handleSort} />
                  {groupTableCols.map(c => (
                    <SortTh key={c.key} label={c.label} colKey={c.key} sortKey={regionSort.sortKey} sortDir={regionSort.sortDir} onSort={regionSort.handleSort} className="text-right" />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRegions.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-1.5 pr-2 font-medium text-gray-800 whitespace-nowrap">{r.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.toShip.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900">{r.shipped.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right"><PctBadgeShip pct={r.pct} /></td>
                    <td className="py-1.5 text-right text-gray-600">{r.received.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.remaining.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.writeoff.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-500">{r.storeCount}</td>
                  </tr>
                ))}
                {sortedRegions.length === 0 && (
                  <tr><td colSpan={8} className="py-4 text-center text-gray-400">Нет данных</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* By subdivision */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <SectionTitle accentColor={accentColor}>По подразделениям — СПБ</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 text-gray-500" style={{ borderColor: `${accentColor}30` }}>
                  <SortTh label="Подразделение" colKey="name"       sortKey={subdivSort.sortKey} sortDir={subdivSort.sortDir} onSort={subdivSort.handleSort} />
                  {groupTableCols.map(c => (
                    <SortTh key={c.key} label={c.label} colKey={c.key} sortKey={subdivSort.sortKey} sortDir={subdivSort.sortDir} onSort={subdivSort.handleSort} className="text-right" />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSubdivs.map(r => (
                  <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-1.5 pr-2 font-medium text-gray-800 whitespace-nowrap">{r.name}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.toShip.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right font-semibold text-gray-900">{r.shipped.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right"><PctBadgeShip pct={r.pct} /></td>
                    <td className="py-1.5 text-right text-gray-600">{r.received.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.remaining.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-600">{r.writeoff.toLocaleString('ru-RU')}</td>
                    <td className="py-1.5 text-right text-gray-500">{r.storeCount}</td>
                  </tr>
                ))}
                {sortedSubdivs.length === 0 && (
                  <tr><td colSpan={8} className="py-4 text-center text-gray-400">Нет данных для СПБ</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* All stores table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <SectionTitle accentColor={accentColor}>Все магазины — детальная таблица</SectionTitle>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Поиск магазина..."
              value={storeSearch}
              onChange={e => setStoreSearch(e.target.value)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1"
            />
            <select
              value={storeRegionFilter}
              onChange={e => setStoreRegionFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none"
            >
              <option value="">Все регионы</option>
              {storeRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={storeSubdivFilter}
              onChange={e => setStoreSubdivFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none"
            >
              <option value="">Все подразд.</option>
              {storeSubdivs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-2">Магазинов: <strong>{storeRows.length}</strong> <span className="text-gray-400 ml-1">— нажмите на строку для просмотра заказов</span></p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {[
                  { key: 'Регион', label: 'Регион' },
                  { key: 'Подразделение', label: 'Подразд.' },
                  ...ALL_COLUMNS,
                ].map(col => (
                  <th
                    key={col.key}
                    className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleStoreSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {storeSortKey === col.key
                        ? (storeSortDir === 'asc' ? <ChevronUp size={11} className="text-gray-500" /> : <ChevronDown size={11} className="text-gray-500" />)
                        : <ChevronDown size={10} className="text-gray-300" />
                      }
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {storeRows.length === 0 ? (
                <tr><td colSpan={ALL_COLUMNS.length + 2} className="px-4 py-6 text-center text-gray-400">Нет данных</td></tr>
              ) : storeRows.map((row, idx) => {
                const sp = getNum(row, 'Отгружено товара %');
                const wp = getNum(row, 'Вычерк по сборке %');
                const isProblem = (sp > 0 && sp < 80) || wp > 15;
                const storeName = row['Магазин'] || '';
                return (
                  <tr
                    key={idx}
                    className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors ${isProblem ? 'bg-red-50/30' : ''}`}
                    onClick={() => storeName && setSelectedStore(storeName)}
                  >
                    <td className="px-2 py-1.5 text-gray-600 whitespace-nowrap">{row['Регион'] || '—'}</td>
                    <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{row['Подразделение'] || '—'}</td>
                    {ALL_COLUMNS.map(col => (
                      <td key={col.key} className="px-2 py-1.5 whitespace-nowrap">
                        {renderTableCell(row, col)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store orders modal */}
      {selectedStore && (
        <StoreOrdersModal
          storeName={selectedStore}
          detailData={groupDetail}
          accentColor={accentColor}
          onClose={() => setSelectedStore(null)}
        />
      )}
    </div>
  );
}
