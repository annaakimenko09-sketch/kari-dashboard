import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, X, ChevronUp, ChevronDown, Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

function Badge({ value, type }) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-400">—</span>;
  const num = parseFloat(value);
  if (isNaN(num)) return <span className="text-gray-700 text-xs">{value}</span>;

  if (type === 'pct_shipped') {
    if (num >= 90) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{num.toFixed(1)}%</span>;
    if (num >= 70) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{num.toFixed(1)}%</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{num.toFixed(1)}%</span>;
  }
  if (type === 'pct_return') {
    if (num <= 5) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{num.toFixed(1)}%</span>;
    if (num <= 15) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{num.toFixed(1)}%</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{num.toFixed(1)}%</span>;
  }
  if (type === 'pct_writeoff') {
    if (num <= 5) return <span className="text-green-600 text-xs">{num.toFixed(1)}%</span>;
    if (num <= 15) return <span className="text-amber-600 text-xs font-medium">{num.toFixed(1)}%</span>;
    return <span className="text-red-600 text-xs font-semibold">{num.toFixed(1)}%</span>;
  }
  return <span className="text-gray-700 text-xs">{typeof num === 'number' ? num.toLocaleString('ru-RU') : value}</span>;
}

const COLUMNS = [
  { key: 'Регион', label: 'Регион', width: 'w-20' },
  { key: 'Подразделение', label: 'Подразделение', width: 'w-24' },
  { key: 'Магазин', label: 'Магазин', width: 'w-36' },
  { key: 'ТЦ', label: 'ТЦ', width: 'w-40' },
  { key: '_productGroup', label: 'Группа', width: 'w-24' },
  { key: '_reportType', label: 'Тип', width: 'w-20' },
  { key: 'Всего к вывозу, шт', label: 'К вывозу', width: 'w-24', type: 'num' },
  { key: 'Отгружено, шт', label: 'Отгружено', width: 'w-24', type: 'num' },
  { key: 'Кол-во вывозов', label: 'Вывозов', width: 'w-20', type: 'num' },
  { key: 'Отгружено товара, %', label: 'Отгруж. %', width: 'w-24', type: 'pct_shipped' },
  { key: 'Вычерк по сборке, %', label: 'Вычерк %', width: 'w-24', type: 'pct_writeoff' },
  { key: 'Возврат от агрегатора, %', label: 'Возврат %', width: 'w-24', type: 'pct_return' },
  { key: 'Вычерк + Возврат + Отменено, %', label: 'В+В+О %', width: 'w-24', type: 'pct_writeoff' },
  { key: 'Дней сборки', label: 'Дней сборки', width: 'w-24', type: 'num' },
  { key: 'Дней отгрузки', label: 'Дней отгр.', width: 'w-24', type: 'num' },
  { key: 'Осталось отгрузить пар, шт', label: 'Осталось', width: 'w-24', type: 'num' },
  { key: 'Получено, шт', label: 'Получено', width: 'w-24', type: 'num' },
  { key: 'Возврат от агрегатора, шт', label: 'Возврат шт', width: 'w-24', type: 'num' },
  { key: 'Вычерк, шт', label: 'Вычерк шт', width: 'w-24', type: 'num' },
];

// Helper: normalize column key lookup (some files use comma, some no comma)
function getVal(row, key) {
  if (row[key] !== undefined) return row[key];
  // Try without comma
  const altKey = key.replace(', ', ' ');
  if (row[altKey] !== undefined) return row[altKey];
  return null;
}

