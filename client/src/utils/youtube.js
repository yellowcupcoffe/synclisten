const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";

/**
 * Extract YouTube video ID from various URL formats.
 */
export function extractVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([^&\s?#]+)/,
    /(?:youtu\.be\/)([^&\s?#]+)/,
    /(?:youtube\.com\/embed\/)([^&\s?#]+)/,
    /(?:youtube\.com\/shorts\/)([^&\s?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Fetch video metadata using the server's oEmbed proxy.
 * Returns { title, author_name, thumbnail_url } or null on failure.
 */
export async function fetchVideoInfo(youtubeUrl) {
  try {
    const res = await fetch(
      `${SERVER_URL}/api/oembed?url=${encodeURIComponent(youtubeUrl)}`
    );
    if (!res.ok) throw new Error("oEmbed fetch failed");
    const data = await res.json();
    return {
      title: data.title || "Unknown Title",
      channelName: data.author_name || "",
      thumbnail: data.thumbnail_url || "",
    };
  } catch (err) {
    console.error("Failed to fetch video info:", err);
    return null;
  }
}

/**
 * Get high-res thumbnail for a YouTube video ID.
 */
export function getThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Format seconds to mm:ss string.
 */
export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
