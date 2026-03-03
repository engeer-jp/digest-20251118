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
