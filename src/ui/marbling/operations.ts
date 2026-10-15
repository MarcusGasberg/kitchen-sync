// Mathematical marbling (Jaffer and Lu, "Mathematical Marbling", IEEE CG&A
// 2012): each operation is an exact, area-preserving map of the water's
// surface with a closed-form inverse, so a pattern is drawn by walking each
// point of water back through the operations, newest first, until it lands in
// a drop.

// The water every basin shows: 2.5 wide and 1 high, the same on every device.
export const WORLD_WIDTH = 2.5;
export const WORLD_HEIGHT = 1;

// What a point of water shows: 0 is clear water, 1 to 4 the inks from
// strongest to faintest, 5 the fresh ink of a change still in the outbox.
export type Tone = 0 | 1 | 2 | 3 | 4 | 5;
export const TONES = 6;

export interface Point {
  readonly x: number;
  readonly y: number;
}

// A drop of ink (or, with tone 0, of clear water) lands at (x, y) and spreads
// to `radius`, pushing everything already on the water outward.
export interface Drop {
  readonly kind: "drop";
  // Stable across renders: what the settle animation tracks.
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly tone: Tone;
}

// A tine drawn along the line through (x, y) in the direction (ux, uy), a
// unit vector. Water on the line moves `shift` along it, water farther off
// less, by falloff / (distance + falloff).
export interface Tine {
  readonly kind: "tine";
  readonly key: string;
  readonly x: number;
  readonly y: number;
  readonly ux: number;
  readonly uy: number;
  readonly shift: number;
  readonly falloff: number;
}

export type Operation = Drop | Tine;

const lineDistance = (op: Tine, x: number, y: number) =>
  Math.abs((x - op.x) * -op.uy + (y - op.y) * op.ux);

const tineShift = (op: Tine, x: number, y: number) =>
  (op.shift * op.falloff) / (lineDistance(op, x, y) + op.falloff);

// Where the water at `p` goes when `op` happens.
export const forward = (op: Operation, p: Point): Point => {
  if (op.kind === "tine") {
    const along = tineShift(op, p.x, p.y);
    return { x: p.x + op.ux * along, y: p.y + op.uy * along };
  }
  if (op.radius === 0) return p;
  const dx = p.x - op.x;
  const dy = p.y - op.y;
  const m2 = dx * dx + dy * dy;
  if (m2 === 0) return { x: op.x + op.radius, y: op.y };
  const k = Math.sqrt(1 + (op.radius * op.radius) / m2);
  return { x: op.x + dx * k, y: op.y + dy * k };
};

// Where the water now at `q` was before `op`, or null when `q` lies inside a
// drop's own disk: that water is the drop's.
export const inverse = (op: Operation, q: Point): Point | null => {
  if (op.kind === "tine") {
    // The shift runs along the line, so the distance to it is unchanged.
    const along = tineShift(op, q.x, q.y);
    return { x: q.x - op.ux * along, y: q.y - op.uy * along };
  }
  const dx = q.x - op.x;
  const dy = q.y - op.y;
  const m2 = dx * dx + dy * dy;
  const r2 = op.radius * op.radius;
  if (r2 === 0) return q;
  if (m2 <= r2) return null;
  const k = Math.sqrt(1 - r2 / m2);
  return { x: op.x + dx * k, y: op.y + dy * k };
};

// What the water shows at (x, y) once every operation has happened, oldest
// first. The renderers' hot loop, so it allocates nothing.
// `src/ui/marbling/webgl.ts` runs the same walk on the GPU: change both.
export const toneAt = (
  ops: ReadonlyArray<Operation>,
  x: number,
  y: number,
): Tone => {
  let qx = x;
  let qy = y;
  for (let k = ops.length - 1; k >= 0; k--) {
    const op = ops[k];
    if (op.kind === "drop") {
      const dx = qx - op.x;
      const dy = qy - op.y;
      const m2 = dx * dx + dy * dy;
      const r2 = op.radius * op.radius;
      if (r2 === 0) continue;
      if (m2 <= r2) return op.tone;
      const back = Math.sqrt(1 - r2 / m2);
      qx = op.x + dx * back;
      qy = op.y + dy * back;
    } else {
      const along = tineShift(op, qx, qy);
      qx -= op.ux * along;
      qy -= op.uy * along;
    }
  }
  return 0;
};

// How a basin of `width` × `height` pixels shows the world: scaled to cover
// the box and centred, so every basin of one shape shows the same water.
export interface View {
  // World units per pixel.
  readonly scale: number;
  // The world point at the box's top-left corner.
  readonly originX: number;
  readonly originY: number;
}

export const coverView = (width: number, height: number): View => {
  const scale = Math.min(WORLD_WIDTH / width, WORLD_HEIGHT / height);
  return {
    scale,
    originX: (WORLD_WIDTH - width * scale) / 2,
    originY: (WORLD_HEIGHT - height * scale) / 2,
  };
};

// An operation part of the way through settling in: a drop's area grows in
// step with `progress`, and so does a tine's shift. At 0 it changes nothing.
export const partway = (op: Operation, progress: number): Operation => {
  if (progress >= 1) return op;
  const p = Math.max(0, progress);
  return op.kind === "drop"
    ? { ...op, radius: op.radius * Math.sqrt(p) }
    : { ...op, shift: op.shift * p };
};

// The exponential ease-out every settle uses: quick to land, slow to still.
export const easeOut = (t: number): number =>
  t >= 1 ? 1 : t <= 0 ? 0 : 1 - 2 ** (-10 * t);
