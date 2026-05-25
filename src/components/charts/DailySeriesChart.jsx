import React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

export default function DailySeriesChart({ series = [], tooltip }) {
  if (!series?.length) {
    return <div className='grid h-full place-items-center text-sm text-slate-400'>Sem dados no período.</div>;
  }

  return (
    <ResponsiveContainer width='100%' height='100%'>
      <LineChart data={series} margin={{ left: 4, right: 4, top: 6, bottom: 0 }}>
        <XAxis
          dataKey='day'
          axisLine={false}
          tickLine={false}
          interval={0}
          minTickGap={0}
          tickMargin={8}
          padding={{ left: 10, right: 10 }}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
        />
        <Tooltip content={tooltip} />
        <Line type='monotone' dataKey='income' stroke='#34d399' strokeWidth={2.5} dot={false} />
        <Line type='monotone' dataKey='expense' stroke='#fb7185' strokeWidth={2.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

