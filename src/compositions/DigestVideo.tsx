import { AbsoluteFill, Audio, Sequence } from "remotion";
import { PhotoSlide } from "../components/PhotoSlide";
import { VideoClip } from "../components/VideoClip";
import { TitleCard } from "../components/TitleCard";
import { EndCard } from "../components/EndCard";
import { staticFile } from "remotion";

const mediaItems: Array<{
  type: "image" | "video";
  src: string;
  durationFrames: number;
  startFrom?: number;
}> = [
  // 作成時間の若い順 (LastWriteTime昇順)
  // 動画7本 × 180フレーム(6秒) = 1260 + 写真6枚 × 90フレーム(3秒) = 540 → 合計1800フレーム
  { type: "video", src: "media/33f69e77-dfdd-4895-a6c6-c6c1ed876766.mp4", durationFrames: 180, startFrom: 0 },  // 22:04:08
  { type: "video", src: "media/a89a7ca9-523b-48ac-987f-05b973c2270d.mp4", durationFrames: 180, startFrom: 0 },  // 22:04:11
  { type: "video", src: "media/cf4915e6-1e86-45a1-8d60-6f420196d201.mp4", durationFrames: 180, startFrom: 0 },  // 22:04:16
  { type: "image", src: "media/e2c2ed0f-f896-4a29-a21e-0a1a6bcab70a.jpeg", durationFrames: 90 },                // 22:04:18
  { type: "image", src: "media/3584d8ba-c255-4435-aef4-831d99a5552c.jpeg", durationFrames: 90 },                // 22:04:24
  { type: "image", src: "media/07a8259b-5149-4943-ae97-8be1ee8ef30d.jpeg", durationFrames: 90 },                // 22:04:29
  { type: "image", src: "media/dad3a1d8-0de8-4e63-9e5a-7d23d590e3f8.jpeg", durationFrames: 90 },                // 22:04:35
  { type: "video", src: "media/c12216fe-ccc5-4db6-9d91-5b0eaded2645.mp4", durationFrames: 180, startFrom: 0 },  // 22:04:38
  { type: "video", src: "media/5b4da17f-e65b-4a44-aabe-10faebb414cf.mp4", durationFrames: 180, startFrom: 0 },  // 22:04:43
  { type: "video", src: "media/12025cde-54b1-47ad-8e6b-688d735ca6be.mp4", durationFrames: 180, startFrom: 0 },  // 22:04:48
  { type: "image", src: "media/6023e5d6-7b12-4986-9d59-9aa379f10b7e.jpeg", durationFrames: 90 },                // 22:04:56
  { type: "image", src: "media/c4e0b5d6-fe5e-4ed8-bf8c-c639082f52bd.jpeg", durationFrames: 90 },                // 22:05:04
  { type: "video", src: "media/41d607d6-db5b-481d-ad47-ef3c8dea639d.mp4", durationFrames: 180, startFrom: 0 },  // 22:04:51
];

const TITLE_DURATION = 90; // 3秒
const END_DURATION = 90; // 3秒
const TOTAL_FRAMES = 1800;

export const DigestVideo: React.FC = () => {
  let currentOffset = 0;

  return (
    <AbsoluteFill className="bg-black">
      {/* メディアレイヤー (全1800フレームを埋める) */}
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
        <TitleCard title="天王寺動物園" date="2025年11月18日" />
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
