# DES Animation Renderer

This project generates a 240-second educational animation about the Data Encryption Standard (DES) as an MP4 video. It uses an HTML5 Canvas for the animation, Puppeteer to capture deterministic frames, and FFmpeg to encode the final video.

## Project Structure
- `index.html`: The single-page application containing the canvas and deterministic rendering logic.
- `scripts/render.js`: Node.js script that launches headless Chromium, captures 7200 frames at 30 fps, and encodes the MP4.
- `.github/workflows/render-des-video.yml`: GitHub Actions workflow to automate the rendering and artifact upload.

## Local Execution

### Prerequisites
- Node.js (v22 or higher recommended)
- FFmpeg installed and available in your system PATH

### Steps
1. Install dependencies:
```bash
   npm install
```
2. Run the render script:
```bash
   npm run render
```
3. The output video will be saved to `out/des-animation.mp4`.

## GitHub Actions Execution
The project includes a workflow that triggers on `workflow_dispatch` and pushes to the `main` branch. 
1. Go to the **Actions** tab in your GitHub repository.
2. Select **Render DES Animation**.
3. Click **Run workflow**.
4. Once completed, download the `des-animation-mp4` artifact from the workflow run summary.