import type { SceneNode } from './scene.ts';

export type PatchOp = 'create' | 'update' | 'move' | 'remove';

export interface Patch {
  readonly op: PatchOp;
  readonly key: string;
  readonly next?: SceneNode;
  readonly previous?: SceneNode;
  readonly index: number;
}

export function diffChildren(
  previous: readonly SceneNode[],
  next: readonly SceneNode[]
): Patch[] {
  const patches: Patch[] = [];
  const previousIndex = new Map<string, number>();
  for (let i = 0; i < previous.length; i++) {
    previousIndex.set((previous[i] as SceneNode).key, i);
  }

  const matched = new Set<string>();
  let lastPlacedIndex = 0;

  for (let i = 0; i < next.length; i++) {
    const node = next[i] as SceneNode;
    const foundAt = previousIndex.get(node.key);

    if (foundAt === undefined) {
      patches.push({ op: 'create', key: node.key, next: node, index: i });
      continue;
    }

    matched.add(node.key);
    const before = previous[foundAt] as SceneNode;
    patches.push({ op: 'update', key: node.key, next: node, previous: before, index: i });

    if (foundAt < lastPlacedIndex) {
      patches.push({ op: 'move', key: node.key, next: node, previous: before, index: i });
    } else {
      lastPlacedIndex = foundAt;
    }
  }

  for (let i = 0; i < previous.length; i++) {
    const node = previous[i] as SceneNode;
    if (!matched.has(node.key)) {
      patches.push({ op: 'remove', key: node.key, previous: node, index: i });
    }
  }

  return patches;
}

export function attrsEqual(a: SceneNode['attrs'], b: SceneNode['attrs']): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function nodeUnchanged(a: SceneNode, b: SceneNode): boolean {
  if (a === b) return true;
  if (a.type !== b.type) return false;
  if (a.text !== b.text) return false;
  if (a.transform?.x !== b.transform?.x) return false;
  if (a.transform?.y !== b.transform?.y) return false;
  if (a.transform?.k !== b.transform?.k) return false;
  return attrsEqual(a.attrs, b.attrs);
}
