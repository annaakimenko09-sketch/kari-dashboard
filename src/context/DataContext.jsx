import { createContext, useContext, useState, useCallback } from 'react';
import { parseExcelFiles, mergeSummaryData, mergeDetailData, mergeRegionTotals } from '../utils/excelParser';
import { parseScanningFiles } from '../utils/scanningParser';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [parsedFiles, setParsedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanningFiles, setScanningFiles] = useState([]);

  const loadFiles = useCallback(async (fileList) => {
    setLoading(true);
    setError(null);
    try {
      // Split: scanning files ("Нет сканирования") vs vyvoz/report files
      const scanList = Array.from(fileList).filter(f =>
        f.name.includes('сканирован') || f.name.toLowerCase().includes('scan')
      );
      const reportList = Array.from(fileList).filter(f =>
        !f.name.includes('сканирован') && !f.name.toLowerCase().includes('scan')
      );

      if (reportList.length > 0) {
        const results = await parseExcelFiles(reportList);
        setParsedFiles(results);
      }
      if (scanList.length > 0) {
        const scanResults = await parseScanningFiles(scanList);
        setScanningFiles(scanResults);
      }
    } catch (err) {
      setError(err.message || 'Ошибка при загрузке файлов');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScanningFiles = useCallback(async (fileList) => {
    setLoading(true);
    setError(null);
    try {
      const results = await parseScanningFiles(Array.from(fileList));
      setScanningFiles(results);
    } catch (err) {
      setError(err.message || 'Ошибка при загрузке файлов сканирования');
    } finally {
      setLoading(false);
    }
  }, []);

  const summaryData = mergeSummaryData(parsedFiles);
  const detailData = mergeDetailData(parsedFiles);
  const regionTotals = mergeRegionTotals(parsedFiles);

  // Debug: log column names from first summary row
  if (summaryData.length > 0) {
    console.log('[DataContext] Columns:', Object.keys(summaryData[0]));
    console.log('[DataContext] First row sample:', summaryData[0]);
    console.log('[DataContext] Summary rows:', summaryData.length, '| RegionTotals:', regionTotals.length);
  }

  // All regions (for global KPIs and region breakdown) — store rows
  const allSummary = summaryData;

  // All regions — ИТОГО rows per region (for accurate KPI totals)
  const allRegionTotals = regionTotals;

  // Filter only Обувь product group
  const obuvSummary = summaryData.filter(r => r._productGroup === 'Обувь');
  const obuvRegionTotals = regionTotals.filter(r => r._productGroup === 'Обувь');
  const obuvDetail = detailData.filter(r => r._productGroup === 'Обувь');

  // Filter Kids (Кидс + any kids sub-groups)
  const kidsSummary = summaryData.filter(r => r._productGroup !== 'Обувь');
  const kidsRegionTotals = regionTotals.filter(r => r._productGroup !== 'Обувь');
  const kidsDetail = detailData.filter(r => r._productGroup !== 'Обувь');

  // Filter only СПБ and БЕЛ regions (for subdivision/store detail)
  const spbBelSummary = summaryData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('БЕЛ') || region.includes('SPB') || region.includes('BEL');
  });

  const spbBelDetail = detailData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('БЕЛ') || region.includes('SPB') || region.includes('BEL');
  });

  // SPB only for orders control (Детализация)
  const spbDetail = detailData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('SPB');
  });

  // Scanning data helpers
  const spbScanning = scanningFiles.find(f => f.fileRegion === 'СПБ') || null;
  const belScanning = scanningFiles.find(f => f.fileRegion === 'БЕЛ') || null;

  return (
    <DataContext.Provider value={{
      parsedFiles,
      loading,
      error,
      loadFiles,
      summaryData,
      detailData,
      regionTotals,
      allSummary,
      allRegionTotals,
      obuvSummary,
      obuvRegionTotals,
      obuvDetail,
      kidsSummary,
      kidsRegionTotals,
      kidsDetail,
      spbBelSummary,
      spbBelDetail,
      spbDetail,
      scanningFiles,
      loadScanningFiles,
      spbScanning,
      belScanning,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
