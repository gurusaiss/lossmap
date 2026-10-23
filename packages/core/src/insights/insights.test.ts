import { describe, expect, it } from 'vitest';
import { mondayOf, narrativeUsesOnlyGivenNumbers, templateInsight } from '../index.ts';
const input = { days: 14, kpis: { totalLossRs: 47157, valueIn: 586209, lossPct: 8.04, lots: 114 }, topStage: { kind: 'waiting', lossRs: 30565, lossPct: 5.34 }, worstCentre: { name: 'Centre B', lossPct: 11.74, lossRs: 36422, avgWaitH: 4 }, bestCentre: { name: 'Centre A', lossPct: 3.89, avgWaitH: 1.85 } };
describe('weekly insight', () => {
  const t = templateInsight(input);
  it('uses the computed numbers and names the worst centre', () => { expect(t.en).toContain('₹47,157'); expect(t.en).toContain('114 lots'); expect(t.en).toContain('Centre B loses 11.7%'); expect(t.recEn).toContain('Centre B'); });
  it('has Telugu text with the same figures', () => { expect(t.te).toContain('₹47,157'); expect(t.recTe).toContain('Centre B'); });
  it('accepts AI wording that only repeats given numbers', () => expect(narrativeUsesOnlyGivenNumbers('Centre B lost ₹36,422 over 4 hours.', 'loss 36422 wait 4')).toBe(true));
  it('rejects wording with an invented number', () => expect(narrativeUsesOnlyGivenNumbers('Centre B lost ₹99,999.', 'loss 36422 wait 4')).toBe(false));
  it('weeks start on Monday', () => expect(mondayOf(new Date('2026-10-21T10:00:00Z'))).toBe('2026-10-19'));
});
