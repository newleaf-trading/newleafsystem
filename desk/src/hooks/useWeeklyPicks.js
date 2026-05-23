import { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const R2_BASE = 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev';

function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function useWeeklyPicks(weekId) {
  const [picks, setPicks] = useState([]);
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const currentWeek = weekId || getISOWeek();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch weekly picks doc
      const weekDoc = await getDoc(doc(db, 'weeklyPicks', currentWeek));
      if (!weekDoc.exists()) {
        setPicks([]);
        setWeekData(null);
        setLoading(false);
        return;
      }

      const data = weekDoc.data();
      setWeekData({ id: currentWeek, ...data });

      // Fetch full tile + analysis for each pick
      const tileIds = data.tileIds || [];
      const enriched = await Promise.all(tileIds.map(async (tileId) => {
        const [tileSnap, analysisSnap, pubSnap] = await Promise.all([
          getDoc(doc(db, 'tiles', tileId)),
          getDoc(doc(db, 'analyses', tileId)),
          getDoc(doc(db, 'publications', tileId)),
        ]);

        const tile = tileSnap.exists() ? { id: tileSnap.id, ...tileSnap.data() } : null;
        const analysis = analysisSnap.exists() ? analysisSnap.data() : null;
        const publication = pubSnap.exists() ? pubSnap.data() : null;

        if (!tile) return null;

        const symbol = tile.symbol || '';
        const strategy = (tile.strategy || '').replace(/\s+/g, '-');

        return {
          tileId,
          tile,
          analysis,
          hasAnalysis: !!analysis,
          // Asset URLs
          assets: {
            pdfUrl: `${R2_BASE}/reports/pdf/${symbol}/${symbol}-${strategy}-latest.pdf`,
            picksUrl: `https://newleafsystem.com/picks/analysis/${symbol.toLowerCase()}`,
            investUrl: `https://newleafsystem.com/invest/position/${tileId}`,
            r2DataUrl: `${R2_BASE}/reports/${symbol}/latest.json`,
          },
          // Social copy (from analysis if available)
          socialCopy: analysis?.socialCopy || null,
          // Sentiment
          sentiment: tile.sentiment || analysis?._sentiment || null,
          // Provenance
          provenance: {
            model: analysis?.model_used || tile?.model_used || 'unknown',
            promptVersion: analysis?.prompt_version || null,
            source: analysis?.analysis_source || tile?.analysis_source || null,
            timestamp: analysis?.generation_timestamp || tile?.generation_timestamp || null,
            commitSha: analysis?.code_commit_sha || null,
          },
          // Publication channels
          channels: publication?.channels || {
            picks:     { status: 'complete', url: assets?.picksUrl },
            invest:    { status: 'complete', url: assets?.investUrl },
            pdf:       { status: 'tbd' },
            youtube:   { status: 'tbd' },
            linkedin:  { status: 'tbd' },
            twitter:   { status: 'tbd' },
            instagram: { status: 'tbd' },
            email:     { status: 'tbd' },
          },
        };
      }));

      setPicks(enriched.filter(Boolean));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentWeek]);

  useEffect(() => { load(); }, [load]);

  const updateChannelStatus = useCallback(async (tileId, channel, status, url = null) => {
    const ref = doc(db, 'publications', tileId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { channels: {} };
    data.channels[channel] = { status, url, updatedAt: new Date().toISOString() };
    await setDoc(ref, data, { merge: true });
    await load(); // refresh
  }, [load]);

  return { picks, weekData, loading, error, reload: load, currentWeek, updateChannelStatus };
}

export { getISOWeek };
