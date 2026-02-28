import { useData } from '../context/DataContext';
import SalesYuiPage from './SalesYuiPage';

export default function SalesYuiMonthSpbPage() {
  const { spbSalesYuiMonth } = useData();
  return <SalesYuiPage fileData={spbSalesYuiMonth} title="Отчёт по продажам ЮИ за месяц — СПБ" />;
}
