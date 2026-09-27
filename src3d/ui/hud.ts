import { NightCard } from '../director';
import { Inventory, RES_ICON, RES_LIST, Res } from '../rules';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export interface SlotView {
  icon: string;
  cost: string;
  title: string;
  affordable: boolean;
}

export interface PointerView {
  x: number;
  y: number;
  icon: string;
}

/** Everything drawn on top of the 3D view during play. */
export class Hud {
  readonly root = el('div', 'hud');
  private hpEl = el('div', 'pill hp');
  private hpFill = el('i');
  private hpNum = el('span', 'num');
  private phaseEl = el('div', 'pill phase');
  private phaseLabel = el('div', 'label');
  private phaseSub = el('div', 'sub');
  private phaseFill = el('i');
  private resEl = el('div', 'pill res');
  private resSpans = new Map<Res, HTMLSpanElement>();
  private lastRes: Partial<Inventory> = {};
  private nightBtn = el('button', 'nightbtn clickable', '🌙 Bring the night');
  private muteBtn = el('button', 'iconbtn clickable', '🔊');
  private helpBtn = el('button', 'iconbtn clickable', '❔');
  private toolbar = el('div', 'toolbar');
  private slots: HTMLButtonElement[] = [];
  private upBtn = el('button', 'upgrade clickable');
  private actBtn = el('button', 'actbtn clickable', '⛏️');
  private ctxBtn = el('button', 'context clickable');
  private bannerEl = el('div', 'banner');
  private bannerT: ReturnType<typeof setTimeout> | null = null;
  private hintEl = el('div', 'hint');
  private bossEl = el('div', 'bossbar');
  private bossName = el('div', 'name');
  private bossFill = el('i');
  private vignette = el('div', 'vignette');
  private cardWrap = el('div', 'cardwrap');
  private pointerEls: HTMLDivElement[] = [];

  onSelect: (i: number) => void = () => {};
  onUpgrade: () => void = () => {};
  onNight: () => void = () => {};
  onMute: () => void = () => {};
  onHelp: () => void = () => {};
  onContext: () => void = () => {};
  onAction: (down: boolean) => void = () => {};

