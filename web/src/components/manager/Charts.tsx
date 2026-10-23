import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr } from '../../lib/manager/format.ts';

const axis = { fill: 'var(--muted)', fontSize: 12 };
/** Every chart has a value table next to it (see Overview), so colour is never the only carrier of meaning. */
export function BarsChart({ data, onPick, label }: { data: { name: string; value: number; key: string }[]; onPick?: (key: string) => void; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-56 w-full" data-testid="chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} />
          <XAxis dataKey="name" tick={axis} stroke="var(--line)" /><YAxis tick={axis} stroke="var(--line)" width={56} tickFormatter={(v) => inr(v)} />
          <Tooltip formatter={(v) => inr(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} onClick={(d) => onPick?.((d as unknown as { key: string }).key)} cursor={onPick ? 'pointer' : undefined}>
            {data.map((d, i) => <Cell key={d.key} fill={i === 0 ? 'var(--s2)' : 'var(--s1)'} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
/** Waterfall: a transparent base bar plus the loss bar, for the weight-and-quality value left after each step. */
export function Waterfall({ steps, label }: { steps: { name: string; base: number; loss: number }[]; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-56 w-full" data-testid="waterfall">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={steps} margin={{ left: 0, right: 8, top: 8 }}>
          <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="name" tick={axis} stroke="var(--line)" /><YAxis tick={axis} stroke="var(--line)" width={56} tickFormatter={(v) => inr(v)} />
          <Tooltip formatter={(v) => inr(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--text)' }} />
          <Bar dataKey="base" stackId="a" fill="var(--s1)" /><Bar dataKey="loss" stackId="a" fill="var(--s2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
