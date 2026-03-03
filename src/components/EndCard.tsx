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
