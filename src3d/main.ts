import './ui/style.css';
import { audio } from './audio';
import { Game, loadBest } from './game';
import { helpScreen, menuScreen } from './ui/screens';

const app = document.getElementById('app')!;
const overlay = document.getElementById('overlay')!;

let game: Game | null = null;

function newGame(play: boolean): void {
  game?.destroy();
  const seed = (Math.random() * 2 ** 31) | 0;
  game = new Game(app, overlay, seed, (again) => newGame(again));
  if (play) {
    game.start();
    return;
  }
  audio.music('menu');
  const menu = menuScreen(
    overlay,
    loadBest(),
    () => {
      menu.remove();
      game!.start();
    },
    () => {
      const h = helpScreen(overlay, () => h.remove());
    },
  );
}

newGame(false);

// Debug handles for playtesting from the console (dev server only).
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.game = () => game;
  void import('./dev').then((d) => (w.autoRun = (o?: object) => d.autoRun(game as never, o)));
}
