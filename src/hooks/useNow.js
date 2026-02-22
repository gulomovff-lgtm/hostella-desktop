import { useState, useEffect } from 'react';

// Single shared clock — ONE interval for the entire app, not per-bed
const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
};

export default useNow;
