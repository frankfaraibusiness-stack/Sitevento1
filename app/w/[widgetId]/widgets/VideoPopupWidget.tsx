'use client';

// Click-to-play (or configured autoplay) video overlay. Fully
// functional for both a direct mp4 URL (native <video>) and a YouTube
// embed URL (iframe) — whichever the owner pastes in.
import { useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

function isYouTube(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

function toYouTubeEmbed(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    const id = u.searchParams.get('v');
    if (id) return `https://www.youtube.com/embed/${id}`;
    return url;
  } catch {
    return url;
  }
}

export function VideoPopupWidget({ config }: Props) {
  const videoUrl = typeof config.videoUrl === 'string' ? config.videoUrl : '';
  const autoplay = Number(config.autoplay) === 1;
  const [playing, setPlaying] = useState(autoplay);

  if (!videoUrl) {
    return (
      <div style={{ padding: 12, fontSize: 12, color: '#9a938a', textAlign: 'center' }}>
        No video configured yet.
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {playing ? (
        isYouTube(videoUrl) ? (
          <iframe
            src={`${toYouTubeEmbed(videoUrl)}?autoplay=1`}
            style={{ width: '100%', height: '100%', border: 0 }}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            title="Video"
          />
        ) : (
          <video src={videoUrl} controls autoPlay style={{ width: '100%', height: '100%' }} />
        )
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play video"
          style={{
            background: 'rgba(255,255,255,0.92)',
            border: 0,
            borderRadius: '50%',
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width={22} height={22} fill="#22201c">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      )}
    </div>
  );
}
