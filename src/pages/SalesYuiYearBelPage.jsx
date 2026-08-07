import { useData } from '../context/DataContext';
import SalesYuiPage from './SalesYuiPage';

export default function SalesYuiYearBelPage() {
  const { belSalesYuiYear } = useData();
  return <SalesYuiPage fileData={belSalesYuiYear} title="Отчёт по продажам ЮИ за год — БЕЛ" />;
}
