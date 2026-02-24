import { useData } from '../context/DataContext';
import ScanningTemplate from './ScanningTemplate';

export default function ScanningBelPage() {
  const { belScanning } = useData();
  return (
    <ScanningTemplate
      scanData={belScanning}
      regionLabel="БЕЛ"
      accentColor="#0ea5e9"
    />
  );
}
