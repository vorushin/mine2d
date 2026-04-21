import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { HOTBAR, HotbarAction, hotbarAvailable } from '../ui/hotbarDef';
import { GameState, hasItem } from '../state/GameState';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { Modal } from '../ui/ShopModal';
import { HelpOverlay } from '../ui/HelpOverlay';

export class UIScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private state!: GameState;
  readonly events = new Phaser.Events.EventEmitter();
  private hotbarContainer!: Phaser.GameObjects.Container;
  private hotbarCells: {
    bg: Phaser.GameObjects.Rectangle;
    icon: Phaser.GameObjects.Rectangle;
    label: Phaser.GameObjects.Text;
    countBg: Phaser.GameObjects.Rectangle;
    count: Phaser.GameObjects.Text;
  }[] = [];
  private helpOverlay: HelpOverlay | null = null;
  private helpButton!: Phaser.GameObjects.Container;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpLabel!: Phaser.GameObjects.Text;
  private phaseLabel!: Phaser.GameObjects.Text;
  private nightLabel!: Phaser.GameObjects.Text;
  private phaseBar!: Phaser.GameObjects.Graphics;
  private invPanel!: Phaser.GameObjects.Container;
  private invChips: { bg: Phaser.GameObjects.Rectangle; swatch: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text; key: string }[] = [];
  private joystick?: VirtualJoystick;
  private modal: Modal | null = null;
  private attackButton?: Phaser.GameObjects.Arc;
  private interactButton?: Phaser.GameObjects.Arc;
  private skipNightButton?: Phaser.GameObjects.Rectangle;
  private shopCompass?: Phaser.GameObjects.Container;

  constructor() {
    super('UI');
  }

  init(data: { gameScene: GameScene }): void {
    this.gameScene = data.gameScene;
    this.state = data.gameScene.state;
  }

  create(): void {
    this.buildHotbar();
    this.buildHud();
    this.buildHelpButton();
    this.buildShopCompass();

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch) {
      this.joystick = new VirtualJoystick(this);
      this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => this.gameScene.input2.setJoystickVector({ x: this.joystick!.value.x, y: this.joystick!.value.y }),
      });
      this.buildTouchButtons();
    }

    this.events.on('hotbar_changed', () => this.renderHotbar());
    this.events.on('zombie_killed', () => {
      this.cameras.main.shake(40, 0.002);
    });
    this.events.on('open_modal', (mode: 'shop' | 'craft') => this.openModal(mode));

    this.scale.on('resize', () => {
      this.layout();
    });

    this.layout();
  }

  private buildHotbar(): void {
    this.hotbarContainer = this.add.container(0, 0);
    for (let i = 0; i < HOTBAR.length; i++) {
      const bg = this.add.rectangle(0, 0, 56, 68, 0x1a1c22, 0.88).setStrokeStyle(2, 0x555, 0.8);
      const icon = this.add.rectangle(0, 0, 28, 28, HOTBAR[i].color);
      icon.setStrokeStyle(1, 0x000000, 0.5);
      const label = this.add.text(0, 0, HOTBAR[i].label, {
        fontFamily: 'system-ui', fontSize: '11px', color: '#ddd',
      }).setOrigin(0.5);
      const countBg = this.add.rectangle(0, 0, 18, 14, 0x000000, 0.7).setStrokeStyle(1, 0x666, 0.5);
      countBg.setVisible(false);
      const count = this.add.text(0, 0, '', {
        fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: '#ffcc66',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      this.hotbarContainer.add([bg, icon, label, countBg, count]);
      this.hotbarCells.push({ bg, icon, label, countBg, count });
      const idx = i;
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.state.hotbarSlot = idx;
        this.events.emit('hotbar_changed');
      });
    }
  }

  private buildHelpButton(): void {
    this.helpButton = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);
    const bg = this.add.circle(0, 0, 16, 0x26334a, 0.9).setStrokeStyle(1, 0x88aaff, 0.6);
    const txt = this.add.text(0, 0, '?', {
      fontFamily: 'system-ui', fontSize: '18px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.helpButton.add([bg, txt]);
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => this.toggleHelp());
    this.input.keyboard?.on('keydown-H', () => this.toggleHelp());
    this.input.keyboard?.on('keydown-SLASH', () => this.toggleHelp());
  }

  private buildShopCompass(): void {
    this.shopCompass = this.add.container(0, 0).setScrollFactor(0).setDepth(600);
    const ring = this.add.circle(0, 0, 18, 0x000000, 0.5).setStrokeStyle(2, 0xffd166, 0.8);
    const arrow = this.add.triangle(0, 0, -6, 6, 6, 6, 0, -8, 0xffd166, 1).setStrokeStyle(1, 0x000, 1);
    const label = this.add.text(0, 22, 'SHOP', {
      fontFamily: 'ui-monospace, monospace', fontSize: '9px', color: '#ffd166', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.shopCompass.add([ring, arrow, label]);
    this.shopCompass.setVisible(false);
  }

  toggleHelp(): void {
    if (this.helpOverlay) {
      this.helpOverlay.destroy();
      this.helpOverlay = null;
    } else {
      this.helpOverlay = new HelpOverlay(this, {
        onClose: () => { this.helpOverlay?.destroy(); this.helpOverlay = null; },
      });
    }
  }

  private buildHud(): void {
    this.hpBar = this.add.graphics();
    this.hpBar.setScrollFactor(0).setDepth(500);
    this.hpLabel = this.add.text(0, 0, '', {
      fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#fff',
    }).setOrigin(0, 0.5).setScrollFactor(0);
    this.phaseBar = this.add.graphics();
    this.phaseBar.setScrollFactor(0).setDepth(500);
    this.phaseLabel = this.add.text(0, 0, '', {
      fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#9fc2ff',
    }).setOrigin(0.5, 0.5).setScrollFactor(0);
    this.nightLabel = this.add.text(0, 0, '', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(1, 0).setScrollFactor(0);
    this.buildInventoryPanel();
  }

  private buildInventoryPanel(): void {
    this.invPanel = this.add.container(0, 0).setScrollFactor(0).setDepth(500);
    const items: { key: string; color: number; label: string }[] = [
      { key: 'wood', color: 0x9c6a3f, label: 'W' },
      { key: 'stone', color: 0x888888, label: 'S' },
      { key: 'iron', color: 0xc9b037, label: 'I' },
      { key: 'gold', color: 0xffd700, label: 'G' },
      { key: 'arrow', color: 0xe6e6e6, label: 'A' },
      { key: 'bullet', color: 0xffaa00, label: 'B' },
      { key: 'lava', color: 0xff4d1a, label: 'L' },
    ];
    for (const it of items) {
      const bg = this.add.rectangle(0, 0, 56, 22, 0x1a1c22, 0.88).setStrokeStyle(1, 0x555, 0.7).setOrigin(0, 0.5);
      const swatch = this.add.rectangle(0, 0, 10, 10, it.color).setStrokeStyle(1, 0x000, 0.5).setOrigin(0, 0.5);
      const text = this.add.text(0, 0, `${it.label} 0`, {
        fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#eee', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.invPanel.add([bg, swatch, text]);
      this.invChips.push({ bg, swatch, text, key: it.key });
    }
  }

  private buildTouchButtons(): void {
    this.attackButton = this.add.circle(0, 0, 44, 0xff4d4d, 0.28).setScrollFactor(0).setDepth(1000);
    this.attackButton.setStrokeStyle(2, 0xffffff, 0.5);
    this.attackButton.setInteractive();
    this.attackButton.on('pointerdown', () => {
      // Auto-target nearest zombie if any within reach; otherwise fire in facing direction (for ranged)
      const zs = this.gameScene.zombies.filter((z) => z.alive);
      if (zs.length === 0) return;
      zs.sort((a, b) => a.distanceToPlayer(this.gameScene.player) - b.distanceToPlayer(this.gameScene.player));
      const target = zs[0];
      this.gameScene.handleTileInteraction(target.sprite.x, target.sprite.y);
    });

    this.interactButton = this.add.circle(0, 0, 36, 0xffcc66, 0.28).setScrollFactor(0).setDepth(1000);
    this.interactButton.setStrokeStyle(2, 0xffffff, 0.5);
    this.interactButton.setInteractive();
    this.interactButton.on('pointerdown', () => this.gameScene.handleInteractPressed());

    this.skipNightButton = this.add.rectangle(0, 0, 96, 28, 0x26334a, 0.85).setScrollFactor(0).setDepth(1000);
    this.skipNightButton.setStrokeStyle(1, 0x88aaff, 0.6);
    this.skipNightButton.setInteractive({ useHandCursor: true });
    this.skipNightButton.on('pointerdown', () => this.gameScene.cycle.skipToNight());
    const skipText = this.add.text(0, 0, 'Skip to Night', {
      fontFamily: 'system-ui', fontSize: '12px', color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1001);
    this.skipNightButton.setData('text', skipText);
  }

  layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Scale hotbar cells to fit the screen width (mobile support).
    const maxCellW = 56;
    const idealW = HOTBAR.length * maxCellW + (HOTBAR.length - 1) * 4;
    const availW = w - 24;
    const scale = Math.min(1, availW / idealW);
    const cellW = Math.round(maxCellW * scale);
    const cellH = Math.round(68 * scale);
    const pad = Math.max(2, Math.round(4 * scale));
    const totalW = HOTBAR.length * cellW + (HOTBAR.length - 1) * pad;
    const startX = (w - totalW) / 2 + cellW / 2;
    const y = h - cellH / 2 - 10;
    for (let i = 0; i < this.hotbarCells.length; i++) {
      const x = startX + i * (cellW + pad);
      const cell = this.hotbarCells[i];
      cell.bg.setPosition(x, y);
      cell.bg.setDisplaySize(cellW, cellH);
      cell.icon.setPosition(x, y - Math.round(12 * scale));
      cell.icon.setDisplaySize(Math.round(28 * scale), Math.round(28 * scale));
      cell.label.setPosition(x, y + Math.round(20 * scale));
      cell.label.setFontSize(Math.max(9, Math.round(11 * scale)));
      const countX = x + cellW / 2 - Math.round(12 * scale);
      const countY = y - cellH / 2 + Math.round(10 * scale);
      cell.countBg.setPosition(countX, countY);
      cell.count.setPosition(countX, countY);
    }
    this.hpLabel.setPosition(22, 22);
    this.phaseLabel.setPosition(w / 2, 22);
    this.nightLabel.setPosition(w - 20, 12);

    // Inventory chips laid out under HP bar on the left
    const invStartX = 18;
    const invStartY = 52;
    for (let i = 0; i < this.invChips.length; i++) {
      const chip = this.invChips[i];
      const cx = invStartX + i * 62;
      chip.bg.setPosition(cx, invStartY);
      chip.swatch.setPosition(cx + 6, invStartY);
      chip.text.setPosition(cx + 20, invStartY);
    }

    if (this.helpButton) this.helpButton.setPosition(22, h - cellH - 34);

    if (this.attackButton) this.attackButton.setPosition(w - 60, h - cellH - 80);
    if (this.interactButton) this.interactButton.setPosition(w - 130, h - cellH - 50);
    if (this.skipNightButton) {
      this.skipNightButton.setPosition(w - 64, 44);
      const t = this.skipNightButton.getData('text') as Phaser.GameObjects.Text;
      t.setPosition(w - 64, 44);
    }
  }

  update(): void {
    this.renderHud();
    this.renderHotbar();
    this.renderInventory();
    this.renderShopCompass();
  }

  private renderShopCompass(): void {
    if (!this.shopCompass) return;
    const shop = this.gameScene.world.shopPos;
    if (!shop) { this.shopCompass.setVisible(false); return; }
    const cam = this.gameScene.cameras.main;
    const { x: sx, y: sy } = this.gameScene.world.tileToWorldCenter(shop.x, shop.y);
    const viewLeft = cam.worldView.left;
    const viewTop = cam.worldView.top;
    const viewRight = cam.worldView.right;
    const viewBottom = cam.worldView.bottom;
    const onScreen = sx >= viewLeft && sx <= viewRight && sy >= viewTop && sy <= viewBottom;
    if (onScreen) { this.shopCompass.setVisible(false); return; }
    this.shopCompass.setVisible(true);
    // Screen coord of player
    const playerSx = (this.gameScene.player.x - viewLeft) * cam.zoom;
    const playerSy = (this.gameScene.player.y - viewTop) * cam.zoom;
    const shopSx = (sx - viewLeft) * cam.zoom;
    const shopSy = (sy - viewTop) * cam.zoom;
    const dx = shopSx - playerSx;
    const dy = shopSy - playerSy;
    const mag = Math.hypot(dx, dy) || 1;
    const padX = 40;
    const padY = 100;
    const w = this.scale.width;
    const h = this.scale.height;
    // Clamp to screen edge, following direction from player
    const cx = Math.max(padX, Math.min(w - padX, playerSx + dx));
    const cy = Math.max(padY, Math.min(h - padY, playerSy + dy));
    this.shopCompass.setPosition(cx, cy);
    const arrow = this.shopCompass.getAt(1) as Phaser.GameObjects.Triangle;
    arrow.rotation = Math.atan2(dy, dx) + Math.PI / 2;
    void mag;
  }

  private renderInventory(): void {
    for (const chip of this.invChips) {
      const n = this.state.inventory.counts[chip.key as keyof typeof this.state.inventory.counts] ?? 0;
      const labelPrefix = chip.text.text.split(' ')[0];
      chip.text.setText(`${labelPrefix} ${n}`);
      chip.text.setColor(n > 0 ? '#fff' : '#666');
      chip.bg.setStrokeStyle(1, n > 0 ? 0x88aaff : 0x444, n > 0 ? 0.7 : 0.4);
    }
  }

  private renderHud(): void {
    const hpPct = Math.max(0, this.state.playerHp) / this.state.playerMaxHp;
    this.hpBar.clear();
    this.hpBar.fillStyle(0x333333, 0.8);
    this.hpBar.fillRoundedRect(18, 14, 140, 16, 4);
    this.hpBar.fillStyle(hpPct > 0.5 ? 0x77dd77 : hpPct > 0.2 ? 0xffcc33 : 0xff4d4d, 1);
    this.hpBar.fillRoundedRect(18, 14, 140 * hpPct, 16, 4);
    this.hpLabel.setText(`HP ${Math.ceil(this.state.playerHp)}`).setPosition(22, 22);
    this.hpLabel.setDepth(501);

    const prog = this.gameScene.cycle.phaseProgress();
    const barW = 240;
    const barX = this.scale.width / 2 - barW / 2;
    this.phaseBar.clear();
    this.phaseBar.fillStyle(0x1a1c22, 0.8);
    this.phaseBar.fillRoundedRect(barX, 32, barW, 8, 4);
    const phaseColor =
      this.state.phase === 'day' ? 0xffcc66 :
      this.state.phase === 'dusk' ? 0xff884d :
      this.state.phase === 'night' ? 0x5577ff :
      0xaaccff;
    this.phaseBar.fillStyle(phaseColor, 1);
    this.phaseBar.fillRoundedRect(barX, 32, barW * prog, 8, 4);
    this.phaseLabel.setText(`${this.state.phase.toUpperCase()}`).setPosition(this.scale.width / 2, 20);
    const kills = this.state.stats?.zombiesKilled ?? 0;
    const extra = this.state.phase === 'night' ? `   •   zombies ${this.gameScene.zombies.filter((z) => z.alive).length}` : '';
    this.nightLabel.setText(`Night ${this.state.nightNumber}   •   Score ${this.state.score}   •   kills ${kills}${extra}`);

    if (this.skipNightButton) this.skipNightButton.setVisible(this.state.phase === 'day');
  }

  private renderHotbar(): void {
    for (let i = 0; i < this.hotbarCells.length; i++) {
      const cell = this.hotbarCells[i];
      const act: HotbarAction = HOTBAR[i];
      const selected = i === this.state.hotbarSlot;
      const available = hotbarAvailable(i, this.state);
      cell.bg.setStrokeStyle(selected ? 3 : 1, selected ? 0xffd166 : 0x555, selected ? 1 : 0.7);
      cell.icon.setAlpha(available ? 1 : 0.35);
      cell.label.setAlpha(available ? 1 : 0.5);
      let countText = '';
      if (act.kind === 'ranged') {
        countText = String(this.state.inventory.counts[act.ammo] ?? 0);
      } else if (act.kind === 'place') {
        const c0 = act.cost[0];
        countText = String(this.state.inventory.counts[c0.material] ?? 0);
      }
      if (countText === '') {
        cell.count.setVisible(false);
        cell.countBg.setVisible(false);
      } else {
        cell.count.setText(countText).setVisible(true);
        cell.countBg.setVisible(true);
      }
      void hasItem; // suppress lint
    }
  }

  openModal(mode: 'shop' | 'craft'): void {
    if (this.modal) this.modal.destroy();
    this.modal = new Modal(this, {
      state: this.state,
      benchAvailable: () => this.gameScene.benchAvailable(),
      onChanged: () => this.renderHotbar(),
      onClose: () => { this.modal?.destroy(); this.modal = null; },
      mode,
    });
  }
}
