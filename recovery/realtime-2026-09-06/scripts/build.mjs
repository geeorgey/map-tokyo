import { build } from 'esbuild';
import { mkdir, cp, writeFile, readFile, rm } from 'node:fs/promises';
import { validateTimetable } from '../src/timetable.mjs';

validateTimetable(JSON.parse(await readFile(new URL('../public/data/timetable.json', import.meta.url))));
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
const result = await build({
  entryPoints: ['src/App.jsx'], outdir: 'dist/assets', bundle: true,
  format: 'esm', minify: true, metafile: true, entryNames: 'app-[hash]',
  jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment',
  target: ['es2022'], legalComments: 'eof', logLevel: 'info',
});
const outputs = Object.entries(result.metafile.outputs);
const script = outputs.find(([, value]) => value.entryPoint)?.[0].replace('dist/', '/');
const css = outputs.find(([name]) => name.endsWith('.css'))?.[0].replace('dist/', '/');
await writeFile('dist/index.html', `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link rel="icon" href="data:,"><meta name="theme-color" content="#b7cbd0"><meta name="description" content="東京駅の3Dジオラマ。日本時間の時計と公式時刻表で、列車の発車を眺める。日付・速度を変えて東京の一日を再現できます。"><title>東京鉄道景 — Tokyo Railway Diorama</title><link rel="stylesheet" href="${css}"><script type="module" src="${script}"></script></head><body><div id="root"></div></body></html>\n`);
