---
name: create-digest
description: 指定フォルダの写真・動画から任意の長さのダイジェスト動画を生成するRemotionプロジェクトを作成します
---

# Create Digest Skill

このスキルは、指定されたフォルダ内の写真・動画ファイルをAIが分析・選定し、ダイジェスト動画を生成するRemotionプロジェクトを自動作成する機能です。子どもの成長記録や、月単位・イベントごとの振り返り動画の作成を想定しています。

## 使用方法

ユーザーから以下のパラメータを受け取ってください:

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| フォルダパス | ○ | - | メディアファイルが格納されたフォルダのパス |
| 動画の長さ | × | 60秒 | 動画の長さ（秒数）。最低60秒 |
| 必須ファイル | × | なし | ダイジェストに必ず含めたいファイル名のリスト |
| タイトル | × | 「おもいで」 | オープニングに表示するカスタムタイトル |

### 実行手順

#### ステップ1: 新プロジェクト作成

`create-project` スキルを使用して新しいRemotionプロジェクトを作成します。プロジェクト名は `digest-YYYYMMDD` 形式を推奨します。

#### ステップ2: メディアスキャン

以下のスクリプトを実行してフォルダ内（サブフォルダを含む）のメディア情報をJSON形式で取得します:

```powershell
a:\SlideShow\_shared\skills\.gemini\skills\create-digest\scripts\scan-media.ps1 -FolderPath "<フォルダパス>"
```

対象ファイル形式: `*.jpg, *.jpeg, *.png, *.heic, *.mp4, *.mov`（サブフォルダ内も再帰的にスキャン）

スキャン結果の `filename` フィールドはルートフォルダからの相対パス（例: `2025/July/photo.jpg`）を含みます。TSXコード内では `staticFile("media/" + filename)` で参照してください。

#### ステップ3: メディア選定

スキャン結果のJSONを分析し、ダイジェストに含める素材を選定します。

**選定ルール:**
1. **必須ファイルを最優先**: ユーザーが指定した必須ファイルは必ず含める
2. 残り枠をAI判断で選定
3. 素材数の目安: `素材数 ≈ (動画長 - 5秒) / 平均表示秒数(3〜5秒)`
   - 60秒の場合: 12〜20素材
   - 120秒の場合: 24〜40素材
4. 日付の多様性を優先し、期間全体をカバーする
5. 写真と動画をバランスよく混合する
6. HEICファイルはスキップする（ブラウザが非対応のため、ユーザーに通知すること）
7. MOVファイル（HEVC）はそのまま使用を試みるが、再生に問題がある場合はH.264 MP4への変換を推奨する

#### ステップ4: Junctionリンク作成

ファイルをコピーせず、ソースフォルダへのJunctionリンクを作成します:

```powershell
New-Item -ItemType Junction -Path "<プロジェクトパス>\public\media" -Target "<ソースフォルダパス>"
```

TSXコード内では `staticFile("media/<ファイル名>")` で参照します。

#### ステップ5: コード生成

以下のファイルを生成してください。

##### タイミング計算ルール

動画の長さを `T秒` として（30fps）:

| 区間 | フレーム数 | 秒数 |
|------|-----------|------|
| タイトルカード | 90 | 3 |
| コンテンツ領域 | T×30 - 150 | T - 5 |
| エンドカード | 60 | 2 |
| **合計** | **T×30** | **T** |

- 写真スライド: 各90〜150フレーム（3〜5秒）
- 動画クリップ: 各90〜240フレーム（3〜8秒）
- **検証**: 全素材のフレーム数合計がコンテンツ領域フレーム数と一致すること

##### 5-1. `src/Root.tsx` — Composition登録

```tsx
import "./index.css";
import { Composition } from "remotion";
import { DigestVideo } from "./compositions/DigestVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DigestVideo"
        component={DigestVideo}
        durationInFrames={/* T×30 */}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
```

##### 5-2. `src/compositions/DigestVideo.tsx` — メインコンポジション

