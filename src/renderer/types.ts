import type { SceneNode } from './scene.ts';

export interface RenderStats {
  created: number;
  updated: number;
  removed: number;
  moved: number;
  attributeWrites: number;
  textWrites: number;
  frames: number;
}

export function createStats(): RenderStats {
  return {
    created: 0,
    updated: 0,
    removed: 0,
    moved: 0,
    attributeWrites: 0,
    textWrites: 0,
    frames: 0,
  };
}

export interface Renderer {
  render(scene: SceneNode): void;
  readonly stats: RenderStats;
  resetStats(): void;
  destroy(): void;
}
