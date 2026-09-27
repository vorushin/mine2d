import { TOTAL_NIGHTS } from '../config';
import { Cost, costText, Inventory, canAfford } from '../rules';

function screen(overlay: HTMLElement, cls: string, html: string): HTMLDivElement {
  const s = document.createElement('div');
  s.className = 'screen ' + cls;
  s.innerHTML = html;
  overlay.appendChild(s);
  return s;
}

export interface Best {
  nights: number;
  wins: number;
}

export function menuScreen(overlay: HTMLElement, best: Best, onPlay: () => void, onHelp: () => void): HTMLDivElement {
  const bestLine = best.wins > 0
    ? `👑 Beaten ${best.wins}× · best ${best.nights} nights`
    : best.nights > 0 ? `Best: survived ${best.nights} night${best.nights === 1 ? '' : 's'}` : '';
  const s = screen(
    overlay,
    '',
    `<h1 class="logo">MINE3D<small>SEVEN NIGHTS</small></h1>
     <div class="tag">Mine and build by day. Survive the night.<br>Every night brings a surprise. On the seventh, the King comes.</div>
     <button class="big" data-play>▶ PLAY</button>
     <div class="row"><button class="small" data-help>How to play</button><a class="small" href="classic.html" style="color:inherit;text-decoration:none">Play the 2D classic</a></div>
     ${bestLine ? `<div class="best">${bestLine}</div>` : ''}`,
  );
  s.querySelector('[data-play]')!.addEventListener('click', onPlay);
  s.querySelector('[data-help]')!.addEventListener('click', onHelp);
  return s;
}

export interface RunStats {
  nights: number;
  kills: number;
  blocks: number;
  built: number;
  victory: boolean;
}

export function endScreen(overlay: HTMLElement, st: RunStats, best: Best, onAgain: () => void, onContinue: (() => void) | null): HTMLDivElement {
  const title = st.victory ? '👑 VICTORY! 👑' : 'The night got you…';
  const sub = st.victory
    ? `You beat the Zombie King and survived all ${TOTAL_NIGHTS} nights!`
    : `You survived ${st.nights} night${st.nights === 1 ? '' : 's'}. ${st.nights >= best.nights && st.nights > 0 ? '⭐ New best!' : `Best: ${best.nights}`}`;
  const s = screen(
    overlay,
    'dim',
    `<h1 class="logo" style="font-size:clamp(40px,9vw,80px)">${title}</h1>
     <div class="tag">${sub}</div>
     <div class="stats">
       <span>🌙 Nights survived</span><b>${st.nights}</b>
       <span>🧟 Zombies defeated</span><b>${st.kills}</b>
       <span>⛏️ Blocks mined</span><b>${st.blocks}</b>
       <span>🧱 Things built</span><b>${st.built}</b>
     </div>
     <div class="row">
       ${onContinue ? '<button class="big" data-cont>Keep going ∞</button>' : ''}
       <button class="${onContinue ? 'small' : 'big'}" data-again>New island</button>
     </div>`,
  );
  s.querySelector('[data-again]')!.addEventListener('click', onAgain);
  s.querySelector('[data-cont]')?.addEventListener('click', () => onContinue?.());
  return s;
}

export function helpScreen(overlay: HTMLElement, onClose: () => void): HTMLDivElement {
  const s = screen(
    overlay,
    'dim',
    `<div class="panel">
      <h2>How to play</h2>
      <h3>The goal</h3>
      <p style="margin:0">Survive <b>7 nights</b> on the island. Zombies crawl out of the sea at night. On night 7 the <b>Zombie King</b> rises — defeat him to win!</p>
      <h3>Controls</h3>
      <table>
        <tr><td>Move</td><td>WASD / arrows · touch: drag on the left side</td></tr>
        <tr><td>Mine & fight</td><td>Hold <b>Space</b> or click · touch: hold the big ⛏️ button</td></tr>
        <tr><td>Build</td><td>Keys <b>2–5</b> (or tap a slot), then click / tap the ground</td></tr>
        <tr><td>Back to pickaxe</td><td><b>1</b>, <b>Q</b> or right-click</td></tr>
        <tr><td>Upgrade pickaxe</td><td><b>U</b> or the green ⬆ button</td></tr>
        <tr><td>Talk / pet</td><td><b>E</b> or the yellow button</td></tr>
        <tr><td>Bring the night</td><td><b>N</b> — skip the rest of the day</td></tr>
        <tr><td>Sound</td><td><b>M</b></td></tr>
      </table>
      <h3>Build</h3>
      <table>
        <tr><td>🧱 Wall</td><td>Blocks zombies. Uses stone if you have it (much stronger), else wood.</td></tr>
        <tr><td>🔥 Torch</td><td>Lights the night and burns zombies that come close.</td></tr>
        <tr><td>🏹 Turret</td><td>Shoots zombies by itself. Needs iron.</td></tr>
        <tr><td>🧨 TNT</td><td>Blows up when a zombie steps on it — or when you hit it. Also great for mining!</td></tr>
      </table>
      <h3>Pickaxe</h3>
      <p style="margin:0">Wood → Stone → Iron → Crystal. A better pickaxe mines faster, hits harder, and can dig iron, gold and crystal.</p>
      <h3>Surprises</h3>
      <p style="margin:0">Every dusk a card reveals what the night holds. Every day something unexpected happens — look for the arrows at the screen edge!</p>
      <div class="row" style="margin-top:16px"><button class="big" data-close>Got it!</button></div>
    </div>`,
  );
  s.querySelector('[data-close]')!.addEventListener('click', onClose);
  s.addEventListener('pointerdown', (e) => {
    if (e.target === s) onClose();
  });
  return s;
}

export interface Offer {
  emoji: string;
  title: string;
  text: string;
  cost: Cost;
  sold?: boolean;
  buy: () => void;
}

export function tradeScreen(overlay: HTMLElement, inv: Inventory, offers: Offer[], onClose: () => void): HTMLDivElement {
  const s = screen(overlay, 'dim', '');
  const render = () => {
    s.innerHTML = `<div class="panel"><h2>🎈 Balloon Merchant</h2>
      <p style="margin:0 0 12px;text-align:center;opacity:.85">"Shiny things for shiny coins!"</p>
      <div class="offers">${offers
        .map(
          (o, i) => `<button class="offer clickable ${o.sold ? 'sold' : canAfford(inv, o.cost) ? '' : 'poor'}" data-i="${i}">
            <div class="e">${o.emoji}</div><b>${o.title}</b><div style="font-size:12px;opacity:.8">${o.text}</div>
            <div style="margin-top:6px;font-weight:700">${o.sold ? 'SOLD' : costText(o.cost)}</div></button>`,
        )
        .join('')}</div>
      <div class="row" style="margin-top:14px"><button class="small" data-close>Bye!</button></div></div>`;
    s.querySelectorAll<HTMLButtonElement>('[data-i]').forEach((b) =>
      b.addEventListener('click', () => {
        const o = offers[Number(b.dataset.i)];
        if (!o.sold && canAfford(inv, o.cost)) {
          o.buy();
          render();
        }
      }),
    );
    s.querySelector('[data-close]')!.addEventListener('click', onClose);
  };
  render();
  return s;
}
