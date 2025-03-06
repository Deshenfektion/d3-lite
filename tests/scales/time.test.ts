import { describe, expect, it } from 'vitest';
import { scaleTime } from '@/scales/time.ts';

describe('scaleTime', () => {
  const start = new Date(2025, 0, 1);
  const end = new Date(2025, 0, 31);

  it('maps dates onto pixels', () => {
    const scale = scaleTime({ domain: [start, end], range: [0, 300] });
    expect(scale(start.getTime())).toBe(0);
    expect(scale(end.getTime())).toBe(300);
  });

  it('inverts back to a date', () => {
    const scale = scaleTime({ domain: [start, end], range: [0, 300] });
    const middle = scale.invertTime(150);
    expect(middle.getDate()).toBe(16);
  });

  it('chooses day ticks for a month span', () => {
    const ticks = scaleTime({ domain: [start, end], range: [0, 300] }).timeTicks(6);
    expect(ticks.length).toBeGreaterThan(2);
    expect(ticks[0]).toBeInstanceOf(Date);
  });

  it('chooses month ticks for a multi-year span', () => {
    const scale = scaleTime({
      domain: [new Date(2023, 0, 1), new Date(2025, 0, 1)],
      range: [0, 300],
    });
    const format = scale.timeFormat(6);
    expect(format(new Date(2024, 5, 1))).toMatch(/Jun/);
  });

  it('exposes numeric ticks for axis rendering', () => {
    const ticks = scaleTime({ domain: [start, end], range: [0, 300] }).ticks(5);
    expect(typeof ticks[0]).toBe('number');
  });
});