  constructor(overlay: HTMLElement, touch: boolean) {
    const top = el('div', 'top');
    const hpBar = el('div', 'bar');
    hpBar.appendChild(this.hpFill);
    this.hpEl.append(el('span', 'heart', '❤️'), hpBar, this.hpNum);
    const phaseBar = el('div', 'bar');
    phaseBar.appendChild(this.phaseFill);
    this.phaseEl.append(this.phaseLabel, this.phaseSub, phaseBar);
    for (const r of RES_LIST) {
      const s = el('span', 'zero', `${RES_ICON[r]}<b>0</b>`);
      this.resSpans.set(r, s);
      this.resEl.appendChild(s);
    }
    const corner = el('div', 'corner');
    const icons = el('div', 'icons');
    icons.append(this.muteBtn, this.helpBtn);
    corner.append(this.resEl, icons, this.nightBtn);
    top.append(this.hpEl, this.phaseEl, corner);

    for (let i = 0; i < 5; i++) {
      const b = el('button', 'slot clickable');
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.onSelect(i);
      });
      this.slots.push(b);
      this.toolbar.appendChild(b);
    }
    this.toolbar.appendChild(this.upBtn);
    this.upBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onUpgrade();
    });
    this.nightBtn.addEventListener('click', () => this.onNight());
    this.muteBtn.addEventListener('click', () => this.onMute());
    this.helpBtn.addEventListener('click', () => this.onHelp());
    this.ctxBtn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.onContext();
    });
    this.ctxBtn.style.display = 'none';

    const bossBar = el('div', 'bar');
    bossBar.appendChild(this.bossFill);
    this.bossEl.append(this.bossName, bossBar);

    this.root.append(this.vignette, top, this.bossEl, this.bannerEl, this.hintEl, this.ctxBtn, this.toolbar, this.cardWrap);
    if (touch) {
      this.root.appendChild(this.actBtn);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.actBtn.classList.add('down');
        this.onAction(true);
      };
      const up = () => {
        this.actBtn.classList.remove('down');
        this.onAction(false);
      };
      this.actBtn.addEventListener('pointerdown', down);
      this.actBtn.addEventListener('pointerup', up);
      this.actBtn.addEventListener('pointercancel', up);
      this.actBtn.addEventListener('pointerleave', up);
    }
    // HUD buttons never take keyboard focus, so Space/Enter always go to the game.
    this.root.querySelectorAll('button').forEach((b) => (b.tabIndex = -1));
    this.root.addEventListener('mousedown', (e) => e.preventDefault());
    overlay.appendChild(this.root);
  }

  show(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  setHp(hp: number, max: number): void {
    const f = Math.max(0, hp / max);
    this.hpFill.style.transform = `scaleX(${f})`;
    this.hpNum.textContent = String(Math.ceil(Math.max(0, hp)));
    this.hpEl.classList.toggle('low', f < 0.3);
  }

  setPhase(label: string, sub: string, frac: number, night: boolean, blood: boolean): void {
    this.phaseLabel.textContent = label;
    this.phaseSub.textContent = sub;
    this.phaseFill.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
    this.phaseEl.classList.toggle('night', night);
    this.phaseEl.classList.toggle('blood', blood);
  }

  setRes(inv: Inventory): void {
    for (const r of RES_LIST) {
      const s = this.resSpans.get(r)!;
      if (this.lastRes[r] !== inv[r]) {
        s.querySelector('b')!.textContent = String(inv[r]);
        s.classList.toggle('zero', inv[r] === 0);
        if ((this.lastRes[r] ?? 0) < inv[r]) {
          s.classList.add('bump');
          setTimeout(() => s.classList.remove('bump'), 130);
        }
        this.lastRes[r] = inv[r];
      }
    }
  }

  setNightButton(v: boolean): void {
    this.nightBtn.style.display = v ? '' : 'none';
  }

  setMuted(m: boolean): void {
    this.muteBtn.textContent = m ? '🔇' : '🔊';
  }

  setToolbar(selected: number, slots: SlotView[], upgrade: { label: string; cost: string; ready: boolean } | null): void {
    slots.forEach((s, i) => {
      const b = this.slots[i];
      const html = `<span class="key">${i + 1}</span><span class="ic">${s.icon}</span><span class="cost">${s.cost}</span>`;
      if (b.innerHTML !== html) b.innerHTML = html;
      b.title = s.title;
      b.classList.toggle('sel', i === selected);
      b.classList.toggle('poor', !s.affordable);
    });
    this.actBtn.textContent = slots[selected]?.icon ?? '⛏️';
    if (!upgrade) {
      this.upBtn.className = 'upgrade clickable max';
    } else {
      const html = `<b>⬆ ${upgrade.label}</b>${upgrade.cost}`;
      if (this.upBtn.innerHTML !== html) this.upBtn.innerHTML = html;
      this.upBtn.className = 'upgrade clickable' + (upgrade.ready ? ' ready' : '');
    }
  }

  banner(title: string, sub = '', ms = 3000): void {
    if (!title) {
      this.bannerEl.classList.remove('show');
      return;
    }
    this.bannerEl.innerHTML = `<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}`;
    this.bannerEl.classList.add('show');
    if (this.bannerT) clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => this.bannerEl.classList.remove('show'), ms);
  }

  hint(html: string | null): void {
    const v = html ?? '';
    if (this.hintEl.innerHTML !== v) this.hintEl.innerHTML = v;
  }

  context(text: string | null): void {
    this.ctxBtn.style.display = text ? '' : 'none';
    if (text && this.ctxBtn.textContent !== text) this.ctxBtn.textContent = text;
  }

  boss(name: string | null, frac = 0): void {
    this.bossEl.classList.toggle('show', !!name);
    if (name) {
      this.bossName.textContent = name;
      this.bossFill.style.transform = `scaleX(${Math.max(0, frac)})`;
    }
  }

  hurt(k: number): void {
    this.vignette.style.opacity = String(k);
  }

  card(night: number, c: NightCard, ms: number, onSkip?: () => void): void {
    this.cardWrap.innerHTML = '';
    const card = el(
      'div',
      'card' + (c.good ? ' good' : '') + (c.id === 'king' ? ' king' : ''),
      `<div class="n">NIGHT ${night}</div><div class="e">${c.emoji}</div><h2>${c.title}</h2><p>${c.text}</p>`,
    );
    this.cardWrap.appendChild(card);
    void card.offsetWidth; // flush styles so the flip-in transition runs
    card.classList.add('show');
    const close = () => {
      card.classList.remove('show');
      setTimeout(() => card.remove(), 400);
    };
    card.addEventListener('pointerdown', () => {
      close();
      onSkip?.();
    });
    setTimeout(close, ms);
  }

  pointers(list: PointerView[]): void {
    while (this.pointerEls.length < list.length) {
      const p = el('div', 'pointer');
      this.root.appendChild(p);
      this.pointerEls.push(p);
    }
    this.pointerEls.forEach((p, i) => {
      const v = list[i];
      if (!v) {
        p.style.display = 'none';
        return;
      }
      p.style.display = '';
      if (p.textContent !== v.icon) p.textContent = v.icon;
      p.style.transform = `translate(${v.x}px, ${v.y}px) translate(-50%, -50%)`;
    });
  }
}
