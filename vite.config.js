import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
export default defineConfig({
  base: './',
  plugins: [{name:'release-provenance',apply:'build',generateBundle(){
    const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
    this.emitFile({type:'asset',fileName:'release.json',source:JSON.stringify({repository:'geeorgey/map-tokyo',gitCommit:git('rev-parse','HEAD'),dirty:Boolean(git('status','--porcelain')),builtAt:new Date().toISOString()},null,2)+'\n'});
  }}],
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], react: ['react','react-dom'] } } } },
});
