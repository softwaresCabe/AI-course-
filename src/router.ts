import { useEffect, useState } from 'react';

// Plain #name hash routing (artifact-safe): #home, #syllabus, #week-3, #midterm, #final, #gradebook, #future
export function useRoute(): string {
  const read = () => (location.hash.replace(/^#/, '') || 'home').toLowerCase();
  const [r, setR] = useState(read);
  useEffect(() => {
    const on = () => {
      setR(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export function go(route: string) {
  if (location.hash.replace(/^#/, '') === route) window.scrollTo({ top: 0 });
  else location.hash = route;
}
