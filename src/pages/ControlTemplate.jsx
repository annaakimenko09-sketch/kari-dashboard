import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, CheckCircle, Upload, X, Package, ChevronRight } from 'lucide-react';
import { getNum } from '../utils/excelParser';
import { useData } from '../context/DataContext';

const PROBLEM_TYPES = {
  low_shipped:    { label: 'Отгр. < 70%',    color: 'red',   description: 'Низкий % отгрузки' },
  medium_shipped: { label: 'Отгр. 70-80%',   color: 'amber', description: 'Умеренный % отгрузки' },
  high_writeoff:  { label: 'Вычерк > 15%',   color: 'red',   description: 'Высокий вычерк' },
  high_return:    { label: 'Возврат > 15%',   color: 'amber', description: 'Высокий возврат' },
  remaining:      { label: 'Остаток > 0',     color: 'blue',  description: 'Есть нераспределённые пары' },
};

function getProblemTypes(row) {
  const types = [];
  const sp  = getNum(row, 'Отгружено товара %') || 100;
  const wp  = getNum(row, 'Вычерк по сборке %');
  const rp  = getNum(row, 'Возврат от агрегатора %');
  const rem = getNum(row, 'Осталось отгрузить пар шт');
  if (sp < 70) types.push('low_shipped');
  else if (sp < 80) types.push('medium_shipped');
  if (wp > 15) types.push('high_writeoff');
  if (rp > 15) types.push('high_return');
  if (rem > 0) types.push('remaining');
  return types;
}

function getSeverity(types) {
  if (types.includes('low_shipped') || types.includes('high_writeoff')) return 'critical';
  if (types.includes('medium_shipped') || types.includes('high_return')) return 'warning';
  return 'info';
}

