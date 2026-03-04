// ============================================================
// Flappy Suan - A birthday Flappy Bird game
// ============================================================

// --- Constants ---
const GAME_WIDTH = 375;
const GAME_HEIGHT = 812;

const PHYSICS = {
    gravity: 0.45,
    jumpVelocity: -7.5,
    terminalVelocity: 12,
};

const PIPE_CONFIG = {
    width: 58,
    gapSize: 155,
    speed: 2.5,
    spawnInterval: 95,
    minTopHeight: 80,
    maxTopHeight: 0, // calculated at init
};

const BIRD_CONFIG = {
    x: 80,
    radius: 18,
    width: 40,
    height: 40,
};

const GROUND = {
    height: 90,
    y: 0, // calculated at init
    scrollSpeed: 2.5,
};

// --- Enums ---
const GameState = {
    MENU: 'menu',
    LEVEL_SELECT: 'levelSelect',
    PLAYING: 'playing',
    FALLING: 'falling',
    GAME_OVER: 'gameOver',
    LEVEL_COMPLETE: 'levelComplete',
};

const GameMode = {
    HBD: 'hbd',
    CASUAL: 'casual',
};

// --- Note Frequencies ---
const NOTE_FREQ = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23,
    'G4': 392.00, 'A4': 440.00, 'Bb4': 466.16, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46,
    'G5': 783.99, 'A5': 880.00, 'Bb5': 932.33, 'C6': 1046.50,
};

// Happy Birthday melody in F major (starting on C5): [note, durationInBeats]
const HAPPY_BIRTHDAY_MELODY = [
    ['C5', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 1], ['F5', 1], ['E5', 2],
    ['C5', 0.5], ['C5', 0.5], ['D5', 1], ['C5', 1], ['G5', 1], ['F5', 2],
    ['C5', 0.5], ['C5', 0.5], ['C6', 1], ['A5', 1], ['F5', 1], ['E5', 1], ['D5', 1],
    ['Bb5', 0.5], ['Bb5', 0.5], ['A5', 1], ['F5', 1], ['G5', 1], ['F5', 2],
];

// HBD mode: one pipe per melody note
const HBD_TOTAL_PIPES = HAPPY_BIRTHDAY_MELODY.length; // 25

// --- Birthday Audio ---
class BirthdayAudio {
    constructor() {
        this.audioCtx = null;
        this.isPlaying = false;
        this.oscillators = [];
        this.pianoOscs = [];
        this.tempo = 120;
        this.loopTimeout = null;
    }

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    play() {
        if (this.isPlaying) return;
        this.init();
        this.isPlaying = true;
        this.oscillators = [];

        const beatDuration = 60 / this.tempo;
        let currentTime = this.audioCtx.currentTime + 0.1;

        for (const [note, beats] of HAPPY_BIRTHDAY_MELODY) {
            const freq = NOTE_FREQ[note];
            if (!freq) { currentTime += beats * beatDuration; continue; }

            const duration = beats * beatDuration;
            this.playNote(freq, currentTime, duration * 0.9);
            currentTime += duration;
        }

        const totalDuration = currentTime - this.audioCtx.currentTime;
        this.loopTimeout = setTimeout(() => {
            this.isPlaying = false;
            if (game.state === GameState.PLAYING && game.mode === GameMode.HBD) {
                this.play();
            }
        }, totalDuration * 1000);
    }

    playNote(frequency, startTime, duration) {
        // Fundamental tone
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.value = frequency;

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.05);

        // Soft 2nd harmonic for warmth
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();

        osc2.type = 'sine';
        osc2.frequency.value = frequency * 2;

        gain2.gain.setValueAtTime(0.001, startTime);
        gain2.gain.linearRampToValueAtTime(0.03, startTime + 0.02);
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.7);

        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);

        osc2.start(startTime);
        osc2.stop(startTime + duration * 0.7 + 0.05);

        this.oscillators.push(osc, osc2);
    }

    // Play a single short piano-like note by melody index
    playPianoNote(noteIndex) {
        this.init();
        if (noteIndex < 0 || noteIndex >= HAPPY_BIRTHDAY_MELODY.length) return;
        const [note] = HAPPY_BIRTHDAY_MELODY[noteIndex];
        const freq = NOTE_FREQ[note];
        if (!freq) return;

        // Stop any previous piano note to avoid phase interference
        for (const osc of this.pianoOscs) {
            try { osc.stop(); } catch (e) { /* already stopped */ }
        }
        this.pianoOscs = [];

        const actx = this.audioCtx;
        const now = actx.currentTime;
        const duration = 0.45;

        // Fundamental tone
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start(now);
        osc.stop(now + duration + 0.05);

        // Soft harmonic for piano-like timbre
        const osc2 = actx.createOscillator();
        const gain2 = actx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.linearRampToValueAtTime(0.04, now + 0.015);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.6);
        osc2.connect(gain2);
        gain2.connect(actx.destination);
        osc2.start(now);
        osc2.stop(now + duration * 0.6 + 0.05);

        this.pianoOscs = [osc, osc2];
    }

    stop() {
        this.isPlaying = false;
        if (this.loopTimeout) {
            clearTimeout(this.loopTimeout);
            this.loopTimeout = null;
        }
        for (const osc of this.oscillators) {
            try { osc.stop(); } catch (e) { /* already stopped */ }
        }
        this.oscillators = [];
    }
}

// --- Bird Sprite Images ---
const birdImages = {
    default: new Image(),
    happy: new Image(),
    surprised: new Image(),
};
birdImages.default.src = 'default.png';
birdImages.happy.src = 'happy.png';
birdImages.surprised.src = 'surprised.png';

function getBirdImage(face) {
    if (face === 'happy') return birdImages.happy;
    if (face === 'surprised') return birdImages.surprised;
    return birdImages.default;
}

