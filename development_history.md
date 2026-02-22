# AR Bus Navigation App - Development History & Technical Summary

このドキュメントは、プロジェクト開始から現在（MapLibre版ミニマップ完成・GitHub Pages公開）までの開発フロー、実装された技術、遭遇した問題点とその解決策をまとめたものです。

## 1. プロジェクト初期化と基盤構築
### 技術スタック
- **Framework**: React (Vite) + TypeScript
- **Runtime**: Capacitor (Android)
- **AR View**: Three.js (`@react-three/fiber`, `@react-three/drei`)
- **State Management**: React Hooks (useState, useEffect, useContext)

### 実装内容
- Viteプロジェクトの作成とCapacitorの初期設定。
- `navigator.mediaDevices.getUserMedia` を使用したカメラフィードの背景表示。
- CSSでの全画面表示レイアウト作成。

## 2. 位置情報とセンサーフュージョンの実装
### 課題: GPSの不安定さと方位のズレ
- 生のGPSデータは飛び値が多く、AR表示がガタつく。
- デバイスコンパス（地磁気センサー）はノイズに弱く、不安定。

### 解決策: Sensor Fusion & Kalman Filter
- **Kalman Filter**: 2次元カルマンフィルタ (`KalmanFilter.ts`) を実装し、GPS座標のノイズを除去して滑らかな移動軌跡を実現。
- **Sensor Fusion Hook** (`useSensorFusion.ts`):
  - GPS座標と加速度・ジャイロセンサーを統合。
  - **EMA (Exponential Moving Average)** フィルタを用いて、コンパス方位の微細な振動を平滑化。
  - Android/iOSの差異（`deviceorientationabsolute` vs `webkitCompassHeading`）を吸収するロジックを実装。

## 3. ARナビゲーション機能の実装
### 実装機能
- **3D矢印**: 次のウェイポイントを示す3D矢印モデルを表示。
- **座標変換**: GPS座標 (Latitude, Longitude) を Three.js のワールド座標 (x, y, z) に変換するロジック (`geoUtils.ts`) を実装。
  - ヒュベニの公式や球面三角法を用いた距離・方位計算。
- **Heading Up**: ユーザーの向いている方向が常に画面奥（Z軸マイナス）になるように、AR空間全体を回転させるアプローチを採用。

## 4. UI/UXデザインの刷新
### コンセプト: "Modern Yellow Accent"
- **配色**: 黒背景に鮮やかな黄色 (#FFC107) をアクセントに使用。
- **レイアウト**:
  - 全画面ARビュー。
  - 左上に「β」バッジ。
  - 下部に横スクロール可能なカード型UI（次のバス停、曲がり角情報を表示）。
  - 右下にミニマップ。

### 実装
- **CSS Modules**: `index.css` に変数ベースのデザインシステムを構築。
- **SVG Icons**: ナビゲーション指示（右折、左折、直進）のアイコンコンポーネント化。

## 5. ミニマップの進化
### Phase 1: SVG簡易マップ
- 初めはSVGでルート線を描画する簡易的なものを実装。
- **問題点**: 縮尺が固定で分かりにくい、自分の方位とマップの回転が同期していない。

### Phase 2: MapLibre GL JS + OSM (現在の実装)
- **MapLibre GL JS** を導入し、OpenStreetMap (OSM) のラスタタイルを使用。
- **完全無料構成**: APIキー不要のOSMタイルサーバーを利用。
- **Heading Up Rotation**: `map.easeTo({ bearing: userHeading })` により、スマホの回転に合わせて地図が滑らかに回転する機能を実装。
- **Dark Mode Hack**: CSSの `filter: invert(100%) hue-rotate(180deg)` をCanvasに適用し、**無料でダークモード地図**を実現。
- **ユーザーマーカー**: 地図が回転しても、マーカー（矢印）は常に画面上方を向くように `rotationAlignment: 'viewport'` を設定。

## 6. ARランドマーク機能
- **機能**: Unipol, Otago Polytechnic, Robertson Library などの主要施設に特定の色付き3Dピンを表示。
- **Billboard**: ピンとラベルが常にユーザーの方を向くように `@react-three/drei` の `Billboard` コンポーネントを使用。
- **距離スケーリング**: 遠くのピンは小さく、近づくと大きくなる動的なスケーリングロジック。
- **可視半径**: `visibleRadius` (150m) を設定し、近くの建物だけを表示して画面の混雑を回避。

## 7. ヘディングキャリブレーション機能
### 課題
- 建造物内や干渉の多い場所では、デジタルコンパスが大きく狂うことがある。

### 解決策
- **キャリブレーションボタン**: 画面右上に照準アイコンのボタンを追加。
- **ロジック**: ボタン押下時、現在のルートセグメント（道路の方位）を正解とし、現在のセンサー値との差分（オフセット）を計算して保存。以後、このオフセットを全方位データに加算して補正する。

## 8. デプロイとWeb対応
### GitHub Pagesへの公開
- カメラやGPS APIを使用するため、**HTTPS** が必須。GitHub Pagesは標準でHTTPS対応。
- `vite.config.ts`: `base` パスをリポジトリ名に合わせて設定。
- `gh-pages` パッケージを使用して、ビルド成果物を `gh-pages` ブランチにデプロイするフローを確立。
- これにより、QRコード等で手軽にアプリを配布・体験可能に。

---

## 技術的な重要ポイントまとめ
1. **座標系**: GPS(Lat/Lon) → Web Mercator(Map) → Three.js(3D) の3つの座標系の相互変換。
2. **パフォーマンス**: Reactの再レンダリングを抑えつつ、Canvas(3D/Map)のアニメーションフレーム(60fps)で滑らかな回転を実現。
3. **オフライン/コスト**: 外部有料APIに依存せず、ブラウザ標準APIとオープンデータ(OSM)のみで構成。

## 今後の課題（Potential Future Work）
- **オフラインキャッシュ**: Service Worker (PWA) を導入し、地図タイルやルートデータを完全にオフラインで使えるようにする。
- **高度なオクルージョン**: 建物の陰にARオブジェクトが隠れる表現（WebXRの深度APIが必要）。
- **ルート検索**: クライアントサイドでの経路探索（現在は固定ルートJSONを使用）。
