import { useEffect, useState } from 'react';
import { api } from './api';

export function useLinkedStudents() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  useEffect(() => {
    api('/portal/me')
      .then(setMe)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return { me, students: me ? me.students : [], loading, error };
}
