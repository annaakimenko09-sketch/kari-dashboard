import { useData } from '../context/DataContext';
import SalesHourPage from './SalesHourPage';

export default function SalesHourSpbPage() {
  const { spbSalesHour } = useData();
  const hour = spbSalesHour?.filePeriod || '';
  return <SalesHourPage fileData={spbSalesHour} title={`По часу${hour && hour !== '00' ? ` (${hour}:00)` : ''} — СПБ`} />;
}
