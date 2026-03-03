import { AbsoluteFill, Img, useCurrentFrame, interpolate } from "remotion";

type Props = {
  src: string;
};

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
