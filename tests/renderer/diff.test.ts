import { describe, expect, it } from 'vitest';
import { attrsEqual, diffChildren, nodeUnchanged } from '@/renderer/diff.ts';
import {
  circle,
  countNodes,
  findByKey,
  group,
  rect,
  transformToString,
} from '@/renderer/scene.ts';

const node = (key: string, value = 0) => rect(key, { x: value });

describe('diffChildren', () => {
  it('creates every node on first render', () => {
    const patches = diffChildren([], [node('a'), node('b')]);
    expect(patches.map((patch) => patch.op)).toEqual(['create', 'create']);
  });

  it('updates matched keys in place', () => {
    const patches = diffChildren([node('a')], [node('a', 5)]);
    expect(patches).toHaveLength(1);
    expect(patches[0]!.op).toBe('update');
  });

  it('removes nodes whose keys disappear', () => {
    const patches = diffChildren([node('a'), node('b')], [node('a')]);
    expect(patches.filter((patch) => patch.op === 'remove').map((patch) => patch.key)).toEqual([
      'b',
    ]);
  });

  it('emits no moves when order is preserved', () => {
    const before = [node('a'), node('b'), node('c')];
    const after = [node('a'), node('b'), node('c')];
    expect(diffChildren(before, after).some((patch) => patch.op === 'move')).toBe(false);
  });

  it('emits a move only for nodes that shifted backwards', () => {
    const before = [node('a'), node('b'), node('c')];
    const after = [node('c'), node('a'), node('b')];
    const moves = diffChildren(before, after).filter((patch) => patch.op === 'move');
    expect(moves.map((patch) => patch.key)).toEqual(['a', 'b']);
  });

  it('handles a full replacement', () => {
    const patches = diffChildren([node('a')], [node('z')]);
    expect(patches.map((patch) => patch.op).sort()).toEqual(['create', 'remove']);
  });

  it('handles an empty next list', () => {
    expect(diffChildren([node('a')], []).map((patch) => patch.op)).toEqual(['remove']);
  });

  it('reports the target index for insertions', () => {
    const patches = diffChildren([node('a')], [node('new'), node('a')]);
    expect(patches[0]).toMatchObject({ op: 'create', key: 'new', index: 0 });
  });
});

describe('attrsEqual', () => {
  it('compares shallowly', () => {
    expect(attrsEqual({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBe(true);
    expect(attrsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('detects added and removed keys', () => {
    expect(attrsEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(attrsEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });
});

describe('nodeUnchanged', () => {
  it('short-circuits on identity', () => {
    const only = node('a');
    expect(nodeUnchanged(only, only)).toBe(true);
  });

  it('compares type, text, transform and attributes', () => {
    expect(nodeUnchanged(rect('a', { x: 1 }), rect('a', { x: 1 }))).toBe(true);
    expect(nodeUnchanged(rect('a', { x: 1 }), rect('a', { x: 2 }))).toBe(false);
    expect(nodeUnchanged(rect('a', {}), circle('a', {}))).toBe(false);
    expect(
      nodeUnchanged(
        group({ key: 'g', transform: { x: 0, y: 0, k: 1 } }),
        group({ key: 'g', transform: { x: 5, y: 0, k: 1 } })
      )
    ).toBe(false);
  });
});

describe('scene helpers', () => {
  const tree = group({ key: 'root' }, [
    group({ key: 'inner' }, [rect('bar', { x: 1 })]),
    circle('dot', { r: 3 }),
  ]);

  it('counts every node in the tree', () => {
    expect(countNodes(tree)).toBe(4);
  });

  it('finds a node by key at any depth', () => {
    expect(findByKey(tree, 'bar')?.type).toBe('rect');
    expect(findByKey(tree, 'missing')).toBeUndefined();
  });

  it('serializes transforms, omitting identity parts', () => {
    expect(transformToString({ x: 5, y: 6, k: 1 })).toBe('translate(5, 6)');
    expect(transformToString({ x: 0, y: 0, k: 2 })).toBe('scale(2)');
    expect(transformToString({ x: 0, y: 0, k: 1 })).toBe('');
  });
});
