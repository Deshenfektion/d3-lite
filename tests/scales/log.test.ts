import { describe, expect, it } from 'vitest';
import { scaleLog } from '@/scales/log.ts';

describe('scaleLog', () => {
  it('maps decades to even spacing', () => {
    const scale = scaleLog({ domain: [1, 1000], range: [0, 300] });
    expect(scale(1)).toBeCloseTo(0, 6);
    expect(scale(10)).toBeCloseTo(100, 6);
    expect(scale(100)).toBeCloseTo(200, 6);
    expect(scale(1000)).toBeCloseTo(300, 6);
  });

  it('inverts logarithmically', () => {
    const scale = scaleLog({ domain: [1, 100], range: [0, 200] });
    expect(scale.invert(100)).toBeCloseTo(10, 6);
  });

  it('supports an alternate base', () => {
    const scale = scaleLog({ domain: [1, 8], range: [0, 300], base: 2 });
    expect(scale(2)).toBeCloseTo(100, 6);
    expect(scale(4)).toBeCloseTo(200, 6);
  });

  it('handles fully negative domains', () => {
    const scale = scaleLog({ domain: [-100, -1], range: [0, 200] });
    expect(scale(-100)).toBeCloseTo(0, 6);
    expect(scale(-1)).toBeCloseTo(200, 6);
  });

  it('produces decade ticks', () => {
    const ticks = scaleLog({ domain: [1, 1000] }).ticks(4);
    expect(ticks).toContain(1);
    expect(ticks).toContain(10);
    expect(ticks).toContain(1000);
  });

  it('produces minor ticks when decades are few', () => {
    const ticks = scaleLog({ domain: [1, 10] }).ticks(10);
    expect(ticks).toContain(2);
    expect(ticks).toContain(5);
  });

  it('snaps the domain to powers of the base', () => {
    expect(
      scaleLog({ domain: [3, 700] })
        .nice()
        .domain()
    ).toEqual([1, 1000]);
  });

  it('copies preserving the base', () => {
    const clone = scaleLog({ domain: [1, 8], range: [0, 300], base: 2 }).copy();
    expect(clone(4)).toBeCloseTo(200, 6);
  });
});
