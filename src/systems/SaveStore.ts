const BEST_SCORE_KEY = 'mine2d:best_score';

export const SaveStore = {
  getBestScore(): number {
    try {
      const raw = localStorage.getItem(BEST_SCORE_KEY);
      if (!raw) return 0;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  },
  updateBestScore(score: number): number {
    const current = this.getBestScore();
    if (score > current) {
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(score));
      } catch {
        /* private mode etc. — silent */
      }
      return score;
    }
    return current;
  },
};
