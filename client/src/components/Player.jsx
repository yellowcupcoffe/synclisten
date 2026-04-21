import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";

/**
 * Hidden YouTube iFrame player.
 * Exposes imperative methods: loadVideo, play, pause, seekTo, getCurrentTime, getDuration.
 * Fires onEnded callback when a video finishes playing.
 */
const Player = forwardRef(function Player({ onEnded, onReady, onTimeUpdate }, ref) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const intervalRef = useRef(null);

  // Load YouTube iFrame API and create player
  useEffect(() => {
    let mounted = true;

    const createPlayer = () => {
      if (!containerRef.current || !mounted) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "1",
        width: "1",
        playerVars: {
          autoplay: 0,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (mounted) {
              setReady(true);
              onReady?.();
            }
          },
          onStateChange: (e) => {
            // 0 = ENDED
            if (e.data === 0) {
              onEnded?.();
            }
          },
          onError: (e) => {
            console.error("YT Player error:", e.data);
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      // Load the API script
      const existingScript = document.querySelector(
        'script[src*="youtube.com/iframe_api"]'
      );
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        document.head.appendChild(tag);
      }

      // Set up the global callback
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        createPlayer();
      };
    }

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      try {
        playerRef.current?.destroy();
      } catch (e) {
        /* ignore */
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Time update polling
  useEffect(() => {
    if (!ready) return;

    intervalRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const time = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        onTimeUpdate?.(time, duration);
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose imperative API
  useImperativeHandle(
    ref,
    () => ({
      loadVideo: (videoId, startTime = 0) => {
        if (playerRef.current?.loadVideoById) {
          playerRef.current.loadVideoById({
            videoId,
            startSeconds: startTime,
          });
        }
      },
      play: () => {
        playerRef.current?.playVideo?.();
      },
      pause: () => {
        playerRef.current?.pauseVideo?.();
      },
      seekTo: (time) => {
        playerRef.current?.seekTo?.(time, true);
      },
      getCurrentTime: () => {
        return playerRef.current?.getCurrentTime?.() ?? 0;
      },
      getDuration: () => {
        return playerRef.current?.getDuration?.() ?? 0;
      },
      getState: () => {
        return playerRef.current?.getPlayerState?.() ?? -1;
      },
    }),
    [ready]
  );

  return <div className="yt-player-wrapper" ref={containerRef} />;
});

export default Player;
