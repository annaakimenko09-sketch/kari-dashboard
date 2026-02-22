import { useState, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function UploadPage() {
  const { loadFiles, loading, error, parsedFiles } = useData();
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

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
    await loadFiles(selectedFiles);
  };

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const alreadyLoaded = parsedFiles.length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-blue-800 mb-2">Как загрузить данные</h2>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Перетащите Excel-файлы (.xlsx) в зону ниже или нажмите для выбора</li>
          <li>Поддерживаются файлы: "Отчет ДР Неделя", "Отчет ДР Месяц" и их варианты</li>
          <li>Можно загрузить несколько файлов одновременно</li>
          <li>Данные фильтруются по регионам СПБ и БЕЛ</li>
        </ul>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragOver
            ? 'border-red-400 bg-red-50'
            : 'border-gray-300 bg-gray-50 hover:border-red-300 hover:bg-red-50/30'
          }
        `}
      >
        <Upload size={36} className={`mx-auto mb-3 ${dragOver ? 'text-red-500' : 'text-gray-400'}`} />
        <p className="text-gray-700 font-medium">
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
              <div key={f.name} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <FileSpreadsheet size={18} className="text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{f.name}</p>
                  <p className="text-xs text-gray-500">{(f.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  onClick={() => removeFile(f.name)}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleLoad}
            disabled={loading}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Обрабатываем файлы...
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
            <p className="text-sm font-medium text-red-800">Ошибка загрузки</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Success: loaded files */}
      {alreadyLoaded && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-green-600" />
            <h3 className="text-sm font-semibold text-gray-700">Загруженные файлы</h3>
          </div>
          <div className="space-y-2">
            {parsedFiles.map(f => (
              <div key={f.fileName} className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800 truncate mr-2">{f.fileName}</span>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-green-300 text-green-700">
                      {f.productGroup}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white border border-blue-300 text-blue-700">
                      {f.reportType}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{f.period || 'Период не определён'}</p>
                <div className="flex gap-4 mt-1.5 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Магазинов: {f.summary.length}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    Заказов: {f.detail.length}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Перейти на Dashboard
            </button>
            <button
              onClick={() => navigate('/shipments')}
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
