# 復旧スナップショットの出典・ライセンス

## 配信ファイルに含まれるライブラリ

元リポジトリの親コミット `2b2cfdccdfa6b1cd8194a42dc7df89282b0d4550` の `package-lock.json` には、以下のバージョンが記録されています。復旧した配信ファイルでもReact `19.2.8`、Three.js revision `180`、Lucideのコードを確認しています。以下の原文は、対応する公式npmパッケージから抽出したものです。配信ファイルは変更していません。

| パッケージ | バージョン | ライセンス原文 |
| --- | --- | --- |
| React | 19.2.8 | [MIT](licenses/react-19.2.8-LICENSE.txt) |
| React DOM | 19.2.8 | [MIT](licenses/react-dom-19.2.8-LICENSE.txt) |
| Scheduler | 0.27.0 | [MIT](licenses/scheduler-0.27.0-LICENSE.txt) |
| Three.js / OrbitControls | 0.180.0 | [MIT](licenses/three-0.180.0-LICENSE.txt) |
| Lucide React | 0.468.0 | [ISC（Feather由来部分の帰属表示を含む）](licenses/lucide-react-0.468.0-LICENSE.txt) |

取得URL・取得日・パッケージと原文のSHA-256は [licenses/sources.json](licenses/sources.json) に記録しています。開発依存関係は同梱の `package-lock.json` で固定しており、`npm ci` で取得する各パッケージにもライセンスが付属します。

## 地図データ

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)。地図データには [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) が適用されます。画面とPNGの帰属表示を元実装から保持しています。元の編集用データ・取得クエリ・再生成手順と詳細は、リポジトリ直下の [DATA-LICENSE.md](../../DATA-LICENSE.md) および `src/data/` に保持されています。

## 時刻表・運転日・祝日

- 駅時刻表・列車ごとの運転日：[JR東日本 東京駅時刻表](https://timetables.jreast.co.jp/timetable/list1039.html)。2026年9月号から取得・整形。各行の `source` と `dates` をJSONに保持しています。
- 祝日：[内閣府 国民の祝日](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html) の [CSV](https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv)。取得元URL・取得日時をJSONに保持しています。
- これらのデータにライブラリのMIT/ISCライセンスを適用しているわけではありません。元データの出典と提供元の利用条件を保持します。このスナップショットでは、時刻表データに新たなオープンライセンスを設定していません。

アプリ独自の実装・生成物について、この保存作業で新たなライセンスを設定していません。