function ProblemBadge({ type }) {
  const pt = PROBLEM_TYPES[type];
  const colorMap = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', blue: 'bg-blue-100 text-blue-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[pt.color]}`}>
      {pt.label}
    </span>
  );
}

// Classify order status
function classifyStatus(status) {
  if (!status) return 'active';
  const s = String(status).toLowerCase();
  if (s.includes('отмен') || s.includes('cancel')) return 'cancelled';
  if (s.includes('выполн') || s.includes('доставл') || s.includes('complete') || s.includes('done')) return 'completed';
  return 'active';
}

function getOrderStatusStyle(status) {
  const cls = classifyStatus(status);
  if (cls === 'cancelled') return 'bg-gray-100 text-gray-500 line-through';
  if (cls === 'completed') return 'bg-green-50 text-green-700';
  return 'bg-blue-50 text-blue-700';
}

// Find order number field
function getOrderNum(row) {
  for (const key of Object.keys(row)) {
    const v = String(row[key] || '');
    if (v.startsWith('RU') || v.startsWith('Ru')) return v;
  }
  // fallback: look for номер/заказ columns
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if (k.includes('номер') || k.includes('заказ') || k.includes('order')) {
      const v = String(row[key] || '');
      if (v && v !== '0' && v !== 'undefined') return v;
    }
  }
  return '—';
}

// Find date field
function getOrderDate(row) {
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if (k.includes('дата') || k.includes('date')) {
      const v = row[key];
      if (!v) continue;
      if (v instanceof Date) {
        return v.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
      }
      const s = String(v);
      if (s && s !== '0') return s;
    }
  }
  return '—';
}

// Find qty field
function getOrderQty(row) {
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if (k.includes('количество') || k.includes('кол-во') || k.includes('qty') || k.includes('пар')) {
      const n = getNum(row, key);
      if (n > 0) return n;
    }
  }
  return 0;
}

// Find destination field — direct read + fallback scan
function getOrderDest(row) {
  // Direct field first (including "Комментарий (логист)" which is column G in Детализация)
  const direct = row['Куда перебрасываем'] || row['Куда'] || row['Комментарий (логист)'] || row['Комментарий'];
  if (direct && String(direct).trim() && String(direct).trim() !== '0') return String(direct).trim();
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if (k.includes('куда') || k.includes('направл') || k.includes('dest')) {
      const v = String(row[key] || '').trim();
      if (v && v !== '0') return v;
    }
  }
  return '—';
}

// Find status field
function getOrderStatus(row) {
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if (k.includes('статус') || k.includes('status')) {
      const v = String(row[key] || '').trim();
      if (v && v !== '0') return v;
    }
  }
  return '—';
}

// Find shipped qty
function getOrderShipped(row) {
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase();
    if ((k.includes('отгруж') || k.includes('shipped')) && (k.includes('шт') || k.includes('кол') || k.includes('qty') || k.includes('пар'))) {
      const n = getNum(row, key);
      if (n > 0) return n;
    }
  }
  return 0;
}

// Store Detail Modal
function StoreModal({ storeName, detailData, accentColor, onClose, productGroup }) {
  const storeOrders = useMemo(() => {
    return detailData.filter(row => {
      const shop = String(row['Магазин'] || row['магазин'] || '').trim();
      return shop === storeName;
    });
  }, [detailData, storeName]);

  const totalQty = useMemo(() => storeOrders.reduce((s, r) => s + getOrderQty(r), 0), [storeOrders]);
  const totalShipped = useMemo(() => storeOrders.reduce((s, r) => s + getOrderShipped(r), 0), [storeOrders]);
  const cancelledCount = useMemo(() => storeOrders.filter(r => classifyStatus(getOrderStatus(r)) === 'cancelled').length, [storeOrders]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 text-base leading-tight">{storeName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{productGroup} · {storeOrders.length} заказов</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100 flex-shrink-0">
          {[
            { label: 'Всего заказов', value: storeOrders.length, unit: 'шт' },
            { label: 'К вывозу', value: totalQty.toLocaleString('ru-RU'), unit: 'пар' },
            { label: 'Отгружено', value: totalShipped.toLocaleString('ru-RU'), unit: 'пар' },
          ].map(m => (
            <div key={m.label} className="text-center">
              <div className="text-xs text-gray-500">{m.label}</div>
              <div className="font-bold text-gray-900 text-sm">{m.value} <span className="font-normal text-gray-400 text-xs">{m.unit}</span></div>
            </div>
          ))}
        </div>

        {cancelledCount > 0 && (
          <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex-shrink-0">
            <span className="text-xs text-gray-500">Отменено: <span className="font-semibold text-gray-700">{cancelledCount}</span> заказ(ов)</span>
          </div>
        )}

        {/* Orders list */}
        <div className="overflow-y-auto flex-1">
          {storeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package size={32} className="text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Нет данных по заказам этого магазина</p>
              <p className="text-gray-400 text-xs mt-1">Детализация не содержит записей для «{storeName}»</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 sticky top-0">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Заказ</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Дата</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Кол-во</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Отгр.</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Куда</th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {storeOrders.map((row, i) => {
                  const orderNum = getOrderNum(row);
                  const date = getOrderDate(row);
                  const qty = getOrderQty(row);
                  const shipped = getOrderShipped(row);
                  const dest = getOrderDest(row);
                  const status = getOrderStatus(row);
                  const statusCls = classifyStatus(status);

                  return (
                    <tr key={i} className={`hover:bg-gray-50 transition-colors ${statusCls === 'cancelled' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-2.5">
                        <span className={`font-mono text-xs font-semibold ${statusCls === 'cancelled' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                          {orderNum}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{date}</td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-gray-800">
                        {qty > 0 ? qty.toLocaleString('ru-RU') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-right font-semibold text-gray-800">
                        {shipped > 0 ? shipped.toLocaleString('ru-RU') : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[120px] truncate">{dest}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getOrderStatusStyle(status)}`}>
                          {statusCls === 'cancelled' ? 'Отменён' : statusCls === 'completed' ? 'Выполнен' : status !== '—' ? status : 'Активен'}
                        </span>
                      </td>
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

export default function ControlTemplate({ summary, parsedFiles, accentColor, productGroup }) {
  const navigate = useNavigate();
  const { detailData } = useData();
  const [activeFilter, setActiveFilter] = useState('all');
  const [subdivFilter, setSubdivFilter] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);

  // Filter only SPB+BEL
  const spbBelSummary = useMemo(() => summary.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('БЕЛ') || region.includes('SPB') || region.includes('BEL');
  }), [summary]);

  const problems = useMemo(() => {
    return spbBelSummary
      .map(row => {
        const types = getProblemTypes(row);
        return { row, types, severity: getSeverity(types) };
      })
      .filter(({ types }) => types.length > 0)
      .sort((a, b) => {
        const order = { critical: 0, warning: 1, info: 2 };
        return order[a.severity] - order[b.severity];
      });
  }, [spbBelSummary]);

  const subdivisions = useMemo(() => {
    return [...new Set(problems.map(p => p.row['Подразделение']).filter(Boolean))].sort();
  }, [problems]);

  const filtered = useMemo(() => {
    let data = problems;
    if (activeFilter !== 'all') data = data.filter(p => p.severity === activeFilter || p.types.includes(activeFilter));
    if (subdivFilter) data = data.filter(p => p.row['Подразделение'] === subdivFilter);
    return data;
  }, [problems, activeFilter, subdivFilter]);

  const counts = useMemo(() => ({
    all:      problems.length,
    critical: problems.filter(p => p.severity === 'critical').length,
    warning:  problems.filter(p => p.severity === 'warning').length,
    info:     problems.filter(p => p.severity === 'info').length,
  }), [problems]);

  // Filter detail data for this product group
  const filteredDetail = useMemo(() => {
    if (!productGroup) return detailData;
    if (productGroup === 'Обувь') return detailData.filter(r => r._productGroup === 'Обувь');
    return detailData.filter(r => r._productGroup !== 'Обувь');
  }, [detailData, productGroup]);

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-3">Нет загруженных данных</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 text-white rounded-lg text-sm font-medium" style={{ backgroundColor: accentColor }}>
          Загрузить файлы
        </button>
      </div>
    );
  }

  const SEVERITY = {
    critical: { icon: AlertCircle,   bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500' },
    warning:  { icon: AlertTriangle, bg: 'bg-amber-50',  border: 'border-amber-200',  dot: 'bg-amber-500' },
    info:     { icon: CheckCircle,   bg: 'bg-blue-50',   border: 'border-blue-200',   dot: 'bg-blue-500' },
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle size={18} className="text-red-600" />
          <span className="font-semibold text-red-800">{counts.all} магазинов требуют внимания (СПБ)</span>
        </div>
        <div className="text-xs text-red-600">
          Критерии: Отгружено &lt; 80%, Вычерк &gt; 15%, Возврат &gt; 15%, Остаток &gt; 0
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all',      label: `Все (${counts.all})`,                     desc: null },
          { key: 'critical', label: `Критические (${counts.critical})`,         desc: 'Отгр. < 70% или Вычерк > 15%' },
          { key: 'warning',  label: `Предупреждения (${counts.warning})`,       desc: 'Отгр. 70–80% или Возврат > 15%' },
          { key: 'info',     label: `Информационные (${counts.info})`,          desc: 'Остаток > 0' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex flex-col items-start leading-tight"
            style={activeFilter === tab.key
              ? { backgroundColor: accentColor, color: 'white' }
              : { backgroundColor: 'white', border: '1px solid #e5e7eb', color: '#4b5563' }
            }
          >
            <span>{tab.label}</span>
            {tab.desc && (
              <span className="text-xs font-normal mt-0.5" style={{ opacity: 0.7 }}>{tab.desc}</span>
            )}
          </button>
        ))}

        <select value={subdivFilter} onChange={e => setSubdivFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none">
          <option value="">Все подразделения</option>
          {subdivisions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Problem cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle size={32} className="text-green-500 mx-auto mb-2" />
            <p className="text-green-700 font-medium">Нет проблемных магазинов</p>
            <p className="text-green-600 text-sm">По выбранным фильтрам все показатели в норме</p>
          </div>
        )}

        {filtered.map(({ row, types, severity }, idx) => {
          const sv = SEVERITY[severity];
          const sp  = getNum(row, 'Отгружено товара %');
          const wp  = getNum(row, 'Вычерк по сборке %');
          const rp  = getNum(row, 'Возврат от агрегатора %');
          const rem = getNum(row, 'Осталось отгрузить пар шт');
          const shipped  = getNum(row, 'Отгружено шт');
          const toShip   = getNum(row, 'Всего к вывозу шт');
          const storeName = row['Магазин'] || '—';

          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 ${sv.bg} ${sv.border} cursor-pointer hover:shadow-md transition-shadow`}
              onClick={() => setSelectedStore(storeName)}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${sv.dot}`} />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{storeName}</span>
                    <span className="text-gray-500 text-xs">{row['ТЦ'] || ''}</span>
                    <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                      Подробнее <ChevronRight size={12} />
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {row['Подразделение'] || ''} · {row['_productGroup']} · {row['Регион']}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {types.map(t => <ProblemBadge key={t} type={t} />)}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                      { label: 'К вывозу',   value: toShip.toLocaleString('ru-RU'),  unit: 'шт',  alert: false },
                      { label: 'Отгружено',  value: shipped.toLocaleString('ru-RU'), unit: 'шт',  alert: false },
                      { label: 'Отгруж. %',  value: sp.toFixed(1),                   unit: '%',   alert: sp < 80 },
                      { label: 'Вычерк %',   value: wp.toFixed(1),                   unit: '%',   alert: wp > 15 },
                      { label: 'Возврат %',  value: rp.toFixed(1),                   unit: '%',   alert: rp > 15 },
                      { label: 'Остаток',    value: rem.toLocaleString('ru-RU'),      unit: 'шт',  alert: rem > 0 },
                    ].map(m => (
                      <div key={m.label} className="bg-white/60 rounded-lg p-2">
                        <div className="text-xs text-gray-500">{m.label}</div>
                        <div className={`text-sm font-semibold ${m.alert ? 'text-red-700' : 'text-gray-900'}`}>
                          {m.value} <span className="text-xs font-normal text-gray-400">{m.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Store detail modal */}
      {selectedStore && (
        <StoreModal
          storeName={selectedStore}
          detailData={filteredDetail}
          accentColor={accentColor}
          productGroup={productGroup}
          onClose={() => setSelectedStore(null)}
        />
      )}
    </div>
  );
}
