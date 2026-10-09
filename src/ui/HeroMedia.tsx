import { useEffect, useState } from 'react';

/**
 * Optional cinematic background (Higgsfield clips, see docs/HIGGSFIELD.md). Files live in public/media and are
 * listed in public/media/manifest.json. Nothing renders when the manifest has no entry. Reduced motion shows
 * the still poster instead of the video.
 */
interface Entry {
  video?: string;
  poster?: string;
}
let manifest: Promise<Record<string, Entry>> | null = null;
const load = (): Promise<Record<string, Entry>> =>
  (manifest ??= fetch('/media/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, Entry>>) : ({} as Record<string, Entry>)))
    .catch(() => ({}) as Record<string, Entry>));

export function HeroMedia({ name }: { name: string }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    void load().then((m) => live && setEntry(m[name] ?? null));
    return () => {
      live = false;
    };
  }, [name]);
  if (!entry || failed) return null;
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <div className="hero-media" aria-hidden="true">
      {entry.video && !still ? (
        <video src={`/media/${entry.video}`} poster={entry.poster ? `/media/${entry.poster}` : undefined} autoPlay muted loop playsInline onError={() => setFailed(true)} />
      ) : entry.poster ? (
        <img src={`/media/${entry.poster}`} alt="" onError={() => setFailed(true)} />
      ) : null}
    </div>
  );
}
