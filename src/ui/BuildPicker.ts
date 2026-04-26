import Phaser from 'phaser';
import { GameState } from '../state/GameState';
import { buildPickerCells, BuildPickerCell } from './buildPickerData';

export interface BuildPickerCallbacks {
  onSelect: (hotbarIndex: number) => void;
  onClose: () => void;
}

const COLS = 4;
const ROWS = 3;
const CELL_W = 78;
const CELL_H = 70;
const GAP = 8;
const PANEL_PAD = 14;

/**
 * Modal placement grid that opens from the Build button. Renders a 4×3 grid
 * of placement actions; tapping an enabled cell calls onSelect with the
 * underlying HOTBAR index. Tapping the "✕ Close" or the backdrop closes.
 */
export class BuildPicker {
  private scene: Phaser.Scene;
  private cb: BuildPickerCallbacks;
  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Rectangle;
  private cells: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; data: BuildPickerCell }[] = [];
  private closeBtn: Phaser.GameObjects.Rectangle;
  private closeLabel: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, state: GameState, cb: BuildPickerCallbacks) {
    this.scene = scene;
    this.cb = cb;
    this.container = scene.add.container(0, 0).setDepth(2000).setScrollFactor(0);

    this.backdrop = scene.add.rectangle(0, 0, scene.scale.width, scene.scale.height, 0x000000, 0.45)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setInteractive();
    this.backdrop.on('pointerdown', () => this.cb.onClose());

    this.panel = scene.add.rectangle(0, 0,
      COLS * CELL_W + (COLS - 1) * GAP + PANEL_PAD * 2,
      ROWS * CELL_H + (ROWS - 1) * GAP + PANEL_PAD * 2 + 28,
      0x1a1c22, 0.96)
      .setStrokeStyle(2, 0x88aaff, 0.6)
      .setScrollFactor(0)
      .setOrigin(0.5);

    this.container.add([this.backdrop, this.panel]);

    const pickerCells = buildPickerCells(state);
    for (let i = 0; i < pickerCells.length; i++) {
      const data = pickerCells[i];
      const bg = scene.add.rectangle(0, 0, CELL_W, CELL_H, data.color, data.available ? 0.85 : 0.3)
        .setStrokeStyle(2, data.available ? 0xffd166 : 0x555, 0.7)
        .setScrollFactor(0);
      const label = scene.add.text(0, 0, data.label, {
        fontFamily: 'system-ui', fontSize: '11px', color: data.available ? '#fff' : '#888', fontStyle: 'bold',
      }).setOrigin(0.5).setScrollFactor(0);
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        if (!data.available) return;
        this.cb.onSelect(data.hotbarIndex);
      });
      this.cells.push({ bg, label, data });
      this.container.add([bg, label]);
    }

    this.closeBtn = scene.add.rectangle(0, 0, 96, 24, 0x4a2030, 0.92)
      .setStrokeStyle(1, 0xff6666, 0.7)
      .setScrollFactor(0);
    this.closeLabel = scene.add.text(0, 0, '✕ Close', {
      fontFamily: 'system-ui', fontSize: '12px', color: '#fff',
    }).setOrigin(0.5).setScrollFactor(0);
    this.closeBtn.setInteractive({ useHandCursor: true });
    this.closeBtn.on('pointerdown', () => this.cb.onClose());
    this.container.add([this.closeBtn, this.closeLabel]);

    this.layout();
  }

  layout(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.backdrop.setSize(w, h);
    const panelW = COLS * CELL_W + (COLS - 1) * GAP + PANEL_PAD * 2;
    const panelH = ROWS * CELL_H + (ROWS - 1) * GAP + PANEL_PAD * 2 + 28;
    const panelX = w / 2;
    const panelY = h * 0.55;
    this.panel.setPosition(panelX, panelY);
    void panelW;
    const startX = panelX - (COLS * CELL_W + (COLS - 1) * GAP) / 2 + CELL_W / 2;
    const startY = panelY - panelH / 2 + PANEL_PAD + CELL_H / 2;
    for (let i = 0; i < this.cells.length; i++) {
      const r = Math.floor(i / COLS);
      const col = i % COLS;
      const cx = startX + col * (CELL_W + GAP);
      const cy = startY + r * (CELL_H + GAP);
      this.cells[i].bg.setPosition(cx, cy);
      this.cells[i].label.setPosition(cx, cy + CELL_H / 2 - 10);
    }
    this.closeBtn.setPosition(panelX, panelY + panelH / 2 - 14);
    this.closeLabel.setPosition(panelX, panelY + panelH / 2 - 14);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
