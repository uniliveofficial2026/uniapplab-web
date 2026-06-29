import { useState, useEffect } from 'react';
import { db } from './db';

export function useDB() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      setTimeout(() => setTick(t => t + 1), 0);
    });
    return () => {
        unsubscribe();
    };
  }, []);

  return db;
}
