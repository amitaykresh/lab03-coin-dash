/* global Phaser, COIN_DASH */
const HIGH_SCORE_KEY = 'coinDash.highScore';

// Storage may be blocked (private mode, sandboxed iframe), so never let it throw.
function loadHighScore() {
  try {
    const value = parseInt(window.localStorage.getItem(HIGH_SCORE_KEY), 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch (e) {
    return 0;
  }
}

function saveHighScore(value) {
  try {
    window.localStorage.setItem(HIGH_SCORE_KEY, String(value));
  } catch (e) {
    // Ignore: the high score just won't persist.
  }
}

// Drone start positions and headings (degrees); the first three match the original layout.
const DRONE_SPAWNS = [
  { x: 90, y: 100, angle: 35 }, { x: 360, y: 100, angle: 140 }, { x: 630, y: 100, angle: 245 },
  { x: 150, y: 430, angle: 300 }, { x: 680, y: 400, angle: 215 }
];
// Survives scene.restart() (R) but not a page reload.
let difficultyIndex = COIN_DASH.defaultDifficulty;

class CoinDash extends Phaser.Scene {
  constructor() { super('CoinDash'); }

  create() {
    const c = COIN_DASH;
    this.difficulty = c.difficulties[difficultyIndex];
    this.score = 0;
    this.highScore = loadHighScore();
    this.finished = false;
    this.paused = false;
    this.shieldUntil = 0;
    this.deadline = this.time.now + c.roundSeconds * 1000;
    this.physics.world.setBounds(0, 44, c.width, c.height - 44);
    this.add.grid(c.width / 2, c.height / 2, c.width, c.height, 40, 40,
      c.colors.background, 1, 0x24334b, 0.45);
    this.hud = this.add.text(18, 12, '', { font: '18px monospace', color: '#ffffff' });
    this.player = this.add.rectangle(c.width / 2, c.height / 2, 24, 24, c.colors.player);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.coin = this.add.circle(100, 100, 9, c.colors.coin);
    this.physics.add.existing(this.coin);
    this.coin.body.setCircle(9);
    this.placeCoin();
    this.drones = this.physics.add.group();
    const { droneCount, droneSpeed } = this.difficulty;
    for (let i = 0; i < droneCount; i++) {
      const spawn = DRONE_SPAWNS[i % DRONE_SPAWNS.length];
      const drone = this.add.rectangle(spawn.x, spawn.y, 26, 26, c.colors.drone);
      this.drones.add(drone);
      drone.body.setCollideWorldBounds(true).setBounce(1, 1);
      const angle = spawn.angle * Math.PI / 180;
      drone.body.setVelocity(Math.cos(angle) * droneSpeed, Math.sin(angle) * droneSpeed);
    }
    this.physics.add.overlap(this.player, this.coin, () => {
      if (this.finished) return;
      this.score++;
      this.placeCoin();
    });
    this.physics.add.overlap(this.player, this.drones, () => {
      if (this.time.now < this.shieldUntil) return;
      this.finish('A drone caught you!');
    });
    // Shield power-up: a diamond that appears every powerupEvery seconds if none is on the field.
    this.powerup = this.add.rectangle(0, 0, 18, 18, c.colors.powerup).setAngle(45).setVisible(false);
    this.physics.add.existing(this.powerup);
    this.powerup.body.enable = false;
    this.physics.add.overlap(this.player, this.powerup, () => {
      if (this.finished || !this.powerup.visible) return;
      this.powerup.setVisible(false);
      this.powerup.body.enable = false;
      this.shieldUntil = this.time.now + c.shieldSeconds * 1000;
    });
    this.powerupTimer = this.time.addEvent({ delay: c.powerupEvery * 1000, loop: true, callback: () => this.spawnPowerup() });
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,R');
    this.input.keyboard.on('keydown-R', () => this.scene.restart());
    this.input.keyboard.on('keydown-P', () => this.togglePause());
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
    ['ONE', 'TWO', 'THREE'].forEach((key, index) => {
      this.input.keyboard.on(`keydown-${key}`, () => {
        difficultyIndex = index;
        this.scene.restart();
      });
    });
  }

  placeCoin() {
    const c = COIN_DASH;
    // Avoid spawning the next coin directly underneath the player.
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 60);
    this.coin.setPosition(x, y);
    this.coin.body.reset(x, y);
  }

  spawnPowerup() {
    if (this.finished || this.powerup.visible) return;
    const c = COIN_DASH;
    let x, y;
    do {
      x = Phaser.Math.Between(25, c.width - 25);
      y = Phaser.Math.Between(70, c.height - 25);
    } while (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < 80);
    this.powerup.setPosition(x, y).setVisible(true);
    this.powerup.body.enable = true;
    this.powerup.body.reset(x, y);
  }

  togglePause() {
    if (this.finished) return;
    const c = COIN_DASH;
    if (!this.paused) {
      this.paused = true;
      this.pausedAt = this.time.now;
      this.physics.pause();
      this.powerupTimer.paused = true;
      this.pauseOverlay = this.add.container(c.width / 2, c.height / 2, [
        this.add.rectangle(0, 0, 460, 90, 0x0a1120, 0.95),
        this.add.text(0, 0, 'PAUSED — press P to resume',
          { font: '24px monospace', color: '#ffffff', align: 'center' }).setOrigin(0.5)
      ]);
    } else {
      this.paused = false;
      // Push the deadline (and an active shield) back so paused time does not count.
      const pausedFor = this.time.now - this.pausedAt;
      this.deadline += pausedFor;
      if (this.shieldUntil > this.pausedAt) this.shieldUntil += pausedFor;
      this.powerupTimer.paused = false;
      this.physics.resume();
      this.pauseOverlay.destroy();
    }
  }

  update() {
    if (this.finished || this.paused) return;
    const dx = Number(this.cursors.right.isDown || this.keys.D.isDown)
      - Number(this.cursors.left.isDown || this.keys.A.isDown);
    const dy = Number(this.cursors.down.isDown || this.keys.S.isDown)
      - Number(this.cursors.up.isDown || this.keys.W.isDown);
    const direction = new Phaser.Math.Vector2(dx, dy).normalize().scale(COIN_DASH.playerSpeed);
    this.player.body.setVelocity(direction.x, direction.y);
    const seconds = Math.max(0, Math.ceil((this.deadline - this.time.now) / 1000));
    const shield = Math.max(0, Math.ceil((this.shieldUntil - this.time.now) / 1000));
    if (shield > 0) this.player.setStrokeStyle(4, COIN_DASH.colors.powerup);
    else this.player.setStrokeStyle();
    this.hud.setText(`Coins: ${this.score}  Best: ${this.highScore}  ${this.difficulty.name}  Time: ${seconds}s`
      + (shield > 0 ? `  Shield: ${shield}s` : ''));
    if (seconds === 0) this.finish('Time is up!');
  }

  finish(reason) {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    const c = COIN_DASH;
    let message = `${reason}\n${this.score} coins collected\nPress R to try again`;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      saveHighScore(this.score);
      message += '\nNew high score!';
    }
    this.add.rectangle(c.width / 2, c.height / 2, 460, 190, 0x0a1120, 0.95);
    this.add.text(c.width / 2, c.height / 2, message,
      { font: '24px monospace', color: '#ffffff', align: 'center', lineSpacing: 12 }
    ).setOrigin(0.5);
  }
}
window.coinDashGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: COIN_DASH.width,
  height: COIN_DASH.height,
  backgroundColor: COIN_DASH.colors.background,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: CoinDash
});
