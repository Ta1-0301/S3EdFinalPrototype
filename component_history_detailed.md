# コンポーネント開発・変更履歴詳細 (Component History Detail)

**プロジェクト名**: AR Bus Navigation (S3EdFinalPrototype)
**作成日**: 2026-02-15
**概要**: プロジェクト開始時から現在（GitHub Pages公開版）に至るまでの、主要コンポーネントごとのコード変更履歴、技術的判断、および設計の変遷をまとめました。

---

## 1. App.tsx (メインコンポーネント)

アプリケーションの全体構造と状態管理を担うルートコンポーネント。

### 初期バージョン (Phase 1)
- **機能**: `navigator.geolocation` で位置情報を取得し、単純なコンパス方位を表示するのみ。
- **コード特徴**:
  ```tsx
  const [location, setLocation] = useState(null);
  useEffect(() => {
      navigator.geolocation.watchPosition(success, error);
  }, []);
  ```

### 最新バージョン (Phase 2 - Current)
- **変更日時**: 2026年2月上旬〜中旬
- **変更理由**: GPSの精度向上（Sensor Fusion）、UI/UXの刷新、AR機能の統合。
- **現在のコード特徴**:
  ```tsx
  // Sensor Fusionフックの使用（GPS + ジャイロ + Kalman Filter）
  const { smoothedLocation, heading, calibrateHeading } = useSensorFusion();
  
  return (
    <div className="app-root">
      <ARView ... />       {/* AR表示レイヤー */}
      <div className="route-bar">...</div>
      <MiniMap ... />      {/* MapLibre地図 */}
      <button onClick={calibrate}>方位補正</button>
    </div>
  );
  ```
- **主要な改修点**:
  - **センサー統合**: `useSensorFusion` フックへの移行。
  - **デザイン適用**: "Modern Yellow Accent" テーマへの全面書き換え。βバッジ、カードUIの実装。
  - **キャリブレーション**: 右上に「方位補正ボタン」を追加し、方位ズレを修正する機能を追加。
  - **直進時の矢印固定**:
    - **課題**: 遠くのウェイポイントに正直に矢印を向けると、GPS誤差で矢印が左右に揺れてしまい、直進中なのに不安を与える。
    - **解決策**: 「曲がり角」に「40m以内」に接近するまでは、矢印を強制的に「デバイスの正面（直進）」に向けるロジックを実装。
    - **実装コード**:
      ```tsx
      const bearingToTarget = useMemo(() => {
        // ...
        const isTurn = currentTarget.type.includes('turn');
        const isNear = distanceToTarget < 40;

        if (isTurn && isNear) {
          return realBearing; // 曲がり角に近づいたら正確な方向(GPS座標)を指す
        }
        return deviceHeading; // それ以外は常に正面(直進)を指す -> relativeAngleが0になる
      }, ...);
      ```
  - **音声ガイダンス機能**:
    - **目的**: 画面を見続けなくても、音でバス停への接近を知ることができるようにするため。
    - **実装**: バス停まで「50m以内」かつ「10m以上」に接近したタイミングで発火。
    - **コード特徴**:
      ```tsx
      // チャイム(getOff.mp3) -> バス停案内音声 の順に連続再生
      audioRef.current.src = `/assets/AudioTrack/getOff.mp3`;
      audioRef.current.onended = () => {
          audioRef.current.src = `/assets/AudioTrack/${stopAudioFile}`; // route.jsonで定義されたファイル
          audioRef.current.play();
      };
      audioRef.current.play();
      ```
    - **工夫**: `useRef` (`lastPlayedRef`, `isPlayingRef`) を使用して、同じ場所での二重再生や連打を防ぐ排他制御を実装。

---

## 2. useSensorFusion.ts (センサーフュージョン)

### 変更履歴
- **新規作成**: 2026年2月
- **変更理由**: 
  - `useGeolocation.ts` (単純なGPS) と `useOrientation.ts` (コンパス) では、値のブレ（ノイズ）が大きく、AR表示がガタつく問題があったため。
  - これらを統合し、高度なフィルタリングを行うために新規作成された。

### 技術詳細
- **カルマンフィルタ統合**: GPS座標に対して `KalmanFilter` クラスを適用し、移動軌跡を滑らかにした。
- **方位補正 (Calibration)**: 
  ```ts
  const calibrateHeading = useCallback((roadBearing) => {
      // 道路の方位とセンサー方位の差分をオフセットとして保存
      headingOffsetRef.current = roadBearing - rawHeading;
  }, []);
  ```
  このロジックにより、建物内などでコンパスが狂った際に手動で修正可能となった。

---

## 3. KalmanFilter.ts (カルマンフィルタ)

