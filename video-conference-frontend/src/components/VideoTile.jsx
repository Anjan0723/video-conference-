import React, { useEffect, useRef } from "react";

export default function VideoTile({ peerId, name, stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log("Attaching stream for peer:", peerId);
      videoRef.current.srcObject = stream;
    }
  }, [stream, peerId]);

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-black"
      style={{ width: "100%", height: "100%" }}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={peerId === "local"}
        className="w-full h-full object-cover rounded-xl bg-black"
      />

      <div
        className="absolute bottom-2 left-2 px-3 py-1 text-xs bg-black/40 text-white rounded-md"
      >
        {name || peerId}
      </div>
    </div>
  );
}
