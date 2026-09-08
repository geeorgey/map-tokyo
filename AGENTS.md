# 東京鉄道景の作業方針

## 正本と履歴
- 正本は https://github.com/geeorgey/map-tokyo 。別のMacやタスクでも、このリポジトリを取得してから変更する。
- 作業開始時に `git status --short --branch`、`git worktree list`、`git fetch origin` を確認する。進行中の変更を破棄しない。
- 作業ブランチには `codex/` を使い、必要なworktreeは `/Users/geeorgey/.codex/worktrees/map-tokyo/` 配下へ作る。
- 意味のある変更ごとにコミットする。公開時のコミットSHAとCloudflare Version IDを記録する。
- 公開ファイルから別プロジェクトを作って上書きしない。別環境の未統合変更を確認してから公開する。

## 保持する機能
- 日本時間の日時、日時指定、速度変更、一時停止、現在時刻への復帰。
- 公式時刻表に基づく発車、平日・土休日・運転日指定、午前3時の運行日境界。
- 編集可能なThree.jsの駅舎・道路・建物・車両モデル、新幹線追従、昼・夕・夜、光の移ろい、PNG保存。
- 時刻表再現と実測運行情報を混同しない。遅延・運休・実際の列車位置を取得していない場合は明記する。

## 確認と公開
- Node.jsは `.nvmrc` を使用。`npm ci`、`npm test`、`npm run build`。
- 画面で時計、日付移動、発車、追従、光の移ろい、モバイル表示を確認する。
- Cloudflareの認証・Worker・既存カスタムドメインを確認し、dry-run後に公開する。
- 公開後に日時表示、時刻表API、静的ファイルとビルドの一致を確認する。
- 秘密情報、`.env`、`.dev.vars`、`.wrangler`、`node_modules` はコミットしない。