### 変更履歴
- **新規作成**: 2026年2月
- **変更理由**: GPSの飛び値（外れ値）を除去するため。
- **実装内容**:
  - 2次元（Lat, Lon）のカルマンフィルタアルゴリズム。
  - 予測フェーズ（Predict）と更新フェーズ（Update）を持ち、GPS信号が途切れた間も予測位置を返すことでスムーズな描画を実現。

---

## 4. ARView.tsx (AR表示)

### 初期バージョン
- **機能**: 単純な3D矢印オブジェクトを表示。
- **コード**:
  ```tsx
  return <div className="ar-view"><Canvas><Arrow /></Canvas></div>;
  ```

### 最新バージョン
- **変更理由**: "Heading Up"（ユーザーの向きに追従）なAR体験と、ランドマーク情報の表示。
- **変更点**:
  1.  **Heading Up回転**: カメラではなくシーン全体を回転させるアプローチ。
      ```tsx
      <SceneContent arrowRotationY={-relativeAngle} ... />
      ```
  2.  **ランドマークピン (3D)**:
      - **Billboard**: ピンと文字が常にカメラを向く (`@react-three/drei` の `Billboard` 使用)。
      - **距離スケーリング**:
        ```ts
        // 遠くても見やすく、近くても邪魔にならないサイズ調整
        const scale = Math.max(0.4, Math.min(2.4, 60 / distance));
        ```
  3.  **座標変換**: `geoUtils` を使用して GPS座標 -> Three.js空間座標(x,y,z) の変換ロジックを実装。
  4.  **ナビゲーション矢印の視認性向上**:
      - **変更理由**: 初期の矢印は細く、実世界の背景に埋もれて見づらかったため。
      - **変更内容**: 
        - 形状を太く大きく変更 (`width: 1.2`, `height: 1.8`, `depth: 0.5`)。
        - 色を鮮やかなネオングリーン (`#00ff88`) に変更し、`emissive` (自己発光) プロパティを追加して、暗い場所や複雑な背景でもはっきり見えるように改善した。

---

## 5. MiniMap.tsx (ミニマップ)

### 初期バージョン (SVG版)
- **コード**: `<svg>` タグ内にルート線を `path` として描画。
- **問題点**: 
  - 地図としての情報量（道路、建物）がない。
  - 回転させると文字も回転してしまう。

### 最新バージョン (MapLibre GL JS版)
- **変更日時**: 2026年2月12日
- **技術選定**: `maplibre-gl` (Open Source) + OpenStreetMap (OSM)。
- **変更後のコード**:
  ```tsx
  new maplibregl.Map({
      style: { sources: { 'osm': ... } }, // OSMラスタタイル
      center: [lon, lat],
      bearing: userHeading, // ヘディングアップ
      ...
  });
  ```
- **工夫点**:
  - **ダークモード化**: CSSフィルタ `filter: invert(100%)` をCanvasに適用し、無料でダークテーマ地図を実現。
  - **マーカー固定**: ユーザー矢印を `rotationAlignment: 'viewport'` に設定し、地図が回っても矢印は常に画面上（進行方向）を向くように修正。

---

## 6. NavigationCard.tsx (ナビゲーションカード)

### 変更履歴
- **UI刷新**: 2026年2月
- **変更前**: 単純なテキスト表示 (`<div>Turn Left</div>`)。
- **変更後**: 
  - **デザイン**: 黄色い背景、角丸、アイコン付きのリッチなカード。
  - **機能**: `type="turn"` や `type="stop"` プロパティに応じてアイコン（矢印、ピン）を出し分けるロジックを追加。

---

## 7. その他コンポーネント

### CameraFeed.tsx
- **変更なし (Stable)**: 初期実装の `navigator.mediaDevices.getUserMedia` を使用したビデオ表示から大きな変更なし。安定して動作中。

### geoUtils.ts
- **拡張**: 
  - `Coordinate` インターフェースの拡張（`speed`, `headingGPS` 追加）。
  - `toRadians`, `calculateBearing` などの計算ロジックは初期から存在し、AR機能で活用されている。

### useGeolocation.ts / useOrientation.ts
- **廃止 (Deprecated)**: `useSensorFusion.ts` にロジックが統合されたため、現在は使用されていない（または削除済み）。

---

## 全体構成・改善点・今後の課題

### 現状の完成度
- **Web技術のみ**（React + Capacitor + Three.js + MapLibre）で、実用的なARナビゲーションを実現。
- **無料構成**: Google Maps API等の有料サービスを使わず完成させた点は大きな成果。
- **UX**: ヘディングアップとスムーズなAR表示により、直感的なナビゲーションが可能。

### 今後の課題
1.  **オフライン対応**: 地図タイルやルートデータをキャッシュし、完全オフラインで動作させる（PWA/Service Worker）。
2.  **オクルージョン**: 建物の陰にARピンが隠れる処理（WebXRの深度APIが必要）。
3.  **ルート動的検索**: 現在は `route.json` 固定だが、現在地からのルート検索機能の実装。
