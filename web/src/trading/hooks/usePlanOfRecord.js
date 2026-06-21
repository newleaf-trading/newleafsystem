/**
 * usePlanOfRecord — live subscription to the signed-in user's ACTIVE Plan of Record.
 *
 * Returns the single active plan snapshot (or null). Prior plans are retained in
 * the same subcollection as history with status 'paused'; this hook ignores them.
 */
import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../shared/hooks/useAuth';

export function usePlanOfRecord() {
  const { user } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlan(null);
      setLoading(false);
      return;
    }
    const col = collection(db, 'users', user.uid, 'planOfRecord');
    const q = query(col, where('status', '==', 'active'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docSnap = snap.docs[0];
        setPlan(docSnap ? { id: docSnap.id, ...docSnap.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user]);

  return { plan, loading };
}

/**
 * useAllPlansOfRecord — every committed plan for the signed-in user (active +
 * paused history), newest first. Used by the /invest/plans page.
 */
export function useAllPlansOfRecord() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlans([]);
      setLoading(false);
      return;
    }
    const col = collection(db, 'users', user.uid, 'planOfRecord');
    const q = query(col, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPlans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [user]);

  return { plans, loading };
}