```tsx
import { AbsoluteFill, Sequence } from "remotion";
import { PhotoSlide } from "../components/PhotoSlide";
import { VideoClip } from "../components/VideoClip";
import { TitleCard } from "../components/TitleCard";
import { EndCard } from "../components/EndCard";
import { staticFile } from "remotion";

// AIが選定した素材リスト（日付順）
const mediaItems: Array<{
  type: "image" | "video";
  src: string;
  durationFrames: number;
  label: string;
  startFrom?: number;
}> = [
  // AIがここに選定した素材を記述する
  // src には scan-media.ps1 の filename フィールド（相対パス）を使用: "media/" + filename
  // 例（ルート直下）:
  // { type: "image", src: "media/IMG_20250715_143022.jpg", durationFrames: 120, label: "7月15日" },
  // 例（サブフォルダ内）:
  // { type: "image", src: "media/2025/July/IMG_20250715_143022.jpg", durationFrames: 120, label: "7月15日" },
  // { type: "video", src: "media/VID_20250716_101500.mp4", durationFrames: 180, label: "7月16日", startFrom: 0 },
];

const TITLE_DURATION = 90;  // 3秒
const END_DURATION = 60;    // 2秒

export const DigestVideo: React.FC = () => {
  let currentOffset = TITLE_DURATION;

  return (
    <AbsoluteFill className="bg-black">
      <Sequence from={0} durationInFrames={TITLE_DURATION}>
        <TitleCard
          title={/* ユーザー指定タイトルまたは "おもいで" */}
          dateRange={/* "YYYY年M月D日〜M月D日" 形式 */}
        />
      </Sequence>

      {mediaItems.map((item, i) => {
        const from = currentOffset;
        currentOffset += item.durationFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={item.durationFrames}>
            {item.type === "image" ? (
              <PhotoSlide src={staticFile(item.src)} label={item.label} />
            ) : (
              <VideoClip
                src={staticFile(item.src)}
                label={item.label}
                startFrom={item.startFrom ?? 0}
              />
            )}
          </Sequence>
        );
      })}

      <Sequence from={/* T×30 - END_DURATION */} durationInFrames={END_DURATION}>
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};
```

##### 5-3. `src/components/PhotoSlide.tsx` — 写真スライド

Ken Burns効果（ゆっくりズーム）とフェードイン、日付ラベル表示を実装:

```tsx
import { AbsoluteFill, Img, useCurrentFrame, interpolate } from "remotion";

type Props = { src: string; label?: string };

export const PhotoSlide: React.FC<Props> = ({ src, label }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 150], [1, 1.08], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }} className="bg-black flex items-center justify-center">
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
      {label && (
        <div
          className="absolute bottom-6 right-6 text-white text-2xl font-bold"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}
        >
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
};
```

##### 5-4. `src/components/VideoClip.tsx` — 動画クリップ

```tsx
import { AbsoluteFill, Video, useCurrentFrame, interpolate } from "remotion";

type Props = { src: string; label?: string; startFrom?: number };

export const VideoClip: React.FC<Props> = ({ src, label, startFrom = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ opacity }} className="bg-black flex items-center justify-center">
      <Video
        src={src}
        startFrom={startFrom}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {label && (
        <div
          className="absolute bottom-6 right-6 text-white text-2xl font-bold"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.7)" }}
        >
          {label}
        </div>
      )}
    </AbsoluteFill>
  );
};
```

##### 5-5. `src/components/TitleCard.tsx` — オープニング

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

type Props = { title: string; dateRange: string };

export const TitleCard: React.FC<Props> = ({ title, dateRange }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20, 70, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ opacity }}
      className="bg-black flex flex-col items-center justify-center text-white"
    >
      <h1 className="text-6xl font-bold mb-4">{title}</h1>
      <p className="text-2xl opacity-80">{dateRange}</p>
    </AbsoluteFill>
  );
};
```

##### 5-6. `src/components/EndCard.tsx` — エンディング

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  return <AbsoluteFill style={{ opacity }} className="bg-black" />;
};
```

#### ステップ6: ビルドと確認

```bash
cd <プロジェクトパス>
npm install
npm run dev        # Remotion Studioでプレビュー
```

レンダリング:
```bash
npx remotion render DigestVideo out/digest.mp4
```

## 留意点

- 環境はWindows（PowerShell）を前提とします。
- 作業ルートは `a:\SlideShow` に固定されています。
- HEICファイルはブラウザ/Remotionで表示できないため、スキップしてユーザーに通知してください。
- 動画の最低長は60秒です。60秒未満が指定された場合は60秒に設定してください。
- Junctionリンクにより元のメディアファイルを直接参照します。ファイルのコピーは行いません。
- 日付ラベルは日本語形式（例: 「7月15日」）で表示してください。
