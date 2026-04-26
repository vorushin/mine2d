import Phaser from 'phaser';
import { HOTBAR, HotbarAction, hotbarAvailable } from './hotbarDef';
import { GameState } from '../state/GameState';
import { TOUCH_INHAND_SLOTS } from './touchInHandSlots';

export interface InHandBarCallbacks {
  onSelectTool: (hotbarIndex: number) => void;
  onBuildPressed: () => void;
  onCancelPressed: () => void;
  onPlacePressed: () => void;
}

interface Cell {
  bg: Phaser.GameObjects.Rectangle;
  icon: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  countBg: Phaser.GameObjects.Rectangle;
  count: Phaser.GameObjects.Text;
}

const CELL_W = 52;
const CELL_H = 60;
const GAP = 6;

/**
 * The 7-button bottom row used by the touch UI: 6 in-hand tools + a Build
 * button. While the BuildPicker is in placement mode, the rightmost cell
 * morphs into a "✓ Place" button and a small floating "✕ Cancel" appears
 * directly above it.
 */
export class InHandBar {
  private scene: Phaser.Scene;
  private state: GameState;
  private cb: InHandBarCallbacks;
  private toolCells: Cell[] = [];
  private buildBg!: Phaser.GameObjects.Rectangle;
  private buildLabel!: Phaser.GameObjects.Text;
  private cancelBg?: Phaser.GameObjects.Arc;
  private cancelLabel?: Phaser.GameObjects.Text;
  private placementMode = false;

  constructor(scene: Phaser.Scene, state: GameState, cb: InHandBarCallbacks) {
    this.scene = scene;
    this.state = state;
    this.cb = cb;
    this.build();
    this.layout();
  }

  private build(): void {
    for (let i = 0; i < TOUCH_INHAND_SLOTS.length; i++) {
      const hotbarIdx = TOUCH_INHAND_SLOTS[i];
      const act = HOTBAR[hotbarIdx];
      const bg = this.scene.add.rectangle(0, 0, CELL_W, CELL_H, 0x1a1c22, 0.92)
        .setStrokeStyle(2, 0x555, 0.8)
        .setScrollFactor(0)
        .setDepth(900);
      const icon = this.scene.add.rectangle(0, 0, 26, 26, act.color)
        .setStrokeStyle(1, 0x000000, 0.5)
        .setScrollFactor(0)
        .setDepth(901);
      const label = this.scene.add.text(0, 0, act.label, {
        fontFamily: 'system-ui', fontSize: '11px', color: '#ddd',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(901);
      const countBg = this.scene.add.rectangle(0, 0, 18, 14, 0x000000, 0.7)
        .setStrokeStyle(1, 0x666, 0.5)
        .setScrollFactor(0)
        .setDepth(902);
      countBg.setVisible(false);
      const count = this.scene.add.text(0, 0, '', {
        fontFamily: 'ui-monospace, monospace', fontSize: '10px', color: '#ffcc66', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(903);

      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => this.cb.onSelectTool(hotbarIdx));
      this.toolCells.push({ bg, icon, label, countBg, count });
    }

    this.buildBg = this.scene.add.rectangle(0, 0, CELL_W, CELL_H, 0x26334a, 0.92)
      .setStrokeStyle(2, 0x88aaff, 0.8)
      .setScrollFactor(0)
      .setDepth(900);
    this.buildLabel = this.scene.add.text(0, 0, '🛠', {
      fontFamily: 'system-ui', fontSize: '22px', color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(901);
    this.buildBg.setInteractive({ useHandCursor: true });
    this.buildBg.on('pointerdown', () => {
      if (this.placementMode) this.cb.onPlacePressed();
      else this.cb.onBuildPressed();
    });
  }

  setPlacementMode(on: boolean): void {
    this.placementMode = on;
    this.buildLabel.setText(on ? '✓' : '🛠');
    this.buildBg.setStrokeStyle(2, on ? 0x77dd77 : 0x88aaff, 0.9);
    if (on && !this.cancelBg) {
      this.cancelBg = this.scene.add.circle(0, 0, 18, 0x4a2030, 0.92)
        .setStrokeStyle(2, 0xff6666, 0.8)
        .setScrollFactor(0)
        .setDepth(905);
      this.cancelLabel = this.scene.add.text(0, 0, '✕', {
        fontFamily: 'system-ui', fontSize: '16px', color: '#fff', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(906);
      this.cancelBg.setInteractive({ useHandCursor: true });
      this.cancelBg.on('pointerdown', () => this.cb.onCancelPressed());
    } else if (!on && this.cancelBg) {
      this.cancelBg.destroy();
      this.cancelLabel?.destroy();
      this.cancelBg = undefined;
      this.cancelLabel = undefined;
    }
    this.layout();
  }

  layout(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const totalCells = TOUCH_INHAND_SLOTS.length + 1;
    const totalW = totalCells * CELL_W + (totalCells - 1) * GAP;
    const startX = (w - totalW) / 2 + CELL_W / 2;
    const padRadius = 60;
    const y = h - padRadius * 2 - 30;
    for (let i = 0; i < this.toolCells.length; i++) {
      const c = this.toolCells[i];
      const cx = startX + i * (CELL_W + GAP);
      c.bg.setPosition(cx, y);
      c.icon.setPosition(cx, y - 12);
      c.label.setPosition(cx, y + 20);
      c.countBg.setPosition(cx + CELL_W / 2 - 12, y - CELL_H / 2 + 10);
      c.count.setPosition(cx + CELL_W / 2 - 12, y - CELL_H / 2 + 10);
    }
    const buildX = startX + this.toolCells.length * (CELL_W + GAP);
    this.buildBg.setPosition(buildX, y);
    this.buildLabel.setPosition(buildX, y);
    if (this.cancelBg && this.cancelLabel) {
      this.cancelBg.setPosition(buildX, y - CELL_H / 2 - 18);
      this.cancelLabel.setPosition(buildX, y - CELL_H / 2 - 18);
    }
  }

  render(): void {
    for (let i = 0; i < this.toolCells.length; i++) {
      const c = this.toolCells[i];
      const hotbarIdx = TOUCH_INHAND_SLOTS[i];
      const act: HotbarAction = HOTBAR[hotbarIdx];
      const selected = this.state.hotbarSlot === hotbarIdx;
      const available = hotbarAvailable(hotbarIdx, this.state);
      c.bg.setStrokeStyle(selected ? 3 : 2, selected ? 0xffd166 : 0x555, selected ? 1 : 0.7);
      c.icon.setAlpha(available ? 1 : 0.35);
      c.label.setAlpha(available ? 1 : 0.5);
      let countText = '';
      if (act.kind === 'ranged') {
        countText = String(this.state.inventory.counts[act.ammo] ?? 0);
      } else if (act.kind === 'throw') {
        countText = String(this.state.inventory.counts[act.ammo] ?? 0);
      }
      if (countText === '' || countText === '0') {
        c.count.setVisible(false);
        c.countBg.setVisible(false);
      } else {
        c.count.setText(countText).setVisible(true);
        c.countBg.setVisible(true);
      }
    }
  }

  destroy(): void {
    for (const c of this.toolCells) {
      c.bg.destroy(); c.icon.destroy(); c.label.destroy(); c.countBg.destroy(); c.count.destroy();
    }
    this.toolCells = [];
    this.buildBg.destroy();
    this.buildLabel.destroy();
    this.cancelBg?.destroy();
    this.cancelLabel?.destroy();
  }
}
