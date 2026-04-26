import Phaser from 'phaser';
import { GameState, hasItem } from '../state/GameState';
import { MaterialId } from '../world/tileTypes';
import { SHOP_OFFERS, buy, firstAffordablePayment } from '../systems/Shop';
import { RECIPES, applyCraft } from '../systems/Crafting';

export interface ModalDeps {
  state: GameState;
  benchAvailable: () => boolean;
  onClose: () => void;
  mode: 'shop' | 'craft';
  onChanged: () => void;
}

const INVENTORY_ORDER: MaterialId[] = [
  'wood', 'stone', 'iron', 'gold',
  'arrow', 'bullet', 'bomb',
  'lava',
  'wallReinforced', 'turretFlame',
];

const MATERIAL_COLORS: Record<MaterialId, number> = {
  wood: 0x9c6a3f,
  stone: 0x888888,
  iron: 0xc9b037,
  gold: 0xffd700,
  arrow: 0xe6e6e6,
  bullet: 0xffaa00,
  lava: 0xff4d1a,
  bomb: 0x2a2a2a,
  wallReinforced: 0x5a5a70,
  turretFlame: 0xff8030,
};

const ROW_H = 56;
const DRAG_THRESHOLD_PX = 8;

export class Modal {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private deps: ModalDeps;
  private feedbackText: Phaser.GameObjects.Text | null = null;
  private escHandler: (() => void) | null = null;

  // Scroll state — persists across re-renders triggered by buy / craft.
  private scrollY = 0;
  private maxScroll = 0;
  private contentContainer: Phaser.GameObjects.Container | null = null;
  private contentTop = 0;
  private contentBottom = 0;
  private maskGfx: Phaser.GameObjects.Graphics | null = null;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragPointerId: number | null = null;
  private wheelHandler: ((p: Phaser.Input.Pointer, o: unknown[], dx: number, dy: number) => void) | null = null;
  private pointerMoveHandler: ((p: Phaser.Input.Pointer) => void) | null = null;
  private pointerUpHandler: ((p: Phaser.Input.Pointer) => void) | null = null;

  constructor(scene: Phaser.Scene, deps: ModalDeps) {
    this.scene = scene;
    this.deps = deps;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(2000);
    this.container.setScrollFactor(0);

    this.escHandler = () => this.deps.onClose();
    scene.input.keyboard?.on('keydown-ESC', this.escHandler);

    this.installScrollListeners();
    this.render();
  }

  private installScrollListeners(): void {
    this.wheelHandler = (_p, _o, _dx, dy) => {
      if (this.maxScroll <= 0) return;
      this.scrollTo(this.scrollY + dy * 0.5);
    };
    this.pointerMoveHandler = (p) => {
      if (!this.isDragging) return;
      if (this.dragPointerId !== p.id) return;
      if (!p.isDown) {
        this.isDragging = false;
        return;
      }
      const dy = p.y - this.dragStartY;
      this.scrollTo(this.dragStartScroll - dy);
    };
    this.pointerUpHandler = (p) => {
      if (this.dragPointerId === p.id) {
        this.isDragging = false;
        this.dragPointerId = null;
      }
    };
    this.scene.input.on('wheel', this.wheelHandler);
    this.scene.input.on('pointermove', this.pointerMoveHandler);
    this.scene.input.on('pointerup', this.pointerUpHandler);
  }

