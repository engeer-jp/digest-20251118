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

> **注意**: scan-media.ps1 が文字化けで実行できない場合は、PowerShell で直接ファイル一覧を取得してください:
> ```powershell
> Get-ChildItem -Path "<フォルダパス>" -Recurse -Include *.jpg,*.jpeg,*.png,*.mp4,*.mov | Select-Object Name,Length,LastWriteTime,Extension | ConvertTo-Json
> ```

#### ステップ3: メディア選定

スキャン結果のJSONを分析し、ダイジェストに含める素材を選定します。

**選定ルール:**
1. **必須ファイルを最優先**: ユーザーが指定した必須ファイルは必ず含める
2. 残り枠をAI判断で選定
3. 素材数の目安: `素材数 ≈ 動画長(秒) / 平均表示秒数(3〜5秒)`
   - 60秒の場合: 12〜20素材
   - 120秒の場合: 24〜40素材
4. **作成日時の昇順**で並べる（LastWriteTime順）
5. 写真と動画をバランスよく混合する（目安: 動画7 : 写真3）
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

タイトルカードとエンドカードはメディアの上にオーバーレイ表示するため、コンテンツ領域がタイムライン全体を占めます。

動画の長さを `T秒` として（30fps）:

| 区間 | フレーム数 | 秒数 | 備考 |
|------|-----------|------|------|
| コンテンツ（メディア） | T×30 | T | タイムライン全体を占める |
| タイトルカード（オーバーレイ） | 90 | 3 | 先頭にオーバーレイ |
| エンドカード（オーバーレイ） | 90 | 3 | 末尾にオーバーレイ |

- 写真スライド: 各90〜150フレーム（3〜5秒）
- 動画クリップ: 各90〜240フレーム（3〜8秒）
- **検証**: 全素材のフレーム数合計が `T×30` と一致すること

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

タイトルとエンドカードはメディアレイヤーの上にオーバーレイします。メディアがフレーム0から始まり、タイムライン全体を埋めます。

```tsx
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { PhotoSlide } from "../components/PhotoSlide";
import { VideoClip } from "../components/VideoClip";
import { TitleCard } from "../components/TitleCard";
import { EndCard } from "../components/EndCard";
import { staticFile } from "remotion";

// AIが選定した素材リスト（作成日時の昇順）
const mediaItems: Array<{
  type: "image" | "video";
  src: string;
  durationFrames: number;
  startFrom?: number;
}> = [
  // AIがここに選定した素材を記述する
  // src には scan-media.ps1 の filename フィールド（相対パス）を使用: "media/" + filename
  // 例:
  // { type: "image", src: "media/IMG_20250715_143022.jpg", durationFrames: 90 },
  // { type: "video", src: "media/VID_20250716_101500.mp4", durationFrames: 180, startFrom: 0 },
];

const TITLE_DURATION = 90;  // 3秒
const END_DURATION = 90;    // 3秒
const TOTAL_FRAMES = /* T×30 */;

export const DigestVideo: React.FC = () => {
  let currentOffset = 0;

  return (
    <AbsoluteFill className="bg-black">
      {/* メディアレイヤー (全フレームを埋める) */}
      {mediaItems.map((item, i) => {
        const from = currentOffset;
        currentOffset += item.durationFrames;
        return (
          <Sequence key={i} from={from} durationInFrames={item.durationFrames}>
            {item.type === "image" ? (
              <PhotoSlide src={staticFile(item.src)} />
            ) : (
              <VideoClip
                src={staticFile(item.src)}
                startFrom={item.startFrom ?? 0}
              />
            )}
          </Sequence>
        );
      })}

      {/* オーバーレイ: オープニングタイトル */}
      <Sequence from={0} durationInFrames={TITLE_DURATION}>
        <TitleCard
          title={/* ユーザー指定タイトルまたは "おもいで" */}
          date={/* "YYYY年M月D日" 形式 */}
        />
      </Sequence>

      {/* オーバーレイ: エンディング */}
      <Sequence from={TOTAL_FRAMES - END_DURATION} durationInFrames={END_DURATION}>
        <EndCard />
      </Sequence>

      {/* BGM */}
      <Audio src={staticFile("bgm.wav")} volume={0.7} />
    </AbsoluteFill>
  );
};
```

