// PART 2A — 0s–60s
// Title card, AZRIEL intro, IBM/Lucifer history, start of FIPS PUB 46

(function() {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    
    const startTime = Date.now();
    const DURATION = 60000; // 60 seconds
    
    // Color palette
    const COLORS = {
        bg: '#0D0208',
        green: '#00FF41',
        greenDark: '#008F11',
        greenDarker: '#003B00',
        white: '#FFFFFF',
        accent: '#00AA2A'
    };
    
    // Matrix rain
    class MatrixRain {
        constructor() {
            this.columns = Math.floor(canvas.width / 14);
            this.drops = new Array(this.columns).fill(0).map(() => ({
                y: Math.random() * canvas.height,
                speed: Math.random() * 3 + 1,
                opacity: Math.random() * 0.3 + 0.1
            }));
            this.chars = '01';
        }
        
        update() {
            this.drops.forEach(drop => {
                drop.y += drop.speed;
                if (drop.y > canvas.height) {
                    drop.y = 0;
                    drop.speed = Math.random() * 3 + 1;
                }
            });
        }
        
        draw() {
            ctx.fillStyle = 'rgba(13, 2, 8, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.font = '14px monospace';
            this.drops.forEach((drop, i) => {
                const char = this.chars[Math.floor(Math.random() * this.chars.length)];
                const x = i * 14;
                ctx.fillStyle = `rgba(0, 255, 65, ${drop.opacity})`;
                ctx.fillText(char, x, drop.y);
            });
        }
    }
    
    // AZRIEL character
    class Azriel {
        constructor() {
            this.x = canvas.width / 2;
            this.y = canvas.height / 2;
            this.waveAngle = 0;
            this.scale = 1;
        }
        
        draw(x, y, scale = 1, wave = false, thumbsUp = false) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);
            
            // Body
            ctx.fillStyle = COLORS.greenDark;
            ctx.fillRect(-30, 50, 60, 80);
            
            // Head
            ctx.fillStyle = '#FFE0B2';
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI * 2);
            ctx.fill();
            
            // Hair
            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.arc(0, -10, 50, Math.PI, 0);
            ctx.fill();
            
            // Eyes
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(-15, 0, 5, 0, Math.PI * 2);
            ctx.arc(15, 0, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // Smile
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 10, 20, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
            
            // Arms
            ctx.strokeStyle = '#FFE0B2';
            ctx.lineWidth = 15;
            ctx.lineCap = 'round';
            
            if (wave) {
                this.waveAngle = Math.sin(Date.now() * 0.005) * 0.3;
                ctx.beginPath();
                ctx.moveTo(-30, 60);
                ctx.lineTo(-30 - Math.cos(this.waveAngle) * 40, 60 - Math.sin(this.waveAngle) * 40);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(-30, 60);
                ctx.lineTo(-70, 90);
                ctx.stroke();
            }
            
            if (thumbsUp) {
                ctx.beginPath();
                ctx.moveTo(30, 60);
                ctx.lineTo(70, 40);
                ctx.stroke();
                ctx.fillStyle = '#FFE0B2';
                ctx.beginPath();
                ctx.arc(70, 40, 10, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(30, 60);
                ctx.lineTo(70, 90);
                ctx.stroke();
            }
            
            // Legs
            ctx.strokeStyle = '#FFE0B2';
            ctx.lineWidth = 15;
            ctx.beginPath();
            ctx.moveTo(-15, 130);
            ctx.lineTo(-15, 180);
            ctx.moveTo(15, 130);
            ctx.lineTo(15, 180);
            ctx.stroke();
            
            ctx.restore();
        }
    }
    
    const matrixRain = new MatrixRain();
    const azriel = new Azriel();
    
    // Draw watermarks
    function drawWatermarks() {
        ctx.fillStyle = 'rgba(0, 255, 65, 0.3)';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('AI Gabut', canvas.width - 20, 40);
        
        ctx.textAlign = 'left';
        ctx.fillText('AXION Neuralis', 20, 40);
    }
    
    // Draw glowing text
    function drawGlowText(text, x, y, size, color = COLORS.green) {
        ctx.save();
        ctx.font = `bold ${size}px Arial`;
        ctx.textAlign = 'center';
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }
    
    // Draw digital padlock
    function drawPadlock(x, y, size) {
        ctx.save();
        ctx.translate(x, y);
        
        // Lock body
        ctx.fillStyle = COLORS.greenDark;
        ctx.fillRect(-size/2, 0, size, size);
        
        // Lock shackle
        ctx.strokeStyle = COLORS.green;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, size/2, Math.PI, 0);
        ctx.stroke();
        
        // Keyhole
        ctx.fillStyle = COLORS.bg;
        ctx.beginPath();
        ctx.arc(0, size/3, size/6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-size/12, size/3, size/6, size/3);
        
        ctx.restore();
    }
    
    function animate() {
        const elapsed = Date.now() - startTime;
        const time = elapsed / 1000; // Convert to seconds
        
        // Clear with matrix rain
        matrixRain.update();
        matrixRain.draw();
        
        // Scene 1: Title card (0-3s)
        if (time >= 0 && time < 3) {
            const fadeIn = Math.min(1, time);
            ctx.save();
            ctx.globalAlpha = fadeIn;
            
            drawPadlock(canvas.width / 2, canvas.height / 2 - 100, 80);
            drawGlowText('Part 2: Jenis-Jenis Enkripsi', canvas.width / 2, canvas.height / 2 + 50, 60);
            drawGlowText('DES', canvas.width / 2, canvas.height / 2 + 150, 120);
            drawGlowText('@random.ai.id', canvas.width / 2, canvas.height / 2 + 250, 30);
            
            ctx.restore();
        }
        
        // Scene 2: AZRIEL intro (3-20s)
        if (time >= 3 && time < 20) {
            const sceneTime = time - 3;
            const slideIn = Math.min(1, sceneTime / 0.5);
            const slideX = canvas.width / 2 + (1 - slideIn) * 500;
            
            azriel.draw(slideX, canvas.height / 2, 2.5, sceneTime > 1 && sceneTime < 5);
            
            drawGlowText('AZRIEL', canvas.width / 2, 200, 80);
            drawGlowText('@random.ai.id', canvas.width / 2, 300, 40);
            drawGlowText('AI Gabut', canvas.width / 2 + 400, 300, 40);
            
            if (sceneTime > 3) {
                ctx.save();
                ctx.globalAlpha = Math.min(1, (sceneTime - 3) / 0.5);
                drawGlowText('Fokus: DES (Data Encryption Standard)', canvas.width / 2, 800, 50);
                ctx.restore();
            }
        }
        
        // Scene 3: IBM/Lucifer history (20-45s)
        if (time >= 20 && time < 45) {
            const sceneTime = time - 20;
            
            azriel.draw(canvas.width - 300, canvas.height / 2, 2);
            
            // Timeline
            ctx.strokeStyle = COLORS.green;
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(200, canvas.height / 2);
            ctx.lineTo(1200, canvas.height / 2);
            ctx.stroke();
            
            // 1970s marker
            const marker1Alpha = sceneTime < 5 ? sceneTime / 5 : 1;
            ctx.save();
            ctx.globalAlpha = marker1Alpha;
            ctx.fillStyle = COLORS.green;
            ctx.beginPath();
            ctx.arc(400, canvas.height / 2, 20, 0, Math.PI * 2);
            ctx.fill();
            drawGlowText('1970-an', 400, canvas.height / 2 - 80, 50);
            
            // IBM
            if (sceneTime > 3) {
                ctx.fillStyle = COLORS.greenDark;
                ctx.fillRect(350, canvas.height / 2 + 40, 100, 60);
                drawGlowText('IBM', 400, canvas.height / 2 + 80, 40);
            }
            
            // Horst Feistel
            if (sceneTime > 8) {
                const alpha = Math.min(1, (sceneTime - 8) / 2);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = COLORS.green;
                ctx.beginPath();
                ctx.arc(600, canvas.height / 2, 20, 0, Math.PI * 2);
                ctx.fill();
                drawGlowText('Horst Feistel', 600, canvas.height / 2 - 80, 50);
            }
            
            // Lucifer
            if (sceneTime > 13) {
                const alpha = Math.min(1, (sceneTime - 13) / 2);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = COLORS.green;
                ctx.beginPath();
                ctx.arc(800, canvas.height / 2, 20, 0, Math.PI * 2);
                ctx.fill();
                drawGlowText('Lucifer', 800, canvas.height / 2 - 80, 50);
                drawGlowText('Desain Awal', 800, canvas.height / 2 + 100, 30);
            }
            
            ctx.restore();
        }
        
        // Scene 4: FIPS PUB 46 start (45-60s)
        if (time >= 45 && time < 60) {
            const sceneTime = time - 45;
            
            azriel.draw(canvas.width - 300, canvas.height / 2, 2);
            
            // Document animation
            const docY = canvas.height / 2 - 100 + Math.sin(sceneTime * 2) * 10;
            ctx.fillStyle = COLORS.greenDark;
            ctx.fillRect(canvas.width / 2 - 200, docY - 150, 400, 500);
            
            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(canvas.width / 2 - 180, docY - 130, 360, 460);
            
            drawGlowText('FIPS PUB 46', canvas.width / 2, docY - 50, 60);
            
            if (sceneTime > 3) {
                const alpha = Math.min(1, (sceneTime - 3) / 1);
                ctx.save();
                ctx.globalAlpha = alpha;
                drawGlowText('Januari 1977', canvas.width / 2, docY + 50, 50);
                ctx.restore();
            }
            
            if (sceneTime > 6) {
                const alpha = Math.min(1, (sceneTime - 6) / 1);
                ctx.save();
                ctx.globalAlpha = alpha;
                drawGlowText('NBS + NSA', canvas.width / 2, docY + 150, 40);
                drawGlowText('Standar Federal', canvas.width / 2, docY + 250, 35);
                ctx.restore();
            }
            
            if (sceneTime > 10) {
                const alpha = Math.min(1, (sceneTime - 10) / 1);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = COLORS.green;
                ctx.lineWidth = 5;
                ctx.setLineDash([10, 5]);
                ctx.strokeRect(canvas.width / 2 - 250, docY - 150, 500, 500);
                drawGlowText('Kontroversi Kunci', canvas.width / 2, docY + 350, 40);
                ctx.restore();
            }
        }
        
        drawWatermarks();
        
        if (elapsed < DURATION) {
            requestAnimationFrame(animate);
        } else {
            // Fade out
            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }
    
    animate();
})();
