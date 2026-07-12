import Phaser from 'phaser';
import { SaveStore } from '../systems/SaveStore';
import { SaveLoad } from '../systems/SaveLoad';
import { TEX } from '../gfx/textures';
import { sounds } from '../systems/Sound';
import { music } from '../systems/Music';
import { ClassId, CompanionId, MetaStore, ModifierId } from '../systems/MetaStore';
import { CLASS_SPECS } from '../systems/Classes';
import { COMPANION_SPECS } from '../entities/Companion';
import { CampaignStore } from '../systems/CampaignStore';
import { CAMPAIGN_LEVELS } from '../systems/Campaign';

interface PickerChip {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  id: string;
  owned: boolean;
}

export class MenuScene extends Phaser.Scene {
  private pickedClass: ClassId = 'adventurer';
  private pickedBuddy: CompanionId | null = null;
  private pickedModifier: ModifierId | null = null;
  private pickerOpen = false;
  private pickerObjects: Phaser.GameObjects.GameObject[] = [];
  private mainObjects: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Menu');
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(0x162033);
    this.pickerOpen = false;
    this.pickerObjects = [];
    this.mainObjects = [];

    // Music starts on the first gesture (browser audio unlock)
    music.setTheme('menu');
    this.input.on('pointerdown', () => {
      sounds.ensure();
      music.poke();
    });

    // Background grid of grass/dirt tiles
    const bg = this.add.graphics();
    for (let y = 0; y < h + 64; y += 32) {
      for (let x = 0; x < w + 64; x += 32) {
        const r = (Math.sin(x * 0.3 + y * 0.2) + 1) / 2;
        const c = r > 0.5 ? 0x1a2a1a : 0x0f1a0f;
        bg.fillStyle(c, 1);
        bg.fillRect(x, y, 32, 32);
      }
    }

