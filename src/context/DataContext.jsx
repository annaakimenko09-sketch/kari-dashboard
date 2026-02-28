import { createContext, useContext, useState, useCallback } from 'react';
import { parseExcelFiles, mergeSummaryData, mergeDetailData, mergeRegionTotals } from '../utils/excelParser';
import { parseScanningFiles } from '../utils/scanningParser';
import { parseJewelryFiles } from '../utils/jewelryParser';
import { parseCapsuleFiles } from '../utils/capsuleParser';
import { parsePricingFiles } from '../utils/pricingParser';
import { parseFillingFiles } from '../utils/fillingParser';
import { parseIZFiles } from '../utils/izParser';
import { parseSalesFiles } from '../utils/salesParser';
import { parseSalesYuiFiles } from '../utils/salesYuiParser';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [parsedFiles, setParsedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanningFiles, setScanningFiles] = useState([]);
  const [jewelryItogi, setJewelryItogi] = useState([]);     // ЮИ Итоги (СПБ и БЕЛ)
  const [jewelryUnexposed, setJewelryUnexposed] = useState([]); // Невыставленный товар
  const [capsuleFiles, setCapsuleFiles] = useState([]);    // Капсулы
  const [pricingFiles, setPricingFiles] = useState([]);    // Цены на полупарах
  const [fillingFiles, setFillingFiles] = useState([]);    // Наполненность обувь
  const [izFiles, setIzFiles] = useState([]);              // Адресное ИЗ
  const [salesFiles, setSalesFiles] = useState([]);        // Продажи
  const [salesYuiFiles, setSalesYuiFiles] = useState([]);  // Продажи ЮИ

  const loadFiles = useCallback(async (fileList) => {
    setLoading(true);
    setError(null);
    try {
      const all = Array.from(fileList);

      const isScanning  = f => f.name.includes('сканирован') || f.name.toLowerCase().includes('scan');
      const isJewelry   = f => {
        const n = f.name.toLowerCase();
        return n.includes('юи') || n.includes('ювелир') || n.includes('невыставленн');
      };
      const isCapsule   = f => f.name.toLowerCase().includes('капсул');
      const isPricing   = f => f.name.toLowerCase().includes('полупарк') || f.name.toLowerCase().includes('переоценк');
      const isFilling   = f => f.name.toLowerCase().includes('наполненност');
      const isIZ        = f => f.name.toLowerCase().includes('интернет заказ');
      const isSales     = f => {
        const n = f.name.toUpperCase();
        return (n.startsWith('ДЕНЬ_') || n.startsWith('МЕСЯЦ_')) &&
          (n.includes('СПБ') || n.includes('БЕЛ'));
      };
      // ЮИ files: start with ДЕНЬ or МЕСЯЦ but NO СПБ/БЕЛ in name
      const isSalesYui  = f => {
        const n = f.name.toUpperCase();
        return (n.startsWith('ДЕНЬ') || n.startsWith('МЕСЯЦ')) &&
          !n.includes('СПБ') && !n.includes('БЕЛ') && !n.includes('SPB') && !n.includes('BEL');
      };
      const isReport    = f => !isScanning(f) && !isJewelry(f) && !isCapsule(f) && !isPricing(f) && !isFilling(f) && !isIZ(f) && !isSales(f) && !isSalesYui(f);

      const scanList    = all.filter(isScanning);
      const jewelryList = all.filter(isJewelry);
      const capsuleList = all.filter(isCapsule);
      const pricingList = all.filter(isPricing);
      const fillingList = all.filter(isFilling);
      const izList      = all.filter(isIZ);
      const salesList    = all.filter(isSales);
      const salesYuiList = all.filter(isSalesYui);
      const reportList   = all.filter(isReport);

      if (reportList.length > 0) {
        const results = await parseExcelFiles(reportList);
        setParsedFiles(results);
      }
      if (scanList.length > 0) {
        const scanResults = await parseScanningFiles(scanList);
        setScanningFiles(scanResults);
      }
      if (jewelryList.length > 0) {
        const { itogiResults, unexposedResults } = await parseJewelryFiles(jewelryList);
        if (itogiResults.length > 0) setJewelryItogi(itogiResults);
        if (unexposedResults.length > 0) setJewelryUnexposed(unexposedResults);
      }
      if (capsuleList.length > 0) {
        const capsuleResults = await parseCapsuleFiles(capsuleList);
        if (capsuleResults.length > 0) setCapsuleFiles(capsuleResults);
      }
      if (pricingList.length > 0) {
        const pricingResults = await parsePricingFiles(pricingList);
        if (pricingResults.length > 0) setPricingFiles(pricingResults);
      }
      if (fillingList.length > 0) {
        const fillingResults = await parseFillingFiles(fillingList);
        if (fillingResults.length > 0) setFillingFiles(fillingResults);
      }
      if (izList.length > 0) {
        const izResults = await parseIZFiles(izList);
        if (izResults.length > 0) setIzFiles(izResults);
      }
      if (salesList.length > 0) {
        const salesResults = await parseSalesFiles(salesList);
        if (salesResults.length > 0) setSalesFiles(salesResults);
      }
      if (salesYuiList.length > 0) {
        const salesYuiResults = await parseSalesYuiFiles(salesYuiList);
        if (salesYuiResults.length > 0) setSalesYuiFiles(salesYuiResults);
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

  // ЮИ helpers
  const spbJewelryItogi = jewelryItogi.find(f => f.fileRegion === 'СПБ') || null;
  const belJewelryItogi = jewelryItogi.find(f => f.fileRegion === 'БЕЛ') || null;
  // Невыставленный товар — обычно один файл, берём последний
  const jewelryUnexposedFile = jewelryUnexposed[jewelryUnexposed.length - 1] || null;

  // Capsule helpers — find by region or fall back to ALL file
  const spbCapsule = capsuleFiles.find(f => f.fileRegion === 'СПБ')
    || capsuleFiles.find(f => f.fileRegion === 'ALL')
    || null;
  const belCapsule = capsuleFiles.find(f => f.fileRegion === 'БЕЛ')
    || capsuleFiles.find(f => f.fileRegion === 'ALL')
    || null;

  // Pricing helpers
  const spbPricing = pricingFiles.find(f => f.fileRegion === 'СПБ') || null;
  const belPricing = pricingFiles.find(f => f.fileRegion === 'БЕЛ') || null;

  // Filling helpers
  const spbFilling = fillingFiles.find(f => f.fileRegion === 'СПБ')
    || fillingFiles.find(f => f.fileRegion === 'ALL')
    || null;
  const belFilling = fillingFiles.find(f => f.fileRegion === 'БЕЛ')
    || fillingFiles.find(f => f.fileRegion === 'ALL')
    || null;

  // IZ helpers
  const spbIZ = izFiles.find(f => f.fileRegion === 'СПБ')
    || izFiles.find(f => f.fileRegion === 'ALL')
    || null;
  const belIZ = izFiles.find(f => f.fileRegion === 'БЕЛ')
    || izFiles.find(f => f.fileRegion === 'ALL')
    || null;

  // Sales helpers
  const spbSalesDay   = salesFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'ДЕНЬ')   || null;
  const belSalesDay   = salesFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'ДЕНЬ')   || null;
  const spbSalesMonth = salesFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'МЕСЯЦ')  || null;
  const belSalesMonth = salesFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'МЕСЯЦ')  || null;

  // Sales ЮИ helpers
  const spbSalesYuiDay   = salesYuiFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'ДЕНЬ')   || null;
  const belSalesYuiDay   = salesYuiFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'ДЕНЬ')   || null;
  const spbSalesYuiMonth = salesYuiFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'МЕСЯЦ')  || null;
  const belSalesYuiMonth = salesYuiFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'МЕСЯЦ')  || null;

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
      jewelryItogi,
      jewelryUnexposed,
      spbJewelryItogi,
      belJewelryItogi,
      jewelryUnexposedFile,
      capsuleFiles,
      spbCapsule,
      belCapsule,
      pricingFiles,
      spbPricing,
      belPricing,
      fillingFiles,
      spbFilling,
      belFilling,
      izFiles,
      spbIZ,
      belIZ,
      salesFiles,
      spbSalesDay,
      belSalesDay,
      spbSalesMonth,
      belSalesMonth,
      salesYuiFiles,
      spbSalesYuiDay,
      belSalesYuiDay,
      spbSalesYuiMonth,
      belSalesYuiMonth,
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
