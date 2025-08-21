import React from 'react';
import axios from 'axios';

const POLL_INTERVAL = 5000; // ms

const BackendStatus: React.FC = () => {
  const [online, setOnline] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const res = await axios.get('/api/results', { timeout: 3000 });
        if (!mounted) return;
        setOnline(res && res.status === 200);
      } catch (e) {
        if (!mounted) return;
        setOnline(false);
      }
    };
    check();
    const id = setInterval(check, POLL_INTERVAL);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const title = online === null ? 'Checking backend...' : online ? 'Backend online' : 'Backend offline';

  return (
    <div className={`backend-status ${online ? 'online' : online === false ? 'offline' : 'checking'}`} title={title}>
      <span className="dot" />
      <span className="label">{online === null ? '...' : online ? 'ONLINE' : 'OFFLINE'}</span>
    </div>
  );
};

export default BackendStatus;
