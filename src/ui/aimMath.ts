/**
 * Snaps a normalized stick value (each in [-1, 1]) to one of 8 cardinal/diagonal
 * unit directions. Returns null if the magnitude is inside the dead-zone.
 *
 * Coordinate convention matches Phaser screen space: +y is "down" / south.
 */
export function snap8Way(
  sx: number,
  sy: number,
  deadzone = 0.25,
): { dx: number; dy: number } | null {
  const mag = Math.hypot(sx, sy);
  if (mag < deadzone) return null;
  const angle = Math.atan2(sy, sx);
  const sector = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  const TABLE: { dx: number; dy: number }[] = [
    { dx: 1, dy: 0 },   // 0  E
    { dx: 1, dy: 1 },   // 1  SE
    { dx: 0, dy: 1 },   // 2  S
    { dx: -1, dy: 1 },  // 3  SW
    { dx: -1, dy: 0 },  // 4  W
    { dx: -1, dy: -1 }, // 5  NW
    { dx: 0, dy: -1 },  // 6  N
    { dx: 1, dy: -1 },  // 7  NE
  ];
  return TABLE[sector];
}
