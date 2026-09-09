# train.lvnsk.jp の計測設定

2026-09-09 に既存アカウント内へ追加。

| サービス | 設定 |
| --- | --- |
| GA4 アカウント | LVNSK / 386743347 |
| GA4 プロパティ | train.lvnsk.jp / 553396987 |
| ウェブストリーム | 東京鉄道景 — train.lvnsk.jp / 15743581506 |
| 測定 ID | G-DKM4M2PE9Q |
| レポート | 日本時間 / 日本円 |
| GTM アカウント | リバネスナレッジ / 6054886111 |
| GTM コンテナ | train.lvnsk.jp / 263589093 / GTM-K7R2RWQC |
| GTM 公開バージョン | 2 / Initial GA4 — train.lvnsk.jp |
| Search Console | https://train.lvnsk.jp/ の URL プレフィックス |

GTM の Google タグを `Initialization - All Pages` で配信する。
GA4 の拡張計測は有効。Google タグを直接重ねて設置しない。
Search Console の確認メタタグは `index.html` に保持する。
`public/sitemap.xml` に公開トップページを記載し、`public/robots.txt` から参照する。

GA の初期レポート目的はトラフィック分析とユーザーエンゲージメント。
業種はサイト内容に合わせてアート・エンターテインメント、規模は小規模で初期設定。
広告サービスへのリンク、Google シグナル、Measurement Protocol の秘密鍵は追加していない。

公開後の確認結果は `analytics-verification.json` に記録する。
