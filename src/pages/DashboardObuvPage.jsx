import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import DashboardTemplate from './DashboardTemplate';

export default function DashboardObuvPage() {
  const { obuvSummary, obuvRegionTotals, parsedFiles } = useData();
  const navigate = useNavigate();
  return (
    <DashboardTemplate
      summary={obuvSummary}
      regionTotals={obuvRegionTotals}
      parsedFiles={parsedFiles}
      accentColor="#E91E8C"
      groupLabel="Обувь"
      navigate={navigate}
      controlPath="/obuv/control"
      vyvozPath="/obuv/vyvoz"
    />
  );
}
