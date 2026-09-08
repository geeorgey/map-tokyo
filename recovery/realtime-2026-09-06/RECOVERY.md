# 2026年9月6日版・時計と時刻表の復旧用スナップショット

2026年9月8日、完成済みの時計・時刻表実装を履歴に保存したものです。既存の編集用ソースを保持するため、リポジトリ直下のファイルは変更していません。保存時の親コミットは `2b2cfdccdfa6b1cd8194a42dc7df89282b0d4550`（`codex/unify-tokyo`）です。

このディレクトリの27個の元ファイルは、9月6日版のローカル成果物とバイト単位で同一です。対応するSHA-256は [snapshot-manifest.json](snapshot-manifest.json) に記録しています。追加したものはこの復旧案内、出典・ライセンス案内、ライセンス原文、チェックサムだけです。`node_modules`、`dist`、`.wrangler`、認証情報、ローカルログは保存していません。

[README.md](README.md) は9月6日時点の記録をそのまま保持しています。そこに記載された公開バージョンと動作確認結果は過去の結果であり、現在の本番状態を示すものではありません。この保存作業ではデプロイしていません。

## 統合時に再利用するファイル

| ファイル | 内容 |
| --- | --- |
| `src/clock.mjs` | JSTの日時変換、午前3時の運行日境界、実時間・シミュレーション時計、0.5〜300倍速、停止・日時指定 |
| `src/timetable.mjs` | 7路線の定義、公式駅時刻表・運転日カレンダーの解析、データ検証 |
| `src/schedule.mjs` | 平日・土休日・指定運転日の発車イベント生成、代表線路上の列車状態 |
| `src/load-timetable.mjs` | 月ごとの時刻表・運行カレンダーの取得。全データ検証後に切り替え |
| `src/worker.mjs` | `/api/station`、`/api/calendars`、`/api/holidays` とキャッシュ・入力検証 |
| `src/diorama.mjs` | 既存描画の時計・ダイヤ接続部分。統合先の編集用エンジンへ移植する際の参考 |
| `src/App.jsx`、`src/style.css` | 日時・速度・一時停止・現在時刻復帰・時刻表・モバイル操作 |
| `public/data/timetable.json` | 2026年9月の時刻表、運転日、祝日、出典URLを含む取得済みデータ |
| `scripts/import-timetable.mjs` | 時刻表と運転日をまとめて取得し、完全性を確認して保存 |
| `test/*.test.mjs` | 時計、日付境界、平日・土休日・指定運転日、発車挙動の既存テスト |

`clock.mjs`、`timetable.mjs`、`schedule.mjs`、`load-timetable.mjs`、`worker.mjs` はvendorを直接importしません。`diorama.mjs` と `App.jsx` は [vendor/scene-runtime.js](vendor/scene-runtime.js) に依存します。統合先には元の編集用エンジンがあるため、この接続部分を移植して使えます。9月8日に追加された光の移ろいは、この9月6日版には含まれません。

`vendor/deployed/` は当時公開されていた配信ファイルの原本です。元の取得日時・Workerバージョン・SHA-256は [vendor/deployed-manifest.json](vendor/deployed-manifest.json) にあります。`vendor/scene-runtime.js` はその原本の自動マウントを外して描画部品をexportしたものです。原本は比較・再構成のため保持しています。

## ローカルでの再現

このディレクトリへ移動してNode.js 22以上で実行します。

```sh
npm ci
npm test
npm run build
npx wrangler dev --ip 127.0.0.1 --port 4180
```

同梱された `wrangler.jsonc` と `npm run deploy` は当時の本番設定です。上記の確認にはデプロイ不要です。今回の依頼範囲は復旧ブランチへの履歴保存のみです。

2026年9月8日の保存時には、新規の `npm ci`、既存テスト7件、ビルドが成功しました。元ファイル27件・配信原本5件のSHA-256一致を確認し、保存対象36件を認証情報の既知形式で走査して検出0件でした。アプリの機能変更はなく、ブラウザ・本番への再検証や時刻表の再取得は行っていません。

発車時刻の再現であり、遅延・運休・実測位置は含みません。代表線路・車両と入線・停車演出の制約は元のREADMEを参照してください。データとライブラリの帰属表示は [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) に整理しています。
