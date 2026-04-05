"use client";

import React, { useState, useRef } from "react";
import { Play, Pause, ArrowRight } from "lucide-react";

interface MinorityReportHeroProps {
  heroTitle?: string;
  heroDescription?: string;
  backgroundImage?: string;
  videoUrl?: string;
  onEnter: () => void;
}

const MinorityReportHero: React.FC<MinorityReportHeroProps> = ({
  heroTitle = "Secure. Simulate. Save.",
  heroDescription = "AI-powered surveillance optimization. Select a building, place cameras with machine learning, and simulate scenarios with generative video.",
  backgroundImage = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?ixlib=rb-4.0.3&auto=format&fit=crop&w=2072&q=80",
  videoUrl = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  onEnter,
}) => {
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsVideoPlaying(true);
      setIsVideoPaused(false);
    }
  };

  const handlePauseVideo = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsVideoPaused(true);
    }
  };

  const handleResumeVideo = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsVideoPaused(false);
    }
  };

  const handleVideoEnded = () => {
    setIsVideoPlaying(false);
    setIsVideoPaused(false);
  };

  return (
    <main
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        overflow: "auto",
        background: "#000",
        color: "#fff",
        zIndex: 10000,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
      }}
    >
      {/* Brand — full width bar */}
      <div
        style={{
          width: "100%",
          padding: "20px 40px",
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: "1.5rem",
            color: "#fff",
            letterSpacing: "-0.025em",
          }}
        >
          Minority Report
        </span>
      </div>

      {/* Hero — centered text */}
      <div
        style={{
          width: "100%",
          paddingTop: "40px",
          paddingBottom: "48px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "700px", margin: "0 auto", padding: "0 24px" }}>
          <h1
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            {heroTitle}
          </h1>
          <p
            style={{
              marginTop: "24px",
              fontSize: "1.125rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.7,
            }}
          >
            {heroDescription}
          </p>
          <div
            style={{
              marginTop: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              onClick={onEnter}
              style={{
                background: "#fff",
                color: "#000",
                padding: "14px 44px",
                fontSize: "1.1rem",
                borderRadius: "9999px",
                fontWeight: 600,
                border: "none",
                outline: "none",
                boxShadow: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "rgba(255,255,255,0.85)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#fff";
              }}
            >
              Enter
              <ArrowRight style={{ width: 20, height: 20 }} />
            </button>
          </div>
        </div>
      </div>

      {/* Media — full width, edge to edge */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 9",
            borderRadius: "24px",
            overflow: "hidden",
          }}
        >
          <img
            src={backgroundImage}
            alt="Surveillance overview"
            width={2072}
            height={1165}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              inset: 0,
              objectFit: "cover",
              transition: "opacity 500ms ease",
              opacity: isVideoPlaying ? 0 : 1,
            }}
          />
          <video
            ref={videoRef}
            src={videoUrl}
            style={{
              width: "100%",
              height: "100%",
              position: "absolute",
              inset: 0,
              objectFit: "cover",
              transition: "opacity 500ms ease",
              opacity: isVideoPlaying ? 1 : 0,
            }}
            onEnded={handleVideoEnded}
            playsInline
            muted
          />
          <div
            style={{
              position: "absolute",
              bottom: 20,
              right: 20,
              zIndex: 10,
            }}
          >
            {!isVideoPlaying ? (
              <button
                onClick={handlePlayVideo}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  outline: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Play
                  style={{
                    width: 28,
                    height: 28,
                    color: "#fff",
                    fill: "#fff",
                    marginLeft: 3,
                  }}
                />
              </button>
            ) : (
              <button
                onClick={isVideoPaused ? handleResumeVideo : handlePauseVideo}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.2)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                  outline: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {isVideoPaused ? (
                  <Play
                    style={{
                      width: 28,
                      height: 28,
                      color: "#fff",
                      fill: "#fff",
                      marginLeft: 3,
                    }}
                  />
                ) : (
                  <Pause
                    style={{
                      width: 28,
                      height: 28,
                      color: "#fff",
                      fill: "#fff",
                    }}
                  />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export { MinorityReportHero };
