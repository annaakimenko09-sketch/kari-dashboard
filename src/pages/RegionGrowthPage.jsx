import { Fragment, useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import * as XLSX from 'xlsx-js-style';
import { Download, ChevronDown, ChevronRight } from 'lucide-react';

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  return Math.round(v).toLocaleString('ru-RU');
}

// Строка с раскрывающимся списком артикулов для сезона/направления
function DetailPanel({ items, regions, colSpan }) {
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
        <div className="overflow-x-auto">
          <table className="text-xs w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '260px' }} />
              {regions.map(r => <col key={r} style={{ width: '70px' }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-2 py-1.5 text-gray-500 font-semibold">Артикул</th>
                {regions.map(r => (
                  <th key={r} className="text-center px-2 py-1.5 text-gray-500 font-semibold">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-100">
                  <td className="px-2 py-1 text-gray-700 truncate" title={item.article}>{item.article}</td>
                  {regions.map(r => (
                    <td key={r} className="px-2 py-1 text-center text-gray-700">{fmtNum(item.values[r])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

export default function RegionGrowthPage() {
  const { regionGrowth } = useData();
  const [expanded, setExpanded] = useState(new Set());

  const regions = regionGrowth?.regions || [];
  const colSpan = regions.length + 1;

  const detailsBySeason = useMemo(() => {
    const map = {};
    if (!regionGrowth) return map;
    for (const d of regionGrowth.details) {
      if (!map[d.season]) map[d.season] = [];
      map[d.season].push(d);
    }
    return map;
  }, [regionGrowth]);

  const detailsBySeasonDirection = useMemo(() => {
    const map = {};
    if (!regionGrowth) return map;
    for (const d of regionGrowth.details) {
      const key = `${d.season}||${d.direction}`;
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    return map;
  }, [regionGrowth]);

  function toggle(key) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function exportToExcel() {
    if (!regionGrowth) return;
    const wb = XLSX.utils.book_new();

    const headerStyle = {
      font: { bold: true, color: { rgb: '374151' } },
      fill: { fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } },
    };
    const cellStyle = { alignment: { horizontal: 'center', vertical: 'center' } };

    // Лист 1: Сводная
    {
      const headers = ['Сезон', 'Направление', ...regions];
      const rows = [];
      if (regionGrowth.grandTotal) {
        rows.push(['Общий итог', '', ...regions.map(r => regionGrowth.grandTotal.values[r])]);
      }
      for (const season of regionGrowth.seasons) {
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
      const rows = regionGrowth.details.map(d => [
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
    XLSX.writeFile(wb, `Прирост_регионы${suffix}.xlsx`);
  }

  if (!regionGrowth) {
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
            <p className="text-xs text-gray-400 mb-0.5">Прирост регионы — остатки в среднем магазине</p>
            <p className="text-base font-bold text-gray-800">{regionGrowth.title || regionGrowth.fileName}</p>
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-700">Остатки по регионам</h2>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ backgroundColor: '#3b82f6' }}
          >
            <Download size={13} /> Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="text-sm w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 32 }} />
              <col style={{ width: 220 }} />
              {regions.map(r => <col key={r} style={{ width: 90 }} />)}
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-2 py-2.5" />
                <th className="text-left px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Показатель
                </th>
                {regions.map(r => (
                  <th key={r} className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {r}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Общий итог */}
              {regionGrowth.grandTotal && (() => {
                const key = 'grand';
                const isExp = expanded.has(key);
                return [
                  <tr
                    key={key}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer ${isExp ? 'bg-blue-50' : ''}`}
                    onClick={() => toggle(key)}
                  >
                    <td className="px-2 py-2 text-center">
                      {isExp ? <ChevronDown size={14} className="text-gray-400 mx-auto" /> : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                    </td>
                    <td className="px-2 py-2 text-left text-xs font-bold text-gray-900">Общий итог</td>
                    {regions.map(r => (
                      <td key={r} className="px-2 py-2 text-center text-xs font-bold text-gray-900">
                        {fmtNum(regionGrowth.grandTotal.values[r])}
                      </td>
                    ))}
                  </tr>,
                  isExp && <DetailPanel key={`${key}-d`} items={regionGrowth.details} regions={regions} colSpan={colSpan} />,
                ];
              })()}

              {regionGrowth.seasons.map(season => {
                const seasonKey = `season:${season.label}`;
                const isSeasonExp = expanded.has(seasonKey);
                return (
                  <Fragment key={seasonKey}>
                    <tr
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isSeasonExp ? 'bg-blue-50' : ''}`}
                      onClick={() => toggle(seasonKey)}
                    >
                      <td className="px-2 py-2 text-center">
                        {isSeasonExp ? <ChevronDown size={14} className="text-gray-400 mx-auto" /> : <ChevronRight size={14} className="text-gray-400 mx-auto" />}
                      </td>
                      <td className="px-2 py-2 text-left text-xs font-semibold text-gray-800">{season.label}</td>
                      {regions.map(r => (
                        <td key={r} className="px-2 py-2 text-center text-xs font-semibold text-gray-800">
                          {fmtNum(season.total[r])}
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
                            className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${isDirExp ? 'bg-blue-50' : ''}`}
                            onClick={() => toggle(dirKey)}
                          >
                            <td className="px-2 py-2 text-center">
                              {isDirExp ? <ChevronDown size={13} className="text-gray-300 mx-auto" /> : <ChevronRight size={13} className="text-gray-300 mx-auto" />}
                            </td>
                            <td className="px-2 py-2 pl-6 text-left text-xs text-gray-600">{dir.label}</td>
                            {regions.map(r => (
                              <td key={r} className="px-2 py-2 text-center text-xs text-gray-600">
                                {fmtNum(dir.values[r])}
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
