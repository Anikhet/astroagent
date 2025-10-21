'use client';

import { useEffect, useMemo, useState } from 'react';

export interface PlannerCardProps {
  date: Date;
  latitude: number;
  longitude: number;
  target?: string;
}

interface PlannerMetrics {
  targetAltitudeDeg: number;
  sunAltitudeDeg: number;
  moonTargetSeparationDeg: number;
  cloudCoverPct: number | null;
}

interface PlannerResponse {
  observer: {
    latitude: number;
    longitude: number;
    elevationM: number;
    datetime: string;
  };
  target: string;
  metrics: PlannerMetrics;
  recommendation: {
    ok: boolean;
    score: number; // 0..1
    criteria: {
      alt: number;
      sun: number;
      moon: number;
      clouds: number;
    };
  };
}

export function PlannerCard({ date, latitude, longitude, target = 'saturn' }: PlannerCardProps) {
  const [data, setData] = useState<PlannerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const p = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      elev: String(0),
      datetime: date.toISOString(),
      target,
    });
    return p.toString();
  }, [date, latitude, longitude, target]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/plan?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as PlannerResponse;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to fetch plan');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const ok = data?.recommendation.ok ?? false;
  const scorePct = Math.round(((data?.recommendation.score ?? 0) * 100));

  return (
    <div className="absolute top-4 left-4 z-10 w-80 rounded-xl border border-emerald-600/40 bg-black/70 backdrop-blur-md p-4 text-white">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-emerald-400">Observing Planner</h3>
        <span className={`text-xs px-2 py-1 rounded ${ok ? 'bg-emerald-600/30 text-emerald-300' : 'bg-red-600/30 text-red-300'}`}>
          {ok ? 'Good' : 'Poor'}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-300">Target: <span className="text-emerald-300 capitalize">{target}</span></p>

      {loading && (
        <p className="mt-3 text-sm text-gray-400">Loading plan…</p>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-300">{error}</p>
      )}
      {!loading && !error && data && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Score</span>
            <span className="text-emerald-300 font-medium">{scorePct}%</span>
          </div>
          <div className="h-2 w-full bg-gray-700 rounded">
            <div className="h-2 rounded bg-emerald-500" style={{ width: `${scorePct}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs mt-2">
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Target Alt</p>
              <p className="text-emerald-300">{data.metrics.targetAltitudeDeg.toFixed(1)}°</p>
            </div>
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Sun Alt</p>
              <p className="text-emerald-300">{data.metrics.sunAltitudeDeg.toFixed(1)}°</p>
            </div>
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Moon Sep</p>
              <p className="text-emerald-300">{data.metrics.moonTargetSeparationDeg.toFixed(1)}°</p>
            </div>
            <div className="bg-white/5 rounded p-2">
              <p className="text-gray-400">Clouds</p>
              <p className="text-emerald-300">{data.metrics.cloudCoverPct == null ? '—' : `${Math.round(data.metrics.cloudCoverPct)}%`}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlannerCard;


