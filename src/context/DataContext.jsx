import { createContext, useContext, useState, useCallback } from 'react';
import { parseExcelFiles, mergeSummaryData, mergeDetailData } from '../utils/excelParser';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [parsedFiles, setParsedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadFiles = useCallback(async (fileList) => {
    setLoading(true);
    setError(null);
    try {
      const results = await parseExcelFiles(fileList);
      setParsedFiles(results);
    } catch (err) {
      setError(err.message || 'Ошибка при загрузке файлов');
    } finally {
      setLoading(false);
    }
  }, []);

  const summaryData = mergeSummaryData(parsedFiles);
  const detailData = mergeDetailData(parsedFiles);

  // Filter only СПБ and БЕЛ regions
  const spbBelSummary = summaryData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('БЕЛ') || region.includes('SPB') || region.includes('BEL');
  });

  const spbBelDetail = detailData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('БЕЛ') || region.includes('SPB') || region.includes('BEL');
  });

  return (
    <DataContext.Provider value={{
      parsedFiles,
      loading,
      error,
      loadFiles,
      summaryData,
      detailData,
      spbBelSummary,
      spbBelDetail,
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
