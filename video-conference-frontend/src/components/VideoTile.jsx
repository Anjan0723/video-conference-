// src/components/VideoTile.jsx  ← COPY-PASTE THIS ENTIRE FILE
import React, { useEffect, useRef } from "react";

export default function VideoTile({ peerId, name, stream }) {
  const videoRef = useRef(null);

 useEffect(() => {
   const video = videoRef.current;
   if (!video || !stream) return;

   // THIS IS THE FIX: Force assign + play every time stream changes
   video.srcObject = stream;

   // Force play — this fixes 99% of black screen issues
   const playVideo = async () => {
     try {
       await video.play();
     } catch (err) {
       console.log("Play interrupted (user gesture needed)");
     }
   };
   playVideo();

   // Also try again when track becomes active
   const handleCanPlay = () => video.play();
   video.addEventListener("canplay", handleCanPlay);

   return () => {
     video.removeEventListener("canplay", handleCanPlay);
     video.srcObject = null;
   };
 }, [stream]);

 // Show video even if track is "inactive" — trust the stream exists
 const showVideo = !!stream;

 return (
   <div className="relative rounded-xl overflow-hidden bg-gray-800 aspect-video">
     <video
       ref={videoRef}
       autoPlay
       playsInline
       muted={peerId === "local"}
       className="w-full h-full object-cover"
       style={{ background: "black" }}
     />

     {!showVideo && peerId !== "local" && (
       <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
         <div className="text-center">
           <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
             <span className="text-3xl font-bold text-white">
               {name?.[0]?.toUpperCase() || "?"}
             </span>
           </div>
           <p className="text-gray-400">Connecting...</p>
         </div>
       </div>
     )}

     <div className="absolute bottom-2 left-2 px-3 py-1 bg-black/60 text-white text-xs rounded">
       {name || "User"} {peerId === "local" && "(You)"}
     </div>
   </div>
 );
}