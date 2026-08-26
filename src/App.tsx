import PosTerminal from './views/PosTerminal';
import AgentConsole from './views/AgentConsole';
import Launcher from './views/Launcher';
import { isTenantKey } from './lib/tenants';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const tenantParam = params.get('tenant');

  if (view === 'pos') {
    const tenant = isTenantKey(tenantParam) ? tenantParam : 'cgv';
    return <PosTerminal tenant={tenant} />;
  }
  if (view === 'console') return <AgentConsole />;
  return <Launcher />;
}