// --- Bird ---
class Bird {
    constructor() {
        this.x = BIRD_CONFIG.x;
        this.y = GAME_HEIGHT / 2;
        this.velocity = 0;
        this.rotation = 0;
        this.face = 'normal'; // 'normal', 'happy', 'hurt', 'surprised'
        this.faceTimer = 0;
    }

    flap() {
        this.velocity = PHYSICS.jumpVelocity;
    }

    update() {
        this.velocity += PHYSICS.gravity;
        this.velocity = Math.min(this.velocity, PHYSICS.terminalVelocity);
        this.y += this.velocity;

        // Rotation based on velocity
        this.rotation = Math.min(
            Math.PI / 2,
            Math.max(-Math.PI / 6, this.velocity * 0.08)
        );

        // Revert happy face back to normal after timer
        if (this.faceTimer > 0) {
            this.faceTimer--;
            if (this.faceTimer === 0 && (this.face === 'happy' || this.face === 'surprised')) {
                this.face = 'normal';
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        const img = getBirdImage(this.face);
        const s = BIRD_CONFIG.radius * 2 + 4;
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();
    }

    getBoundingCircle() {
        return { x: this.x, y: this.y, radius: BIRD_CONFIG.radius - 3 };
    }
}

// --- Pipe ---
class Pipe {
    constructor(index) {
        this.x = GAME_WIDTH + PIPE_CONFIG.width;
        this.topHeight = PIPE_CONFIG.minTopHeight +
            Math.random() * (PIPE_CONFIG.maxTopHeight - PIPE_CONFIG.minTopHeight);
        this.bottomY = this.topHeight + PIPE_CONFIG.gapSize;
        this.passed = false;
        this.index = index;
    }

    update() {
        this.x -= PIPE_CONFIG.speed;
    }

    isOffScreen() {
        return this.x + PIPE_CONFIG.width < -10;
    }

    draw(ctx) {
        const capHeight = 22;
        const capOverhang = 5;
        const w = PIPE_CONFIG.width;

        if (game.mode === GameMode.HBD) {
            // Birthday-themed candle pipes
            const bodyColor = '#F8BBD0';
            const stripeColor = '#F48FB1';
            const capColor = '#EC407A';
            const borderColor = '#C2185B';

            // Top pipe body (candle)
            ctx.fillStyle = bodyColor;
            ctx.fillRect(this.x, 0, w, this.topHeight);
            // Diagonal candy stripes
            ctx.save();
            ctx.beginPath();
            ctx.rect(this.x, 0, w, this.topHeight - capHeight);
            ctx.clip();
            ctx.fillStyle = stripeColor;
            const stripeW = 14;
            for (let sy = -w; sy < this.topHeight + w; sy += stripeW * 2) {
                ctx.beginPath();
                ctx.moveTo(this.x, sy);
                ctx.lineTo(this.x + w, sy + w);
                ctx.lineTo(this.x + w, sy + w + stripeW);
                ctx.lineTo(this.x, sy + stripeW);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            // Top pipe cap
            ctx.fillStyle = capColor;
            ctx.fillRect(this.x - capOverhang, this.topHeight - capHeight, w + capOverhang * 2, capHeight);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - capOverhang, this.topHeight - capHeight, w + capOverhang * 2, capHeight);

            // Bottom pipe body (candle)
            ctx.fillStyle = bodyColor;
            ctx.fillRect(this.x, this.bottomY, w, GROUND.y - this.bottomY);
            // Diagonal candy stripes
            ctx.save();
            ctx.beginPath();
            ctx.rect(this.x, this.bottomY + capHeight, w, GROUND.y - this.bottomY - capHeight);
            ctx.clip();
            ctx.fillStyle = stripeColor;
            for (let sy = this.bottomY - w; sy < GROUND.y + w; sy += stripeW * 2) {
                ctx.beginPath();
                ctx.moveTo(this.x, sy);
                ctx.lineTo(this.x + w, sy + w);
                ctx.lineTo(this.x + w, sy + w + stripeW);
                ctx.lineTo(this.x, sy + stripeW);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            // Bottom pipe cap
            ctx.fillStyle = capColor;
            ctx.fillRect(this.x - capOverhang, this.bottomY, w + capOverhang * 2, capHeight);
            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - capOverhang, this.bottomY, w + capOverhang * 2, capHeight);
        } else {
            // Casual mode - clean pink pipes
            // Top pipe body
            ctx.fillStyle = '#F48FB1';
            ctx.fillRect(this.x, 0, w, this.topHeight);
            ctx.fillStyle = '#EC407A';
            ctx.fillRect(this.x + 4, 0, 6, this.topHeight - capHeight);
            ctx.fillRect(this.x + w - 10, 0, 6, this.topHeight - capHeight);
            // Top pipe cap
            ctx.fillStyle = '#EC407A';
            ctx.fillRect(this.x - capOverhang, this.topHeight - capHeight, w + capOverhang * 2, capHeight);
            ctx.strokeStyle = '#C2185B';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - capOverhang, this.topHeight - capHeight, w + capOverhang * 2, capHeight);

            // Bottom pipe body
            ctx.fillStyle = '#F48FB1';
            ctx.fillRect(this.x, this.bottomY, w, GROUND.y - this.bottomY);
            ctx.fillStyle = '#EC407A';
            ctx.fillRect(this.x + 4, this.bottomY + capHeight, 6, GROUND.y - this.bottomY - capHeight);
            ctx.fillRect(this.x + w - 10, this.bottomY + capHeight, 6, GROUND.y - this.bottomY - capHeight);
            // Bottom pipe cap
            ctx.fillStyle = '#EC407A';
            ctx.fillRect(this.x - capOverhang, this.bottomY, w + capOverhang * 2, capHeight);
            ctx.strokeStyle = '#C2185B';
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x - capOverhang, this.bottomY, w + capOverhang * 2, capHeight);
        }
    }