    // Sound toggle (top-right)
    const soundBtn = this.add.text(w - 18, 16, music.muted ? '🔇' : '🔊', {
      fontFamily: 'system-ui', fontSize: '22px',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    soundBtn.on('pointerdown', () => {
      const muted = music.toggleMuted();
      soundBtn.setText(muted ? '🔇' : '🔊');
    });

    // Sprite showcase at bottom
    const decor = [TEX.tree, TEX.crystal_ore, TEX.cave_entrance, TEX.torch, TEX.chest, TEX.shop_npc, 'zombie_goblin', 'zombie_normal', 'zombie_bat', 'zombie_skeleton', 'boss_necromancer', 'zombie_king'];
    const totalDecorW = decor.length * 56;
    const startX = (w - totalDecorW) / 2 + 28;
    for (let i = 0; i < decor.length; i++) {
      const img = this.add.image(startX + i * 56, h - 66, decor[i]);
      img.setScale(1.6);
      this.tweens.add({ targets: img, y: img.y - 4, yoyo: true, repeat: -1, duration: 900 + i * 50 });
    }

    // Title v2
    const title = this.add.text(w / 2, h / 2 - 168, 'MINE2D II', {
      fontFamily: 'system-ui', fontSize: '72px', color: '#ffe082', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 7,
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, y: title.y - 6, yoyo: true, repeat: -1, duration: 1600 });
    const sub = this.add.text(w / 2, h / 2 - 116, '⛏  T H E   D E E P   D A R K  ⛏', {
      fontFamily: 'system-ui', fontSize: '22px', color: '#7fe7ff', fontStyle: 'bold',
      stroke: '#0a2a3a', strokeThickness: 4,
    }).setOrigin(0.5);
    this.tweens.add({ targets: sub, alpha: 0.7, yoyo: true, repeat: -1, duration: 1200 });

    this.add.text(w / 2, h / 2 - 86, 'mine by day · survive the night · beat the Zombie King', {
      fontFamily: 'system-ui', fontSize: '15px', color: '#c8dbef',
    }).setOrigin(0.5);
    this.add.text(w / 2, h / 2 - 62, '🎂  a game made for Robert  🎂', {
      fontFamily: 'system-ui', fontSize: '13px', color: '#ffb0d8',
    }).setOrigin(0.5);

    const meta = MetaStore.get();
    const best = SaveStore.getBestScore();
    const statusBits = [
      best > 0 ? `★ best ${best} night${best === 1 ? '' : 's'}` : '★ no score yet',
      `⭐ ${meta.coins} coins`,
    ];
    const campaignDone = CampaignStore.completedCount();
    if (campaignDone > 0) statusBits.push(`🗺 ${campaignDone}/${CAMPAIGN_LEVELS.length} missions`);
    if (meta.victories > 0) statusBits.push(`👑 ${meta.victories} victor${meta.victories === 1 ? 'y' : 'ies'}`);
    this.add.text(w / 2, h / 2 - 38, statusBits.join('   ·   '), {
      fontFamily: 'ui-monospace, monospace', fontSize: '14px', color: '#ffd166',
    }).setOrigin(0.5);

    this.buildMainButtons();

    const hint = 'WASD/Joystick move · Click/Tap use · E interact · R Hero Blast · C craft · M sound · H help';
    this.add.text(w / 2, h - 18, hint, { fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#7a8595' }).setOrigin(0.5);
  }

  private buildMainButtons(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const hasSave = SaveLoad.hasSave();
    let y = h / 2 + 4;

    const mkButton = (label: string, color: number, hover: number, big: boolean, onPress: () => void): void => {
      const btn = this.add.rectangle(w / 2, y, big ? 260 : 220, big ? 52 : 42, color).setStrokeStyle(2, 0xffffff, 0.55);
      const text = this.add.text(w / 2, y, label, {
        fontFamily: 'system-ui', fontSize: big ? '21px' : '17px', color: '#fff', fontStyle: 'bold',
      }).setOrigin(0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => btn.setFillStyle(hover));
      btn.on('pointerout', () => btn.setFillStyle(color));
      btn.on('pointerdown', () => {
        sounds.ensure();
        sounds.click();
        onPress();
      });
      this.mainObjects.push(btn, text);
      y += big ? 60 : 50;
    };

    if (hasSave) {
      const savedAt = SaveLoad.savedAt();
      mkButton('↻  Continue Run', 0x2e5ea0, 0x3e77c5, true, () => {
        const snap = SaveLoad.load();
        if (snap) this.scene.start('Game', { loadSnapshot: snap });
        else this.scene.start('Game');
      });
      if (savedAt) {
        const t = this.add.text(w / 2, y - 52 + 30, savedAt.toLocaleString(), {
          fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: '#c8dbef',
        }).setOrigin(0.5);
        this.mainObjects.push(t);
      }
    }

    mkButton(hasSave ? '▶  New Run' : '▶  Start Run', 0x3a7a3a, 0x4a9a4a, true, () => this.openPicker());
    mkButton('🗺  Campaign', 0x2a5a7a, 0x3a77a0, true, () => this.scene.start('Campaign'));
    mkButton('⭐  Hero\'s Hut', 0x6e5a1a, 0x8a7228, false, () => this.scene.start('HeroHut'));
    if (MetaStore.get().victories > 0) {
      mkButton('👑  Replay Credits', 0x4a2a6e, 0x5f3a8a, false, () => {
        this.scene.start('Credits', {
          night: SaveStore.getBestScore(),
          stats: { zombiesKilled: 0, tilesMined: 0, tilesPlaced: 0, goldEarned: 0 },
          fromMenu: true,
        });
      });
    }
  }

  // --- New Run picker --------------------------------------------------------

  private openPicker(): void {
    if (this.pickerOpen) return;
    this.pickerOpen = true;
    for (const o of this.mainObjects) (o as Phaser.GameObjects.Rectangle).setVisible(false);

    const w = this.scale.width;
    const h = this.scale.height;
    const meta = MetaStore.get();
    const panelW = Math.min(660, w - 30);
    const panelH = 320;
    const cx = w / 2;
    const topY = h / 2 - 10;

    const panel = this.add.rectangle(cx, topY + panelH / 2 - 20, panelW, panelH, 0x101a2c, 0.96).setStrokeStyle(2, 0x88aaff, 0.6);
    this.pickerObjects.push(panel);

    const addSection = (label: string, yy: number): void => {
      const t = this.add.text(cx - panelW / 2 + 16, yy, label, {
        fontFamily: 'system-ui', fontSize: '13px', color: '#9eb0c4', fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      this.pickerObjects.push(t);
    };

    const chipRow = (
      yy: number,
      options: { id: string; label: string; owned: boolean }[],
      selectedId: () => string | null,
      onPick: (id: string) => void,
      allowNone: boolean,
    ): void => {
      const chips: PickerChip[] = [];
      let x = cx - panelW / 2 + 16;
      const entries = allowNone ? [{ id: '__none', label: '🌍 Classic', owned: true }, ...options] : options;
      for (const opt of entries) {
        const width = 18 + opt.label.length * 7.5;
        const bg = this.add.rectangle(x + width / 2, yy, width, 30, 0x1a2438, 0.95).setStrokeStyle(1, 0x88aaff, 0.5);
        const label = this.add.text(x + width / 2, yy, opt.label, {
          fontFamily: 'system-ui', fontSize: '12px', color: opt.owned ? '#fff' : '#68727f',
        }).setOrigin(0.5);
        this.pickerObjects.push(bg, label);
        const chip: PickerChip = { bg, label, id: opt.id, owned: opt.owned };
        chips.push(chip);
        if (opt.owned) {
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerdown', () => {
            sounds.click();
            onPick(opt.id === '__none' ? '' : opt.id);
            refresh();
          });
        }
        x += width + 8;
      }
      const refresh = (): void => {
        for (const chip of chips) {
          const isSelected = (selectedId() ?? '__none') === chip.id || (chip.id === '__none' && selectedId() === null);
          chip.bg.setFillStyle(isSelected ? 0x3a7a3a : 0x1a2438, 0.95);
          chip.bg.setStrokeStyle(isSelected ? 2 : 1, isSelected ? 0x9cff9c : 0x88aaff, isSelected ? 0.9 : 0.5);
        }
      };
      refresh();
    };

    addSection('CLASS', topY);
    chipRow(
      topY + 26,
      (Object.keys(CLASS_SPECS) as ClassId[]).map((id) => ({
        id,
        label: `${CLASS_SPECS[id].icon} ${CLASS_SPECS[id].name}${meta.classes.includes(id) ? '' : ' 🔒'}`,
        owned: meta.classes.includes(id),
      })),
      () => this.pickedClass,
      (id) => { this.pickedClass = (id || 'adventurer') as ClassId; },
      false,
    );

    addSection('BUDDY (joins Rex)', topY + 62);
    chipRow(
      topY + 88,
      (['whiskers', 'ember', 'bolt'] as CompanionId[]).map((id) => ({
        id,
        label: `${id === 'whiskers' ? '🐱' : id === 'ember' ? '🐉' : '🤖'} ${COMPANION_SPECS[id].name}${meta.companions.includes(id) ? '' : ' 🔒'}`,
        owned: meta.companions.includes(id),
      })),
      () => this.pickedBuddy,
      (id) => { this.pickedBuddy = (id || null) as CompanionId | null; },
      true,
    );

    addSection('WORLD', topY + 124);
    chipRow(
      topY + 150,
      (['winter', 'island', 'lava'] as ModifierId[]).map((id) => ({
        id,
        label: `${id === 'winter' ? '❄️ Winter' : id === 'island' ? '🏝️ Island' : '🌋 Lava'} World${meta.modifiers.includes(id) ? '' : ' 🔒'}`,
        owned: meta.modifiers.includes(id),
      })),
      () => this.pickedModifier,
      (id) => { this.pickedModifier = (id || null) as ModifierId | null; },
      true,
    );

    const lockNote = this.add.text(cx, topY + 182, '🔒 items are unlocked with Star Coins in the Hero\'s Hut', {
      fontFamily: 'system-ui', fontSize: '11px', color: '#7a8595',
    }).setOrigin(0.5);
    this.pickerObjects.push(lockNote);

    // GO + Back
    const goY = topY + 226;
    const go = this.add.rectangle(cx - 70, goY, 200, 50, 0x3a7a3a).setStrokeStyle(3, 0x88ff88, 0.85);
    const goText = this.add.text(cx - 70, goY, '⛏  DIG IN!', {
      fontFamily: 'system-ui', fontSize: '22px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5);
    go.setInteractive({ useHandCursor: true });
    go.on('pointerover', () => go.setFillStyle(0x4a9a4a));
    go.on('pointerout', () => go.setFillStyle(0x3a7a3a));
    go.on('pointerdown', () => {
      sounds.ensure();
      sounds.click();
      if (SaveLoad.hasSave()) SaveLoad.clear();
      this.scene.start('Game', {
        runConfig: {
          classId: this.pickedClass,
          buddyId: this.pickedBuddy,
          modifierId: this.pickedModifier,
        },
      });
    });
    const back = this.add.rectangle(cx + 120, goY, 110, 40, 0x26334a).setStrokeStyle(1, 0x88aaff, 0.6);
    const backText = this.add.text(cx + 120, goY, 'Back', {
      fontFamily: 'system-ui', fontSize: '15px', color: '#fff',
    }).setOrigin(0.5);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      sounds.click();
      this.closePicker();
    });
    this.pickerObjects.push(go, goText, back, backText);
  }

  private closePicker(): void {
    this.pickerOpen = false;
    for (const o of this.pickerObjects) o.destroy();
    this.pickerObjects = [];
    for (const o of this.mainObjects) (o as Phaser.GameObjects.Rectangle).setVisible(true);
  }
}
