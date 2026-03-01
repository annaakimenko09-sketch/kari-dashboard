import { useData } from '../context/DataContext';
import SalesHourPage from './SalesHourPage';

export default function SalesHourBelPage() {
  const { belSalesHour } = useData();
  const hour = belSalesHour?.filePeriod || '';
  return <SalesHourPage fileData={belSalesHour} title={`По часу${hour && hour !== '00' ? ` (${hour}:00)` : ''} — БЕЛ`} />;
}
