import { useData } from '../context/DataContext';
import ScanningTemplate from './ScanningTemplate';

export default function ScanningSpbPage() {
  const { spbScanning } = useData();
  return (
    <ScanningTemplate
      scanData={spbScanning}
      regionLabel="СПБ"
      accentColor="#E91E8C"
    />
  );
}