  private scrollTo(y: number): void {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScroll);
    if (this.contentContainer) this.contentContainer.y = -this.scrollY;
  }

  private showFeedback(text: string, color: string): void {
    if (this.feedbackText) this.feedbackText.destroy();
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.feedbackText = this.scene.add.text(w / 2, h / 2, text, {
      fontFamily: 'system-ui', fontSize: '20px', color, fontStyle: 'bold',
      backgroundColor: '#000000aa', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(3000);
    const ft = this.feedbackText;
    this.scene.tweens.add({
      targets: ft,
      alpha: 0,
      y: h / 2 - 30,
      delay: 400,
      duration: 600,
      onComplete: () => ft.destroy(),
    });
  }

  private render(): void {
    this.container.removeAll(true);
    if (this.maskGfx) {
      this.maskGfx.destroy();
      this.maskGfx = null;
    }
    this.contentContainer = null;

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;

    const dimmer = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0.55).setOrigin(0, 0);
    this.container.add(dimmer);

    const panelW = Math.min(w - 40, 580);
    const panelH = Math.min(h - 80, 600);
    const panelX = w / 2 - panelW / 2;
    const panelY = h / 2 - panelH / 2;

    const panel = this.scene.add.rectangle(w / 2, h / 2, panelW, panelH, 0x1a1c22, 0.97).setStrokeStyle(2, 0x888, 0.85);
    panel.setInteractive(); // blocks clicks from reaching dimmer
    this.container.add(panel);

    const title = this.scene.add.text(panelX + 20, panelY + 14, this.deps.mode === 'shop' ? 'Shop' : 'Crafting', {
      fontFamily: 'system-ui', fontSize: '20px', color: '#fff', fontStyle: 'bold',
    });
    this.container.add(title);

    const closeHit = this.scene.add.rectangle(panelX + panelW - 26, panelY + 14, 32, 32, 0x000000, 0).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
    const closeX = this.scene.add.text(panelX + panelW - 26, panelY + 14, '✕', {
      fontFamily: 'system-ui', fontSize: '22px', color: '#aaa',
    }).setOrigin(0.5, 0);
    closeHit.on('pointerdown', () => this.deps.onClose());
    this.container.add(closeHit);
    this.container.add(closeX);

    const invLabel = this.scene.add.text(panelX + 20, panelY + 48, 'Your resources', {
      fontFamily: 'system-ui', fontSize: '12px', color: '#9eb0c4',
    });
    this.container.add(invLabel);

    const invRowY = panelY + 64;
    let invX = panelX + 20;
    for (const mat of INVENTORY_ORDER) {
      const count = this.deps.state.inventory.counts[mat] ?? 0;
      const chip = this.scene.add.rectangle(invX, invRowY, 60, 24, count > 0 ? 0x26334a : 0x1a1c22, 1).setStrokeStyle(1, count > 0 ? 0x88aaff : 0x333, 0.7).setOrigin(0, 0.5);
      const swatch = this.scene.add.rectangle(invX + 6, invRowY, 10, 10, MATERIAL_COLORS[mat]).setStrokeStyle(1, 0x000, 0.5).setOrigin(0, 0.5);
      const text = this.scene.add.text(invX + 20, invRowY, `${mat}: ${count}`, {
        fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: count > 0 ? '#fff' : '#555',
      }).setOrigin(0, 0.5);
      this.container.add([chip, swatch, text]);
      invX += 68;
    }

    const statusLine = this.deps.mode === 'craft' && !this.deps.benchAvailable()
      ? 'Stand next to a Crafting Bench to craft.'
      : '';
    let rowsTopY = invRowY + 28;
    if (statusLine) {
      const status = this.scene.add.text(panelX + 20, invRowY + 24, statusLine, {
        fontFamily: 'system-ui', fontSize: '12px', color: '#ffa66a', fontStyle: 'italic',
      });
      this.container.add(status);
      rowsTopY = invRowY + 48;
    }

    // Scrollable rows region
    this.contentTop = rowsTopY;
    this.contentBottom = panelY + panelH - 16;
    const contentH = this.contentBottom - this.contentTop;

    // Drag zone — added BEFORE the content container so the content sits
    // on top. Buttons inside content fire their pointerdown before this
    // drag zone (Phaser topOnly), and empty space falls through to here.
    const dragZone = this.scene.add.zone(panelX, this.contentTop, panelW, contentH)
      .setOrigin(0, 0)
      .setInteractive();
    dragZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = p.y;
      this.dragStartScroll = this.scrollY;
      this.dragPointerId = p.id;
    });
    this.container.add(dragZone);

    // Mask in scene coordinates
    this.maskGfx = this.scene.make.graphics();
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillRect(panelX, this.contentTop, panelW, contentH);
    const mask = this.maskGfx.createGeometryMask();

    this.contentContainer = this.scene.add.container(0, 0);
    this.contentContainer.setMask(mask);
    this.container.add(this.contentContainer);

    // Rows
    let rowY = this.contentTop + ROW_H / 2;
    if (this.deps.mode === 'shop') {
      for (const offer of SHOP_OFFERS) {
        this.renderOfferRow(offer, rowY, panelX, panelW);
        rowY += ROW_H;
      }
    } else {
      for (const recipe of RECIPES) {
        this.renderRecipeRow(recipe, rowY, panelX, panelW);
        rowY += ROW_H;
      }
    }

    const totalHeight = (this.deps.mode === 'shop' ? SHOP_OFFERS.length : RECIPES.length) * ROW_H;
    this.maxScroll = Math.max(0, totalHeight - contentH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScroll);
    this.contentContainer.y = -this.scrollY;

    // Subtle scroll-hint indicator on the right edge if there's anything to scroll
    if (this.maxScroll > 0) {
      const hint = this.scene.add.text(panelX + panelW - 8, this.contentTop + 4, '⇅', {
        fontFamily: 'system-ui', fontSize: '14px', color: '#88aaff',
      }).setOrigin(1, 0);
      this.container.add(hint);
    }
  }

  private renderOfferRow(offer: typeof SHOP_OFFERS[number], y: number, panelX: number, panelW: number) {
    const rowX = panelX + 20;
    const rowW = panelW - 40;
    const bg = this.scene.add.rectangle(rowX + rowW / 2, y, rowW, 48, 0x262a33, 1).setStrokeStyle(1, 0x444, 0.5);
    this.contentContainer!.add(bg);
    const label = this.scene.add.text(rowX + 10, y - 10, offer.label, {
      fontFamily: 'system-ui', fontSize: '14px', color: '#fff',
    });
    this.contentContainer!.add(label);
    const paymentLabel = offer.payments
      .map((p) => (p.kind === 'gold' ? `${p.count} gold` : `${p.count} ${p.material}`))
      .join('   or   ');
    const cost = this.scene.add.text(rowX + 10, y + 8, paymentLabel, {
      fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#bbb',
    });
    this.contentContainer!.add(cost);

    const can = firstAffordablePayment(offer, this.deps.state);
    this.renderActionButton(rowX + rowW - 80, y, 72, 30, can ? 'Buy' : '—', !!can, () => {
      if (can) {
        const res = buy(offer, can, this.deps.state);
        this.deps.onChanged();
        if (res.ok) this.showFeedback(`+ ${offer.label}`, '#a0ffa0');
        this.render();
      }
    });
  }

  private renderRecipeRow(recipe: typeof RECIPES[number], y: number, panelX: number, panelW: number) {
    const rowX = panelX + 20;
    const rowW = panelW - 40;
    const bg = this.scene.add.rectangle(rowX + rowW / 2, y, rowW, 48, 0x262a33, 1).setStrokeStyle(1, 0x444, 0.5);
    this.contentContainer!.add(bg);
    const label = this.scene.add.text(rowX + 10, y - 10, recipe.label, {
      fontFamily: 'system-ui', fontSize: '14px', color: '#fff',
    });
    this.contentContainer!.add(label);
    const costLabel = recipe.inputs.map((i) => `${i.count} ${i.material}`).join('  +  ');
    const cost = this.scene.add.text(rowX + 10, y + 8, costLabel, {
      fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#bbb',
    });
    this.contentContainer!.add(cost);

    const canPay = recipe.inputs.every((i) => hasItem(this.deps.state.inventory, i.material, i.count));
    const benchOk = this.deps.benchAvailable();
    const alreadyHave = (() => {
      const a = recipe.produces;
      if (a.kind === 'pickaxe_upgrade') return this.deps.state.pickaxeTier >= a.toTier;
      if (a.kind === 'sword_upgrade') return this.deps.state.swordTier >= a.toTier;
      if (a.kind === 'unlock_bow') return this.deps.state.hasBow;
      if (a.kind === 'unlock_pistol') return this.deps.state.hasPistol;
      return false;
    })();
    const canCraft = canPay && benchOk && !alreadyHave;
    const btnLabel = alreadyHave ? 'Owned' : canPay && benchOk ? 'Craft' : '—';

    this.renderActionButton(rowX + rowW - 80, y, 72, 30, btnLabel, canCraft, () => {
      const res = applyCraft(recipe, this.deps.state, this.deps.benchAvailable());
      this.deps.onChanged();
      if (res.ok) this.showFeedback(`+ ${recipe.label}`, '#a0ffa0');
      this.render();
    });
  }

  /**
   * Action button (rect + text). Fires on pointerup with no significant
   * movement, so a drag-scroll that started on the button doesn't trigger
   * the buy/craft action.
   */
  private renderActionButton(
    cx: number,
    cy: number,
    w: number,
    h: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ) {
    const rect = this.scene.add.rectangle(cx, cy, w, h, enabled ? 0x3a7a3a : 0x3a3a3a, 1).setStrokeStyle(1, enabled ? 0x9cff9c : 0x666, enabled ? 0.9 : 0.4);
    const text = this.scene.add.text(cx, cy, label, {
      fontFamily: 'system-ui', fontSize: '13px', color: enabled ? '#fff' : '#888', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.contentContainer!.add([rect, text]);
    if (enabled) {
      rect.setInteractive({ useHandCursor: true });
      let downY: number | null = null;
      let downId: number | null = null;
      rect.on('pointerdown', (p: Phaser.Input.Pointer) => {
        downY = p.y;
        downId = p.id;
      });
      rect.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (downId !== p.id || downY === null) return;
        const moved = Math.abs(p.y - downY);
        downY = null;
        downId = null;
        if (moved > DRAG_THRESHOLD_PX) return; // user dragged: treat as scroll, not click
        // Skip if we're not visible (scrolled past content area)
        const sceneY = rect.y + (this.contentContainer?.y ?? 0);
        if (sceneY < this.contentTop - 4 || sceneY > this.contentBottom + 4) return;
        onClick();
      });
    }
  }

  destroy(): void {
    if (this.escHandler) this.scene.input.keyboard?.off('keydown-ESC', this.escHandler);
    if (this.wheelHandler) this.scene.input.off('wheel', this.wheelHandler);
    if (this.pointerMoveHandler) this.scene.input.off('pointermove', this.pointerMoveHandler);
    if (this.pointerUpHandler) this.scene.input.off('pointerup', this.pointerUpHandler);
    if (this.maskGfx) this.maskGfx.destroy();
    this.container.destroy();
    if (this.feedbackText) this.feedbackText.destroy();
  }
}
