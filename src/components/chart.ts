import type { Margin, Size } from '../types/geometry.ts';
import { createCartesianSpace, type CartesianSpace } from '../coords/space.ts';
import { themeFor, type Theme, type ThemeMode } from '../color/schemes.ts';
import { group, type SceneNode } from '../renderer/scene.ts';
import { createSvgRenderer, type SvgRenderer } from '../renderer/svg.ts';
import type { Renderer } from '../renderer/types.ts';
import { createStore, type Store } from '../state/store.ts';
import { effect, flushSync, type Cleanup } from '../state/signal.ts';

export interface ChartContext {
  readonly space: CartesianSpace;
  readonly theme: Theme;
}

export type LayerBuilder<S> = (state: S, context: ChartContext) => SceneNode | undefined;

export interface ChartOptions<S extends object> {
  readonly width?: number;
  readonly height?: number;
  readonly margin?: Partial<Margin>;
  readonly mode?: ThemeMode;
  readonly theme?: Theme;
  readonly initialState: S;
  readonly layers: readonly LayerBuilder<S>[];
  readonly ariaLabel?: string;
  readonly className?: string;
}

export interface Chart<S extends object> {
  readonly store: Store<S>;
  readonly renderer: SvgRenderer;
  readonly element: SVGSVGElement;
  context(): ChartContext;
  scene(): SceneNode | undefined;
  update(partial: Partial<S>): void;
  resize(size: Partial<Size>): void;
  setTheme(theme: Theme): void;
  render(): void;
  destroy(): void;
}

export function createChart<S extends object>(
  container: Element,
  options: ChartOptions<S>
): Chart<S> {
  const width = options.width ?? 640;
  const height = options.height ?? 360;

  let space = createCartesianSpace({
    width,
    height,
    ...(options.margin === undefined ? {} : { margin: options.margin }),
  });
  let theme = options.theme ?? themeFor(options.mode ?? 'light');

  const store = createStore<S>(options.initialState);
  const renderer = createSvgRenderer(container, {
    width,
    height,
    ...(options.ariaLabel === undefined ? {} : { ariaLabel: options.ariaLabel }),
    ...(options.className === undefined ? {} : { className: options.className }),
  });

  let currentScene: SceneNode | undefined;

  const build = (state: S): SceneNode => {
    const context: ChartContext = { space, theme };
    const children: SceneNode[] = [];
    for (const layer of options.layers) {
      const node = layer(state, context);
      if (node) children.push(node);
    }
    return group({ key: 'chart-root', attrs: { class: 'd3l-root' } }, [
      group(
        {
          key: 'plot-area',
          transform: { x: space.plot.x, y: space.plot.y, k: 1 },
        },
        children
      ),
    ]);
  };

  const draw = (state: S): void => {
    currentScene = build(state);
    renderer.render(currentScene);
  };

  let disposeEffect: Cleanup = effect(() => {
    draw(store.state());
  });

  return {
    store,
    renderer,
    element: renderer.root,

    context(): ChartContext {
      return { space, theme };
    },

    scene(): SceneNode | undefined {
      return currentScene;
    },

    update(partial: Partial<S>): void {
      store.patch(partial);
      flushSync();
    },

    resize(size: Partial<Size>): void {
      space = space.resize(size);
      renderer.resize(space.outer.width, space.outer.height);
      draw(store.get());
    },

    setTheme(next: Theme): void {
      theme = next;
      draw(store.get());
    },

    render(): void {
      draw(store.get());
    },

    destroy(): void {
      disposeEffect();
      disposeEffect = () => undefined;
      renderer.destroy();
    },
  };
}

export type { Renderer };
