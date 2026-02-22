# Project Code Changes History

初期バージョンから現在（GitHub Pages公開版）に至るまでの、主要ファイルごとのコード変更履歴まとめです。

## 1. Core Logic & UI (`src/App.tsx`)
アプリケーションのメインエントリーポイント。
- **初期**: シンプルなGPS座標取得とコンパス方位取得のみ。
- **Sensor Fusion導入**: `useSensorFusion` hookを導入し、`navigator.geolocation` から切り替え。
- **UI刷新**:
  - デバッグ表示（数値の羅列）から、実用的なナビUIへ変更。
  - **βバッジ**、**Route Bar**（ルート切り替えボタン）、**ナビゲーションカード**（`NavigationCard`）の統合。
  - `ARView` と `MiniMap` の条件付きレンダリング（`geoLoaded` フラグ）。
- **キャリブレーション**: 右上に「方位補正ボタン」を追加し、`calibrateHeading` 関数を呼び出すロジックを追加。

## 2. AR View (`src/components/ARView.tsx`)
カメラ映像に重ねて3Dオブジェクトを表示するコンポーネント。
- **初期**: 常に北を向く単純な矢印を表示。
- **Heading Up化**: `currentHeading` プロップを受け取り、カメラ全体を回転させて「見たままの方角」に合わせるロジックを追加。
- **座標変換**: `geoUtils.ts` の計算を使用し、GPS座標(Lat/Lon)をThree.js空間の(x, y, z)に変換。
- **ランドマーク実装**:
  - `landmarks` プロップを受け取るよう変更。
  - **3Dピン**: 赤いピン + テキストラベル + 距離表示を作成。
  - **Billboard**: ピンが常にカメラの方を向くように設定。
  - **スケーリング**: 距離に応じてピンの大きさを自動調整するロジック（`scale` 計算式）を追加。

## 3. Mini Map (`src/components/MiniMap.tsx`)
右下の地図表示。
- **初期 (v1)**: SVGによる簡易描画。
  - 背景はグレーの矩形。
  - ルート線と現在地矢印を `<svg>` 要素で描画。
  - 回転はCSSの `transform: rotate()` で実施（文字も回転してしまう問題あり）。
- **現在 (v2)**: MapLibre GL JS + OpenStreetMap。
  - `maplibre-gl` パッケージ導入。
  - OSMラスタタイルを表示（完全無料）。
  - **Heading Up**: `map.easeTo({ bearing })` で地図自体を滑らかに回転。
  - **ダークモード**: CSSフィルタ `invert(100%)` で地図を暗色化。
  - **GeoJSON**: ルート線とバス停をGeoJSONレイヤーとして描画。

## 4. Sensor Logic (`src/hooks/useSensorFusion.ts`, `src/utils/KalmanFilter.ts`)
位置情報と方位の精度向上。
- **Kalman Filter**: 生のGPS座標のノイズ（飛び値）を除去するために `KalmanFilter` クラスを新規作成。
- **Sensor Fusion**:
  - `useGeolocation` と `useOrientation` を廃止し、一つに統合。
  - **方位補正**: `calibrateHeading` 関数を追加。ボタン押下時の道路方位とセンサー方位の差分をオフセットとして保存・適用。
  - iOS/Androidの方位取得APIの違い（`webkitCompassHeading` vs `deviceorientationabsolute`）を吸収。

## 5. Data (`src/data/route.json`)
ルート定義データ。
- **初期**: バス停2つのみ。
- **拡張**:
  - 交差点（`turn_left`, `turn_right`）のウェイポイントを追加。
  - **ランドマーク**: `landmarks` 配列を追加（Unipol, Otago Polytechnic, Robertson Library）。
  - 各地点の座標を微修正。
  - 音声ファイル名定義（将来用）。

## 6. Styling (`src/index.css`)
- **初期**: 基本的なリセットCSSのみ。
- **Design System**:
  - カラー変数（`--accent-yellow`, `--bg-dark`）を定義。
  - **Modern UI**: カードの角丸、影、グラデーションなどを実装。
  - **MapLibre**: 地図用のスタイリングと、MapLibreコントロールの非表示設定。
  - **キャリブレーションボタン**: フローティングアクションボタン（FAB）のスタイル。

## 7. Build & Deploy (`vite.config.ts`, `package.json`)
- **HTTPS化**: 開発サーバーで検証するため、またはデプロイ要件のため。
- **GitHub Pages対応**:
  - `base: '/S3EdFinalPrototype/'` を追加。
  - `gh-pages` パッケージを導入し、`deploy` コマンドを追加。
