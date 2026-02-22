import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import DashboardTemplate from './DashboardTemplate';

export default function DashboardKidsPage() {
  const { kidsSummary, kidsRegionTotals, parsedFiles } = useData();
  const navigate = useNavigate();
  return (
    <DashboardTemplate
      summary={kidsSummary}
      regionTotals={kidsRegionTotals}
      parsedFiles={parsedFiles}
      accentColor="#8b5cf6"
      groupLabel="Кидс"
      navigate={navigate}
      controlPath="/kids/control"
      vyvozPath="/kids/vyvoz"
    />
  );
}
