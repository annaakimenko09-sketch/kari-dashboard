import { useData } from '../context/DataContext';
import ShipmentsTemplate from './ShipmentsTemplate';

export default function ShipmentsObuvPage() {
  const { obuvSummary, parsedFiles } = useData();
  return (
    <ShipmentsTemplate
      summary={obuvSummary}
      parsedFiles={parsedFiles}
      accentColor="#E91E8C"
      exportName="vyvoz_obuv.xlsx"
    />
  );
}
