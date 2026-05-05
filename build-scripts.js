import esbuild from 'esbuild';
import dotenv from 'dotenv';

dotenv.config();

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
