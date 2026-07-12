import Phaser from 'phaser';
import {
  CAMPAIGN_LEVELS, CAMPAIGN_WORLDS, CampaignLevelDef, levelsOfWorld,
  objectiveLabel, unlockBadges,
} from '../systems/Campaign';
import { CampaignStore } from '../systems/CampaignStore';
import { MetaStore } from '../systems/MetaStore';
import { sounds } from '../systems/Sound';
import { music } from '../systems/Music';

interface CampaignSceneData {
  justCompleted?: { levelId: string; stars: number; coins: number };
}

const CARD_W_MAX = 640;
const CARD_H = 148;
const CARD_GAP = 14;
const CONTENT_TOP = 116;

/**
 * The campaign map: six world cards stacked on a scrollable road, three level
 * nodes each. Tap an unlocked node for the mission briefing, then dig in.
 */
export class CampaignScene extends Phaser.Scene {
  private scrollY = 0;
  private maxScroll = 0;
  private content!: Phaser.GameObjects.Container;
  private maskGfx: Phaser.GameObjects.Graphics | null = null;
  private detailObjects: Phaser.GameObjects.GameObject[] = [];
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private detailOpen = false;

  constructor() {
    super('Campaign');
  }

  create(data?: CampaignSceneData): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor(0x121a2a);
    this.scrollY = 0;
    this.detailObjects = [];
    this.detailOpen = false;
    music.setTheme('menu');
    this.input.on('pointerdown', () => { sounds.ensure(); music.poke(); });

    // Faint tile grid backdrop (same mood as the menu)
    const bg = this.add.graphics();
    for (let y = 0; y < h + 64; y += 32) {
      for (let x = 0; x < w + 64; x += 32) {
        const r = (Math.sin(x * 0.35 + y * 0.22) + 1) / 2;
        bg.fillStyle(r > 0.5 ? 0x16233a : 0x0f1828, 1);
        bg.fillRect(x, y, 32, 32);
      }
    }

    // Header
    this.add.text(w / 2, 30, '🗺  CAMPAIGN', {
      fontFamily: 'system-ui', fontSize: '40px', color: '#ffe082', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10);
    this.add.text(w / 2, 62, 'from a bare pickaxe to the Zombie King — 6 worlds, 18 missions', {
      fontFamily: 'system-ui', fontSize: '13px', color: '#9fc2ff',
    }).setOrigin(0.5).setDepth(10);
    const totalStars = CampaignStore.totalStars();
    const done = CampaignStore.completedCount();
    this.add.text(w / 2, 86, `⭐ ${totalStars}/${CAMPAIGN_LEVELS.length * 3} stars  ·  ${done}/${CAMPAIGN_LEVELS.length} missions  ·  💰 ${MetaStore.get().coins} Star Coins`, {
      fontFamily: 'ui-monospace, monospace', fontSize: '13px', color: '#ffd166',
    }).setOrigin(0.5).setDepth(10);

    // Back to menu
    const back = this.add.rectangle(58, 30, 92, 34, 0x26334a).setStrokeStyle(1, 0x88aaff, 0.7).setDepth(10);
    this.add.text(58, 30, '⬅ Menu', { fontFamily: 'system-ui', fontSize: '14px', color: '#fff' }).setOrigin(0.5).setDepth(11);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => { sounds.click(); this.scene.start('Menu'); });

    // Scrollable world cards
    this.content = this.add.container(0, 0);
    this.buildWorldCards();

    // Mask the scroll region below the header
    this.maskGfx = this.make.graphics();
    this.maskGfx.fillStyle(0xffffff);
    this.maskGfx.fillRect(0, CONTENT_TOP - 10, w, h - (CONTENT_TOP - 10));
    this.content.setMask(this.maskGfx.createGeometryMask());

