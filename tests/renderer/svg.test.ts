import { beforeEach, describe, expect, it } from 'vitest';
import { createSvgRenderer, type SvgRenderer } from '@/renderer/svg.ts';
import { circle, group, rect, text } from '@/renderer/scene.ts';

let container: HTMLDivElement;
let renderer: SvgRenderer;

beforeEach(() => {
  document.body.innerHTML = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  renderer = createSvgRenderer(container, { width: 200, height: 100 });
});

const bars = (values: readonly number[]) =>
  group(
    { key: 'root' },
    values.map((value, index) => rect(`bar-${index}`, { x: index * 10, height: value }))
  );

describe('createSvgRenderer', () => {
  it('creates a root svg with sizing attributes', () => {
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 200 100');
    expect(svg.getAttribute('width')).toBe('200');
  });

  it('renders a scene into real elements', () => {
    renderer.render(bars([10, 20, 30]));
    expect(container.querySelectorAll('rect')).toHaveLength(3);
    expect(container.querySelector('rect')!.getAttribute('height')).toBe('10');
  });

  it('nests groups', () => {
    renderer.render(group({ key: 'root' }, [group({ key: 'inner' }, [circle('c', { r: 2 })])]));
    expect(container.querySelector('g > g > circle')).not.toBeNull();
  });

  it('reuses elements across renders instead of recreating them', () => {
    renderer.render(bars([10, 20, 30]));
    const first = container.querySelector('rect');
    renderer.resetStats();

    renderer.render(bars([11, 20, 30]));
    expect(container.querySelector('rect')).toBe(first);
    expect(renderer.stats.created).toBe(0);
    expect(renderer.stats.removed).toBe(0);
  });

  it('writes only the attributes that actually changed', () => {
    renderer.render(bars([10, 20, 30]));
    renderer.resetStats();
    renderer.render(bars([10, 20, 31]));

    expect(renderer.stats.updated).toBe(1);
    expect(renderer.stats.attributeWrites).toBe(1);
  });

  it('performs no writes when the scene is unchanged', () => {
    const scene = bars([10, 20, 30]);
    renderer.render(scene);
    renderer.resetStats();
    renderer.render(scene);

    expect(renderer.stats.updated).toBe(0);
    expect(renderer.stats.attributeWrites).toBe(0);
    expect(renderer.stats.created).toBe(0);
  });

  it('removes elements whose keys disappear', () => {
    renderer.render(bars([10, 20, 30]));
    renderer.render(bars([10, 20]));
    expect(container.querySelectorAll('rect')).toHaveLength(2);
  });

  it('adds elements for new keys without touching existing ones', () => {
    renderer.render(bars([10, 20]));
    const first = container.querySelector('rect');
    renderer.resetStats();
    renderer.render(bars([10, 20, 30]));

    expect(renderer.stats.created).toBe(1);
    expect(container.querySelector('rect')).toBe(first);
  });

  it('reorders by moving the minimum number of elements', () => {
    renderer.render(
      group({ key: 'root' }, [rect('a', {}), rect('b', {}), rect('c', {})])
    );
    renderer.resetStats();
    renderer.render(
      group({ key: 'root' }, [rect('c', {}), rect('a', {}), rect('b', {})])
    );

    expect(renderer.stats.moved).toBeGreaterThan(0);
    expect(renderer.stats.created).toBe(0);
  });

  it('removes attributes that are dropped from a node', () => {
    renderer.render(group({ key: 'root' }, [rect('a', { x: 5, fill: 'red' })]));
    renderer.render(group({ key: 'root' }, [rect('a', { x: 5 })]));
    expect(container.querySelector('rect')!.hasAttribute('fill')).toBe(false);
  });

  it('omits attributes that are null or false', () => {
    renderer.render(group({ key: 'root' }, [rect('a', { x: 1, fill: null, hidden: false })]));
    const element = container.querySelector('rect')!;
    expect(element.hasAttribute('fill')).toBe(false);
    expect(element.hasAttribute('hidden')).toBe(false);
  });

  it('updates text content only when it changes', () => {
    renderer.render(group({ key: 'root' }, [text('label', 'A', { x: 0 })]));
    renderer.resetStats();
    renderer.render(group({ key: 'root' }, [text('label', 'A', { x: 0 })]));
    expect(renderer.stats.textWrites).toBe(0);

    renderer.render(group({ key: 'root' }, [text('label', 'B', { x: 0 })]));
    expect(renderer.stats.textWrites).toBe(1);
    expect(container.querySelector('text')!.textContent).toBe('B');
  });

  it('serializes group transforms', () => {
    renderer.render(
      group({ key: 'root' }, [
        group({ key: 'plot', transform: { x: 40, y: 10, k: 1 } }, [rect('a', {})]),
      ])
    );
    const plot = container.querySelectorAll('g')[1]!;
    expect(plot.getAttribute('transform')).toBe('translate(40, 10)');
  });

  it('looks up elements and bound data by key', () => {
    renderer.render(group({ key: 'root' }, [rect('bar-0', { x: 1 }, { region: 'North' })]));
    const element = renderer.elementFor('bar-0')!;
    expect(element.tagName).toBe('rect');
    expect(renderer.datumFor(element)).toEqual({ region: 'North' });
  });

  it('counts frames', () => {
    renderer.render(bars([1]));
    renderer.render(bars([2]));
    expect(renderer.stats.frames).toBe(2);
  });

  it('resizes the root element', () => {
    renderer.resize(800, 600);
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 800 600');
  });

  it('detaches the root on destroy', () => {
    renderer.render(bars([1]));
    renderer.destroy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('scales attribute writes with the number of changed marks, not total marks', () => {
    const many = Array.from({ length: 500 }, (_, index) => index);
    renderer.render(bars(many));
    renderer.resetStats();

    const changed = [...many];
    changed[0] = 999;
    renderer.render(bars(changed));

    expect(renderer.stats.attributeWrites).toBe(1);
    expect(renderer.stats.updated).toBe(1);
  });
});
