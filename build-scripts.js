import esbuild from 'esbuild';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.VITE_GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ ERROR: VITE_GEMINI_API_KEY not found in .env file.');
  process.exit(1);
}

try {
  await esbuild.build({
    entryPoints: ['src/background.ts', 'src/content.ts'],
    bundle: true,
    outdir: 'dist',
    minify: true,
    platform: 'browser',
  });
  console.log('✅ Extension scripts built successfully.');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
