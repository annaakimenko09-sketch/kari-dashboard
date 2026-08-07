import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { parseExcelFiles, mergeSummaryData, mergeDetailData, mergeRegionTotals } from '../utils/excelParser';
import { parseScanningFiles } from '../utils/scanningParser';
import { parseJewelryFiles } from '../utils/jewelryParser';
import { parseCapsuleFiles } from '../utils/capsuleParser';
import { parsePricingFiles } from '../utils/pricingParser';
import { parseFillingFiles } from '../utils/fillingParser';
import { parseRegionGrowthFiles } from '../utils/regionGrowthParser';
import { parseIZFiles } from '../utils/izParser';
import { parseSalesFiles } from '../utils/salesParser';
import { parseSalesYuiFiles } from '../utils/salesYuiParser';
import { parseSalesHourFiles } from '../utils/salesHourParser';
import { fetchStatus, fetchAllData } from '../utils/serverApi';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  // ── Ручной режим (загрузка файлов) ──────────────────────────
  const [parsedFiles, setParsedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scanningFiles, setScanningFiles] = useState([]);
  const [jewelryItogi, setJewelryItogi] = useState([]);
  const [jewelryUnexposed, setJewelryUnexposed] = useState([]);
  const [capsuleFiles, setCapsuleFiles] = useState([]);
  const [pricingFiles, setPricingFiles] = useState([]);
  const [fillingFiles, setFillingFiles] = useState([]);
  const [regionGrowthFiles, setRegionGrowthFiles] = useState([]);
  const [izFiles, setIzFiles] = useState([]);
  const [salesFiles, setSalesFiles] = useState([]);
  const [salesYuiFiles, setSalesYuiFiles] = useState([]);
  const [salesHourFiles, setSalesHourFiles] = useState([]);

  // ── Серверный режим ──────────────────────────────────────────
  const [serverMode, setServerModeState] = useState(() => {
    try { return localStorage.getItem('kari-server-mode') === 'true'; } catch { return false; }
  });
  const [serverStatus, setServerStatus] = useState({
    connected: false, checking: false, lastUpdated: null, fileCount: 0, files: [], tunnelUrl: null,
  });
  const [serverParsedFiles,    setServerParsedFiles]    = useState([]);
  const [serverScanningFiles,  setServerScanningFiles]  = useState([]);
  const [serverJewelryItogi,   setServerJewelryItogi]   = useState([]);
  const [serverJewelryUnexposed, setServerJewelryUnexposed] = useState([]);
  const [serverCapsuleFiles,   setServerCapsuleFiles]   = useState([]);
  const [serverPricingFiles,   setServerPricingFiles]   = useState([]);
  const [serverFillingFiles,   setServerFillingFiles]   = useState([]);
  const [serverRegionGrowthFiles, setServerRegionGrowthFiles] = useState([]);
  const [serverIzFiles,        setServerIzFiles]        = useState([]);
  const [serverSalesFiles,     setServerSalesFiles]     = useState([]);
  const [serverSalesYuiFiles,  setServerSalesYuiFiles]  = useState([]);
  const [serverSalesHourFiles, setServerSalesHourFiles] = useState([]);

  const intervalRef = useRef(null);

  const setServerMode = useCallback((val) => {
    try { localStorage.setItem('kari-server-mode', val ? 'true' : 'false'); } catch {}
    setServerModeState(val);
  }, []);

  const fetchServerData = useCallback(async () => {
    setServerStatus(prev => ({ ...prev, checking: true }));
    try {
      // Этап 1: быстрый статус — сразу показываем "Сервер подключён"
      const status = await fetchStatus();
      setServerStatus({ connected: true, checking: false, lastUpdated: status.lastUpdated, fileCount: status.fileCount, files: status.files, tunnelUrl: status.tunnelUrl || null });
      // Этап 2: данные в фоне (через туннель может занять 2-3 мин)
      const data = await fetchAllData();
      setServerParsedFiles(data.parsedFiles || []);
      setServerScanningFiles(data.scanningFiles || []);
      setServerJewelryItogi(data.jewelryItogi || []);
      setServerJewelryUnexposed(data.jewelryUnexposed || []);
      setServerCapsuleFiles(data.capsuleFiles || []);
      setServerPricingFiles(data.pricingFiles || []);
      setServerFillingFiles(data.fillingFiles || []);
      setServerRegionGrowthFiles(data.regionGrowthFiles || []);
      setServerIzFiles(data.izFiles || []);
      setServerSalesFiles(data.salesFiles || []);
      setServerSalesYuiFiles(data.salesYuiFiles || []);
      setServerSalesHourFiles(data.salesHourFiles || []);
    } catch (err) {
      setServerStatus(prev => ({ ...prev, connected: false, checking: false }));
    }
  }, []);

  useEffect(() => {
    if (!serverMode) {
      clearInterval(intervalRef.current);
      return;
    }
    fetchServerData();
    intervalRef.current = setInterval(fetchServerData, 30000);
    return () => clearInterval(intervalRef.current);
  }, [serverMode, fetchServerData]);

  // ── Ручная загрузка ──────────────────────────────────────────
  const loadFiles = useCallback(async (fileList) => {
    setLoading(true);
    setError(null);
    try {
      const all = Array.from(fileList);
      const isScanning  = f => f.name.includes('сканирован') || f.name.toLowerCase().includes('scan');
      const isJewelry   = f => { const n = f.name.toLowerCase(); return n.includes('юи') || n.includes('ювелир') || n.includes('невыставленн'); };
      const isCapsule   = f => f.name.toLowerCase().includes('капсул');
      const isPricing   = f => f.name.toLowerCase().includes('полупарк') || f.name.toLowerCase().includes('переоценк');
      const isFilling   = f => f.name.toLowerCase().includes('наполненност');
      const isRegionGrowth = f => f.name.toLowerCase().includes('по регионам');
      const isIZ        = f => f.name.toLowerCase().includes('интернет заказ');
      const isSalesHour = f => { const n = f.name.toLowerCase(); return n.includes('по часу') || n.includes('по_часу') || n.includes('часу продаж') || n.includes('час продаж'); };
      const isSales     = f => { if (isSalesHour(f)) return false; const n = f.name.toUpperCase(); return (n.startsWith('ДЕНЬ_') || n.startsWith('МЕСЯЦ_') || n.startsWith('ГОД_')) && (n.includes('СПБ') || n.includes('БЕЛ')); };
      const isSalesYui  = f => { const n = f.name.toUpperCase(); return (n.startsWith('ДЕНЬ') || n.startsWith('МЕСЯЦ') || n.startsWith('ГОД')) && !n.includes('СПБ') && !n.includes('БЕЛ') && !n.includes('SPB') && !n.includes('BEL'); };
      const isReport    = f => !isScanning(f) && !isJewelry(f) && !isCapsule(f) && !isPricing(f) && !isFilling(f) && !isRegionGrowth(f) && !isIZ(f) && !isSalesHour(f) && !isSales(f) && !isSalesYui(f);

      const reportList    = all.filter(isReport);
      const scanList      = all.filter(isScanning);
      const jewelryList   = all.filter(isJewelry);
      const capsuleList   = all.filter(isCapsule);
      const pricingList   = all.filter(isPricing);
      const fillingList   = all.filter(isFilling);
      const regionGrowthList = all.filter(isRegionGrowth);
      const izList        = all.filter(isIZ);
      const salesList     = all.filter(isSales);
      const salesYuiList  = all.filter(isSalesYui);
      const salesHourList = all.filter(isSalesHour);

      if (reportList.length > 0) setParsedFiles(await parseExcelFiles(reportList));
      if (scanList.length > 0) setScanningFiles(await parseScanningFiles(scanList));
      if (jewelryList.length > 0) {
        const { itogiResults, unexposedResults } = await parseJewelryFiles(jewelryList);
        if (itogiResults.length > 0) setJewelryItogi(itogiResults);
        if (unexposedResults.length > 0) setJewelryUnexposed(unexposedResults);
      }
      if (capsuleList.length > 0) { const r = await parseCapsuleFiles(capsuleList); if (r.length > 0) setCapsuleFiles(r); }
      if (pricingList.length > 0) { const r = await parsePricingFiles(pricingList); if (r.length > 0) setPricingFiles(r); }
      if (fillingList.length > 0) { const r = await parseFillingFiles(fillingList); if (r.length > 0) setFillingFiles(r); }
      if (regionGrowthList.length > 0) { const r = await parseRegionGrowthFiles(regionGrowthList); if (r.length > 0) setRegionGrowthFiles(r); }
      if (izList.length > 0) { const r = await parseIZFiles(izList); if (r.length > 0) setIzFiles(r); }
      if (salesList.length > 0) { const r = await parseSalesFiles(salesList); if (r.length > 0) setSalesFiles(r); }
      if (salesYuiList.length > 0) { const r = await parseSalesYuiFiles(salesYuiList); if (r.length > 0) setSalesYuiFiles(r); }
      if (salesHourList.length > 0) { const r = await parseSalesHourFiles(salesHourList); if (r.length > 0) setSalesHourFiles(r); }
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
      setScanningFiles(await parseScanningFiles(Array.from(fileList)));
    } catch (err) {
      setError(err.message || 'Ошибка при загрузке файлов сканирования');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Выбор источника данных ───────────────────────────────────
  const eff = (manual, server) => serverMode ? server : manual;

  const effParsedFiles    = eff(parsedFiles,    serverParsedFiles);
  const effScanningFiles  = eff(scanningFiles,  serverScanningFiles);
  const effJewelryItogi   = eff(jewelryItogi,   serverJewelryItogi);
  const effJewelryUnexpos = eff(jewelryUnexposed, serverJewelryUnexposed);
  const effCapsuleFiles   = eff(capsuleFiles,   serverCapsuleFiles);
  const effPricingFiles   = eff(pricingFiles,   serverPricingFiles);
  const effFillingFiles   = eff(fillingFiles,   serverFillingFiles);
  const effRegionGrowthFiles = eff(regionGrowthFiles, serverRegionGrowthFiles);
  const effIzFiles        = eff(izFiles,        serverIzFiles);
  const effSalesFiles     = eff(salesFiles,     serverSalesFiles);
  const effSalesYuiFiles  = eff(salesYuiFiles,  serverSalesYuiFiles);
  const effSalesHourFiles = eff(salesHourFiles, serverSalesHourFiles);

  // ── Вычисляемые данные ───────────────────────────────────────
  const summaryData    = mergeSummaryData(effParsedFiles);
  const detailData     = mergeDetailData(effParsedFiles);
  const regionTotals   = mergeRegionTotals(effParsedFiles);
  const allSummary     = summaryData;
  const allRegionTotals = regionTotals;

  const obuvSummary       = summaryData.filter(r => r._productGroup === 'Обувь');
  const obuvRegionTotals  = regionTotals.filter(r => r._productGroup === 'Обувь');
  const obuvDetail        = detailData.filter(r => r._productGroup === 'Обувь');
  const kidsSummary       = summaryData.filter(r => r._productGroup !== 'Обувь');
  const kidsRegionTotals  = regionTotals.filter(r => r._productGroup !== 'Обувь');
  const kidsDetail        = detailData.filter(r => r._productGroup !== 'Обувь');

  const spbBelSummary = summaryData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('БЕЛ') || region.includes('SPB') || region.includes('BEL');
  });
  const spbBelDetail = detailData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('БЕЛ') || region.includes('SPB') || region.includes('BEL');
  });
  const spbDetail = detailData.filter(row => {
    const region = String(row['Регион'] || '').toUpperCase();
    return region.includes('СПБ') || region.includes('SPB');
  });

  const spbScanning = effScanningFiles.find(f => f.fileRegion === 'СПБ') || null;
  const belScanning = effScanningFiles.find(f => f.fileRegion === 'БЕЛ') || null;

  const spbJewelryItogi   = effJewelryItogi.find(f => f.fileRegion === 'СПБ') || null;
  const belJewelryItogi   = effJewelryItogi.find(f => f.fileRegion === 'БЕЛ') || null;
  const jewelryUnexposedFile = effJewelryUnexpos[effJewelryUnexpos.length - 1] || null;

  const spbCapsule = effCapsuleFiles.find(f => f.fileRegion === 'СПБ') || effCapsuleFiles.find(f => f.fileRegion === 'ALL') || null;
  const belCapsule = effCapsuleFiles.find(f => f.fileRegion === 'БЕЛ') || effCapsuleFiles.find(f => f.fileRegion === 'ALL') || null;

  const spbPricing = effPricingFiles.find(f => f.fileRegion === 'СПБ') || null;
  const belPricing = effPricingFiles.find(f => f.fileRegion === 'БЕЛ') || null;

  const spbFilling = effFillingFiles.find(f => f.fileRegion === 'СПБ') || effFillingFiles.find(f => f.fileRegion === 'ALL') || null;
  const belFilling = effFillingFiles.find(f => f.fileRegion === 'БЕЛ') || effFillingFiles.find(f => f.fileRegion === 'ALL') || null;

  const regionGrowth = effRegionGrowthFiles[effRegionGrowthFiles.length - 1] || null;

  const spbIZ = effIzFiles.find(f => f.fileRegion === 'СПБ') || effIzFiles.find(f => f.fileRegion === 'ALL') || null;
  const belIZ = effIzFiles.find(f => f.fileRegion === 'БЕЛ') || effIzFiles.find(f => f.fileRegion === 'ALL') || null;

  const spbSalesDay   = effSalesFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'ДЕНЬ')   || null;
  const belSalesDay   = effSalesFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'ДЕНЬ')   || null;
  const spbSalesMonth = effSalesFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'МЕСЯЦ')  || null;
  const belSalesMonth = effSalesFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'МЕСЯЦ')  || null;
  const spbSalesYear  = effSalesFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'ГОД')    || null;
  const belSalesYear  = effSalesFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'ГОД')    || null;

  const spbSalesHour = effSalesHourFiles.find(f => f.fileRegion === 'СПБ') || effSalesHourFiles.find(f => f.fileRegion === 'ALL') || null;
  const belSalesHour = effSalesHourFiles.find(f => f.fileRegion === 'БЕЛ') || null;

  const spbSalesYuiDay   = effSalesYuiFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'ДЕНЬ')   || null;
  const belSalesYuiDay   = effSalesYuiFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'ДЕНЬ')   || null;
  const spbSalesYuiMonth = effSalesYuiFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'МЕСЯЦ')  || null;
  const belSalesYuiMonth = effSalesYuiFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'МЕСЯЦ')  || null;
  const spbSalesYuiYear  = effSalesYuiFiles.find(f => f.fileRegion === 'СПБ' && f.filePeriod === 'ГОД')    || null;
  const belSalesYuiYear  = effSalesYuiFiles.find(f => f.fileRegion === 'БЕЛ' && f.filePeriod === 'ГОД')    || null;

  return (
    <DataContext.Provider value={{
      // Состояние загрузки
      parsedFiles: effParsedFiles, loading, error,
      loadFiles, loadScanningFiles,
      // Серверный режим
      serverMode, setServerMode, serverStatus, fetchServerData,
      // Сводные данные
      summaryData, detailData, regionTotals,
      allSummary, allRegionTotals,
      obuvSummary, obuvRegionTotals, obuvDetail,
      kidsSummary, kidsRegionTotals, kidsDetail,
      spbBelSummary, spbBelDetail, spbDetail,
      // Сканирование
      scanningFiles: effScanningFiles, spbScanning, belScanning,
      // ЮИ
      jewelryItogi: effJewelryItogi, jewelryUnexposed: effJewelryUnexpos,
      spbJewelryItogi, belJewelryItogi, jewelryUnexposedFile,
      // Капсулы
      capsuleFiles: effCapsuleFiles, spbCapsule, belCapsule,
      // Цены на полупарах
      pricingFiles: effPricingFiles, spbPricing, belPricing,
      // Наполненность
      fillingFiles: effFillingFiles, spbFilling, belFilling,
      // Прирост регионы
      regionGrowthFiles: effRegionGrowthFiles, regionGrowth,
      // Адресное ИЗ
      izFiles: effIzFiles, spbIZ, belIZ,
      // Продажи
      salesFiles: effSalesFiles, spbSalesDay, belSalesDay, spbSalesMonth, belSalesMonth, spbSalesYear, belSalesYear,
      // Продажи ЮИ
      salesYuiFiles: effSalesYuiFiles, spbSalesYuiDay, belSalesYuiDay, spbSalesYuiMonth, belSalesYuiMonth, spbSalesYuiYear, belSalesYuiYear,
      // По часу
      salesHourFiles: effSalesHourFiles, spbSalesHour, belSalesHour,
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
