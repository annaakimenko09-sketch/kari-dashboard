import { Fragment, useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx-js-style';
import { Download, ChevronDown, ChevronRight, ChevronUp, ArrowUpDown } from 'lucide-react';

function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('ru-RU', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Строка с раскрывающимся списком артикулов для сезона/направления
function DetailPanel({ items, regions, colSpan }) {
  // По умолчанию — сортировка по убыванию (от большего к меньшему) по первому региону
  const [sortCol, setSortCol] = useState(regions[0] || null);
  const [sortDir, setSortDir] = useState('desc');

  const sortedItems = useMemo(() => {
    if (!items || !sortCol) return items;
    const copy = [...items];
    copy.sort((a, b) => {
      if (sortCol === 'article') {
        const cmp = String(a.article).localeCompare(String(b.article), 'ru');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const av = a.values[sortCol];
      const bv = b.values[sortCol];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return copy;
  }, [items, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  }

  function SortIcon({ col }) {
    if (sortCol !== col) return <ArrowUpDown size={11} className="inline text-gray-300 ml-0.5" />;
    return sortDir === 'desc'
      ? <ChevronDown size={12} className="inline text-blue-500 ml-0.5" />
      : <ChevronUp size={12} className="inline text-blue-500 ml-0.5" />;
  }

  if (!items || items.length === 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-4 py-3 bg-gray-50 text-xs text-gray-400 text-center">
          Нет данных по артикулам
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <table className="text-xs w-full" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '260px' }} />
            {regions.map(r => <col key={r} style={{ width: '70px' }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200">
              <th
                className="text-left px-2 py-1.5 text-gray-500 font-semibold sticky left-0 z-20 bg-gray-50 cursor-pointer select-none hover:text-gray-700 border-r border-gray-200"
                style={{ top: 37 }}
                onClick={() => handleSort('article')}
              >
                Артикул<SortIcon col="article" />
              </th>
              {regions.map(r => (
                <th
                  key={r}
                  className="text-center px-2 py-1.5 text-gray-500 font-semibold sticky z-10 bg-gray-50 cursor-pointer select-none hover:text-gray-700"
                  style={{ top: 37 }}
                  onClick={() => handleSort(r)}
                >
                  {r}<SortIcon col={r} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedItems.map((item, i) => (
              <tr key={i} className="group border-b border-gray-100 hover:bg-gray-100">
                <td className="px-2 py-1 text-gray-700 truncate sticky left-0 z-10 bg-gray-50 group-hover:bg-gray-100 border-r border-gray-200" title={item.article}>{item.article}</td>
                {regions.map(r => (
                  <td key={r} className="px-2 py-1 text-center text-gray-700">{fmtPct(item.values[r])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

export default function SalesShareUnitsPage() {
  const { regionGrowth } = useData();
  const salesShare = regionGrowth?.salesShare || null;
  const [expanded, setExpanded] = useState(new Set());

  const regions = regionGrowth?.regions || [];
  const colSpan = regions.length + 1;

  const detailsBySeason = useMemo(() => {
    const map = {};
    if (!salesShare) return map;
    for (const d of salesShare.details) {
      if (!map[d.season]) map[d.season] = [];
      map[d.season].push(d);
    }
    return map;
  }, [salesShare]);

  const detailsBySeasonDirection = useMemo(() => {
    const map = {};
    if (!salesShare) return map;
    for (const d of salesShare.details) {
      const key = `${d.season}||${d.direction}`;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [salesShare]);

  function toggle(key) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function exportToExcel() {
    if (!salesShare) return;
    const wb = XLSX.utils.book_new();

    const headerStyle = {
      font: { bold: true, color: { rgb: '374151' } },
      fill: { fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
    };
    const cellStyle = { alignment: { horizontal: 'center', vertical: 'center' }, numFmt: '0.0%' };

    // Лист 1: Сводная
    {
      const headers = ['Сезон', 'Направление', ...regions];
      const rows = [];
      if (salesShare.grandTotal) {
        rows.push(['Общий итог', '', ...regions.map(r => salesShare.grandTotal.values[r])]);
      }
      for (const season of salesShare.seasons) {
        rows.push([season.label, 'Всего', ...regions.map(r => season.total[r])]);
        for (const dir of season.directions) {
          rows.push(['', dir.label, ...regions.map(r => dir.values[r])]);
        }
      }
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      headers.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (ws[addr]) ws[addr].s = headerStyle;
      });
      rows.forEach((row, ri) => {
        row.forEach((_, ci) => {
          const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          if (ws[addr]) ws[addr].s = cellStyle;
        });
      });
      ws['!cols'] = [{ wch: 22 }, { wch: 20 }, ...regions.map(() => ({ wch: 12 }))];
      XLSX.utils.book_append_sheet(wb, ws, 'Сводная');
    }

    // Лист 2: Детально
    {
      const headers = ['Сезон', 'Направление', 'Артикул', ...regions];
      const rows = salesShare.details.map(d => [
        d.season, d.direction || '', d.article, ...regions.map(r => d.values[r]),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      headers.forEach((_, ci) => {
        const addr = XLSX.utils.encode_cell({ r: 0, c: ci });
        if (ws[addr]) ws[addr].s = headerStyle;
      });
      rows.forEach((row, ri) => {
        row.forEach((_, ci) => {
          const addr = XLSX.utils.encode_cell({ r: ri + 1, c: ci });
          if (ws[addr]) ws[addr].s = cellStyle;
        });
      });
      ws['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 40 }, ...regions.map(() => ({ wch: 12 }))];
      XLSX.utils.book_append_sheet(wb, ws, 'Детально');
    }

    const suffix = regionGrowth.title ? `_${regionGrowth.title.replace(/[^\d.]/g, '')}` : '';
    XLSX.writeFile(wb, `Доля_продаж_шт${suffix}.xlsx`);
  }

  if (!regionGrowth || !salesShare) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">
          Загрузите файл «По регионам» через «Загрузить данные»
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Прирост регионы — доля в продажах, шт</p>
            <p className="text-base font-bold text-gray-800">{regionGrowth.title || regionGrowth.fileName}</p>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-700">Доля продаж обуви в шт по регионам</h2>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#3b82f6' }}
          >
            <Download size={13} /> Excel
          </button>
        </div>

        <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
          <table className="text-sm w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 220 }} />
              {regions.map(r => <col key={r} style={{ width: 90 }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-2 py-2.5 sticky left-0 top-0 z-30 bg-white" />
                <th className="text-left px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 z-30 bg-white" style={{ left: 32 }}>
                  Показатель
                </th>
                {regions.map(r => (
                  <th key={r} className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0 z-20 bg-white">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Общий итог */}
              {salesShare.grandTotal && (() => {
                const key = 'grand';
                const isExp = expanded.has(key);
                return [
                  <tr
                    key={key}
                    className={`group border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${isExp ? 'bg-blue-50' : ''}`}
                    onClick={() => toggle(key)}
                  >
                    <td className={`px-2 py-2 text-center sticky left-0 z-10 ${isExp ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                      {isExp ? <ChevronDown size={14} className="text-gray-400 mx-auto" /> : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                    </td>
                    <td className={`px-2 py-2 text-left text-xs font-bold text-gray-900 sticky z-10 ${isExp ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`} style={{ left: 32 }}>Общий итог</td>
                    {regions.map(r => (
                      <td key={r} className="px-2 py-2 text-center text-xs font-bold text-gray-900">
                        {fmtPct(salesShare.grandTotal.values[r])}
                      </td>
                    ))}
                  </tr>,
                  isExp && <DetailPanel key={`${key}-d`} items={salesShare.details} regions={regions} colSpan={colSpan} />,
                ];
              })()}

              {salesShare.seasons.map(season => {
                const seasonKey = `season:${season.label}`;
                const isSeasonExp = expanded.has(seasonKey);
                return (
                  <Fragment key={seasonKey}>
                    <tr
                      className={`group border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isSeasonExp ? 'bg-blue-50' : ''}`}
                      onClick={() => toggle(seasonKey)}
                    >
                      <td className={`px-2 py-2 text-center sticky left-0 z-10 ${isSeasonExp ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                        {isSeasonExp ? <ChevronDown size={14} className="text-gray-400 mx-auto" /> : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                      </td>
                      <td className={`px-2 py-2 text-left text-xs font-semibold text-gray-800 sticky z-10 ${isSeasonExp ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`} style={{ left: 32 }}>{season.label}</td>
                      {regions.map(r => (
                        <td key={r} className="px-2 py-2 text-center text-xs font-semibold text-gray-800">
                          {fmtPct(season.total[r])}
                        </td>
                      ))}
                    </tr>
                    {isSeasonExp && (
                      <DetailPanel
                        key={`${seasonKey}-d`}
                        items={detailsBySeason[season.label]}
                        regions={regions}
                        colSpan={colSpan}
                      />
                    )}
                    {season.directions.map(dir => {
                      const dirKey = `dir:${season.label}||${dir.label}`;
                      const isDirExp = expanded.has(dirKey);
                      return (
                        <Fragment key={dirKey}>
                          <tr
                            className={`group border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isDirExp ? 'bg-blue-50' : ''}`}
                            onClick={() => toggle(dirKey)}
                          >
                            <td className={`px-2 py-2 text-center sticky left-0 z-10 ${isDirExp ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`}>
                              {isDirExp ? <ChevronDown size={13} className="text-gray-300 mx-auto" /> : <ChevronRight size={13} className="text-gray-300 mx-auto" />}
                            </td>
                            <td className={`px-2 py-2 pl-6 text-left text-xs text-gray-600 sticky z-10 ${isDirExp ? 'bg-blue-50' : 'bg-white group-hover:bg-gray-50'}`} style={{ left: 32 }}>{dir.label}</td>
                            {regions.map(r => (
                              <td key={r} className="px-2 py-2 text-center text-xs text-gray-600">
                                {fmtPct(dir.values[r])}
                              </td>
                            ))}
                          </tr>
                          {isDirExp && (
                            <DetailPanel
                              key={`${dirKey}-d`}
                              items={detailsBySeasonDirection[`${season.label}||${dir.label}`]}
                              regions={regions}
                              colSpan={colSpan}
                            />
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
