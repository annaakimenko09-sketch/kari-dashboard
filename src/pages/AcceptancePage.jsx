import { Construction } from 'lucide-react';

export default function AcceptancePage() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#fef3c7' }}>
        <Construction size={32} style={{ color: '#d97706' }} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">Приёмка</h2>
      <p className="text-gray-500 text-sm">В разработке</p>
      <p className="text-gray-400 text-xs mt-1">Раздел будет доступен в следующем обновлении</p>
    </div>
  );
}
