import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Upload, Clock, AlertTriangle, AlertCircle, CheckCircle, XCircle, X, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    const m = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return new Date(+m[3], +m[2]-1, +m[1]);
    const m2 = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3]);
  }
  return null;
}

function daysSince(dateVal) {
  const d = parseDate(dateVal);
  if (!d) return null;
  return Math.floor((new Date().getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function classifyStatus(status) {
  if (!status) return 'unknown';
  const s = String(status).toLowerCase();
  if (s.includes('получено')) return 'completed';
  if (s.includes('отгружено')) return 'completed';
  if (s.includes('отмен')) return 'cancelled';
  if (s.includes('собрано')) return 'assembled';
  return 'active';
}

function getUrgency(days) {
  if (days === null) return null;
  if (days > 12) return 'critical';
  if (days > 10) return 'high';
  if (days > 7)  return 'medium';
  return 'ok';
}

const URGENCY_CONFIG = {
  completed: { label: 'Выполнено',      bg: 'bg-green-50',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-600',  icon: CheckCircle,   days: 'Получено/Отгружено', tabSuffix: '' },
  cancelled: { label: 'Отменено',       bg: 'bg-gray-50',   badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400',   icon: XCircle,       days: 'Отменён',            tabSuffix: '' },
  assembled: { label: 'Собрано',        bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',   icon: CheckCircle,   days: 'Собрано',            tabSuffix: '' },
  critical:  { label: 'Особо критично', bg: 'bg-red-50',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-600',    icon: AlertCircle,   days: '> 12 дней',          tabSuffix: '> 12 дн.' },
  high:      { label: 'Особый контроль',bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', icon: AlertTriangle, days: '> 10 дней',          tabSuffix: '> 10 дн.' },
  medium:    { label: 'Контроль',       bg: 'bg-amber-50',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',  icon: Clock,         days: '> 7 дней',           tabSuffix: '> 7 дн.' },
  ok:        { label: 'В работе',       bg: 'bg-white',     badge: 'bg-gray-100 text-gray-600',     dot: 'bg-green-500',  icon: CheckCircle,   days: '≤ 7 дней',           tabSuffix: '≤ 7 дн.' },
};

function exportToExcel(rows, filename) {
  const data = rows.map(({ row, days, urgency }) => {
    const cfg = URGENCY_CONFIG[urgency];
    return {
      'Срочность':          cfg?.label || urgency,
      'Период':             cfg?.days || '',
      'Подразделение':      row['Подразделение'] || '',
      'Магазин':            row['Магазин'] || '',
      'Дата создания':      row['Дата создания'] || '',
      'Номер заказа':       getOrderNum(row) || '',
      'Дней':               days != null ? days : '',
      'Статус':             row['Статус'] || '',
      'Куда перебрасываем': row['Куда перебрасываем'] || row['Куда'] || row['Комментарий (логист)'] || row['Комментарий'] || '',
      'Группа':             row['_productGroup'] || '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Заказы');
  XLSX.writeFile(wb, filename);
}

// Detect destination platform from "Куда перебрасываем" field
function getDestination(row) {
  const val = String(row['Куда перебрасываем'] || row['Куда'] || row['Комментарий (логист)'] || row['Комментарий'] || '').toLowerCase();
  if (val.includes('ozon') || val.includes('озон')) return 'Ozon';
  if (val.includes('wb') || val.includes('wildberries') || val.includes('вайлдб')) return 'WB';
  if (val.includes('соф') || val.includes('sof') || val.includes('склад')) return 'СОФ';
  return null;
}

function getOrderNum(row) {
  for (const key of ['Номер заказа', 'Заказ', 'Номер', 'Заявка', '№ заказа', '№']) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return String(row[key]);
  }
  for (const key of Object.keys(row)) {
    const val = String(row[key] || '');
    if (val.startsWith('RU') || val.startsWith('Ru')) return val;
  }
  for (const key of Object.keys(row)) {
    const kl = key.toLowerCase();
    if (kl.includes('номер') || kl.includes('заказ') || kl.includes('заявк')) {
      const val = row[key];
      if (val !== null && val !== undefined && val !== '') return String(val);
    }
  }
  return null;
}

// Get quantity from order row
function getQty(row) {
  for (const key of Object.keys(row)) {
    const kl = key.toLowerCase();
    if (kl.includes('количество') || kl.includes('кол-во') || kl === 'шт' || kl.includes('пар')) {
      const val = parseFloat(row[key]);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

// Cancelled orders modal
function CancelledModal({ cancelledOrders, onClose }) {
  // Group by store
  const byStore = useMemo(() => {
    const map = {};
    cancelledOrders.forEach(({ row }) => {
      const store = String(row['Магазин'] || row['магазин'] || '—');
      if (!map[store]) map[store] = [];
      map[store].push(row);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [cancelledOrders]);

  const totalQty = cancelledOrders.reduce((s, { row }) => s + (getQty(row) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base">Отменённые заказы</h2>
            <p className="text-xs text-gray-400 mt-0.5">{cancelledOrders.length} заказов · {totalQty > 0 ? `${totalQty.toLocaleString('ru-RU')} пар` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto flex-1">
          {byStore.map(([store, orders]) => {
            const storeQty = orders.reduce((s, r) => s + (getQty(r) || 0), 0);
            return (
              <div key={store} className="border-b border-gray-100 last:border-0">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50">
                  <span className="font-semibold text-gray-800 text-sm">{store}</span>
                  <span className="text-xs text-gray-500">{orders.length} заказ(ов) · {storeQty > 0 ? `${storeQty.toLocaleString('ru-RU')} пар` : '—'}</span>
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    {orders.map((row, i) => {
                      const orderNum = getOrderNum(row);
                      const qty = getQty(row);
                      const dest = String(row['Куда перебрасываем'] || row['Куда'] || row['Комментарий (логист)'] || row['Комментарий'] || '—').trim();
                      const date = row['Дата создания'] ? String(row['Дата создания']) : '—';
                      return (
                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2">
                            <span className="font-mono font-semibold text-gray-400 line-through">{orderNum || '—'}</span>
                          </td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{date}</td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-600">
                            {qty != null ? `${qty.toLocaleString('ru-RU')} пар` : '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-400 whitespace-nowrap">{dest}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { spbDetail, parsedFiles } = useData();
  const navigate = useNavigate();
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [cancelledModalOpen, setCancelledModalOpen] = useState(false);
  const [destFilter, setDestFilter]       = useState('all');  // Ozon / WB / СОФ / all
  const [statusFilter, setStatusFilter]   = useState('');
  const [subdivFilter, setSubdivFilter]   = useState('');
  const [groupFilter, setGroupFilter]     = useState('');
  const [dateFrom, setDateFrom]           = useState('');  // YYYY-MM-DD

  const enriched = useMemo(() => {
    return spbDetail
      .map(row => {
        const statusClass = classifyStatus(row['Статус']);
        if (statusClass === 'completed') return { row, days: null, urgency: 'completed' };
        if (statusClass === 'cancelled') return { row, days: null, urgency: 'cancelled' };
        if (statusClass === 'assembled') return { row, days: null, urgency: 'assembled' };
        const days = daysSince(row['Дата создания']);
        const urgency = days !== null ? getUrgency(days) : null;
        return { row, days, urgency };
      })
      .filter(r => r.urgency !== null);
  }, [spbDetail]);

  const overdue = useMemo(() =>
    enriched.filter(r => r.urgency !== 'ok' && r.urgency !== 'completed' && r.urgency !== 'cancelled' && r.urgency !== 'assembled'),
  [enriched]);

  // Cancellation stats
  const cancelStats = useMemo(() => {
    const cancelled = enriched.filter(r => r.urgency === 'cancelled');
    let totalQty = 0;
    cancelled.forEach(({ row }) => { const q = getQty(row); if (q) totalQty += q; });
    return { count: cancelled.length, qty: totalQty };
  }, [enriched]);

  const allShown = useMemo(() => {
    let data = urgencyFilter === 'overdue' ? overdue : enriched;
    if (urgencyFilter !== 'all' && urgencyFilter !== 'overdue') {
      data = enriched.filter(r => r.urgency === urgencyFilter);
    }
    if (destFilter !== 'all') {
      data = data.filter(r => getDestination(r.row) === destFilter);
    }
    if (statusFilter) data = data.filter(r => String(r.row['Статус'] || '') === statusFilter);
    if (subdivFilter) data = data.filter(r => String(r.row['Подразделение'] || '') === subdivFilter);
    if (groupFilter)  data = data.filter(r => String(r.row['_productGroup'] || '') === groupFilter);
    if (dateFrom) {
      const from = new Date(dateFrom);
      data = data.filter(r => {
        const d = parseDate(r.row['Дата создания']);
        return d && d >= from;
      });
    }
    return data.sort((a, b) => {
      const orderMap = { critical: 0, high: 1, medium: 2, ok: 3, assembled: 4, cancelled: 5, completed: 6 };
      const ao = orderMap[a.urgency] ?? 9, bo = orderMap[b.urgency] ?? 9;
      if (ao !== bo) return ao - bo;
      return (b.days || 0) - (a.days || 0);
    });
  }, [enriched, overdue, urgencyFilter, destFilter, statusFilter, subdivFilter, groupFilter, dateFrom]);

  const counts = useMemo(() => ({
    total:     enriched.length,
    completed: enriched.filter(r => r.urgency === 'completed').length,
    cancelled: enriched.filter(r => r.urgency === 'cancelled').length,
    assembled: enriched.filter(r => r.urgency === 'assembled').length,
    overdue:   overdue.length,
    critical:  enriched.filter(r => r.urgency === 'critical').length,
    high:      enriched.filter(r => r.urgency === 'high').length,
    medium:    enriched.filter(r => r.urgency === 'medium').length,
    ok:        enriched.filter(r => r.urgency === 'ok').length,
  }), [enriched, overdue]);

  const statuses = useMemo(() => [...new Set(spbDetail.map(r => r['Статус']).filter(Boolean))].sort(), [spbDetail]);
  const subdivs  = useMemo(() => [...new Set(spbDetail.map(r => r['Подразделение']).filter(Boolean))].sort(), [spbDetail]);
  const groups   = useMemo(() => [...new Set(spbDetail.map(r => r['_productGroup']).filter(Boolean))].sort(), [spbDetail]);

  // Unique sorted dates from real data (for dropdown)
  const availableDates = useMemo(() => {
    const seen = new Set();
    spbDetail.forEach(r => {
      const raw = r['Дата создания'];
      if (!raw) return;
      const d = parseDate(raw);
      if (!d) return;
      // Normalise to YYYY-MM-DD for <select> value
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      seen.add(key);
    });
    return [...seen].sort(); // ascending
  }, [spbDetail]);

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-3">Нет загруженных данных</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 bg-[#f59e0b] text-white rounded-lg text-sm font-medium">
          Загрузить файлы
        </button>
      </div>
    );
  }

  if (spbDetail.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Clock size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500">Нет данных детализации для СПБ</p>
        <p className="text-xs text-gray-400 mt-1">Загрузите файл с листом «Детализация»</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'completed', label: 'Выполнено',       value: counts.completed, color: '#16a34a' },
          { key: 'overdue',   label: 'Просроченных',    value: counts.overdue,   color: '#ef4444' },
          { key: 'critical',  label: 'Особо критично',  value: counts.critical,  color: '#dc2626' },
          { key: 'high',      label: 'Особый контроль', value: counts.high,      color: '#f97316' },
        ].map(c => (
          <div key={c.key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
            style={{ borderLeft: `4px solid ${c.color}` }}>
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-sm text-gray-600 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Legend + Cancellation stats */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Критерии контроля</p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(URGENCY_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div>
                    <span className="text-xs font-semibold text-gray-700">{cfg.label}</span>
                    <span className="text-xs text-gray-400 ml-1">({cfg.days})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Cancellation block — clickable */}
          {cancelStats.count > 0 && (
            <button
              onClick={() => setCancelledModalOpen(true)}
              className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center min-w-[140px] hover:bg-gray-100 hover:shadow-sm transition-all cursor-pointer"
            >
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Отменено</p>
              <p className="text-2xl font-bold text-gray-700">{cancelStats.count}</p>
              <p className="text-xs text-gray-500">заказов</p>
              {cancelStats.qty > 0 && (
                <p className="text-sm font-semibold text-gray-600 mt-1">{cancelStats.qty.toLocaleString('ru-RU')} шт</p>
              )}
              <p className="text-xs text-gray-400 mt-1">нажмите для деталей</p>
            </button>
          )}
        </div>
      </div>

      {/* Destination filter buttons (Ozon / WB / СОФ) */}
      <div className="flex flex-wrap gap-2">
        <p className="text-xs text-gray-500 self-center">Куда:</p>
        {['all', 'Ozon', 'WB', 'СОФ'].map(d => (
          <button key={d}
            onClick={() => setDestFilter(d)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={destFilter === d
              ? { backgroundColor: '#0ea5e9', color: 'white' }
              : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#4b5563' }
            }
          >
            {d === 'all' ? 'Все направления' : d}
          </button>
        ))}
      </div>

      {/* Urgency filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',       label: 'Все',            count: counts.total,     suffix: '' },
          { key: 'overdue',   label: 'Просроченные',   count: counts.overdue,   suffix: '' },
          { key: 'critical',  label: 'Особо критично', count: counts.critical,  suffix: '> 12 дн.' },
          { key: 'high',      label: 'Особый контроль',count: counts.high,      suffix: '> 10 дн.' },
          { key: 'medium',    label: 'Контроль',       count: counts.medium,    suffix: '> 7 дн.' },
          { key: 'ok',        label: 'В работе',       count: counts.ok,        suffix: '≤ 7 дн.' },
          { key: 'assembled', label: 'Собрано',        count: counts.assembled, suffix: '' },
          { key: 'completed', label: 'Выполнено',      count: counts.completed, suffix: '' },
          { key: 'cancelled', label: 'Отменено',       count: counts.cancelled, suffix: '' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setUrgencyFilter(tab.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex flex-col items-center leading-tight"
            style={urgencyFilter === tab.key
              ? { backgroundColor: '#f59e0b', color: 'white' }
              : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#4b5563' }
            }
          >
            <span>{tab.label} ({tab.count})</span>
            {tab.suffix && (
              <span className="text-xs opacity-70 font-normal">{tab.suffix}</span>
            )}
          </button>
        ))}
      </div>

      {/* Secondary filters row */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none">
          <option value="">Все статусы</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={subdivFilter} onChange={e => setSubdivFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none">
          <option value="">Все подразделения</option>
          {subdivs.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none">
          <option value="">Все группы</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 whitespace-nowrap">Дата создания от:</span>
          <select
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">Все даты</option>
            {availableDates.map(d => {
              // Display as DD.MM.YYYY
              const [y, m, day] = d.split('-');
              return <option key={d} value={d}>{`${day}.${m}.${y}`}</option>;
            })}
          </select>
          {dateFrom && (
            <button onClick={() => setDateFrom('')} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-gray-500">Заказов: <strong className="text-gray-900">{allShown.length}</strong></p>
        <button
          onClick={() => {
            const tabLabel = urgencyFilter === 'all' ? 'Все' : urgencyFilter === 'overdue' ? 'Просроченные' : URGENCY_CONFIG[urgencyFilter]?.label || urgencyFilter;
            exportToExcel(allShown, `Заказы_${tabLabel}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white rounded-lg transition-colors"
          style={{ backgroundColor: '#16a34a' }}
        >
          <Download size={14} />
          Выгрузить в Excel
        </button>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Срочность</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Подразделение</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Магазин</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Дата создания</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Номер заказа</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Дней</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Статус</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Куда перебрасываем</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Группа</th>
              </tr>
            </thead>
            <tbody>
              {allShown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    Нет заказов по выбранным фильтрам
                  </td>
                </tr>
              ) : allShown.map(({ row, days, urgency }, idx) => {
                const cfg = URGENCY_CONFIG[urgency];
                const IconComp = cfg.icon;
                const orderNum = getOrderNum(row);
                const isCancelled = urgency === 'cancelled';
                const isCompleted = urgency === 'completed';
                return (
                  <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50 ${cfg.bg} ${isCancelled ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                        <IconComp size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row['Подразделение'] || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">{row['Магазин'] || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row['Дата создания'] || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {orderNum
                        ? <span className={`font-mono text-xs font-semibold ${isCancelled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{orderNum}</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isCompleted || isCancelled
                        ? <span className={`text-xs ${isCompleted ? 'text-green-600' : 'text-gray-400'}`}>{isCompleted ? '✓' : '✗'}</span>
                        : <span className={`font-bold text-sm ${urgency === 'critical' ? 'text-red-700' : urgency === 'high' ? 'text-orange-600' : urgency === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
                            {days}
                          </span>
                      }
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={isCompleted ? 'text-green-700 font-medium' : isCancelled ? 'text-gray-400' : 'text-gray-700'}>
                        {row['Статус'] || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row['Куда перебрасываем'] || row['Куда'] || row['Комментарий (логист)'] || row['Комментарий'] || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row['_productGroup'] || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cancelled modal */}
      {cancelledModalOpen && (
        <CancelledModal
          cancelledOrders={enriched.filter(r => r.urgency === 'cancelled')}
          onClose={() => setCancelledModalOpen(false)}
        />
      )}
    </div>
  );
}