export default function ShipmentsPage() {
  const { spbBelSummary, parsedFiles } = useData();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    region: '',
    subdivision: '',
    productGroup: '',
    reportType: '',
    problemOnly: false,
  });
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const filterOptions = useMemo(() => ({
    regions: [...new Set(spbBelSummary.map(r => r['Регион']).filter(Boolean))].sort(),
    subdivisions: [...new Set(spbBelSummary.map(r => r['Подразделение']).filter(Boolean))].sort(),
    productGroups: [...new Set(spbBelSummary.map(r => r['_productGroup']).filter(Boolean))].sort(),
    reportTypes: [...new Set(spbBelSummary.map(r => r['_reportType']).filter(Boolean))].sort(),
  }), [spbBelSummary]);

  const filtered = useMemo(() => {
    let data = spbBelSummary;

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(r =>
        String(r['Магазин'] || '').toLowerCase().includes(q) ||
        String(r['ТЦ'] || '').toLowerCase().includes(q) ||
        String(r['Подразделение'] || '').toLowerCase().includes(q)
      );
    }
    if (filters.region) data = data.filter(r => r['Регион'] === filters.region);
    if (filters.subdivision) data = data.filter(r => r['Подразделение'] === filters.subdivision);
    if (filters.productGroup) data = data.filter(r => r['_productGroup'] === filters.productGroup);
    if (filters.reportType) data = data.filter(r => r['_reportType'] === filters.reportType);
    if (filters.problemOnly) {
      data = data.filter(r => {
        const sp = parseFloat(getVal(r, 'Отгружено товара, %') ?? 100) || 100;
        const wp = parseFloat(getVal(r, 'Вычерк по сборке, %') ?? 0) || 0;
        return sp < 80 || wp > 15;
      });
    }

    if (sortKey) {
      data = [...data].sort((a, b) => {
        const av = getVal(a, sortKey);
        const bv = getVal(b, sortKey);
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an;
        return sortDir === 'asc'
          ? String(av || '').localeCompare(String(bv || ''), 'ru')
          : String(bv || '').localeCompare(String(av || ''), 'ru');
      });
    }

    return data;
  }, [spbBelSummary, search, filters, sortKey, sortDir]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  }

  function clearFilters() {
    setFilters({ region: '', subdivision: '', productGroup: '', reportType: '', problemOnly: false });
    setSearch('');
    setPage(1);
  }

  function exportExcel() {
    const exportData = filtered.map(row => {
      const obj = {};
      COLUMNS.forEach(col => {
        obj[col.label] = getVal(row, col.key) ?? '';
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Вывозы');
    XLSX.writeFile(wb, 'vyvoz_spb_bel.xlsx');
  }

  if (!parsedFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Upload size={32} className="text-gray-300 mb-3" />
        <p className="text-gray-500 mb-3">Нет загруженных данных</p>
        <button onClick={() => navigate('/upload')} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
          Загрузить файлы
        </button>
      </div>
    );
  }

  const hasActiveFilters = search || filters.region || filters.subdivision || filters.productGroup || filters.reportType || filters.problemOnly;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по магазину, ТЦ..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          {/* Select filters */}
          {[
            { key: 'region', label: 'Регион', options: filterOptions.regions },
            { key: 'subdivision', label: 'Подразделение', options: filterOptions.subdivisions },
            { key: 'productGroup', label: 'Группа', options: filterOptions.productGroups },
            { key: 'reportType', label: 'Тип отчёта', options: filterOptions.reportTypes },
          ].map(({ key, label, options }) => (
            <select
              key={key}
              value={filters[key]}
              onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1); }}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
            >
              <option value="">Все ({label})</option>
              {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ))}

          {/* Problem only toggle */}
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            <input
              type="checkbox"
              checked={filters.problemOnly}
              onChange={e => { setFilters(f => ({ ...f, problemOnly: e.target.checked })); setPage(1); }}
              className="rounded text-red-600"
            />
            <span className="text-sm text-gray-600">Только проблемные</span>
          </label>

          {/* Clear & Export */}
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              <X size={14} />
              Сбросить
            </button>
          )}
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">
            <Download size={14} />
            Excel
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Найдено магазинов: <strong className="text-gray-900">{filtered.length}</strong></span>
        <span>Страница {page} из {totalPages || 1}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 whitespace-nowrap select-none"
                  >
                    <div className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-gray-400">
                    Нет данных по выбранным фильтрам
                  </td>
                </tr>
              ) : paginated.map((row, idx) => {
                const sp = parseFloat(getVal(row, 'Отгружено товара, %') ?? 100) || 100;
                const wp = parseFloat(getVal(row, 'Вычерк по сборке, %') ?? 0) || 0;
                const isProblem = sp < 80 || wp > 15;

                return (
                  <tr
                    key={idx}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isProblem ? 'bg-red-50/30' : ''}`}
                  >
                    {COLUMNS.map(col => {
                      const val = getVal(row, col.key);
                      return (
                        <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                          {col.type ? (
                            <Badge value={val} type={col.type} />
                          ) : (
                            <span className="text-gray-700">{val ?? '—'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Назад
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1.5 text-sm border rounded-lg ${page === p ? 'bg-red-600 text-white border-red-600' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                {p}
              </button>
            );
          })}
          {totalPages > 7 && <span className="text-gray-400">...</span>}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}
