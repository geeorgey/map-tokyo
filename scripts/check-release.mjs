import {execFileSync} from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
try{
  if(git('status','--porcelain'))throw new Error('未コミットの変更があります。確認してコミットしてから公開してください。');
  const remote=git('remote','get-url','origin');
  if(!/github\.com[:/]geeorgey\/map-tokyo(?:\.git)?$/.test(remote))throw new Error('正本のmap-tokyoリポジトリから公開してください。');
  const head=git('rev-parse','HEAD');
  const publishedBranch=git('ls-remote','origin','HEAD').split(/\s+/)[0];
  if(head!==publishedBranch)throw new Error('現在のコミットがGitHubのデフォルトブランチと異なります。最新状態を取得・統合・pushしてから公開してください。');
  console.log(`公開元を確認: geeorgey/map-tokyo @ ${head}`);
}catch(error){console.error(error.message);process.exit(1);}