##### 5-3. `src/components/PhotoSlide.tsx` — 写真スライド

縦向き写真にも対応する2層表示: ブラー付き背景（cover） + 前面（contain + Ken Burns効果）

```tsx
import { AbsoluteFill, Img, useCurrentFrame, interpolate } from "remotion";

type Props = { src: string };

export const PhotoSlide: React.FC<Props> = ({ src }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 150], [1, 1.08], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }} className="bg-black">
      {/* 背景: ブラー付きカバー */}
      <Img
        src={src}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.5)",
          transform: "scale(1.1)",
        }}
      />
      {/* 前面: 全体が見えるように収める */}
      <Img
        src={src}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};
```

##### 5-4. `src/components/VideoClip.tsx` — 動画クリップ

縦向き動画にも対応する2層表示。`<OffthreadVideo>` を使用してフレーム精度を確保する。

> **重要**: スマートフォンで撮影されたMP4はBフレームを含むため、`<Video>` ではフレームのジッター（振動）が発生する。`<OffthreadVideo>` は別スレッドで各フレームを正確にデコードするため、この問題を回避できる。

```tsx
import { AbsoluteFill, OffthreadVideo, useCurrentFrame, interpolate } from "remotion";

type Props = { src: string; startFrom?: number };

export const VideoClip: React.FC<Props> = ({ src, startFrom = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }} className="bg-black">
      {/* 背景: ブラー付きカバー */}
      <OffthreadVideo
        src={src}
        startFrom={startFrom}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          filter: "blur(40px) brightness(0.5)",
          transform: "scale(1.1)",
        }}
        muted
      />
      {/* 前面: 全体が見えるように収める */}
      <OffthreadVideo
        src={src}
        startFrom={startFrom}
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};
```

##### 5-5. `src/components/TitleCard.tsx` — オープニング（オーバーレイ）

メディアの上に半透明背景でオーバーレイ表示。タイトル（1行目）と日付（2行目）。

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

type Props = { title: string; date: string };

export const TitleCard: React.FC<Props> = ({ title, date }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20, 70, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center text-white"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div style={{ opacity }}>
        <h1 className="text-6xl font-bold mb-4 text-center">{title}</h1>
        <p className="text-2xl opacity-80 text-center">{date}</p>
      </div>
    </AbsoluteFill>
  );
};
```

##### 5-6. `src/components/EndCard.tsx` — エンディング（オーバーレイ）

メディアの上にフェードインする半透明背景と "fin." テキスト。

```tsx
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const bgOpacity = interpolate(frame, [0, 30], [0, 0.6], {
    extrapolateRight: "clamp",
  });
  const textOpacity = interpolate(frame, [10, 40], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center text-white"
      style={{ backgroundColor: `rgba(0,0,0,${bgOpacity})` }}
    >
      <p className="text-3xl font-bold" style={{ opacity: textOpacity }}>
        fin.
      </p>
    </AbsoluteFill>
  );
};
```

#### ステップ6: BGM生成

`scripts/generate-bgm.mjs` でプログラムによるBGMを生成します。外部依存なし（Node.js のみ）。

```bash
cd <プロジェクトパス>
node scripts/generate-bgm.mjs
```

BGMの仕様:
- 動画の長さと同じ秒数のWAVファイルを `public/bgm.wav` に出力
- ステレオ、44.1kHz、16bit PCM
- Karplus-Strong アルゴリズムによるウクレレ音 + 手拍子
- BPM 140、コード進行: C → F → G → C
- フェードイン（1秒）/ フェードアウト（2.5秒）

BGM生成スクリプトのテンプレートは `scripts/generate-bgm.mjs` を参照してください。`DURATION` 定数を動画の長さ（秒）に合わせて調整します。

#### ステップ7: ビルドと確認

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
- **動画コンポーネントは必ず `<OffthreadVideo>` を使用する**（`<Video>` はスマホ動画でジッターが発生する）。
- 写真・動画ともに縦向きコンテンツは2層表示（ブラー背景 + contain前面）で対応する。
- タイトル・エンドカードはメディアの上にオーバーレイ表示する（独立したタイムラインスロットにしない）。
- PowerShellスクリプトが文字化けで失敗する場合は、インラインPowerShellコマンドや一時スクリプトで対処する。
