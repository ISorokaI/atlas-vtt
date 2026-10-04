import { GLSL_VERSION } from './glsl';

/** A quad over the painted fog's canvas, in world pixels (`aPosition`), with that canvas' coordinates (`aUV`). */
export const fogLiftVertex = `${GLSL_VERSION}
in vec2 aPosition;
in vec2 aUV;
out vec2 vUv;
out vec2 vWorld;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  vUv = aUV;
  vWorld = aPosition;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
}`;

/**
 * Painted fog as the players see it: the fog canvas' coverage (uFog, black) taken away where the
 * party has explored (uExplored, while uReveals.x is set) or perceives now (uPerceived, while
 * uReveals.y is set). Both are world-space textures over the map (uMapSize) whose red is the
 * share of a texel explored or perceived; off the map nothing is lifted. Without either the fog
 * is exactly as painted. The output is premultiplied black, faded with the mesh (uColor) and
 * its render group (uWorldColorAlpha) like a sprite.
 */
export const fogLiftFragment = `${GLSL_VERSION}
in vec2 vUv;
in vec2 vWorld;
out vec4 finalColor;
uniform sampler2D uFog;
uniform sampler2D uExplored;
uniform sampler2D uPerceived;
uniform vec2 uMapSize;
uniform vec2 uReveals;
uniform vec4 uColor;
uniform vec4 uWorldColorAlpha;
void main() {
  float fog = textureLod(uFog, vUv, 0.0).a;
  vec2 m = vWorld / uMapSize;
  float onMap = step(0.0, m.x) * step(m.x, 1.0) * step(0.0, m.y) * step(m.y, 1.0);
  vec2 at = clamp(m, 0.0, 1.0);
  float lifted = 0.0;
  if (uReveals.x > 0.5) lifted = textureLod(uExplored, at, 0.0).r;
  if (uReveals.y > 0.5) lifted = max(lifted, textureLod(uPerceived, at, 0.0).r);
  finalColor = vec4(0.0, 0.0, 0.0, fog * (1.0 - clamp(lifted * onMap, 0.0, 1.0)) * uColor.a * uWorldColorAlpha.a);
}`;
