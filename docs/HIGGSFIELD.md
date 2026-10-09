# Cinematic clips with Higgsfield (optional)

The app's motion (taps, signing, rings, the Win moment) is built in code so it is instant, works offline and follows the theme. Higgsfield is for a few cinematic background clips that play behind key moments. The app works the same without them.

## How to add a clip

1. Generate the clip in Higgsfield with the prompt below.
2. Export it as **MP4 (H.264)**, **1080 x 1920 (vertical)**, **6 to 8 seconds**, made to **loop seamlessly**, **no audio**, and **under 4 MB** (use Higgsfield's compressed export, or a free compressor like HandBrake).
3. Also save **one still frame as JPG** (under 300 KB). It is shown when the phone is set to reduce motion and while the video loads.
4. Put both files in the `public/media/` folder of the project, then tell Claude. The files are listed in `public/media/manifest.json` like this:

```json
{
  "contract": { "video": "contract.mp4", "poster": "contract.jpg" }
}
```

The clip plays at 22% opacity behind the content, so it reads as atmosphere and never competes with text.

## Clip 1: Contract to Self (`contract`)

Plays behind the contract and the signing moment.

> Slow cinematic push-in on a heavy cream paper document resting on a dark walnut desk at dawn, warm golden light raking across the paper from a window, fine paper texture and soft dust motes drifting in the light beam, a fountain pen resting beside the page, shallow depth of field, calm and reverent mood, muted warm palette of cream, gold and deep brown, no text, no people, no logos, seamless loop, 24 fps.

## Clip 2: The Win moment (`win`)

For a future full-screen Win celebration (wired when the clip exists).

> Golden hour light breaking over a quiet turf field on an empty campus, a single slow camera rise from ground level to the horizon as the sun flares, long soft shadows, warm gold and cream tones, peaceful and triumphant rather than loud, no people, no text, no logos, seamless loop, 24 fps.

## Clip 3: Morning check-in (`checkin`)

Behind the morning check-in screen.

> Pre-dawn light slowly filling a minimal bedroom window, cool blue shifting to warm gold, steam rising gently from a cup on the sill, very slow motion, calm and hopeful, no people, no text, seamless loop, 24 fps.

## Tips

- Ask Higgsfield for "seamless loop" and check the first and last second match.
- Keep motion slow. Fast motion behind text is tiring.
- For the dark themes (Black and Gold, Black Panther), a darker variant of each clip looks better. Name it `contract-dark.mp4` and tell Claude.
