const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const FPS = 30;
const DURATION = 240;
const TOTAL_FRAMES = FPS * DURATION;
const WIDTH = 1280;
const HEIGHT = 720;

async function render() {
    const framesDir = path.join(__dirname, '..', 'frames');
    const outDir = path.join(__dirname, '..', 'out');
    
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
    
    const htmlPath = path.resolve(__dirname, '..', 'index.html');
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    
    // Wait for fonts and avoid FOUT
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    
    console.log('Capturing frames...');
    const canvas = await page.$('#stage');
    
    for (let i = 0; i < TOTAL_FRAMES; i++) {
        const t = i / FPS;
        await page.evaluate((time) => window.renderFrame(time), t);
        
        const framePath = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`);
        await canvas.screenshot({ path: framePath, type: 'png' });
        
        if (i % 100 === 0) {
            console.log(`Captured frame ${i}/${TOTAL_FRAMES} (t=${t.toFixed(2)}s)`);
        }
    }
    
    await browser.close();
    console.log('Encoding video with FFmpeg...');
    
    const ffmpegCmd = `ffmpeg -y -framerate ${FPS} -i ${path.join(framesDir, 'frame_%05d.png')} -c:v libx264 -preset medium -crf 23 -pix_fmt yuv420p -movflags +faststart ${path.join(outDir, 'des-animation.mp4')}`;
    
    try {
        execSync(ffmpegCmd, { stdio: 'inherit' });
        console.log('Video encoded successfully!');
    } catch (err) {
        console.error('FFmpeg encoding failed:', err);
        process.exit(1);
    }
}

render().catch(err => {
    console.error(err);
    process.exit(1);
});