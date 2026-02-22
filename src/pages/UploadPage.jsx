import { useState, useRef, useCallback, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const BRAND = '#E91E8C';

export default function UploadPage() {
  const { loadFiles, loading, error, parsedFiles } = useData();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [justLoaded, setJustLoaded] = useState(false);
  const fileInputRef = useRef(null);

  // After successful load — auto-navigate to dashboard
  useEffect(() => {
    if (justLoaded && !loading && !error && parsedFiles.length > 0) {
      const timer = setTimeout(() => navigate('/obuv'), 1200);
      return () => clearTimeout(timer);
    }
  }, [justLoaded, loading, error, parsedFiles, navigate]);

  const handleFiles = useCallback((files) => {
    const xlsxFiles = Array.from(files).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    );
    if (xlsxFiles.length > 0) {
      setSelectedFiles(prev => {
        const existing = new Set(prev.map(f => f.name));
        const newFiles = xlsxFiles.filter(f => !existing.has(f.name));
        return [...prev, ...newFiles];
      });
    }
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const removeFile = (name) => {
    setSelectedFiles(f => f.filter(x => x.name !== name));
  };

  const handleLoad = async () => {
    if (selectedFiles.length === 0) return;
    setJustLoaded(false);
    await loadFiles(selectedFiles);
    setJustLoaded(true);
  };

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const alreadyLoaded = parsedFiles.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95">
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: BRAND }}
            >
              <Loader size={32} className="text-white animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">Обрабатываем файлы...</p>
              <p className="text-sm text-gray-500 mt-1">Это может занять несколько секунд</p>
            </div>
            <div className="flex gap-1.5 mt-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full animate-bounce"
                  style={{ backgroundColor: BRAND, animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Auto-redirect notice */}
      {justLoaded && !loading && !error && parsedFiles.length > 0 && (
        <div
          className="flex items-center gap-3 p-4 rounded-xl border text-white"
          style={{ backgroundColor: BRAND, borderColor: BRAND }}
        >
          <CheckCircle size={20} className="flex-shrink-0" />
          <p className="text-sm font-semibold">Файлы загружены! Переходим на Dashboard...</p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full inline-block" style={{ backgroundColor: BRAND }} />
          Как загрузить данные
        </h2>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Перетащите Excel-файлы (.xlsx) в зону ниже или нажмите для выбора</li>
          <li>Поддерживаются файлы: "Отчет ДР Неделя", "Отчет ДР Месяц" и их варианты</li>
          <li>Можно загрузить несколько файлов одновременно</li>
          <li>KPI считаются по всем регионам, детали по магазинам — по СПБ</li>
        </ul>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all"
        style={{
          borderColor: dragOver ? BRAND : '#d1d5db',
          backgroundColor: dragOver ? '#fdf2f8' : '#f9fafb',
        }}
      >
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: dragOver ? BRAND : '#f3f4f6' }}
        >
          <Upload size={26} style={{ color: dragOver ? 'white' : '#9ca3af' }} />
        </div>
        <p className="text-gray-700 font-semibold text-base">
          {dragOver ? 'Отпустите файлы здесь' : 'Перетащите Excel-файлы сюда'}
        </p>
        <p className="text-sm text-gray-500 mt-1">или нажмите для выбора файлов</p>
        <p className="text-xs text-gray-400 mt-2">.xlsx, .xls</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Выбрано файлов: {selectedFiles.length}
          </h3>
          <div className="space-y-2">
            {selectedFiles.map(f => (
              <div key={f.name} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <FileSpreadsheet size={18} className="text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate font-medium">{f.name}</p>
                  <p className="text-xs text-gray-500">{(f.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(f.name); }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleLoad}
            disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: BRAND }}
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Обрабатываем...
              </>
            ) : (
              <>
                <Upload size={18} />
                Загрузить {selectedFiles.length} {selectedFiles.length === 1 ? 'файл' : 'файлов'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Ошибка загрузки</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Already loaded files */}
      {alreadyLoaded && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} style={{ color: BRAND }} />
            <h3 className="text-sm font-semibold text-gray-700">Загруженные файлы</h3>
          </div>
          <div className="space-y-2">
            {parsedFiles.map(f => (
              <div key={f.fileName} className="p-3 rounded-lg border" style={{ backgroundColor: '#fdf2f8', borderColor: '#f9a8d4' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800 truncate mr-2">{f.fileName}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border text-gray-700" style={{ borderColor: BRAND, color: BRAND }}>
                      {f.productGroup}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-blue-300 text-blue-700">
                      {f.reportType}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{f.period || 'Период не определён'}</p>
                <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                  <span>Магазинов: {f.summary.length}</span>
                  <span>Заказов: {f.detail.length}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigate('/obuv')}
              className="flex-1 px-4 py-2.5 text-white rounded-lg text-sm font-semibold transition-colors"
              style={{ backgroundColor: BRAND }}
            >
              Перейти на Dashboard
            </button>
            <button
              onClick={() => navigate('/obuv/vyvoz')}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Смотреть вывозы
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
