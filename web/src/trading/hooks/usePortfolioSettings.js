import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../shared/hooks/useAuth';

export function usePortfolioSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'portfolioSettings', 'config');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSettings(docSnap.data());
        } else {
          // No settings yet - onboarding needed
          setSettings(null);
        }
      } catch (err) {
        console.error('Error fetching portfolio settings:', err);
        setSettings(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  const updateSettings = async (newSettings) => {
    if (!user) return;

    try {
      const docRef = doc(db, 'users', user.uid, 'portfolioSettings', 'config');
      const dataToSave = {
        ...newSettings,
        updatedAt: new Date(),
        currency: 'USD'
      };

      if (!settings) {
        // First time setup
        dataToSave.createdAt = new Date();
        dataToSave.isConfigured = true;
      }

      await setDoc(docRef, dataToSave, { merge: true });
      setSettings(dataToSave);
      return true;
    } catch (err) {
      console.error('Error updating portfolio settings:', err);
      return false;
    }
  };

  return {
    settings,
    updateSettings,
    loading,
    needsOnboarding: !loading && (!settings || (!settings.isConfigured && !settings.totalCapital))
  };
}
