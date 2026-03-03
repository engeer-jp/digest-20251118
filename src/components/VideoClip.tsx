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
