// Dev-only playtest helpers (never bundled in production builds).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGame = any;

/** Simulates nights with a simple melee autopilot; returns a per-night report. */
export function autoRun(g: AnyGame, opts: { nights?: number; heal?: boolean; tierUp?: boolean } = {}): string {
  const errs: string[] = [];
  window.addEventListener('error', (e) => errs.push(e.message));
  if (g.phase === 'menu') g.start();
  g.advance(4);
  const rep: unknown[] = [];
  const dmg: Record<string, number> = {};
  const orig = g.hurtPlayer.bind(g);
  g.hurtPlayer = (d: number, from: unknown) => {
    const stack = new Error().stack ?? '';
    const src = /explode/.test(stack) ? 'explode' : /updateHazards/.test(stack) ? 'bolt' : /updateBoss|stomp/.test(stack) ? 'stomp' : 'bite';
    if (g.player.invuln <= 0) dmg[`${g.night}:${src}`] = (dmg[`${g.night}:${src}`] ?? 0) + d;
    orig(d, from);
  };
  g.input.update = () => {};
  for (let n = 1; n <= (opts.nights ?? 7); n++) {
    if (opts.tierUp !== false) g.player.setTier(Math.min(3, Math.floor(n / 2)));
    if (opts.heal !== false) g.player.hp = g.player.maxHp;
    while (g.phase !== 'day' || g.phaseT < 3) g.advance(0.5);
    g.bringNight();
    let minHp = g.player.hp, t = 0;
    const k0 = g.stats.kills;
    g.input.actionHeld = true;
    while ((g.phase === 'dusk' || g.phase === 'night') && t < 300 && g.player.hp > 0) {
      const p = g.player.pos;
      const alive = g.zombies.filter((z: any) => !z.dead && z.rising <= 0);
      alive.sort((a: any, b: any) => Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z));
      const z = alive[0];
      if (z) {
        const dx = z.pos.x - p.x, dz = z.pos.z - p.z, d = Math.hypot(dx, dz);
        if (d > 1.2 && d < 9) g.input.move.set(dx / d, dz / d);
        else g.input.move.set(0, 0);
      } else g.input.move.set(0, 0);
      g.advance(0.25);
      t += 0.25;
      minHp = Math.min(minHp, g.player.hp);
    }
    rep.push({ n, card: g.card, t, minHp: Math.round(minHp), kills: g.stats.kills - k0, phase: g.phase, king: g.king ? Math.round(g.king.hp) : null });
    g.input.move.set(0, 0);
    if (g.phase === 'over') break;
  }
  return JSON.stringify({ rep, dmg, errs, victory: g.victory });
}
