# 地図データとライセンス

`src/data/tokyo-map.json` は © OpenStreetMap contributors の派生データベースです。[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) に基づき提供しています。[OpenStreetMap の著作権とライセンス](https://www.openstreetmap.org/copyright)を参照してください。このデータの公開・再配布には同ライセンスの条件が適用されます。

- ソースのスナップショット時刻：2026-09-04T22:32:39Z
- 取得先：Overpass API (`https://overpass-api.de/api/interpreter`)
- 範囲：東京駅中心、駅舎の軸に合わせた約1.46 × 1.71 km
- 元のOSM要素ID、形状、高さ・幅の出典はJSON内に保持しています。
- Google Mapsの航空写真はブラウザでの目視確認に使用。画像・タイル・Googleの3Dモデルは取り込んでいません。
- 画面と書き出すPNGには帰属表記を付けています。

## 再生成

Python環境にShapelyが必要です。プロジェクト直下で実行します。最新データを取得するため、元スナップショットと結果が変わる場合があります。

```sh
python3 -m venv work/geo-venv
work/geo-venv/bin/pip install shapely
mkdir -p work/geodata
curl --fail --data-urlencode data@scripts/query.overpass https://overpass-api.de/api/interpreter -o work/geodata/tokyo-osm.json
curl --fail --data-urlencode data@scripts/relations.overpass https://overpass-api.de/api/interpreter -o work/geodata/relations.json
work/geo-venv/bin/python scripts/prepare-map.py work/geodata/tokyo-osm.json work/geodata/relations.json src/data/tokyo-map.json
npm run build
```

データを変更する場合も、帰属表示と出典の記録を保持してください。アプリの実行時に地図サービスへの接続やAPIキーは必要ありません。

## ホームデータ

`src/data/tokyo-platforms.json` もOpenStreetMapに基づく派生データベース（ODbL 1.0）です。元のホーム輪郭、描画用の輪郭、補正面積、番線、軌間を記録。ホームデータの取得クエリは `scripts/platforms.overpass` です。

```sh
curl --fail --data-urlencode data@scripts/platforms.overpass https://overpass-api.de/api/interpreter -o work/geodata/platforms.json
work/geo-venv/bin/python scripts/prepare-platforms.py work/geodata/platforms.json src/data/tokyo-map.json work/geodata/tokyo-osm.json src/data/tokyo-platforms.json
```

`prepare-map.py` で街のデータを更新した後は、同じスナップショットのデータでホームも再生成してください。屋根・柱・中央線の高低差は描画用の推定で、実測資料ではありません。
