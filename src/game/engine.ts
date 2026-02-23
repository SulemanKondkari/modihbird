// Constants
export const GRAVITY = 1200; // px/s²
export const JUMP_VEL = -480; // px/s
export const TERM_VEL = 700; // px/s
export const PIPE_SPEED = 230; // px/s
export const PIPE_GAP = 210; // px
export const PIPE_SPACING = 310; // px
export const FIRST_PIPE_X = 500; // px
export const BIRD_W = 72;
export const BIRD_H = 52;
export const PILLAR_W = 120;
export const COIN_RADIUS = 24;
export const HITBOX_SHRINK = 10;

export interface GameConfig {
    width: number; // canvas.width
    height: number; // canvas.height
    birdSkinImg: HTMLImageElement;
    pillarSkinImg: HTMLImageElement;
    bgImg: HTMLImageElement;
    rahulImg?: HTMLImageElement;
    coinImg: HTMLImageElement;
    onScore: (score: number) => void;
    onCoinCollected: (total: number) => void;
    onDead: (finalScore: number) => void;
}

export interface BirdState {
    y: number;
    vy: number;
    rotation: number;
}

export interface Pillar {
    x: number;
    gapY: number;
    scored: boolean;
}

export interface Coin {
    x: number;
    y: number;
    collected: boolean;
}

export class GameEngine {
    private config: GameConfig;
    private ctx: CanvasRenderingContext2D;
    private animationFrameId: number | null = null;
    private lastTime: number = 0;

    // State
    private bird: BirdState;
    private pillars: Pillar[] = [];
    private coins: Coin[] = [];
    private score: number = 0;
    private coinCount: number = 0;
    private bgOffset: number = 0;
    private frameCount: number = 0;
    private isDead: boolean = true;
    private clouds: { x: number; y: number; speed: number; scale: number }[] = [];

    constructor(canvas: HTMLCanvasElement, config: GameConfig) {
        this.config = config;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get 2d context');
        this.ctx = context;

        this.bird = {
            y: config.height / 2,
            vy: 0,
            rotation: 0,
        };

        // Init clouds
        for (let i = 0; i < 5; i++) {
            this.clouds.push({
                x: Math.random() * config.width,
                y: Math.random() * (config.height / 2),
                speed: 30 + Math.random() * 20,
                scale: 0.5 + Math.random() * 0.5,
            });
        }
    }

    public start() {
        if (!this.isDead) return;
        this.isDead = false;
        this.score = 0;
        // this.coinCount is preserved across runs in the same session, loaded from props initially
        this.pillars = [];
        this.coins = [];
        this.bird = {
            y: this.config.height / 2,
            vy: 0,
            rotation: 0,
        };
        this.bgOffset = 0;
        this.frameCount = 0;
        this.spawnPillar(FIRST_PIPE_X);
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    // Set initial coin count when loading from storage
    public setInitialCoins(coins: number) {
        this.coinCount = coins;
    }

    public jump() {
        if (this.isDead) return;
        this.bird.vy = JUMP_VEL;
    }

    public stop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isDead = true;
    }

    public reset() {
        this.stop();
        this.bird = {
            y: this.config.height / 2,
            vy: 0,
            rotation: 0,
        };
        this.pillars = [];
        this.coins = [];
        this.score = 0;
        this.draw(); // Draw idle frame
    }

    private spawnPillar(x: number) {
        const minGapY = PIPE_GAP / 2 + 50;
        const maxGapY = this.config.height - PIPE_GAP / 2 - 50;
        const gapY = minGapY + Math.random() * (maxGapY - minGapY);

        this.pillars.push({ x, gapY, scored: false });

        // Exactly 1 coin per gap, perfectly centered.
        // x is the left edge of the pillar, so x + PILLAR_W / 2 is the horizontal center.
        // gapY is the exact vertical center of the gap.
        this.coins.push({
            x: x + PILLAR_W / 2,
            y: gapY,
            collected: false,
        });
    }

