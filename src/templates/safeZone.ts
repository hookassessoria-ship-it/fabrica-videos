// Áreas livres da UI do TikTok num quadro 1080x1920.
export const SAFE = {
  top: 250,
  bottom: 1920 - 420,
  left: 60,
  right: 1080 - 140,
};

// Faixa do visual principal: entre 15% e 65% da altura.
export const VISUAL = {
  top: Math.round(1920 * 0.15),
  bottom: Math.round(1920 * 0.65),
  centerX: (SAFE.left + SAFE.right) / 2,
  centerY: Math.round((1920 * 0.15 + 1920 * 0.65) / 2),
};

// Legendas entre o fim do visual e o limite de baixo.
export const CAPTIONS = {
  centerY: Math.round((VISUAL.bottom + SAFE.bottom) / 2) + 6,
  width: SAFE.right - SAFE.left - 40,
};
