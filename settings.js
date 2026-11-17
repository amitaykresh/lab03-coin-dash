// Keep tuning separate from game behaviour so features can be developed independently.
window.COIN_DASH = {
  width: 800,
  height: 500,
  roundSeconds: 45,
  playerSpeed: 240,
  // Keys 1/2/3 pick a preset; Normal matches the original tuning.
  difficulties: [
    { name: 'Easy', droneCount: 2, droneSpeed: 80 },
    { name: 'Normal', droneCount: 3, droneSpeed: 105 },
    { name: 'Hard', droneCount: 5, droneSpeed: 140 }
  ],
  defaultDifficulty: 1,
  powerupEvery: 12,
  shieldSeconds: 5,
  colors: { background: 0x101c31, player: 0x71e8ce, coin: 0xffd166, drone: 0xff657a, powerup: 0x4cc9f0 }
};
