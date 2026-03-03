import "./index.css";
import { Composition } from "remotion";
import { DigestVideo } from "./compositions/DigestVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DigestVideo"
        component={DigestVideo}
        durationInFrames={1800}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