    private loop = (now: number) => {
        if (this.isDead) return;

        let dt = (now - this.lastTime) / 1000; // in seconds
        if (dt > 0.05) dt = 0.05; // clamp to 50ms max step
        this.lastTime = now;
        this.frameCount++;

        this.update(dt);
        this.draw();

        if (!this.isDead) {
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    };

    private update(dt: number) {
        // Background
        this.bgOffset = (this.bgOffset + (PIPE_SPEED * dt) / 3) % this.config.width;

        // Clouds
        for (const cloud of this.clouds) {
            cloud.x -= cloud.speed * dt;
            if (cloud.x < -100) {
                cloud.x = this.config.width + 100;
                cloud.y = Math.random() * (this.config.height / 2);
            }
        }

        // Bird Physics
        this.bird.vy += GRAVITY * dt;
        if (this.bird.vy > TERM_VEL) this.bird.vy = Math.min(this.bird.vy, TERM_VEL);
        this.bird.y += this.bird.vy * dt;

        // Rotation lerp
        const targetRotation = Math.max(-0.4, Math.min(0.5, this.bird.vy / 1200));
        this.bird.rotation += (targetRotation - this.bird.rotation) * 10 * dt;

        // Floor / Ceiling check
        if (this.bird.y > this.config.height || this.bird.y < 0) {
            this.die();
            return;
        }

        const birdX = this.config.width / 2 - BIRD_W / 2; // Bird is fixed horizontally relative to screen initially... actually wait, standard flappy bird keeps bird fixed at say 20% width. Let's fix bird X to 100px.
        const BIRD_FIXED_X = 100;

        // Pillars
        if (this.pillars.length > 0) {
            const rightmostPillar = this.pillars[this.pillars.length - 1];
            if (rightmostPillar.x < this.config.width) {
                this.spawnPillar(rightmostPillar.x + PIPE_SPACING);
            }
        } else {
            this.spawnPillar(FIRST_PIPE_X);
        }

        for (let i = this.pillars.length - 1; i >= 0; i--) {
            const p = this.pillars[i];
            p.x -= PIPE_SPEED * dt;

            // Score
            if (!p.scored && p.x + PILLAR_W < BIRD_FIXED_X) {
                p.scored = true;
                this.score++;
                this.config.onScore(this.score);
            }

            // Collision
            const bLeft = BIRD_FIXED_X - BIRD_W / 2 + HITBOX_SHRINK;
            const bRight = BIRD_FIXED_X + BIRD_W / 2 - HITBOX_SHRINK;
            const bTop = this.bird.y - BIRD_H / 2 + HITBOX_SHRINK;
            const bBottom = this.bird.y + BIRD_H / 2 - HITBOX_SHRINK;

            const pLeft = p.x;
            const pRight = p.x + PILLAR_W;
            const gapTop = p.gapY - PIPE_GAP / 2;
            const gapBot = p.gapY + PIPE_GAP / 2;

            const xOverlap = bRight > pLeft && bLeft < pRight;
            if (xOverlap) {
                if (bTop < gapTop || bBottom > gapBot) {
                    this.die();
                    return;
                }
            }

            if (p.x + PILLAR_W < 0) {
                this.pillars.splice(i, 1);
            }
        }

        // Coins
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const c = this.coins[i];
            if (c.collected) {
                this.coins.splice(i, 1);
                continue;
            }
            c.x -= PIPE_SPEED * dt;

            // Collect
            const dx = c.x - BIRD_FIXED_X;
            const dy = c.y - this.bird.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < COIN_RADIUS + (BIRD_W / 2 - HITBOX_SHRINK)) {
                c.collected = true;
                this.coinCount++;
                this.config.onCoinCollected(this.coinCount);
            } else if (c.x < -50) {
                this.coins.splice(i, 1);
            }
        }
    }

    private die() {
        this.stop();
        this.config.onDead(this.score);
    }

    private drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(0, 0, 20, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(25, -10, 25, Math.PI * 1, Math.PI * 1.8);
        ctx.arc(55, -5, 20, Math.PI * 1.2, Math.PI * 2);
        ctx.arc(75, 10, 15, Math.PI * 1.5, Math.PI * 0.5);
        ctx.fill();
        ctx.restore();
    }

    public draw() {
        const { width, height } = this.config;
        const { ctx } = this;

        // 1. Solid Sky Blue Background
        ctx.fillStyle = '#5eb6e4';
        ctx.fillRect(0, 0, width, height);

        // 2. Clouds
        for (const cloud of this.clouds) {
            this.drawCloud(ctx, cloud.x, cloud.y, cloud.scale);
        }

        const BIRD_FIXED_X = 100;

        // 4. Pillars
        for (const p of this.pillars) {
            const gapTop = p.gapY - PIPE_GAP / 2;
            const gapBot = p.gapY + PIPE_GAP / 2;

            // Create cylindrical gradient
            const grad = ctx.createLinearGradient(p.x, 0, p.x + PILLAR_W, 0);
            grad.addColorStop(0, '#c76b00'); // dark orange edge
            grad.addColorStop(0.3, '#ffae42'); // bright highlight
            grad.addColorStop(0.7, '#f89820'); // base color
            grad.addColorStop(1, '#a85b00'); // dark orange edge

            ctx.fillStyle = grad;
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#5c3100';

            // Top pillar
            ctx.fillRect(p.x, 0, PILLAR_W, gapTop);
            ctx.strokeRect(p.x, 0, PILLAR_W, gapTop);

            if (this.config.pillarSkinImg) {
                // Determine face dimensions based on aspect ratio
                const imgRatio = this.config.pillarSkinImg.width / this.config.pillarSkinImg.height || 1;
                const faceH = PILLAR_W / imgRatio;
                // Draw face at the very bottom of the top pillar
                ctx.drawImage(this.config.pillarSkinImg, p.x, gapTop - faceH + 5, PILLAR_W, faceH);
            }

            // Bottom pillar
            ctx.fillRect(p.x, gapBot, PILLAR_W, height - gapBot);
            ctx.strokeRect(p.x, gapBot, PILLAR_W, height - gapBot);

            if (this.config.pillarSkinImg) {
                const imgRatio = this.config.pillarSkinImg.width / this.config.pillarSkinImg.height || 1;
                const faceH = PILLAR_W / imgRatio;
                // Draw face at the very top of the bottom pillar
                ctx.drawImage(this.config.pillarSkinImg, p.x, gapBot - 5, PILLAR_W, faceH);
            }
        }

        // 5. Coins
        for (const c of this.coins) {
            const scale = Math.sin(this.frameCount * 0.12) * 0.15 + 0.85;
            ctx.save();
            ctx.translate(c.x, c.y);
            ctx.scale(scale, scale);
            if (this.config.coinImg) {
                const cw = (COIN_RADIUS * 2) * 1.5; // Make coins a bit bigger to see
                const ch = cw;
                ctx.drawImage(
                    this.config.coinImg,
                    -cw / 2,
                    -ch / 2,
                    cw,
                    ch
                );
            } else {
                // Fallback Gold Circle
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // 3. Ground bar (draw in foreground)
        const GROUND_H = 30;
        ctx.fillStyle = '#8B6914';
        ctx.fillRect(0, height - GROUND_H, width, GROUND_H);
        ctx.fillStyle = '#5D4E0A';
        ctx.fillRect(0, height - GROUND_H, width, 5); // top edge

        // 3.5 Rahul Gandhi Flying
        if (this.config.rahulImg && this.config.rahulImg.width > 0 && !this.isDead) {
            // Make him float behind Modi
            const float = Math.sin(this.frameCount * 0.1) * 15;
            const rahulW = 80;
            const rahulH = 60;
            const rahulX = 10; // Explicitly 10px from the left screen boundary
            const rahulY = Math.max(0, Math.min(height - GROUND_H - rahulH, this.bird.y - 10 + float)); // Track Modi's general Y but smooth floating

            ctx.drawImage(this.config.rahulImg, rahulX, rahulY, rahulW, rahulH);
        }

        // 6. Bird
        ctx.save();
        ctx.translate(BIRD_FIXED_X, this.bird.y);
        ctx.rotate(this.bird.rotation);
        if (this.config.birdSkinImg) {
            // Check if the image has loaded by verifying width
            if (this.config.birdSkinImg.width > 0) {
                const aspect = this.config.birdSkinImg.width / this.config.birdSkinImg.height;
                const renderW = BIRD_H * aspect;
                ctx.drawImage(
                    this.config.birdSkinImg,
                    -renderW / 2,
                    -BIRD_H / 2,
                    renderW,
                    BIRD_H
                );
            } else {
                ctx.drawImage(this.config.birdSkinImg, -BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
            }
        } else {
            ctx.fillStyle = '#fafa00';
            ctx.fillRect(-BIRD_W / 2, -BIRD_H / 2, BIRD_W, BIRD_H);
        }
        ctx.restore();

        // HUD score handled in React now.
        // We do not render the canvas text overlap to avoid double rendering with HTML.
    }
}