    const contentH = CAMPAIGN_WORLDS.length * (CARD_H + CARD_GAP);
    this.maxScroll = Math.max(0, CONTENT_TOP + contentH + 20 - h);

    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (this.detailOpen) return;
      this.scrollTo(this.scrollY + dy * 0.5);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.detailOpen || p.y < CONTENT_TOP - 10) return;
      this.isDragging = true;
      this.dragStartY = p.y;
      this.dragStartScroll = this.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.isDragging || !p.isDown) return;
      this.scrollTo(this.dragStartScroll - (p.y - this.dragStartY));
    });
    this.input.on('pointerup', () => { this.isDragging = false; });

    // Start scrolled to the frontier (first playable, uncompleted level)
    const frontier = CAMPAIGN_LEVELS.findIndex((l) => !CampaignStore.isCompleted(l.id));
    if (frontier > 0) {
      const worldIdx = CAMPAIGN_LEVELS[frontier].world - 1;
      this.scrollTo(worldIdx * (CARD_H + CARD_GAP) - 20);
    }

    // Completion toast
    if (data?.justCompleted) {
      const lvl = CAMPAIGN_LEVELS.find((l) => l.id === data.justCompleted!.levelId);
      if (lvl) {
        const allDone = CampaignStore.allCompleted();
        const toastText = allDone
          ? `👑 CAMPAIGN COMPLETE! Every world conquered — you are a legend!`
          : `${'⭐'.repeat(data.justCompleted.stars)}  ${lvl.title} complete!${data.justCompleted.coins > 0 ? `  +${data.justCompleted.coins} Star Coins` : ''}`;
        const toastBg = this.add.rectangle(w / 2, h - 44, Math.min(w - 24, 560), 44, allDone ? 0x4a2a6e : 0x2a4a2a, 0.97)
          .setStrokeStyle(2, allDone ? 0xc46aff : 0x9cff9c, 0.9).setDepth(50);
        const toast = this.add.text(w / 2, h - 44, toastText, {
          fontFamily: 'system-ui', fontSize: '15px', color: '#fff', fontStyle: 'bold',
          align: 'center', wordWrap: { width: Math.min(w - 40, 540) },
        }).setOrigin(0.5).setDepth(51);
        this.tweens.add({ targets: [toastBg, toast], alpha: 0, delay: 4200, duration: 600 });
        if (allDone) {
          for (let i = 0; i < 8; i++) {
            this.time.delayedCall(i * 220, () => sounds.click());
          }
        }
      }
    }
  }

  private scrollTo(y: number): void {
    this.scrollY = Phaser.Math.Clamp(y, 0, this.maxScroll);
    this.content.y = -this.scrollY;
  }

  private buildWorldCards(): void {
    const w = this.scale.width;
    const cardW = Math.min(CARD_W_MAX, w - 24);
    const cx = w / 2;

    for (const world of CAMPAIGN_WORLDS) {
      const levels = levelsOfWorld(world.index);
      const cardTop = CONTENT_TOP + (world.index - 1) * (CARD_H + CARD_GAP);
      const cy = cardTop + CARD_H / 2;
      const worldUnlocked = levels.some((l) => CampaignStore.isUnlocked(l.id));
      const worldDone = levels.every((l) => CampaignStore.isCompleted(l.id));

      const card = this.add.rectangle(cx, cy, cardW, CARD_H, worldUnlocked ? 0x1a2438 : 0x141a26, 0.96)
        .setStrokeStyle(2, worldDone ? 0x9cff9c : worldUnlocked ? world.accent : 0x33405a, worldUnlocked ? 0.85 : 0.5);
      this.content.add(card);

      // World icon (procedural texture) in a little frame
      const iconFrame = this.add.rectangle(cx - cardW / 2 + 38, cardTop + 34, 46, 46, 0x0f1828, 1)
        .setStrokeStyle(1, world.accent, worldUnlocked ? 0.8 : 0.3);
      const icon = this.add.image(cx - cardW / 2 + 38, cardTop + 34, world.icon).setScale(1.5);
      if (!worldUnlocked) icon.setAlpha(0.35).setTint(0x667788);
      this.content.add([iconFrame, icon]);

      const title = this.add.text(cx - cardW / 2 + 70, cardTop + 18, `WORLD ${world.index} — ${world.name}${worldDone ? '  ✓' : worldUnlocked ? '' : '  🔒'}`, {
        fontFamily: 'system-ui', fontSize: '17px', fontStyle: 'bold',
        color: worldUnlocked ? '#ffffff' : '#68727f',
      });
      const tag = this.add.text(cx - cardW / 2 + 70, cardTop + 40, world.tagline, {
        fontFamily: 'system-ui', fontSize: '12px', color: worldUnlocked ? '#9eb0c4' : '#4d5866',
      });
      this.content.add([title, tag]);

      // New-toys strip: what this world's levels add to the arsenal
      const badges = levels.flatMap((l) => unlockBadges(l));
      if (badges.length > 0) {
        const shown = badges.slice(0, 4).join(' · ');
        const more = badges.length > 4 ? `  +${badges.length - 4} more` : '';
        const badgeText = this.add.text(cx - cardW / 2 + 70, cardTop + 58, `NEW: ${shown}${more}`, {
          fontFamily: 'ui-monospace, monospace', fontSize: '10px',
          color: worldUnlocked ? '#ffd166' : '#5a5240',
        });
        this.content.add(badgeText);
      }

      // Level nodes
      const nodeY = cardTop + CARD_H - 38;
      const nodeW = Math.min(180, (cardW - 60) / 3);
      for (let i = 0; i < levels.length; i++) {
        const lvl = levels[i];
        const nx = cx - cardW / 2 + 40 + nodeW / 2 + i * (nodeW + 10);
        this.buildLevelNode(lvl, `${world.index}-${i + 1}`, nx, nodeY, nodeW);
        // Little connector dashes between nodes
        if (i < levels.length - 1) {
          const dash = this.add.rectangle(nx + nodeW / 2 + 5, nodeY, 8, 2, 0x5a6a85, worldUnlocked ? 0.8 : 0.3);
          this.content.add(dash);
        }
      }
    }
  }

  private buildLevelNode(lvl: CampaignLevelDef, shortName: string, x: number, y: number, width: number): void {
    const unlocked = CampaignStore.isUnlocked(lvl.id);
    const completed = CampaignStore.isCompleted(lvl.id);
    const stars = CampaignStore.starsFor(lvl.id);

    const fill = completed ? 0x24402a : unlocked ? 0x2a3a58 : 0x161d2b;
    const stroke = completed ? 0x9cff9c : unlocked ? 0xffd166 : 0x33405a;
    const bg = this.add.rectangle(x, y, width, 46, fill, 1).setStrokeStyle(2, stroke, unlocked || completed ? 0.9 : 0.45);
    const name = this.add.text(x, y - 10, `${shortName}  ${lvl.title}`, {
      fontFamily: 'system-ui', fontSize: '12px', fontStyle: 'bold',
      color: unlocked || completed ? '#fff' : '#5a6575',
    }).setOrigin(0.5);
    const sub = this.add.text(x, y + 10, completed ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) : unlocked ? '▶ PLAY' : '🔒', {
      fontFamily: 'ui-monospace, monospace', fontSize: '11px',
      color: completed ? '#ffd166' : unlocked ? '#9cff9c' : '#5a6575',
    }).setOrigin(0.5);
    this.content.add([bg, name, sub]);

    if (unlocked || completed) {
      bg.setInteractive({ useHandCursor: true });
      let downY: number | null = null;
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => { downY = p.y; });
      bg.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (downY === null || Math.abs(p.y - downY) > 8) { downY = null; return; }
        downY = null;
        sounds.click();
        this.openDetail(lvl, shortName);
      });
      bg.on('pointerover', () => bg.setFillStyle(completed ? 0x2c5234 : 0x35496e, 1));
      bg.on('pointerout', () => bg.setFillStyle(fill, 1));
    }
  }

  // --- Mission briefing panel -------------------------------------------------

  private openDetail(lvl: CampaignLevelDef, shortName: string): void {
    if (this.detailOpen) return;
    this.detailOpen = true;
    const w = this.scale.width;
    const h = this.scale.height;
    const world = CAMPAIGN_WORLDS[lvl.world - 1];

    const scrim = this.add.rectangle(0, 0, w, h, 0x000000, 0.6).setOrigin(0, 0).setDepth(100).setInteractive();
    scrim.on('pointerdown', () => this.closeDetail());

    const panelW = Math.min(540, w - 28);
    const badges = unlockBadges(lvl);
    const objLines = lvl.objectives.map((o) => `▫ ${objectiveLabel(o)}`);
    const bestNights = CampaignStore.bestNightsFor(lvl.id);
    const completed = CampaignStore.isCompleted(lvl.id);

    // Panel height flexes with content
    const lines = 5 + objLines.length + (badges.length > 0 ? 2 : 0);
    const panelH = Math.min(h - 40, 190 + lines * 18);
    const panel = this.add.rectangle(w / 2, h / 2, panelW, panelH, 0x131c2e, 0.98)
      .setStrokeStyle(2, world.accent, 0.85).setDepth(101).setInteractive();
    this.detailObjects.push(scrim, panel);

    const left = w / 2 - panelW / 2 + 20;
    let ty = h / 2 - panelH / 2 + 16;
    const push = (obj: Phaser.GameObjects.GameObject): void => { this.detailObjects.push(obj); };

    push(this.add.text(left, ty, `MISSION ${shortName} · WORLD ${lvl.world}`, {
      fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#9eb0c4',
    }).setDepth(102));
    ty += 18;
    push(this.add.text(left, ty, lvl.title, {
      fontFamily: 'system-ui', fontSize: '26px', color: '#ffe082', fontStyle: 'bold',
    }).setDepth(102));
    ty += 36;
    const blurb = this.add.text(left, ty, lvl.blurb, {
      fontFamily: 'system-ui', fontSize: '13px', color: '#cfd6e0', wordWrap: { width: panelW - 40 },
    }).setDepth(102);
    push(blurb);
    ty += blurb.height + 10;

    push(this.add.text(left, ty, 'OBJECTIVES', {
      fontFamily: 'system-ui', fontSize: '12px', color: '#9eb0c4', fontStyle: 'bold',
    }).setDepth(102));
    ty += 18;
    for (const line of objLines) {
      push(this.add.text(left + 6, ty, line, {
        fontFamily: 'ui-monospace, monospace', fontSize: '12px', color: '#ffec99',
      }).setDepth(102));
      ty += 17;
    }
    ty += 6;

    if (badges.length > 0) {
      push(this.add.text(left, ty, 'NEW ON THIS MISSION', {
        fontFamily: 'system-ui', fontSize: '12px', color: '#9eb0c4', fontStyle: 'bold',
      }).setDepth(102));
      ty += 18;
      const badgeText = this.add.text(left + 6, ty, badges.join('  ·  '), {
        fontFamily: 'system-ui', fontSize: '12px', color: '#7fe7ff', wordWrap: { width: panelW - 46 },
      }).setDepth(102);
      push(badgeText);
      ty += badgeText.height + 8;
    }

    const rewardBits = [
      completed ? `✓ done — best ${bestNights} night${bestNights === 1 ? '' : 's'}, ${'⭐'.repeat(CampaignStore.starsFor(lvl.id))}` : `reward: +${lvl.reward} ⭐ Star Coins`,
      lvl.parNights === 0 ? '3⭐ if done on day 1' : `3⭐ if done within ${lvl.parNights} night${lvl.parNights === 1 ? '' : 's'}`,
    ];
    push(this.add.text(left, ty, rewardBits.join('   ·   '), {
      fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#ffd166',
    }).setDepth(102));

    // Buttons
    const by = h / 2 + panelH / 2 - 38;
    const play = this.add.rectangle(w / 2 - 62, by, 190, 46, 0x3a7a3a).setStrokeStyle(2, 0x88ff88, 0.85).setDepth(102);
    const playText = this.add.text(w / 2 - 62, by, completed ? '↻  PLAY AGAIN' : '⛏  DIG IN!', {
      fontFamily: 'system-ui', fontSize: '18px', color: '#fff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(103);
    play.setInteractive({ useHandCursor: true });
    play.on('pointerover', () => play.setFillStyle(0x4a9a4a));
    play.on('pointerout', () => play.setFillStyle(0x3a7a3a));
    play.on('pointerdown', () => {
      sounds.click();
      this.scene.start('Game', { campaign: { levelId: lvl.id } });
    });
    const close = this.add.rectangle(w / 2 + 110, by, 110, 40, 0x26334a).setStrokeStyle(1, 0x88aaff, 0.6).setDepth(102);
    const closeText = this.add.text(w / 2 + 110, by, 'Back', {
      fontFamily: 'system-ui', fontSize: '15px', color: '#fff',
    }).setOrigin(0.5).setDepth(103);
    close.setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => { sounds.click(); this.closeDetail(); });
    this.detailObjects.push(play, playText, close, closeText);
  }

  private closeDetail(): void {
    this.detailOpen = false;
    for (const o of this.detailObjects) o.destroy();
    this.detailObjects = [];
  }
}
