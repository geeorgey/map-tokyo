# 東京鉄道景

公開先: https://train.lvnsk.jp

2026-09-06 公開バージョン: `9c1d65d7-0fd5-40f1-bda9-8f784fe0065e`。本番URLで時計・60倍速・発車・深夜・祝日・日時移動・車両詳細・PNG保存・スマートフォン表示・再読み込みを確認済み。JavaScript/consoleエラー0件。単体テスト7件合格。時刻表取得APIの駅時刻表・運行カレンダー・祝日を本番でも確認しました。

日本時間の実時間時計、0.5〜300倍速、停止・再開、日時指定、現在時刻への復帰に対応。昼・夕・夜は時計から独立した景観設定です。

## 引き継ぎ元

2026-09-06 に公開されていた Cloudflare Worker `tokyo-railway-diorama` のバージョン `053d20fe-18a9-499a-96d1-6f7114fe18c6` を基にしています。元タスクの編集用ソースはこのMac上で特定できなかったため、公開配信ファイルを保存して既存の3D景観・車両モデルを再利用しています。

- `vendor/deployed/`: 配信ファイルの原本。SHA-256 は `vendor/deployed-manifest.json`。
- `vendor/scene-runtime.js`: 原本の自動マウントを外し、描画クラス等を export したモジュール。3Dモデルの形状は変更していません。
- `src/App.jsx`, `src/style.css`: 編集可能な画面・時計の操作。
- `src/clock.mjs`, `src/schedule.mjs`, `src/diorama.mjs`: 時計・ダイヤ・描画の接続。
- `src/worker.mjs`, `src/load-timetable.mjs`: 別の月を選んだ際の公式時刻表取得。

## 時刻表と再現範囲

初期データは JR東日本掲載の2026年9月号。中央線快速、京浜東北線北行、山手線外回り、東海道線南行、上越新幹線、北陸新幹線、東海道・山陽新幹線を収録しています。平日と土休日を区別し、内閣府の祝日データを使用。運転日限定列車330件のカレンダーを取得して日付で絞り込んでいます。

午前3時より前は前日の運行分です。例: 土曜00:46の列車は金曜の平日ダイヤに属します。別の月は Cloudflare から公式サイトの掲載内容と運行日を取得し、未掲載・取得失敗の場合は列車を表示しません。取得途中の不完全なダイヤは使用しません。APIキャッシュは通常6時間、祝日24時間、取得失敗5分です。新しいデータベース・有料API・定期ジョブは使っていません。

発車時刻の再現であり、遅延・運休・実測の列車位置は取得していません。既存モデルの6本の代表線路を使い、正確な番線・車両形式の再現は対象外です。入線・停車時間は演出です。同じ代表線路の列車が重なる場合は発車直後の列車を優先します。

出典:
- https://timetables.jreast.co.jp/timetable/list1039.html
- https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv
- 地図: OpenStreetMap / ODbL（元アプリの画面・PNGクレジットを維持）

## 開発・確認・公開

Node.js 22以上を使用します。

```sh
nvm use
npm ci
npm test
npm run build
npx wrangler dev --ip 127.0.0.1 --port 4180
```

同梱データを更新する場合（全ページと運行日を検証してから置き換えます）:

```sh
npm run timetable -- 2026-09 --fresh
```

デプロイ前に `npm test` と `npm run build`、ブラウザで時計・発車・日時変更を確認します。既存アカウント `dd4e70f6e77582fb6206a57ea20c0642`、既存Worker・カスタムドメインを使用し、workers.devとプレビューURLは既存どおり無効です。

```sh
npx wrangler deploy --dry-run
npx wrangler deploy
```

引き継ぎ前のバージョンへ戻す場合:

```sh
npx wrangler rollback 053d20fe-18a9-499a-96d1-6f7114fe18c6
```