    collidesWith(bird) {
        const c = bird.getBoundingCircle();
        if (circleRectCollision(c, this.x, 0, PIPE_CONFIG.width, this.topHeight)) return true;
        if (circleRectCollision(c, this.x, this.bottomY, PIPE_CONFIG.width, GROUND.y - this.bottomY)) return true;
        return false;
    }
}

// --- Utility Functions ---
function circleRectCollision(circle, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(circle.x, rx + rw));
    const closestY = Math.max(ry, Math.min(circle.y, ry + rh));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function hitTest(px, py, btn) {
    if (!btn) return false;
    return px >= btn.x && px <= btn.x + btn.w && py >= btn.y && py <= btn.y + btn.h;
}

function drawButton(ctx, text, x, y, w, h, color, borderColor, textColor) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    roundRect(ctx, x + 2, y + 3, w, h, 12, true, false);

    // Body
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 12, true, false);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 12, false, true);

    // Text
    ctx.fillStyle = textColor || '#FFFFFF';
    ctx.font = `bold ${h > 50 ? 28 : 20}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
}

function drawCloud(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.5, y + h * 0.2, w * 0.6, h * 0.7, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.5, y + h * 0.1, w * 0.5, h * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
}

// --- Game State ---
const game = {
    state: GameState.MENU,
    mode: null,
    score: 0,
    highScores: { hbd: 0, casual: 0 },
    bird: null,
    pipes: [],
    pipeTimer: 0,
    totalPipesSpawned: 0,
    groundOffset: 0,
    cakeActive: false,
    cakeX: 0,
    cakeReached: false,
    levelCompleteDelay: 0,
    showLevelComplete: false,
    autopilot: false,
    autopilotDelay: 0,
    dysonShown: false,
    showDysonPopup: false,
    chocolateShown: false,
    showChocolatePopup: false,
    grantWishShown: false,
    showGrantWishPopup: false,
    isNewHighScore: false,
    paused: false,
    confetti: [],
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    // UI button refs
    playBtn: null,
    hbdBtn: null,
    casualBtn: null,
    backBtn: null,
    retryBtn: null,
    menuBtn: null,
    // Menu animation
    menuBobTime: 0,
    // Audio initialized flag
    audioInitialized: false,
};

// --- Canvas Setup ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('game-container');
const birthdayAudio = new BirthdayAudio();

// Cached display dimensions (updated in resizeCanvas)
let gameDisplayW = GAME_WIDTH;
let gameDisplayH = GAME_HEIGHT;

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    // Maintain game aspect ratio within the viewport
    const gameAspect = GAME_WIDTH / GAME_HEIGHT;
    let containerW, containerH;

    if (viewW / viewH < gameAspect) {
        // Viewport is narrower than game aspect ratio — fill width
        containerW = viewW;
        containerH = viewW / gameAspect;
    } else {
        // Viewport is wider than game aspect ratio — fill height
        containerH = viewH;
        containerW = viewH * gameAspect;
    }

    containerW = Math.round(containerW);
    containerH = Math.round(containerH);

    gameContainer.style.width = containerW + 'px';
    gameContainer.style.height = containerH + 'px';

    canvas.style.width = containerW + 'px';
    canvas.style.height = containerH + 'px';
    canvas.width = containerW * dpr;
    canvas.height = containerH * dpr;

    gameDisplayW = containerW;
    gameDisplayH = containerH;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Read safe area
    const style = getComputedStyle(document.documentElement);
    game.safeArea.top = parseInt(style.getPropertyValue('--sait')) || 0;
    game.safeArea.bottom = parseInt(style.getPropertyValue('--saib')) || 0;
}

function getScale() {
    const scaleX = gameDisplayW / GAME_WIDTH;
    const scaleY = gameDisplayH / GAME_HEIGHT;
    return { scaleX, scaleY };
}

// Compute derived constants
function initConstants() {
    GROUND.y = GAME_HEIGHT - GROUND.height;
    PIPE_CONFIG.maxTopHeight = GROUND.y - PIPE_CONFIG.gapSize - PIPE_CONFIG.minTopHeight;
}

// --- Drawing Functions ---
function drawBackground(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const h = gameDisplayH;

    // Soft pink gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#FCE4EC');
    grad.addColorStop(0.5, '#FCE4EC');
    grad.addColorStop(1, '#F8BBD0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Soft pastel clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    const cloudY1 = 100 * scaleY;
    const cloudY2 = 60 * scaleY;
    const cloudY3 = 160 * scaleY;
    drawCloud(ctx, 60 * scaleX, cloudY1, 50 * scaleX, 18 * scaleY);
    drawCloud(ctx, 240 * scaleX, cloudY2, 40 * scaleX, 14 * scaleY);
    drawCloud(ctx, 320 * scaleX, cloudY3, 35 * scaleX, 12 * scaleY);
}

function drawGroundFn(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const groundY = GROUND.y * scaleY;
    const groundH = GROUND.height * scaleY;

    // Pink ground base
    ctx.fillStyle = '#F8BBD0';
    ctx.fillRect(0, groundY, w, groundH);

    // Darker pink lower section
    ctx.fillStyle = '#F48FB1';
    ctx.fillRect(0, groundY + 14 * scaleY, w, groundH - 14 * scaleY);

    // Subtle dot pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    const dotSpacing = 20 * scaleX;
    const offset = -(game.groundOffset * scaleX) % dotSpacing;
    for (let row = 0; row < 3; row++) {
        const rowY = groundY + 24 * scaleY + row * 20 * scaleY;
        const rowOff = row % 2 === 0 ? 0 : dotSpacing / 2;
        for (let x = offset + rowOff; x < w + dotSpacing; x += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, rowY, 2.5 * Math.min(scaleX, scaleY), 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Clean top edge - smooth gradient strip
    const topGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 14 * scaleY);
    topGrad.addColorStop(0, '#EC407A');
    topGrad.addColorStop(1, '#F48FB1');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, groundY, w, 14 * scaleY);

    // Thin highlight line at very top
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(0, groundY, w, 2 * scaleY);
}

function drawMenu(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;

    drawBackground(ctx);

    // Centered layout: total content height ~280, center of screen ~406
    const centerY = GAME_HEIGHT / 2;
    const contentStart = centerY - 140;

    // Title
    const titleY = (contentStart + game.safeArea.top) * scaleY;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#AD1457';
    ctx.lineWidth = 5 * Math.min(scaleX, scaleY);
    ctx.font = `bold ${44 * Math.min(scaleX, scaleY)}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('Flappy Suan', w / 2, titleY);
    ctx.fillText('Flappy Suan', w / 2, titleY);

    // Animated bird
    game.menuBobTime += 0.03;
    const bobY = (contentStart + 80 + Math.sin(game.menuBobTime) * 10) * scaleY;
    ctx.save();
    ctx.translate(w / 2, bobY);
    ctx.scale(scaleX, scaleY);

    // Draw bird at origin (scaled)
    const menuBirdS = BIRD_CONFIG.radius * 2 + 4;
    ctx.drawImage(birdImages.default, -menuBirdS / 2, -menuBirdS / 2, menuBirdS, menuBirdS);

    ctx.restore();

    // PLAY button
    const btnW = 180 * scaleX;
    const btnH = 58 * scaleY;
    const btnX = (w - btnW) / 2;
    const btnY = (contentStart + 145) * scaleY;
    drawButton(ctx, 'PLAY', btnX, btnY, btnW, btnH, '#EC407A', '#C2185B');
    game.playBtn = { x: btnX, y: btnY, w: btnW, h: btnH };

    // High score
    const hsSize = 17 * Math.min(scaleX, scaleY);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Casual Best
    ctx.font = `bold ${hsSize}px Arial, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#AD1457';
    ctx.lineWidth = 3 * Math.min(scaleX, scaleY);
    ctx.strokeText(`Best: ${game.highScores.casual}`, w / 2, (contentStart + 228) * scaleY);
    ctx.fillText(`Best: ${game.highScores.casual}`, w / 2, (contentStart + 228) * scaleY);

    drawGroundFn(ctx);
}

function drawLevelSelect(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;

    drawBackground(ctx);

    // Centered layout
    const centerY = GAME_HEIGHT / 2;
    const contentStart = centerY - 130;

    // Title
    const titleY = (contentStart + game.safeArea.top) * scaleY;
    ctx.font = `bold ${34 * Math.min(scaleX, scaleY)}px Arial, sans-serif`;
    ctx.fillStyle = '#AD1457';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Choose Mode', w / 2, titleY);

    // HBD button
    const btnW = 230 * scaleX;
    const btnH = 70 * scaleY;

    const hbdY = (contentStart + 42) * scaleY;
    drawButton(ctx, 'HBD', (w - btnW) / 2, hbdY, btnW, btnH, '#EC407A', '#C2185B');
    game.hbdBtn = { x: (w - btnW) / 2, y: hbdY, w: btnW, h: btnH };

    // CASUAL button
    const casualY = (contentStart + 132) * scaleY;
    drawButton(ctx, 'CASUAL', (w - btnW) / 2, casualY, btnW, btnH, '#F48FB1', '#EC407A');
    game.casualBtn = { x: (w - btnW) / 2, y: casualY, w: btnW, h: btnH };

    // BACK button
    const backW = 110 * scaleX;
    const backH = 44 * scaleY;
    const backY = (contentStart + 225) * scaleY;
    drawButton(ctx, 'BACK', (w - backW) / 2, backY, backW, backH, '#E0E0E0', '#BDBDBD', '#666');
    game.backBtn = { x: (w - backW) / 2, y: backY, w: backW, h: backH };

    drawGroundFn(ctx);
}

function drawScore(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const scoreY = (55 + game.safeArea.top) * scaleY;

    const fontSize = 48 * Math.min(scaleX, scaleY);
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#AD1457';
    ctx.lineWidth = 4 * Math.min(scaleX, scaleY);
    ctx.strokeText(game.score, w / 2, scoreY);
    ctx.fillText(game.score, w / 2, scoreY);

    // Score/total display removed for HBD mode
}

function drawCake(ctx) {
    if (!game.cakeActive) return;
    const { scaleX, scaleY } = getScale();
    const cakeScale = 5;
    const cx = game.cakeX * scaleX;
    const cy = (GROUND.y - 5 * cakeScale) * scaleY;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scaleX * cakeScale, scaleY * cakeScale);

    // Bottom tier
    ctx.fillStyle = '#FFCCBC';
    ctx.fillRect(-35, -25, 70, 30);
    // Top tier
    ctx.fillStyle = '#F8BBD0';
    ctx.fillRect(-25, -48, 50, 23);
    // Frosting
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-35, -25, 70, 5);
    ctx.fillRect(-25, -48, 50, 5);
    // Candle
    ctx.fillStyle = '#F44336';
    ctx.fillRect(-3, -63, 6, 15);
    // Flame
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.ellipse(0, -68, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function drawPlayingState(ctx) {
    const { scaleX, scaleY } = getScale();

    drawBackground(ctx);

    // Pipes
    ctx.save();
    ctx.scale(scaleX, scaleY);
    for (const pipe of game.pipes) {
        pipe.draw(ctx);
    }
    ctx.restore();

    // Cake
    drawCake(ctx);

    drawGroundFn(ctx);

    // Bird
    ctx.save();
    ctx.translate(game.bird.x * scaleX, game.bird.y * scaleY);
    ctx.scale(scaleX, scaleY);
    ctx.rotate(game.bird.rotation);

    const birdImg = getBirdImage(game.bird.face);
    const birdS = BIRD_CONFIG.radius * 2 + 4;
    ctx.drawImage(birdImg, -birdS / 2, -birdS / 2, birdS, birdS);

    ctx.restore();

    drawScore(ctx);

    if (game.showChocolatePopup) {
        drawChocolatePopup(ctx);
    }
    if (game.showDysonPopup) {
        drawDysonPopup(ctx);
    }
    if (game.showGrantWishPopup) {
        drawGrantWishPopup(ctx);
    }
}

function drawGameOver(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const h = gameDisplayH;

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    // Panel
    const panelW = 280 * scaleX;
    const panelH = 210 * scaleY;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2 - 20 * scaleY;

    ctx.fillStyle = '#FCE4EC';
    roundRect(ctx, panelX, panelY, panelW, panelH, 16, true, false);
    ctx.strokeStyle = '#EC407A';
    ctx.lineWidth = 3;
    roundRect(ctx, panelX, panelY, panelW, panelH, 16, false, true);

    const s = Math.min(scaleX, scaleY);

    // Game Over text
    ctx.font = `bold ${34 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#C2185B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Game Over', w / 2, panelY + 40 * scaleY);

    // Score
    ctx.font = `bold ${24 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#AD1457';
    ctx.fillText(`Score: ${game.score}`, w / 2, panelY + 82 * scaleY);

    // High score
    const modeKey = game.mode === GameMode.HBD ? 'hbd' : 'casual';
    ctx.font = `${20 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#EC407A';
    ctx.fillText(`Best: ${game.highScores[modeKey]}`, w / 2, panelY + 110 * scaleY);

    // New high score
    if (game.isNewHighScore) {
        ctx.font = `bold ${14 * s}px Arial, sans-serif`;
        ctx.fillStyle = '#C2185B';
        ctx.fillText('NEW BEST!', w / 2, panelY + 130 * scaleY);
    }

    // Buttons
    const retryW = 115 * scaleX;
    const retryH = 48 * scaleY;
    const retryX = panelX + 18 * scaleX;
    const retryY = panelY + panelH - 62 * scaleY;
    drawButton(ctx, 'RETRY', retryX, retryY, retryW, retryH, '#EC407A', '#C2185B');
    game.retryBtn = { x: retryX, y: retryY, w: retryW, h: retryH };

    const menuX = panelX + panelW - retryW - 18 * scaleX;
    drawButton(ctx, 'MENU', menuX, retryY, retryW, retryH, '#F48FB1', '#EC407A');
    game.menuBtn = { x: menuX, y: retryY, w: retryW, h: retryH };
}

function drawLevelComplete(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const h = gameDisplayH;
    const s = Math.min(scaleX, scaleY);

    // Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, w, h);

    // Confetti
    drawConfetti(ctx);

    // Panel
    const panelW = 300 * scaleX;
    const panelH = 260 * scaleY;
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2 - 20 * scaleY;

    ctx.fillStyle = '#FCE4EC';
    roundRect(ctx, panelX, panelY, panelW, panelH, 16, true, false);
    ctx.strokeStyle = '#EC407A';
    ctx.lineWidth = 3;
    roundRect(ctx, panelX, panelY, panelW, panelH, 16, false, true);

    // Birthday message
    ctx.font = `bold ${30 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#C2185B';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Happy Birthday!', w / 2, panelY + 40 * scaleY);

    // Cake icon (matches in-game cake)
    ctx.save();
    ctx.translate(w / 2, panelY + 115 * scaleY);
    const iconScale = 0.7 * s;
    ctx.scale(iconScale, iconScale);
    // Bottom tier
    ctx.fillStyle = '#FFCCBC';
    ctx.fillRect(-35, -25, 70, 30);
    // Top tier
    ctx.fillStyle = '#F8BBD0';
    ctx.fillRect(-25, -48, 50, 23);
    // Frosting
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-35, -25, 70, 5);
    ctx.fillRect(-25, -48, 50, 5);
    // Candle
    ctx.fillStyle = '#F44336';
    ctx.fillRect(-3, -63, 6, 15);
    // Flame
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.ellipse(0, -68, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Message
    ctx.font = `${20 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#AD1457';
    ctx.fillText('Suan, you made it!', w / 2, panelY + 150 * scaleY);
    ctx.font = `${16 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#EC407A';
    ctx.fillText(`All ${HBD_TOTAL_PIPES} pipes cleared!`, w / 2, panelY + 175 * scaleY);

    // Buttons
    const retryW = 120 * scaleX;
    const retryH = 48 * scaleY;
    const retryX = panelX + 18 * scaleX;
    const retryY = panelY + panelH - 62 * scaleY;
    drawButton(ctx, 'REPLAY', retryX, retryY, retryW, retryH, '#EC407A', '#C2185B');
    game.retryBtn = { x: retryX, y: retryY, w: retryW, h: retryH };

    const menuX = panelX + panelW - retryW - 18 * scaleX;
    drawButton(ctx, 'MENU', menuX, retryY, retryW, retryH, '#F48FB1', '#EC407A');
    game.menuBtn = { x: menuX, y: retryY, w: retryW, h: retryH };
}

function drawDysonPopup(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const h = gameDisplayH;
    const s = Math.min(scaleX, scaleY);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    const pw = 280 * scaleX;
    const ph = 230 * scaleY;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;

    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, px, py, pw, ph, 16, true, false);
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 4;
    roundRect(ctx, px, py, pw, ph, 16, false, true);

    ctx.font = `${40 * s}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2B50', w / 2, py + 40 * scaleY);

    ctx.font = `bold ${24 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#333';
    ctx.fillText('Dyson Unlocked!', w / 2, py + 80 * scaleY);

    ctx.font = `${16 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#666';
    ctx.fillText('200 points reached!', w / 2, py + 110 * scaleY);

    ctx.font = `${13 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText('Send this screenshot to Shafi', w / 2, py + 140 * scaleY);
    ctx.fillText('to avail it!', w / 2, py + 158 * scaleY);

    ctx.font = `${14 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#999';
    ctx.fillText('Tap to continue', w / 2, py + 195 * scaleY);
}

function drawChocolatePopup(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const h = gameDisplayH;
    const s = Math.min(scaleX, scaleY);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    const pw = 280 * scaleX;
    const ph = 230 * scaleY;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;

    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, px, py, pw, ph, 16, true, false);
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    roundRect(ctx, px, py, pw, ph, 16, false, true);

    ctx.font = `${40 * s}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83C\uDF6B', w / 2, py + 40 * scaleY);

    ctx.font = `bold ${24 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#333';
    ctx.fillText('You Won a Chocolate!', w / 2, py + 80 * scaleY);

    ctx.font = `${16 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#666';
    ctx.fillText('50 points reached!', w / 2, py + 110 * scaleY);

    ctx.font = `${13 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText('Send this screenshot to Shafi', w / 2, py + 140 * scaleY);
    ctx.fillText('to avail it!', w / 2, py + 158 * scaleY);

    ctx.font = `${14 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#999';
    ctx.fillText('Tap to continue', w / 2, py + 195 * scaleY);
}

function drawGrantWishPopup(ctx) {
    const { scaleX, scaleY } = getScale();
    const w = gameDisplayW;
    const h = gameDisplayH;
    const s = Math.min(scaleX, scaleY);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, w, h);

    const pw = 280 * scaleX;
    const ph = 260 * scaleY;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;

    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, px, py, pw, ph, 16, true, false);
    ctx.strokeStyle = '#9C27B0';
    ctx.lineWidth = 4;
    roundRect(ctx, px, py, pw, ph, 16, false, true);

    ctx.font = `${40 * s}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83C\uDF1F', w / 2, py + 40 * scaleY);

    ctx.font = `bold ${22 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#333';
    ctx.fillText('Wish Granted!', w / 2, py + 80 * scaleY);

    ctx.font = `${15 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#666';
    ctx.fillText('400 points reached!', w / 2, py + 108 * scaleY);

    ctx.font = `${13 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText('Request anything from Shafi', w / 2, py + 136 * scaleY);
    ctx.fillText('and he will grant it!', w / 2, py + 154 * scaleY);

    ctx.font = `bold ${12 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#9C27B0';
    ctx.fillText('(This is the last reward)', w / 2, py + 180 * scaleY);

    ctx.font = `${13 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#888';
    ctx.fillText('Send this screenshot to Shafi', w / 2, py + 205 * scaleY);

    ctx.font = `${14 * s}px Arial, sans-serif`;
    ctx.fillStyle = '#999';
    ctx.fillText('Tap to continue', w / 2, py + 232 * scaleY);
}

function initConfetti() {
    game.confetti = [];
    const colors = ['#E91E63', '#FF9800', '#4CAF50', '#2196F3', '#9C27B0', '#FFEB3B'];
    for (let i = 0; i < 60; i++) {
        game.confetti.push({
            x: Math.random() * GAME_WIDTH,
            y: Math.random() * GAME_HEIGHT - GAME_HEIGHT,
            w: 4 + Math.random() * 6,
            h: 8 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            vy: 1 + Math.random() * 2,
            vx: (Math.random() - 0.5) * 2,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.1,
        });
    }
}

function drawConfetti(ctx) {
    if (!game.confetti || game.confetti.length === 0) return;
    const { scaleX, scaleY } = getScale();

    for (const c of game.confetti) {
        c.y += c.vy;
        c.x += c.vx;
        c.rotation += c.rotationSpeed;
        if (c.y > GAME_HEIGHT) {
            c.y = -10;
            c.x = Math.random() * GAME_WIDTH;
        }

        ctx.save();
        ctx.translate(c.x * scaleX, c.y * scaleY);
        ctx.rotate(c.rotation);
        ctx.scale(scaleX, scaleY);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
    }
}

// --- Game Logic ---
function startGame(mode) {
    game.state = GameState.PLAYING;
    game.mode = mode;
    game.score = 0;
    game.bird = new Bird();
    game.pipes = [];
    game.pipeTimer = 0;
    game.totalPipesSpawned = 0;
    game.cakeReached = false;
    game.levelCompleteDelay = 0;
    game.showLevelComplete = false;
    game.autopilot = false;
    game.autopilotDelay = 0;
    if (mode === GameMode.HBD) {
        game.cakeActive = true;
        // Position cake far right — past where all 25 pipes will be
        game.cakeX = GAME_WIDTH + (HBD_TOTAL_PIPES + 1) * PIPE_CONFIG.spawnInterval * PIPE_CONFIG.speed + 250;
    } else {
        game.cakeActive = false;
        game.cakeX = 0;
    }
    game.dysonShown = false;
    game.showDysonPopup = false;
    game.chocolateShown = false;
    game.showChocolatePopup = false;
    game.grantWishShown = false;
    game.showGrantWishPopup = false;
    game.isNewHighScore = false;
    game.groundOffset = 0;
    game.paused = false;
    game.confetti = [];

    if (mode === GameMode.HBD) {
        birthdayAudio.init(); // init AudioContext but don't play melody yet
    }
}

function gameOver() {
    if (game.state === GameState.FALLING) return; // already falling
    game.state = GameState.FALLING;
    game.bird.face = 'hurt';
    game.bird.velocity = -4; // small bounce up before falling
    playHitSound();
    if (game.mode === GameMode.HBD) {
        birthdayAudio.stop();
    }
}

function spawnPipe() {
    if (game.mode === GameMode.HBD && game.totalPipesSpawned >= HBD_TOTAL_PIPES) {
        return;
    }
    game.totalPipesSpawned++;
    game.pipes.push(new Pipe(game.totalPipesSpawned));
}

function spawnCake() {
    const lastPipe = game.pipes[game.pipes.length - 1];
    if (lastPipe) {
        game.cakeX = lastPipe.x + PIPE_CONFIG.width + 250;
    } else {
        game.cakeX = GAME_WIDTH + 250;
    }
    game.cakeActive = true;
}

function checkScoring() {
    for (const pipe of game.pipes) {
        if (!pipe.passed && pipe.x + PIPE_CONFIG.width < game.bird.x) {
            pipe.passed = true;
            game.score++;
            if (game.mode === GameMode.HBD) {
                birthdayAudio.playPianoNote(game.score - 1); // play melody note for this pipe
            } else {
                playScoreSound();
            }

            // Flash happy face on the bird
            game.bird.face = 'happy';
            game.bird.faceTimer = 20; // ~0.33 seconds at 60fps

            if (game.mode === GameMode.HBD && game.score >= HBD_TOTAL_PIPES && !game.autopilot && game.autopilotDelay === 0) {
                game.autopilotDelay = 90; // ~1.5 seconds of free control before autopilot
            }

            if (game.mode === GameMode.CASUAL && game.score === 50 && !game.chocolateShown) {
                game.chocolateShown = true;
                game.showChocolatePopup = true;
                game.paused = true;
            }

            if (game.mode === GameMode.CASUAL && game.score === 200 && !game.dysonShown) {
                game.dysonShown = true;
                game.showDysonPopup = true;
                game.paused = true;
            }

            if (game.mode === GameMode.CASUAL && game.score === 400 && !game.grantWishShown) {
                game.grantWishShown = true;
                game.showGrantWishPopup = true;
                game.paused = true;
            }
        }
    }
}

function checkCakeCollision() {
    if (!game.cakeActive || game.cakeReached) return;
    if (game.bird.x >= game.cakeX - 120) {
        game.bird.face = 'surprised';
        game.bird.faceTimer = 120; // keep surprised face for ~2 seconds
        game.cakeReached = true;
        game.levelCompleteDelay = 90; // ~1.5 seconds delay before showing modal
        game.showLevelComplete = false;
        birthdayAudio.play(); // play the full Happy Birthday melody
        saveHighScore();
    }
}

function update() {
    if (game.paused) return;

    // Handle falling state: bird drops to ground then transition to game over
    if (game.state === GameState.FALLING) {
        game.bird.velocity += PHYSICS.gravity;
        game.bird.velocity = Math.min(game.bird.velocity, PHYSICS.terminalVelocity);
        game.bird.y += game.bird.velocity;
        game.bird.rotation = Math.min(Math.PI / 2, game.bird.rotation + 0.08);

        if (game.bird.y + BIRD_CONFIG.radius >= GROUND.y) {
            game.bird.y = GROUND.y - BIRD_CONFIG.radius;
            game.state = GameState.GAME_OVER;
            saveHighScore();
        }
        return;
    }

    if (game.state !== GameState.PLAYING) return;

    // Bird physics
    game.bird.update();

    // Autopilot delay countdown
    if (game.autopilotDelay > 0 && !game.autopilot) {
        game.autopilotDelay--;
        if (game.autopilotDelay <= 0) {
            game.autopilot = true;
        }
    }

    // Autopilot: after last pipe, gently fly bird toward cake center
    if (game.autopilot && !game.cakeReached) {
        const targetY = GROUND.y - 150; // aim at middle of the cake
        if (game.bird.y > targetY + 10) {
            game.bird.velocity = Math.max(game.bird.velocity, PHYSICS.jumpVelocity * 0.6);
        }
        // Clamp velocity so flight looks smooth
        game.bird.velocity = Math.max(game.bird.velocity, -4);
    }

    // Pipe spawning
    game.pipeTimer++;
    if (game.pipeTimer >= PIPE_CONFIG.spawnInterval) {
        game.pipeTimer = 0;
        spawnPipe();
    }

    // Update pipes (stop when cake is reached)
    if (!game.cakeReached) {
        for (const pipe of game.pipes) {
            pipe.update();
        }
        game.pipes = game.pipes.filter(p => !p.isOffScreen());
    }

    // Scoring
    checkScoring();

    // Pipe collision (skip during autopilot)
    if (!game.autopilot) {
        for (const pipe of game.pipes) {
            if (pipe.collidesWith(game.bird)) {
                gameOver();
                return;
            }
        }
    }

    // Ground/ceiling collision (skip if celebrating cake reach)
    if (game.bird.y + BIRD_CONFIG.radius >= GROUND.y) {
        game.bird.y = GROUND.y - BIRD_CONFIG.radius;
        if (game.cakeReached) {
            game.bird.velocity = 0;
        } else {
            gameOver();
            return;
        }
    }
    if (game.bird.y - BIRD_CONFIG.radius <= 0) {
        game.bird.y = BIRD_CONFIG.radius;
        game.bird.velocity = 0;
    }

    // HBD cake
    if (game.mode === GameMode.HBD && game.cakeActive) {
        if (!game.cakeReached) {
            game.cakeX -= PIPE_CONFIG.speed;
        }
        checkCakeCollision();
    }

    // Delay before showing level complete modal
    if (game.cakeReached && !game.showLevelComplete) {
        game.levelCompleteDelay--;
        if (game.levelCompleteDelay <= 0) {
            game.showLevelComplete = true;
            game.state = GameState.LEVEL_COMPLETE;
            initConfetti();
        }
    }

    // Ground scroll (stop when cake is reached)
    if (!game.cakeReached) {
        game.groundOffset = (game.groundOffset + GROUND.scrollSpeed) % 24;
    }
}

// --- Render ---
function render() {
    const w = gameDisplayW;
    const h = gameDisplayH;
    ctx.clearRect(0, 0, w, h);

    switch (game.state) {
        case GameState.MENU:
            drawMenu(ctx);
            break;
        case GameState.LEVEL_SELECT:
            drawLevelSelect(ctx);
            break;
        case GameState.PLAYING:
        case GameState.FALLING:
            drawPlayingState(ctx);
            break;
        case GameState.GAME_OVER:
            drawPlayingState(ctx);
            drawGameOver(ctx);
            break;
        case GameState.LEVEL_COMPLETE:
            drawPlayingState(ctx);
            if (game.showLevelComplete) {
                drawLevelComplete(ctx);
            }
            break;
    }
}

// --- Input ---
function handleTap(clientX, clientY) {
    // Initialize audio context on first interaction (iOS requirement)
    if (!game.audioInitialized) {
        game.audioInitialized = true;
        birthdayAudio.init();
    }

    const x = clientX;
    const y = clientY;

    switch (game.state) {
        case GameState.MENU:
            if (hitTest(x, y, game.playBtn)) {
                game.state = GameState.LEVEL_SELECT;
            }
            break;

        case GameState.LEVEL_SELECT:
            if (hitTest(x, y, game.hbdBtn)) {
                startGame(GameMode.HBD);
            } else if (hitTest(x, y, game.casualBtn)) {
                startGame(GameMode.CASUAL);
            } else if (hitTest(x, y, game.backBtn)) {
                game.state = GameState.MENU;
            }
            break;

        case GameState.PLAYING:
            if (game.showChocolatePopup) {
                game.showChocolatePopup = false;
                game.paused = false;
            } else if (game.showDysonPopup) {
                game.showDysonPopup = false;
                game.paused = false;
            } else if (game.showGrantWishPopup) {
                game.showGrantWishPopup = false;
                game.paused = false;
            } else if (!game.autopilot) {
                game.bird.flap();
                playFlapSound();
            }
            break;

        case GameState.GAME_OVER:
        case GameState.LEVEL_COMPLETE:
            if (hitTest(x, y, game.retryBtn)) {
                startGame(game.mode);
            } else if (hitTest(x, y, game.menuBtn)) {
                game.state = GameState.MENU;
            }
            break;
    }
}

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = gameContainer.getBoundingClientRect();
    handleTap(touch.clientX - rect.left, touch.clientY - rect.top);
}, { passive: false });

canvas.addEventListener('click', (e) => {
    const rect = gameContainer.getBoundingClientRect();
    handleTap(e.clientX - rect.left, e.clientY - rect.top);
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (game.state === GameState.PLAYING) {
            if (game.showChocolatePopup) {
                game.showChocolatePopup = false;
                game.paused = false;
            } else if (game.showDysonPopup) {
                game.showDysonPopup = false;
                game.paused = false;
            } else if (game.showGrantWishPopup) {
                game.showGrantWishPopup = false;
                game.paused = false;
            } else if (!game.autopilot) {
                game.bird.flap();
                playFlapSound();
            }
        }
    }
});

// Prevent default touch behaviors
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());

// --- Sound Effects ---
function playFlapSound() {
    if (!birthdayAudio.audioCtx) return;
    try {
        const actx = birthdayAudio.audioCtx;
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(420, actx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, actx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.08, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + 0.1);
    } catch (e) { /* ignore audio errors */ }
}

function playScoreSound() {
    if (!birthdayAudio.audioCtx) return;
    try {
        const actx = birthdayAudio.audioCtx;
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587, actx.currentTime);
        osc.frequency.setValueAtTime(784, actx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.1, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + 0.15);
    } catch (e) { /* ignore */ }
}

function playHitSound() {
    if (!birthdayAudio.audioCtx) return;
    try {
        const actx = birthdayAudio.audioCtx;
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, actx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, actx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.12, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(actx.destination);
        osc.start();
        osc.stop(actx.currentTime + 0.25);
    } catch (e) { /* ignore */ }
}

// --- High Scores ---
function loadHighScores() {
    try {
        const stored = localStorage.getItem('flappySuanHighScores');
        if (stored) {
            game.highScores = JSON.parse(stored);
        }
    } catch (e) {
        game.highScores = { hbd: 0, casual: 0 };
    }
}

function saveHighScore() {
    const key = game.mode === GameMode.HBD ? 'hbd' : 'casual';
    if (game.score > game.highScores[key]) {
        game.highScores[key] = game.score;
        game.isNewHighScore = true;
        try {
            localStorage.setItem('flappySuanHighScores', JSON.stringify(game.highScores));
        } catch (e) { /* ignore */ }
    }
}

// --- Visibility ---
document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === GameState.PLAYING) {
        game.paused = true;
    }
});

// --- Game Loop ---
const FIXED_DT = 1000 / 60;
let lastTime = 0;
let accumulator = 0;

function gameLoop(timestamp) {
    const elapsed = timestamp - lastTime;
    lastTime = timestamp;

    const clamped = Math.min(elapsed, 200);
    accumulator += clamped;

    while (accumulator >= FIXED_DT) {
        update();
        accumulator -= FIXED_DT;

        // Update confetti in level complete state too
        if (game.state === GameState.LEVEL_COMPLETE && game.confetti.length > 0) {
            // confetti updates happen in drawConfetti
        }
    }

    render();
    requestAnimationFrame(gameLoop);
}

// --- Resume from pause on tap ---
canvas.addEventListener('touchstart', function resumeHandler(e) {
    if (game.paused && game.state === GameState.PLAYING && !game.showDysonPopup && !game.showChocolatePopup && !game.showGrantWishPopup) {
        game.paused = false;
        lastTime = performance.now();
        accumulator = 0;
    }
}, { passive: true });

// --- Initialization ---
function init() {
    initConstants();
    loadHighScores();
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', () => {
        setTimeout(resizeCanvas, 100);
    });

    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        requestAnimationFrame(gameLoop);
    });
}

init();
