import { useData } from '../context/DataContext';
import SalesPage from './SalesPage';

export default function SalesYearSpbPage() {
  const { spbSalesYear } = useData();
  return <SalesPage fileData={spbSalesYear} title="Отчёт по продажам за год — СПБ" />;
}
