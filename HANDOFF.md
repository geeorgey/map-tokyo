# 東京鉄道景・リモート引き継ぎ

更新日: 2026-09-09。引き継ぎ先は飯田橋の Mac。

## 正本と現在地

- リポジトリ: https://github.com/geeorgey/map-tokyo.git
- デフォルトブランチ: `codex/unify-tokyo`（`main` ではない）。必ず fetch して最新を確認する。
- 引き継ぎ前の最新コミット: `d2968cd803c3cc51b84dceb7d9e8e5a083f510c8`。
- 公開中のソース: `c99e4733853aedc42db211db828d7b0ff14fbd1c`。後続コミットは検証文書の更新。
- 公開 URL: https://train.lvnsk.jp/
- Cloudflare Worker: `tokyo-railway-diorama`。
- 公開 Version ID: `3f10c7a8-5c73-444c-b9a3-9a29bbcb5c7c`。
- Cloudflare アカウント: `dd4e70f6e77582fb6206a57ea20c0642`。認証はリモートで確認し、秘密情報を会話や Git にコピーしない。

## 完了している機能

東京駅周辺の編集可能な Three.js ジオラマ、視点切替、新幹線追従、車両詳細、
昼・夕・夜、約90秒で巡る「光の移ろい」、PNG保存。
日本時間の実時間時計、日時指定、0.5〜300倍速、一時停止、現在時刻への復帰。
公式時刻表に合わせた発車、平日・土休日・運転日限定列車、午前3時の運行日境界。
遅延・運休・実測位置は取得しない。入線・停車時間、番線、車両形式は簡略化している。

9月6日に別Macで実装した時計・時刻表を9月8日の旧ソース公開で一度上書きしたが、
その後本リポジトリへ統合して復旧済み。
`recovery/realtime-2026-09-06/` は原本保存用であり、公開元にしてはいけない。
古い `/Users/geeorgey/Desktop/dev/train.lvnsk.jp` が存在する場合も、変更を保全し、
この GitHub の最新ソースへ移ってから作業する。

## 計測設定（9月9日公開・検証済み）

- GA4: LVNSK `386743347` / プロパティ `553396987` / ストリーム `15743581506` / `G-DKM4M2PE9Q`。
- GTM: リバネスナレッジ `6054886111` / コンテナ `263589093` / `GTM-K7R2RWQC`、公開バージョン2。
- GTMの Google タグを Initialization - All Pages で配信。GAタグの直書きを重ねない。
- Search Console: `https://train.lvnsk.jp/` のURLプレフィックス。HTMLメタタグで所有権確認済み。
- サイトマップ送信成功・1ページ検出。GA4とのリンク作成済み。
- 公開ブラウザで GTM/gtag HTTP200、page_view 一回送信・HTTP204、GAリアルタイムの受信を確認。
- `robots.txt` には既存のCloudflare管理ルールが前置される。オリジン側の内容は保持されている。

詳細は `docs/analytics-setup.md`、`docs/analytics-verification.json`、
`docs/deployment-verification.json`、`docs/release-history.md` を参照。
Google管理画面のブラウザセッションはローカル側なので、必要時にリモートのログイン状態を確認する。

## 開発・確認・公開

まずルート `AGENTS.md` と `README.md` を読む。
Node.js は `.nvmrc` の24を使う。システムNode20では現行Wranglerが動かない。

```sh
npm ci
npm test
npm run dev:worker
```

`dev:worker` は http://127.0.0.1:4180/ で時刻表API込み。
`npm run dev` はViteのみ。直近の自動テストは24件成功。
変更時は今回の変更に合う確認と実画面確認を行う。
公開は認証確認、build/dry-run、ソースのcommit/push後に実行する。
`npm run deploy` の事前チェックは未コミット変更とリモートのデフォルトブランチHEAD不一致を拒否する。
公開ソースのSHAは `/release.json` でも確認できる。

## 引き継ぎ時に行うこと

1. 飯田橋で既存checkoutと未コミット変更を確認・保全する。
2. 最新GitHubソースを取得してこの文書を読める状態にする。
3. Node24で依存関係・テスト・ビルドを確認し、続行するcheckoutとcommitを報告する。
4. 既存依頼は完了済み。引き継ぎ確認のために再デプロイや新機能追加をする必要はない。

今後はこのリモートcheckoutとGitHubを基準に継続する。ローカルの旧コピーから公開しない。
