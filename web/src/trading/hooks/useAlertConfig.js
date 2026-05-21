import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { DEFAULT_ALERT_CONFIG } from '../utils/alertEngine';

/**
 * Hook to read/write alert thresholds from Firestore config/alertThresholds.
 * Uses getDoc (one-shot) instead of onSnapshot to avoid poisoning Firestore's
 * WebSocket when auth hasn't resolved yet.
 */
export function useAlertConfig() {
  const [config, setConfig] = useState(DEFAULT_ALERT_CONFIG);
  const [loading, setLoading] = useState(true);

  // One-shot load with retry after auth settles
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'alertThresholds');
        const snap = await getDoc(docRef);
        if (cancelled) return;

        if (snap.exists()) {
          const data = snap.data();
          const merged = { ...DEFAULT_ALERT_CONFIG };
          Object.keys(merged).forEach(key => {
            if (data[key]) {
              merged[key] = { ...merged[key], ...data[key] };
            }
          });
          setConfig(merged);
        } else {
          setConfig(DEFAULT_ALERT_CONFIG);
        }
      } catch (err) {
        // Permission denied or doc doesn't exist — use defaults silently
        console.warn('Alert config not accessible (using defaults):', err.code || err.message);
        setConfig(DEFAULT_ALERT_CONFIG);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadConfig();
    return () => { cancelled = true; };
  }, []);

  // Save config to Firestore
  const saveConfig = useCallback(async (newConfig) => {
    try {
      const docRef = doc(db, 'config', 'alertThresholds');
      const payload = {};
      Object.keys(newConfig).forEach(key => {
        payload[key] = {
          enabled: newConfig[key].enabled,
          threshold: newConfig[key].threshold,
        };
      });
      payload.updatedAt = new Date().toISOString();
      await setDoc(docRef, payload, { merge: true });
      // Update local state immediately
      setConfig(newConfig);
      console.log('Alert config saved');
      return true;
    } catch (err) {
      console.error('Error saving alert config:', err);
      return false;
    }
  }, []);

  // Toggle a single alert type
  const toggleAlert = useCallback(async (alertType) => {
    const updated = { ...config };
    updated[alertType] = { ...updated[alertType], enabled: !updated[alertType].enabled };
    setConfig(updated);
    return saveConfig(updated);
  }, [config, saveConfig]);

  // Update a single threshold
  const updateThreshold = useCallback(async (alertType, value) => {
    const updated = { ...config };
    updated[alertType] = { ...updated[alertType], threshold: value };
    setConfig(updated);
    return saveConfig(updated);
  }, [config, saveConfig]);

  return { config, loading, saveConfig, toggleAlert, updateThreshold };
}
