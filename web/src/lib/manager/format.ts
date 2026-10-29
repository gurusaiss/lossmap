export const inr = (n: number | null | undefined) => '₹' + Math.round(Number(n ?? 0)).toLocaleString('en-IN');
export const pct = (n: number | null | undefined) => `${Math.round(Number(n ?? 0) * 10) / 10}%`.replace('.0%', '%');
export const hoursLabel = (h: number | null | undefined) => `${Math.round(Number(h ?? 0) * 10) / 10} h`;
