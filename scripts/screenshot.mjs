/**
 * ヘッドレスブラウザでゲームを起動してスクリーンショットを撮る。
 *
 * 3D の見た目はユニットテストでは検証できない。ゴーストが積みに隠れていないか、
 * ピースの色が見分けられるか、狭い画面でパネルが被らないか——といった確認に使う。
 *
 *   npm run dev                 # 別ターミナルで先に起動しておく
 *   npm run shot
 *   npm run shot -- --keys "ArrowLeft,ArrowLeft,Space" --width 1000 --height 700
 *   npm run shot -- --url http://localhost:5173 --out tmp/gameover.png
 */
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { chromium } from 'playwright';

function parseArgs(argv) {
  const options = {
    url: 'http://localhost:5173/',
    out: 'tmp/shot.png',
    width: 1280,
    height: 860,
    keys: '',
    wait: 800,
    gap: 80,
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    if (!(key in options)) throw new Error(`不明なオプション: ${argv[i]}`);
    options[key] = typeof options[key] === 'number' ? Number(value) : value;
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
await mkdir(dirname(options.out), { recursive: true });

// SwiftShader を明示しないと、GPU の無い環境で WebGL が初期化できない。
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: options.width, height: options.height },
});

const problems = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    problems.push(`[${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));

try {
  await page.goto(options.url, { waitUntil: 'networkidle' });
} catch {
  console.error(`${options.url} に接続できません。先に npm run dev を起動してください。`);
  await browser.close();
  process.exit(1);
}

await page.waitForTimeout(400);

for (const key of options.keys.split(',').filter(Boolean)) {
  await page.keyboard.press(key.trim());
  await page.waitForTimeout(options.gap);
}

await page.waitForTimeout(options.wait);

const canvas = await page.evaluate(() => {
  const element = document.querySelector('canvas');
  if (!element) return 'canvas がない';
  const context = element.getContext('webgl2') ?? element.getContext('webgl');
  return context ? `${element.width}x${element.height}` : 'WebGL コンテキストがない';
});

await page.screenshot({ path: options.out });

console.log(`canvas   : ${canvas}`);
console.log(`stats    : ${(await page.locator('#stats').innerText()).replace(/\n/g, ' | ')}`);
console.log(`保存先   : ${options.out}`);
console.log(`エラー   : ${problems.length ? `\n  ${problems.join('\n  ')}` : 'なし'}`);

await browser.close();
process.exit(problems.length > 0 ? 1 : 0);
