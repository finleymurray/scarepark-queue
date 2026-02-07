'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionHistory } from '@/types/database';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const LINE_COLORS = [
  '#CC0000',
  '#22C55E',
  '#6366F1',
  '#FF8C00',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
  '#EF4444',
  '#14B8A6',
];

function getTimeRange(dateStr: string): { start: string; end: string } {
  const start = new Date(`${dateStr}T17:00:00`);
  const end = new Date(`${dateStr}T00:00:00`);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState<AttractionHistory[]>([]);
  const [rideIds, setRideIds] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split('T')[0]
  );

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      setAuthenticated(true);
    }
    checkAuth();
  }, [router]);

  // Fetch ride IDs
  useEffect(() => {
    if (!authenticated) return;
    async function fetchRides() {
      const { data } = await supabase
        .from('attractions')
        .select('id, attraction_type');
      if (data) {
        setRideIds(new Set(data.filter((a) => a.attraction_type === 'ride').map((a) => a.id)));
      }
    }
    fetchRides();
  }, [authenticated]);

  // Fetch history when date changes
  useEffect(() => {
    if (!authenticated) return;
    async function fetchHistory() {
      setLoading(true);
      const { start, end } = getTimeRange(selectedDate);

      const { data, error } = await supabase
        .from('attraction_history')
        .select('*')
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .order('recorded_at', { ascending: true });

      if (error) {
        console.error('Error fetching history:', error);
        setHistoryData([]);
      } else {
        setHistoryData(data || []);
      }
      setLoading(false);
    }
    fetchHistory();
  }, [authenticated, selectedDate]);

  // Transform data for Recharts
  const { chartData, attractionNames } = useMemo(() => {
    if (historyData.length === 0) return { chartData: [], attractionNames: [] };

    // Filter to rides only
    const rideData = historyData.filter((h) => rideIds.has(h.attraction_id));
    if (rideData.length === 0) return { chartData: [], attractionNames: [] };

    // Collect unique attraction names
    const namesSet = new Set<string>();
    rideData.forEach((r) => namesSet.add(r.attraction_name));
    const names = Array.from(namesSet);

    // Build chart data: one entry per history record timestamp
    // Group records that share the same timestamp
    const timeMap = new Map<number, Record<string, number | string>>();

    for (const record of rideData) {
      const time = new Date(record.recorded_at).getTime();

      if (!timeMap.has(time)) {
        timeMap.set(time, { time });
      }
      const point = timeMap.get(time)!;
      point[record.attraction_name] = record.wait_time;
    }

    // Sort by time and forward-fill missing values
    const sorted = Array.from(timeMap.values()).sort(
      (a, b) => (a.time as number) - (b.time as number)
    );

    // Forward-fill: carry the last known value for each attraction
    const lastKnown: Record<string, number> = {};
    for (const point of sorted) {
      for (const name of names) {
        if (name in point) {
          lastKnown[name] = point[name] as number;
        } else if (name in lastKnown) {
          point[name] = lastKnown[name];
        }
      }
    }

    return { chartData: sorted, attractionNames: names };
  }, [historyData, rideIds]);

  if (!authenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-bone/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-4 sm:p-6">
      <header className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-blood-bright text-3xl font-black uppercase tracking-wide sm:text-4xl">
            Queue Analytics
          </h1>
          <p className="text-bone/40 text-sm mt-1">Historical wait time data</p>
        </div>

        <Link
          href="/admin"
          className="px-4 py-2.5 bg-gore border border-blood/30 text-bone/60 hover:text-bone
                     rounded-lg transition-colors text-sm w-fit"
        >
          Back to Control Room
        </Link>
      </header>

      <div className="mx-auto w-full h-px bg-gradient-to-r from-transparent via-blood/50 to-transparent mb-6" />

      {/* Date picker */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-bone/70 text-sm font-medium">Select Night:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-3 py-2 bg-black/60 border border-gore rounded-lg text-bone text-sm
                     focus:outline-none focus:border-blood-bright transition-colors
                     [color-scheme:dark]"
        />
      </div>

      {/* Chart */}
      {loading ? (
        <div className="horror-card rounded-xl p-12 text-center">
          <p className="text-bone/60 text-lg">Loading historical data...</p>
        </div>
      ) : chartData.length === 0 ? (
        <div className="horror-card rounded-xl p-12 text-center">
          <p className="text-bone/40 text-lg">No data recorded for this night.</p>
          <p className="text-bone/30 text-sm mt-2">
            Data is captured automatically when staff update queue times.
          </p>
        </div>
      ) : (
        <div className="horror-card rounded-xl p-4 sm:p-6">
          <h2 className="text-bone text-lg font-bold mb-4">Wait Times — {selectedDate}</h2>
          <ResponsiveContainer width="100%" height={500}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3a0000" />
              <XAxis
                dataKey="time"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(ts) =>
                  new Date(Number(ts)).toLocaleTimeString('en-GB', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                }
                stroke="#E8E0D0"
                tick={{ fill: '#E8E0D0', fontSize: 12 }}
              />
              <YAxis
                stroke="#E8E0D0"
                tick={{ fill: '#E8E0D0', fontSize: 12 }}
                label={{
                  value: 'Wait (min)',
                  angle: -90,
                  position: 'insideLeft',
                  fill: '#E8E0D0',
                  style: { fontSize: 12 },
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a0000',
                  border: '1px solid #3a0000',
                  borderRadius: '8px',
                  color: '#E8E0D0',
                }}
                labelFormatter={(ts) =>
                  new Date(Number(ts)).toLocaleTimeString('en-GB', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  })
                }
                formatter={(value, name) => [`${value} min`, name]}
              />
              <Legend wrapperStyle={{ color: '#E8E0D0' }} />
              {attractionNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
