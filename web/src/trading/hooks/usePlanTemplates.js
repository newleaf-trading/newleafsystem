/**
 * usePlanTemplates — live subscription to the planTemplates collection.
 *
 * publishedOnly=true (investor chooser) filters to status === 'published'.
 * Operator manager subscribes to all so it can show drafts/retired too.
 */
import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

export function usePlanTemplates({ publishedOnly = false } = {}) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const col = collection(db, 'planTemplates');
    const q = publishedOnly ? query(col, where('status', '==', 'published')) : col;
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) =>
          a.name === b.name ? (b.version || 0) - (a.version || 0) : a.name.localeCompare(b.name)
        );
        setTemplates(rows);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [publishedOnly]);

  return { templates, loading, error };
}
