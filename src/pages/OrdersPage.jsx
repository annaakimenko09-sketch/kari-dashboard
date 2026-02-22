import { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Upload, Clock, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

// Parse date from "dd.mm.yyyy" or JS Date
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    // dd.mm.yyyy
    const m = val.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (m) return new Date(+m[3], +m[2]-1, +m[1]);
    // yyyy-mm-dd
    const m2 = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3]);
  }
  return null;
}

function daysSince(dateVal) {
  const d = parseDate(dateVal);
  if (!d) return null;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Urgency levels based on days overdue
function getUrgency(days) {
  if (days === null) return null;
  if (days > 12) return 'critical';   // особо критично
  if (days > 10) return 'high';       // особый контроль
  if (days > 7)  return 'medium';     // контроль
  return 'ok';                        // в работе (<=7)
}

const URGENCY_CONFIG = {
  critical: { label: 'Особо критично',  bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-600',    icon: AlertCircle,   days: '> 12 дней' },
  high:     { label: 'Особый контроль', bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', icon: AlertTriangle, days: '> 10 дней' },
  medium:   { label: 'Контроль',        bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',  icon: Clock,         days: '> 7 дней' },
  ok:       { label: 'В работе',        bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  icon: CheckCircle,   days: '≤ 7 дней' },
};

export default function OrdersPage() {
  const { spbDetail, parsedFiles } = useData();
  const navigate = useNavigate();
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [statusFilter, setStatusFilter]   = useState('');
  const [subdivFilter, setSubdivFilter]   = useState('');
  const [groupFilter, setGroupFilter]     = useState('');

  // Enrich rows with urgency
  const enriched = useMemo(() => {
    return spbDetail
      .map(row => {
        const days = daysSince(row['Дата создания']);
        const urgency = days !== null ? getUrgency(days) : null;
        return { row, days, urgency };
      })
      .filter(r => r.urgency !== null);
  }, [spbDetail]);

  // Filter overdue (>7 days) and all statuses
  const overdue = useMemo(() => enriched.filter(r => r.urgency !== 'ok'), [enriched]);

  const allShown = useMemo(() => {
    let data = urgencyFilter === 'overdue' ? overdue : enriched;
    if (urgencyFilter !== 'all' && urgencyFilter !== 'overdue') {
      data = enriched.filter(r => r.urgency === urgencyFilter);
    }
    if (statusFilter) data = data.filter(r => String(r.row['Статус'] || '') === statusFilter);
    if (subdivFilter) data = data.filter(r => String(r.row['Подразделение'] || '') === subdivFilter);
    if (groupFilter)  data = data.filter(r => String(r.row['_productGroup'] || '') === groupFilter);
    return data.sort((a, b) => (b.days || 0) - (a.days || 0));
  }, [enriched, overdue, urgencyFilter, statusFilter, subdivFilter, groupFilter]);

  const counts = useMemo(() => ({
    total:    enriched.length,
    overdue:  overdue.length,
    critical: enriched.filter(r => r.urgency === 'critical').length,
    high:     enriched.filter(r => r.urgency === 'high').length,
    medium:   enriched.filter(r => r.urgency === 'medium').length,
    ok:       enriched.filter(r => r.urgency === 'ok').length,
  }), [enriched, overdue]);

  const statuses   = useMemo(() => [...new Set(spbDetail.map(r => r['Статус']).filter(Boolean))].sort(), [spbDetail]);
  const subdivs    = useMemo(() => [...new Set(spbDetail.map(r => r['Подразделение']).filter(Boolean))].sort(), [spbDetail]);
  const groups     = useMemo(() => [...new Set(spbDetail.map(r => r['_productGroup']).filter(Boolean))].sort(), [spbDetail]);

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-3">Нет загруженных данных</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 bg-[#f59e0b] text-white rounded-lg text-sm font-medium hover:bg-[#d97706]">
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
          { key: 'overdue',  label: 'Просроченных',    value: counts.overdue,  color: '#ef4444' },
          { key: 'critical', label: 'Особо критично',  value: counts.critical, color: '#dc2626' },
          { key: 'high',     label: 'Особый контроль', value: counts.high,     color: '#f97316' },
          { key: 'medium',   label: 'На контроле',     value: counts.medium,   color: '#f59e0b' },
        ].map(c => (
          <div key={c.key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4"
            style={{ borderLeft: `4px solid ${c.color}` }}>
            <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-sm text-gray-600 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Критерии контроля</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
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

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',      label: `Все заказы (${counts.total})` },
          { key: 'overdue',  label: `Просроченные (${counts.overdue})` },
          { key: 'critical', label: `Особо критично (${counts.critical})` },
          { key: 'high',     label: `Особый контроль (${counts.high})` },
          { key: 'medium',   label: `Контроль (${counts.medium})` },
          { key: 'ok',       label: `В работе (${counts.ok})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setUrgencyFilter(tab.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={urgencyFilter === tab.key
              ? { backgroundColor: '#f59e0b', color: 'white' }
              : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#4b5563' }
            }
          >
            {tab.label}
          </button>
        ))}

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
      </div>

      <p className="text-sm text-gray-500 px-1">Заказов: <strong className="text-gray-900">{allShown.length}</strong></p>

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Срочность</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Дней</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Дата создания</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Статус</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Подразделение</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Магазин</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Куда перебрасываем</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">Группа</th>
                {/* Show all other detail columns dynamically */}
              </tr>
            </thead>
            <tbody>
              {allShown.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    {urgencyFilter === 'ok' ? 'Нет заказов в работе' : 'Нет просроченных заказов — отлично!'}
                  </td>
                </tr>
              ) : allShown.map(({ row, days, urgency }, idx) => {
                const cfg = URGENCY_CONFIG[urgency];
                const IconComp = cfg.icon;
                return (
                  <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50 ${cfg.bg}`}>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
                        <IconComp size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`font-bold text-sm ${urgency === 'critical' ? 'text-red-700' : urgency === 'high' ? 'text-orange-600' : urgency === 'medium' ? 'text-amber-600' : 'text-green-600'}`}>
                        {days}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row['Дата создания'] || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="text-gray-700">{row['Статус'] || '—'}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row['Подразделение'] || '—'}</td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap font-medium">{row['Магазин'] || '—'}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row['Куда перебрасываем'] || row['Куда'] || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{row['_productGroup'] || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
