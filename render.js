/**
 * render.js
 * Motion Graphics Video Renderer for "Part 1 - Apa itu Enkripsi?"
 * 
 * Engine: Node.js + Puppeteer + GSAP + FFmpeg
 * Resolution: 1920x1080 (16:9)
 * Frame Rate: 30 FPS
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fps = 30;
const duration = 60; // Total durasi video dalam detik
const totalFrames = fps * duration;
const framesDir = path.join(__dirname, 'frames');
const outputDir = path.join(__dirname, 'output');
const outputFile = path.join(outputDir, 'part-01-apa-itu-enkripsi.mp4');

// HTML Template dengan CSS dan GSAP untuk Motion Graphics
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;800&display=swap" rel="stylesheet">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <style>
        body { 
            margin: 0; padding: 0; 
            background: #0f172a; 
            color: #f8fafc; 
            font-family: 'Inter', sans-serif; 
            overflow: hidden; 
            width: 1920px; height: 1080px; 
            position: relative;
        }
        .scene { 
            position: absolute; top: 0; left: 0; 
            width: 100%; height: 100%; 
            display: flex; flex-direction: column; 
            justify-content: center; align-items: center; 
            opacity: 0; 
        }
        .text-title { font-size: 80px; font-weight: 800; text-align: center; margin-bottom: 20px; }
        .text-sub { font-size: 40px; font-weight: 400; text-align: center; color: #94a3b8; }
        .icon { font-size: 200px; margin-bottom: 40px; font-family: 'Noto Color Emoji', sans-serif; }
        .chat-bubble { background: #3b82f6; padding: 30px 50px; border-radius: 30px; font-size: 60px; font-weight: bold; margin: 20px; }
        .chat-bubble.gray { background: #334155; color: #10b981; font-family: monospace; }
        .arrow { font-size: 80px; margin: 20px; }
        .lock { color: #10b981; }
        .key { color: #f59e0b; }
        .eye { color: #ef4444; }
        .btn-follow { background: #ef4444; padding: 20px 60px; border-radius: 50px; font-size: 40px; font-weight: bold; margin-top: 40px; box-shadow: 0 10px 25px rgba(239, 68, 68, 0.3); }
    </style>
</head>
<body>
    <!-- Scene 1: 0-2s -->
    <div class="scene scene1">
        <div class="icon lock">🔒</div>
        <div class="text-title">Apa itu Enkripsi?</div>
        <div class="text-sub">Part 1 | @random.ai.id</div>
    </div>

    <!-- Scene 2: 2-10s -->
    <div class="scene scene2">
        <div class="icon">👋</div>
        <div class="text-title">AZRIEL</div>
        <div class="text-sub">@random.ai.id | AI Gabut</div>
    </div>

    <!-- Scene 3: 10-24s -->
    <div class="scene scene3">
        <div style="display: flex; align-items: center;">
            <div class="chat-bubble">Pesan Asli</div>
            <div class="arrow">➡️</div>
            <div class="chat-bubble gray">x7#kL9!@</div>
        </div>
        <div class="icon key" style="margin-top: 40px;">🔑</div>
        <div class="text-title" style="font-size: 60px; margin-top: 20px;">Enkripsi = pesan diacak</div>
        <div class="text-sub">Cuma pemilik kunci yang bisa baca</div>
    </div>

    <!-- Scene 4: 24-38s -->
    <div class="scene scene4">
        <div class="icon">📜</div>
        <div class="text-title" style="font-size: 60px;">Kayak surat bahasa alien</div>
        <div style="display: flex; align-items: center; margin-top: 30px;">
            <div class="icon" style="font-size: 100px; margin: 0;">👽</div>
            <div class="arrow" style="font-size: 60px;">➡️</div>
            <div class="icon" style="font-size: 100px; margin: 0;">📖</div>
        </div>
        <div class="text-sub" style="margin-top: 30px;">Butuh kamus rahasia</div>
    </div>

    <!-- Scene 5: 38-50s -->
    <div class="scene scene5">
        <div style="display: flex; align-items: center;">
            <div class="chat-bubble">"gua otw"</div>
            <div class="arrow">➡️</div>
            <div class="chat-bubble gray">"x7#kL9"</div>
        </div>
        <div class="icon eye" style="margin-top: 40px;">👁️❓</div>
        <div class="text-title" style="font-size: 60px; margin-top: 20px;">Chat aman?</div>
    </div>

    <!-- Scene 6: 50-57s -->
    <div class="scene scene6">
        <div class="icon">👍</div>
        <div class="text-title" style="font-size: 60px;">Follow @random.ai.id</div>
        <div class="text-sub">AI Gabut</div>
        <div class="btn-follow">FOLLOW</div>
    </div>

    <!-- Scene 7: 57-60s -->
    <div class="scene scene7">
        <div class="icon">🎬</div>
        <div class="text-title" style="font-size: 60px;">@random.ai.id</div>
        <div class="text-sub">AI Gabut</div>
        <div class="text-sub" style="margin-top: 20px; color: #3b82f6;">Part 1 — Apa itu Enkripsi?</div>
    </div>

    <script>
        const tl = gsap.timeline();
        
        // Scene 1: 0-2s
        tl.to(".scene1", { opacity: 1, duration: 0.5 }, 0);
        tl.from(".scene1 .icon", { scale: 0, duration: 0.5, ease: "back.out(1.7)" }, 0.2);
        tl.to(".scene1", { opacity: 0, duration: 0.5 }, 1.5);

        // Scene 2: 2-10s
        tl.to(".scene2", { opacity: 1, duration: 0.5 }, 2);
        tl.from(".scene2 .icon", { x: -100, opacity: 0, duration: 0.5 }, 2.2);
        tl.to(".scene2 .icon", { rotation: 20, duration: 0.2, yoyo: true, repeat: 3 }, 3);
        tl.to(".scene2", { opacity: 0, duration: 0.5 }, 9.5);

        // Scene 3: 10-24s
        tl.to(".scene3", { opacity: 1, duration: 0.5 }, 10);
        tl.from(".scene3 .chat-bubble", { y: 50, opacity: 0, stagger: 0.2 }, 10.5);
        tl.from(".scene3 .arrow", { scale: 0, duration: 0.3 }, 11.5);
        tl.from(".scene3 .key", { scale: 0, rotation: -90, duration: 0.5, ease: "back.out(1.7)" }, 13);
        tl.to(".scene3", { opacity: 0, duration: 0.5 }, 23.5);

        // Scene 4: 24-38s
        tl.to(".scene4", { opacity: 1, duration: 0.5 }, 24);
        tl.from(".scene4 .icon", { scale: 0.5, opacity: 0, stagger: 0.2 }, 24.5);
        tl.to(".scene4", { opacity: 0, duration: 0.5 }, 37.5);

        // Scene 5: 38-50s
        tl.to(".scene5", { opacity: 1, duration: 0.5 }, 38);
        tl.from(".scene5 .chat-bubble", { scale: 0, duration: 0.4, stagger: 0.2 }, 38.5);
        tl.from(".scene5 .eye", { y: 50, opacity: 0, duration: 0.5 }, 40);
        tl.to(".scene5 .eye", { x: -20, duration: 0.3, yoyo: true, repeat: 5 }, 41);
        tl.to(".scene5", { opacity: 0, duration: 0.5 }, 49.5);

        // Scene 6: 50-57s
        tl.to(".scene6", { opacity: 1, duration: 0.5 }, 50);
        tl.from(".scene6 .icon", { scale: 0, duration: 0.5, ease: "back.out(1.7)" }, 50.2);
        tl.from(".scene6 .btn-follow", { y: 30, opacity: 0, duration: 0.5 }, 51);
        tl.to(".scene6", { opacity: 0, duration: 0.5 }, 56.5);

        // Scene 7: 57-60s
        tl.to(".scene7", { opacity: 1, duration: 0.5 }, 57);
        tl.from(".scene7 .text-title", { y: 20, opacity: 0, duration: 0.5 }, 57.2);
        tl.to(".scene7", { opacity: 0, duration: 0.5 }, 59.5);

        // PENTING: Bekukan timeline agar tidak berjalan otomatis (mencegah desinkronisasi di CI)
        gsap.globalTimeline.pause();
        
        // Expose fungsi untuk menggeser waktu animasi dari Node.js
        window.setTime = function(t) {
            gsap.globalTimeline.time(t);
        };
    </script>
</body>
</html>
`;

(async () => {
    console.log('[INFO] Mempersiapkan direktori...');
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    console.log('[INFO] Meluncurkan Headless Browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Muat HTML dan tunggu hingga font/CDN selesai dimuat
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    console.log(`[INFO] Memulai capture ${totalFrames} frames pada ${fps} FPS...`);
    for (let i = 0; i < totalFrames; i++) {
        const t = i / fps;
        
        // Geser timeline GSAP ke waktu yang tepat secara deterministik
        await page.evaluate((time) => {
            window.setTime(time);
        }, t);
        
        const framePath = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`);
        await page.screenshot({ path: framePath, type: 'png' });
        
        if (i % 150 === 0) {
            console.log(`[PROGRESS] Frame ${i}/${totalFrames} (t=${t.toFixed(1)}s)`);
        }
    }
    
    await browser.close();
    
    console.log('[INFO] Encoding video dengan FFmpeg...');
    // Encode frames menjadi MP4 H.264
    const ffmpegCmd = `ffmpeg -y -framerate ${fps} -i ${framesDir}/frame_%05d.png -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 ${outputFile}`;
    
    try {
        execSync(ffmpegCmd, { stdio: 'inherit' });
        console.log(`[SUCCESS] Video berhasil dirender: ${outputFile}`);
    } catch (error) {
        console.error('[ERROR] FFmpeg gagal:', error);
        process.exit(1);
    }
    
    // Cleanup frames untuk menghemat space artifact
    console.log('[INFO] Membersihkan file frames...');
    fs.rmSync(framesDir, { recursive: true, force: true });
})();
