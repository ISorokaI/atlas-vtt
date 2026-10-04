import { Mesh, MeshGeometry, Texture, UniformGroup, type Renderer, type Shader, type TextureSource } from 'pixi.js';
import type { FogBounds } from '../../types/fogTypes';
import { ENGINE_SHADERS } from '../lighting/engine/engineShaders';
import { createShader, glOf } from '../lighting/engine/gpu';
import { describeShaderFailures, failedEngineShaders } from '../lighting/engine/shaderCheck';
import type { FogReveal } from './fogReveal';

/**
 * Painted fog as the players see it: the fog canvas drawn black, without what the party has
 * explored or perceives now (`FogReveal`, read anew on every render, so a capture for the player
 * window and the GM's session view always draw the current one). Without a reveal it draws the
 * fog exactly as painted.
 */
export class FogLift {
  readonly view: Mesh<MeshGeometry, Shader>;
  private readonly mapSize = new Float32Array([1, 1]);
  /** Whether the explored memory (x) and what is perceived now (y) lift the fog. */
  private readonly reveals = new Float32Array(2);
  private readonly uniforms = new UniformGroup({
    uMapSize: { value: this.mapSize, type: 'vec2<f32>' },
    uReveals: { value: this.reveals, type: 'vec2<f32>' },
  });
  private readonly geometry = new MeshGeometry({
    positions: new Float32Array(8),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  private readonly shader: Shader;

  /**
   * Null where the lift cannot be drawn: on a renderer without WebGL, or a device that does not
   * link its shader. The fog is then shown as painted, so a failure never shows the players more.
   */
  static create(renderer: Renderer, fog: Texture, reveal: () => FogReveal | null): FogLift | null {
    const gl = glOf(renderer);
    if (!gl || gl.isContextLost()) return null;
    const failures = failedEngineShaders(gl, [ENGINE_SHADERS.fogLift]);
    if (failures.length > 0) {
      console.error(`Atlas: painted fog cannot follow the party's sight on this graphics device:\n${describeShaderFailures(failures)}`);
      return null;
    }
    return new FogLift(fog, reveal);
  }

  private constructor(fog: Texture, private readonly reveal: () => FogReveal | null) {
    this.shader = createShader(ENGINE_SHADERS.fogLift, {
      fogLiftUniforms: this.uniforms,
      uFog: fog.source,
      uExplored: Texture.WHITE.source,
      uPerceived: Texture.WHITE.source,
    });
    this.view = new Mesh({ geometry: this.geometry, shader: this.shader });
    this.view.label = 'playerFog';
    this.view.eventMode = 'none';
    this.view.onRender = (): void => this.bindReveal();
  }

  /** The fog canvas and the world rectangle it covers. */
  setFog(fog: Texture, bounds: FogBounds): void {
    this.shader.resources.uFog = fog.source;
    const { x, y, width, height } = bounds;
    this.geometry.positions = new Float32Array([x, y, x + width, y, x + width, y + height, x, y + height]);
  }

  destroy(): void {
    this.view.onRender = null;
    this.view.destroy();
    this.geometry.destroy();
    this.shader.destroy();
  }

  /** Binds the reveal of this render; a texture it no longer names is never kept. */
  private bindReveal(): void {
    const reveal = this.reveal();
    this.reveals[0] = reveal?.explored ? 1 : 0;
    this.reveals[1] = reveal ? 1 : 0;
    if (reveal) this.mapSize.set([Math.max(1, reveal.map.width), Math.max(1, reveal.map.height)]);
    this.bind('uExplored', reveal?.explored?.source ?? Texture.WHITE.source);
    this.bind('uPerceived', reveal?.perceived.source ?? Texture.WHITE.source);
    this.uniforms.update();
  }

  private bind(name: 'uExplored' | 'uPerceived', source: TextureSource): void {
    if (this.shader.resources[name] !== source) this.shader.resources[name] = source;
  }
}
