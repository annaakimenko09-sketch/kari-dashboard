import { useData } from '../context/DataContext';
import SalesYuiPage from './SalesYuiPage';

export default function SalesYuiDaySpbPage() {
  const { spbSalesYuiDay } = useData();
  return <SalesYuiPage fileData={spbSalesYuiDay} title="Ежедневный отчёт ЮИ — СПБ" />;
}
