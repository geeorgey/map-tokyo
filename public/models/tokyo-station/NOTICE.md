# 東京駅丸の内駅舎 3Dモデルの出典

出典：3D都市モデル（Project PLATEAU）千代田区（2025年度）（東京都）を加工して作成。

- データセット：https://www.geospatial.jp/ckan/dataset/plateau-13101-chiyoda-ku-2025
- 利用条件：https://www.mlit.go.jp/plateau/site-policy/ （公共データ利用規約 PDL1.0。CC BY 4.0 互換）
- 加工：駅舎1棟の抽出、Draco展開、座標軸・地盤高の変換。形状・写真テクスチャは元データ由来。
- 配置・夜間照明は本アプリ独自の表現。国土交通省・東京都による制作物または公式な駅舎復元図ではありません。
- 写真には撮影時の影・工事用足場が含まれます。2025年度版というデータの名称は、現在の駅舎外観を保証しません。

抽出元・feature ID・ハッシュは manifest.json。再抽出：上記公開ZIP内の sourceEntry を取得し、`node scripts/import-station.cjs /path/to/data446.b3dm`。
