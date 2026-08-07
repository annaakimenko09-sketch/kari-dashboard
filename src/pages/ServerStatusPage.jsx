import { useState } from 'react';
import { useData } from '../context/DataContext';
import { RefreshCw, Server, Wifi, WifiOff, Upload, CheckCircle2, Clock, Globe, Copy, Check } from 'lucide-react';

const TYPE_LABELS = {
  'report':            'Отчёт ДР',
  'scanning':          'Сканирование',
  'jewelry-itogi':     'ЮИ Итоги',
  'jewelry-unexposed': 'Невыставленный товар',
  'capsule':           'Капсулы',
  'pricing':           'Цены на полупарах',
  'filling':           'Наполненность',
  'iz':                'Адресное ИЗ',
  'sales':             'Продажи',
  'sales-yui':         'Продажи ЮИ',
  'sales-hour':        'Продажи по часу',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function ServerStatusPage() {
  const { serverMode, setServerMode, serverStatus, fetchServerData } = useData();
  const [copied, setCopied] = useState(false);

  const { connected, checking, lastUpdated, fileCount, files, tunnelUrl } = serverStatus;

  function copyUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <Server size={24} style={{ color: '#E91E8C' }} />
        <h1 className="text-2xl font-bold text-white">Синхронизация с сервером</h1>
      </div>

      {/* Переключатель режима */}
      <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Выберите режим работы дашборда. В режиме сервера данные загружаются автоматически при добавлении файлов в папку на рабочем столе и обновляются каждые 30 секунд.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => setServerMode(false)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all"
            style={{
              backgroundColor: !serverMode ? '#E91E8C' : 'rgba(255,255,255,0.06)',
              color: !serverMode ? 'white' : 'rgba(255,255,255,0.6)',
              border: !serverMode ? 'none' : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Upload size={16} />
            Ручная загрузка
          </button>
          <button
            onClick={() => setServerMode(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium text-sm transition-all"
            style={{
              backgroundColor: serverMode ? '#E91E8C' : 'rgba(255,255,255,0.06)',
              color: serverMode ? 'white' : 'rgba(255,255,255,0.6)',
              border: serverMode ? 'none' : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Server size={16} />
            Синхронизация с сервером
          </button>
        </div>
      </div>

      {/* Статус подключения */}
      {serverMode && (
        <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {connected
                ? <Wifi size={20} style={{ color: '#10b981' }} />
                : <WifiOff size={20} style={{ color: '#ef4444' }} />
              }
              <div>
                <p className="font-semibold text-white text-sm">
                  {connected ? 'Сервер подключён' : 'Сервер недоступен'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  172.16.239.105:3002
                </p>
              </div>
              {connected && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                  Активен
                </span>
              )}
            </div>
            <button
              onClick={fetchServerData}
              disabled={checking}
              className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)' }}
            >
              <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
              {checking ? 'Проверка...' : 'Обновить'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <p className="text-2xl font-bold text-white">{fileCount}</p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>файлов загружено</p>
            </div>
            <div className="col-span-2 rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <Clock size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
              <div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Последнее обновление</p>
                <p className="text-sm font-medium text-white mt-0.5">{formatDate(lastUpdated)}</p>
              </div>
            </div>
          </div>

          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Автообновление каждые 30 секунд
          </p>
        </div>
      )}

      {/* Внешняя ссылка через туннель */}
      {serverMode && connected && tunnelUrl && (
        <div className="rounded-xl p-5 mb-6" style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Globe size={15} style={{ color: '#E91E8C' }} />
            Ссылка для доступа вне офиса
          </h2>
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Эта ссылка работает из любой сети. Поделитесь ею с коллегой. URL может измениться при перезапуске сервера.
          </p>
          <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <a href={tunnelUrl} target="_blank" rel="noreferrer"
              className="flex-1 text-sm font-mono truncate"
              style={{ color: '#60a5fa' }}>
              {tunnelUrl}
            </a>
            <button onClick={() => copyUrl(tunnelUrl)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md flex-shrink-0 transition-colors"
              style={{ backgroundColor: copied ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.08)', color: copied ? '#10b981' : 'rgba(255,255,255,0.7)' }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Скопировано' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}

      {/* Список файлов на сервере */}
      {serverMode && connected && files && files.length > 0 && (
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle2 size={15} style={{ color: '#10b981' }} />
            Файлы на сервере
          </h2>
          <div className="space-y-1.5">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs px-2 py-0.5 rounded font-medium flex-shrink-0"
                    style={{ backgroundColor: 'rgba(233,30,140,0.15)', color: '#E91E8C' }}>
                    {TYPE_LABELS[f.type] || f.type}
                  </span>
                  <span className="text-sm truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>{f.name}</span>
                </div>
                {(f.region || f.period) && (
                  <span className="text-xs flex-shrink-0 ml-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {[f.region, f.period].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Инструкция когда не в серверном режиме */}
      {!serverMode && (
        <div className="rounded-xl p-5" style={{ backgroundColor: '#1f2937', border: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 className="text-sm font-semibold text-white mb-3">Как использовать синхронизацию</h2>
          <ol className="space-y-3">
            {[
              'Переключитесь в режим "Синхронизация с сервером" выше',
              'Положите Excel-файлы в папку "Проект вывозы и приёмки" на рабочем столе',
              'Запустите скрипт "СИНХРОНИЗАЦИЯ С СЕРВЕРОМ (вывозы).command"',
              'Данные в дашборде обновятся автоматически',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: 'rgba(233,30,140,0.2)', color: '#E91E8C' }}>
                  {i + 1}
                </span>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
