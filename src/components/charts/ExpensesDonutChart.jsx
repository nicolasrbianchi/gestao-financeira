import React from 'react';
import { Cell, Label, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

// Paleta mais separada (boa leitura em dark) + cor de marca.
const COLORS = [
  '#f2d58b', // brand champagne
  '#34d399', // emerald
  '#fb7185', // rose
  '#22d3ee', // cyan
  '#a78bfa', // violet
  '#f59e0b', // amber
  '#60a5fa', // blue
  '#f472b6', // pink
  '#f97316', // orange
  '#2dd4bf', // teal
  '#cbd5e1', // slate-300
  '#84cc16', // lime
  '#e879f9', // fuchsia
  '#d6b25e', // deeper gold
];

function hashString(value = '') {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

function colorForLabel(label = '') {
  const key = String(label || '').trim().toLowerCase();
  const idx = hashString(key) % COLORS.length;
  return COLORS[idx];
}

export default function ExpensesDonutChart({ items = [], total = 0, formatMoney = (v) => String(v ?? 0), colorForLabel: colorForLabelProp = null }) {
  if (!items?.length) {
    return <div className='grid h-full place-items-center text-sm text-slate-400'>Sem gráfico disponível.</div>;
  }

  const top = items.slice(0, 8);
  const pickColor = typeof colorForLabelProp === 'function' ? colorForLabelProp : colorForLabel;

  return (
    <ResponsiveContainer width='100%' height='100%'>
      <PieChart>
        <Pie data={top} dataKey='value' nameKey='name' innerRadius={60} outerRadius={90} paddingAngle={3}>
          {top.map((entry, index) => (
            <Cell key={entry.name || index} fill={pickColor(entry.name || String(index))} />
          ))}
          <Label
            position='center'
            content={() => (
              <text x='50%' y='50%' textAnchor='middle' dominantBaseline='middle' fill='#e2e8f0'>
                <tspan x='50%' dy='-0.25em' fontSize='12'>Total</tspan>
                <tspan x='50%' dy='1.25em' fontSize='14' fontWeight='800'>
                  {formatMoney(total || 0)}
                </tspan>
              </text>
            )}
          />
        </Pie>
        <Tooltip formatter={(value) => formatMoney(value)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
