import Phaser from 'phaser';
import { generateZombieTextures } from '../entities/Zombie';
import { generateAllTextures } from '../gfx/textures';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    generateAllTextures(this);
    generateZombieTextures(this);
    this.scene.start('Menu');
  }
}
