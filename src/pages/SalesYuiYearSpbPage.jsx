import { useData } from '../context/DataContext';
import SalesYuiPage from './SalesYuiPage';

export default function SalesYuiYearSpbPage() {
  const { spbSalesYuiYear } = useData();
  return <SalesYuiPage fileData={spbSalesYuiYear} title="Отчёт по продажам ЮИ за год — СПБ" />;
}
