import Phaser from 'phaser';
import { GameScene } from './GameScene';
import { HOTBAR, HotbarAction, hotbarAvailable } from '../ui/hotbarDef';
import { GameState, hasItem } from '../state/GameState';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { AimPad } from '../ui/AimPad';
import { InHandBar } from '../ui/InHandBar';
import { BuildPicker } from '../ui/BuildPicker';
import { PlacementGhost } from '../ui/PlacementGhost';
import { MinimapToggle } from '../ui/MinimapToggle';
import { InteractButton } from '../ui/InteractButton';
import { OrientationOverlay } from '../ui/OrientationOverlay';
import { OverflowMenu } from '../ui/OverflowMenu';
import { Modal } from '../ui/ShopModal';
import { HelpOverlay } from '../ui/HelpOverlay';
import { Minimap } from '../ui/Minimap';

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
    keyHint: Phaser.GameObjects.Text;
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
  aimPad?: AimPad;
  private inHandBar?: InHandBar;
  private buildPicker: BuildPicker | null = null;
  private placementGhost: PlacementGhost | null = null;
  private placementHotbarIdx: number | null = null;
  private prePlacementHotbarSlot: number | null = null;
  private minimapToggle?: MinimapToggle;
  private contextInteractButton?: InteractButton;
  private orientationOverlay?: OrientationOverlay;
  private overflowMenu?: OverflowMenu;
  private modal: Modal | null = null;
  private shopCompass?: Phaser.GameObjects.Container;
  private minimap?: Minimap;
  private bossHpBarBg?: Phaser.GameObjects.Rectangle;
  private bossHpBarFg?: Phaser.GameObjects.Rectangle;
  private bossHpLabel?: Phaser.GameObjects.Text;

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
    this.buildBossHpBar();

    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) {
      this.minimap = new Minimap(this, this.gameScene);
    }
    if (isTouch) {
      this.joystick = new VirtualJoystick(this, 80, this.scale.height - 80, 60);
      this.aimPad = new AimPad(this, this.scale.width - 80, this.scale.height - 80, 60);
      this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => this.gameScene.input2.setJoystickVector({ x: this.joystick!.value.x, y: this.joystick!.value.y }),
      });
      this.aimPad.events.on('change', (x: number, y: number) => {
        this.gameScene.handleAimAction(x, y, false);
      });
      this.aimPad.events.on('release', (x: number, y: number) => {
        this.gameScene.handleAimAction(x, y, true);
      });
      this.time.addEvent({
        delay: 60,
        loop: true,
        callback: () => {
          if (this.aimPad?.value.active) {
            this.gameScene.handleAimAction(this.aimPad.value.x, this.aimPad.value.y, false);
          }
        },
      });
      this.inHandBar = new InHandBar(this, this.state, {
        onSelectTool: (hotbarIdx) => {
          if (this.placementHotbarIdx !== null) this.exitPlacementMode();
          this.state.hotbarSlot = hotbarIdx;
          this.events.emit('hotbar_changed');
          this.gameScene.refreshPlayerWeapon();
        },
        onBuildPressed: () => this.openBuildPicker(),
        onCancelPressed: () => this.exitPlacementMode(),
        onPlacePressed: () => this.commitPlacement(),
      });
      this.hotbarContainer.setVisible(false);
      this.minimapToggle = new MinimapToggle(this, this.gameScene);
      this.contextInteractButton = new InteractButton(this, () => this.gameScene.handleInteractPressed());
      this.orientationOverlay = new OrientationOverlay(this);
      this.overflowMenu = new OverflowMenu(this, [
        { icon: '?', label: 'Help', onPress: () => this.toggleHelp() },
        {
          icon: '⏵',
          label: 'Skip to Night',
          onPress: () => this.gameScene.cycle.skipToNight(),
          isVisible: () => this.state.phase === 'day',
        },
      ]);
      this.helpButton.setVisible(false);
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
      const keyHintText = i < 9 ? String(i + 1) : i === 9 ? '0' : '';
      const keyHint = this.add.text(0, 0, keyHintText, {
        fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: '#9eb0c4',
      }).setOrigin(0, 0);

      this.hotbarContainer.add([bg, icon, label, countBg, count, keyHint]);
      this.hotbarCells.push({ bg, icon, label, countBg, count, keyHint });
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

  private buildBossHpBar(): void {
    this.bossHpBarBg = this.add.rectangle(0, 0, 400, 14, 0x000000, 0.75).setStrokeStyle(2, 0xff2020, 0.85).setScrollFactor(0).setDepth(600);
    this.bossHpBarFg = this.add.rectangle(0, 0, 396, 10, 0xc22020, 1).setScrollFactor(0).setDepth(601);
    this.bossHpLabel = this.add.text(0, 0, '⚠ BOSS', {
      fontFamily: 'system-ui', fontSize: '14px', color: '#ffcccc', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(602);
    this.bossHpBarBg.setVisible(false);
    this.bossHpBarFg.setVisible(false);
    this.bossHpLabel.setVisible(false);
  }

  private renderBossHpBar(): void {
    const boss = this.gameScene.zombies.find((z) => z.alive && z.variant === 'boss');
    if (!boss || !this.bossHpBarBg || !this.bossHpBarFg || !this.bossHpLabel) {
      this.bossHpBarBg?.setVisible(false);
      this.bossHpBarFg?.setVisible(false);
      this.bossHpLabel?.setVisible(false);
      return;
    }
    const w = this.scale.width;
    const cx = w / 2;
    const cy = 90;
    this.bossHpBarBg.setPosition(cx, cy);
    this.bossHpBarFg.setPosition(cx - 198 + (396 * Math.max(0, boss.hp) / boss.maxHp) / 2, cy);
    this.bossHpBarFg.width = 396 * Math.max(0, boss.hp) / boss.maxHp;
    this.bossHpLabel.setPosition(cx, cy - 16);
    this.bossHpBarBg.setVisible(true);
    this.bossHpBarFg.setVisible(true);
    this.bossHpLabel.setVisible(true);
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

  private openBuildPicker(): void {
    if (this.buildPicker) return;
    this.buildPicker = new BuildPicker(this, this.state, {
      onSelect: (hotbarIdx) => this.enterPlacementMode(hotbarIdx),
      onClose: () => { this.buildPicker?.destroy(); this.buildPicker = null; },
    });
  }

  private enterPlacementMode(hotbarIdx: number): void {
    this.buildPicker?.destroy();
    this.buildPicker = null;
    this.prePlacementHotbarSlot = this.state.hotbarSlot;
    this.placementHotbarIdx = hotbarIdx;
    this.state.hotbarSlot = hotbarIdx;
    this.gameScene.refreshPlayerWeapon();
    const act = HOTBAR[hotbarIdx];
    this.placementGhost = new PlacementGhost(this.gameScene, act.color);
    this.inHandBar?.setPlacementMode(true);
  }

  private exitPlacementMode(): void {
    if (this.placementHotbarIdx === null) return;
    this.placementGhost?.destroy();
    this.placementGhost = null;
    this.placementHotbarIdx = null;
    if (this.prePlacementHotbarSlot !== null) {
      this.state.hotbarSlot = this.prePlacementHotbarSlot;
      this.prePlacementHotbarSlot = null;
      this.gameScene.refreshPlayerWeapon();
      this.events.emit('hotbar_changed');
    }
    this.inHandBar?.setPlacementMode(false);
  }

  private commitPlacement(): void {
    if (this.placementHotbarIdx === null) return;
    const tile = this.gameScene.getCurrentPlacementTarget();
    if (!tile || !tile.valid) return;
    const wc = this.gameScene.world.tileToWorldCenter(tile.tx, tile.ty);
    this.gameScene.handleTileInteraction(wc.x, wc.y);
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
      cell.keyHint.setPosition(x - cellW / 2 + 4, y - cellH / 2 + 3);
      cell.keyHint.setFontSize(Math.max(8, Math.round(10 * scale)));
    }
    this.hpLabel.setPosition(22, 22);
    this.phaseLabel.setPosition(w / 2, 22);
    this.nightLabel.setPosition(w - 20, 12);

    // Inventory chips: a single horizontal row on desktop, a 3-column grid
    // on touch (saves horizontal space for the top HUD elements).
    const isTouchHud = !!this.joystick;
    if (isTouchHud) {
      const cols = 3;
      const startX = 18;
      const startY = 52;
      const chipW = 60;
      const chipH = 22;
      for (let i = 0; i < this.invChips.length; i++) {
        const chip = this.invChips[i];
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cx = startX + c * (chipW + 4);
        const cy = startY + r * (chipH + 4);
        chip.bg.setPosition(cx, cy);
        chip.swatch.setPosition(cx + 6, cy);
        chip.text.setPosition(cx + 20, cy);
      }
    } else {
      const invStartX = 18;
      const invStartY = 52;
      for (let i = 0; i < this.invChips.length; i++) {
        const chip = this.invChips[i];
        const cx = invStartX + i * 62;
        chip.bg.setPosition(cx, invStartY);
        chip.swatch.setPosition(cx + 6, invStartY);
        chip.text.setPosition(cx + 20, invStartY);
      }
    }

    if (this.helpButton && !isTouchHud) {
      this.helpButton.setPosition(22, h - cellH - 34);
    }
    if (this.joystick) this.joystick.setPosition(80, h - 80);
    if (this.aimPad) this.aimPad.setPosition(w - 80, h - 80);
    this.inHandBar?.layout();
    this.minimap?.layout();
    this.minimapToggle?.setPosition(w - 60, 22);
    this.overflowMenu?.setPosition(w - 28, 22);
    if (this.contextInteractButton) {
      this.contextInteractButton.setPosition(w - 80, h - 80 - 80);
    }

  }

  update(): void {
    this.renderHud();
    this.renderHotbar();
    this.inHandBar?.render();
    this.renderInventory();
    this.renderShopCompass();
    this.renderBossHpBar();
    this.minimap?.update();
    this.minimapToggle?.update();
    if (this.minimapToggle?.isOpen()) this.minimapToggle.updateModalMap();
    this.contextInteractButton?.setTag(this.gameScene.getAdjacentInteractable());
    this.orientationOverlay?.update();
    if (this.placementGhost && this.placementHotbarIdx !== null) {
      const tile = this.gameScene.getCurrentPlacementTarget();
      if (tile) {
        this.placementGhost.setTarget(tile.tx, tile.ty);
        this.placementGhost.setValid(tile.valid);
      }
    }
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
    const rex = this.gameScene.dog?.alive ? `   •   🐶 Lv ${this.gameScene.dog.level}` : '';
    this.nightLabel.setText(`Night ${this.state.nightNumber}   •   Score ${this.state.score}   •   kills ${kills}${rex}${extra}`);
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
