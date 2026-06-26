import type { LucideIcon } from "lucide-react";
import { Music, FileAudio, AudioLines, Headphones, Minimize2, Scissors } from "lucide-react";

import type { ToolStep, ToolFaq } from "@/lib/tools";
import type { MediaEngine, MediaOptions } from "@/lib/media/engine";

/** A select control rendered by the generic media runner. */
export interface MediaSelectControl {
  kind: "select";
  /** Which MediaOptions field this control sets. */
  key: keyof MediaOptions;
  label: string;
  default: string;
  columns?: number;
  options: { value: string; label: string; description?: string }[];
}

export interface MediaToolDefinition {
  slug: string;
  name: string;
  category: "media";
  icon: LucideIcon;
  processing: "client";
  /** Engine command this tool runs (see lib/media/engine.ts). */
  engine: MediaEngine;
  /** Which interactive runner to render. */
  runner: "convert" | "trim";

  short: string;
  title: string;
  metaDescription: string;
  h1: string;
  heroSubtitle: string;
  keywords: string[];

  intro: string[];
  steps: ToolStep[];
  faqs: ToolFaq[];
  related: string[];

  accept: string;
  acceptLabel: string;
  maxSizeMb: number;
  /** Optional controls for the generic convert runner. */
  controls?: MediaSelectControl[];
  /** Verb shown on the primary button, e.g. "Convert to MP3". */
  action: string;
  processingLabel: string;
  downloadLabel: string;
}

const BITRATE_CONTROL: MediaSelectControl = {
  kind: "select",
  key: "audioBitrate",
  label: "Audio quality",
  default: "192k",
  columns: 3,
  options: [
    { value: "128k", label: "Standard", description: "128 kbps · smallest" },
    { value: "192k", label: "High", description: "192 kbps · recommended" },
    { value: "320k", label: "Best", description: "320 kbps · largest" },
  ],
};

const VIDEO_ACCEPT = "video/*,.mp4,.mov,.avi,.mkv,.webm,.m4v,.wmv,.flv,.mpg,.mpeg,.3gp";
const AV_ACCEPT = "audio/*,video/*";

export const mediaTools: MediaToolDefinition[] = [
  {
    slug: "video-to-mp3",
    name: "Video to MP3",
    category: "media",
    icon: Music,
    processing: "client",
    engine: "video-to-mp3",
    runner: "convert",
    short: "Extract the audio from any video and save it as an MP3.",
    title: "Video to MP3 Converter - Free Online Tool",
    metaDescription:
      "Convert video files to MP3 directly in your browser. Fast, private, and free. No uploads required. Works on desktop and mobile.",
    h1: "Video to MP3 Converter",
    heroSubtitle: "Convert video files to MP3 directly in your browser.",
    keywords: ["video to mp3", "convert video to mp3", "video to mp3 converter", "extract audio from video", "mp3 from video"],
    intro: [
      "Pulling the audio out of a video is the quickest way to keep a song, lecture, podcast or interview without the picture. This converter takes the soundtrack from your video and saves it as a clean MP3 you can play anywhere.",
      "Everything happens inside your browser using your own device, so your video is never uploaded to a server. There is nothing to install, no account to create, and no watermark or quality catch.",
    ],
    steps: [
      { title: "Add your video", text: "Drag a video file into the box, or click to browse and select one from your device." },
      { title: "Pick the audio quality", text: "Choose Standard, High or Best depending on how you'll use the MP3." },
      { title: "Convert and download", text: "Click Convert to MP3 and your audio file downloads as soon as it's ready." },
    ],
    faqs: [
      { q: "How do I convert a video to MP3?", a: "Add your video file, choose an audio quality, then click Convert to MP3. The audio is extracted in your browser and downloads as an MP3 file." },
      { q: "Is the conversion private?", a: "Yes. The conversion runs entirely in your browser, so your video stays on your device and is never uploaded to our servers." },
      { q: "What file formats are supported?", a: "Common video formats including MP4, MOV, AVI, MKV, WEBM, M4V, WMV and FLV. The audio is always saved as an MP3." },
      { q: "Is there a file size limit?", a: "Because processing happens on your device, very large files use more memory. Files up to a few hundred MB work well on most modern computers and phones." },
    ],
    related: ["mp4-to-mp3", "audio-converter", "video-compressor", "audio-trimmer"],
    accept: VIDEO_ACCEPT,
    acceptLabel: "video files",
    maxSizeMb: 500,
    controls: [BITRATE_CONTROL],
    action: "Convert to MP3",
    processingLabel: "Extracting audio…",
    downloadLabel: "Download MP3",
  },
  {
    slug: "mp4-to-mp3",
    name: "MP4 to MP3",
    category: "media",
    icon: FileAudio,
    processing: "client",
    engine: "mp4-to-mp3",
    runner: "convert",
    short: "Turn an MP4 video into an MP3 audio file in seconds.",
    title: "MP4 to MP3 Converter - Free, Private & Online",
    metaDescription:
      "Convert MP4 to MP3 free, directly in your browser. Extract audio from MP4 video with no uploads and no sign-up. Fast and private on desktop and mobile.",
    h1: "MP4 to MP3 Converter",
    heroSubtitle: "Convert MP4 video files to MP3 audio, right in your browser.",
    keywords: ["mp4 to mp3", "convert mp4 to mp3", "mp4 to mp3 converter", "mp4 to mp3 online", "extract audio from mp4"],
    intro: [
      "MP4 is a video format, so it carries both picture and sound. When you only need the sound — a song, a talk, a recorded call — converting the MP4 to MP3 gives you a small audio file that plays on any device or music app.",
      "This tool extracts the audio track from your MP4 and encodes it as an MP3 without uploading anything. The work is done locally in your browser, so even private recordings stay on your device.",
    ],
    steps: [
      { title: "Add your MP4", text: "Drag your MP4 file into the box, or click to choose it from your device." },
      { title: "Choose the quality", text: "Pick the MP3 audio quality that fits how you'll listen." },
      { title: "Convert and download", text: "Click Convert to MP3 and download your audio file instantly." },
    ],
    faqs: [
      { q: "How do I convert MP4 to MP3?", a: "Add your MP4 file, pick an audio quality and click Convert to MP3. The audio is extracted in your browser and saved as an MP3." },
      { q: "Does my MP4 get uploaded?", a: "No. The conversion happens locally in your browser, so your MP4 never leaves your device." },
      { q: "Will I lose audio quality?", a: "The MP3 is encoded from the original audio track. Choosing a higher bitrate keeps it closer to the source; 192 kbps is a good balance for most people." },
      { q: "Can I convert other video formats too?", a: "Yes. For MOV, MKV, WEBM, AVI and more, use the Video to MP3 tool, which accepts a wide range of video formats." },
    ],
    related: ["video-to-mp3", "audio-converter", "mp3-converter", "video-compressor"],
    accept: "video/mp4,.mp4,.m4v",
    acceptLabel: "MP4 files",
    maxSizeMb: 500,
    controls: [BITRATE_CONTROL],
    action: "Convert to MP3",
    processingLabel: "Converting to MP3…",
    downloadLabel: "Download MP3",
  },
  {
    slug: "audio-converter",
    name: "Audio Converter",
    category: "media",
    icon: Headphones,
    processing: "client",
    engine: "audio-converter",
    runner: "convert",
    short: "Convert audio between MP3, WAV, M4A, OGG and FLAC.",
    title: "Audio Converter - Free Online Audio Format Converter",
    metaDescription:
      "Free online audio converter. Convert between MP3, WAV, M4A, AAC, OGG and FLAC in your browser. No uploads, no sign-up — private and fast on any device.",
    h1: "Audio Converter",
    heroSubtitle: "Convert audio files between MP3, WAV, M4A, OGG and FLAC in your browser.",
    keywords: ["audio converter", "convert audio", "audio format converter", "wav to mp3", "m4a to mp3", "online audio converter"],
    intro: [
      "Different apps and devices prefer different audio formats. An audio converter lets you switch between them — MP3 for universal playback, WAV or FLAC for quality, M4A or OGG for smaller modern files — without any guesswork.",
      "Pick your target format and the conversion runs entirely in your browser. Your audio files are never uploaded, so the process is both fast (no waiting on an upload) and completely private.",
    ],
    steps: [
      { title: "Add your audio file", text: "Drag an audio file into the box, or click to select one. You can also drop in a video to pull out its audio." },
      { title: "Choose the output format", text: "Select MP3, WAV, M4A, OGG or FLAC, and a quality level for compressed formats." },
      { title: "Convert and download", text: "Click Convert and download your file in the new format." },
    ],
    faqs: [
      { q: "Which formats can I convert between?", a: "You can convert to MP3, WAV, M4A, AAC, OGG and FLAC. Most common audio and video inputs are accepted as the source." },
      { q: "Is it lossless?", a: "WAV and FLAC are lossless targets. MP3, M4A, AAC and OGG are compressed (lossy), so they're smaller; pick a higher bitrate to keep more detail." },
      { q: "Are my files uploaded?", a: "No. Conversion happens in your browser, so your audio stays private on your device." },
      { q: "Can I convert a video's audio?", a: "Yes. Drop in a video file and the converter will extract and convert its audio track to the format you choose." },
    ],
    related: ["mp3-converter", "video-to-mp3", "audio-trimmer", "video-compressor"],
    accept: AV_ACCEPT,
    acceptLabel: "audio or video files",
    maxSizeMb: 300,
    controls: [
      {
        kind: "select",
        key: "format",
        label: "Convert to",
        default: "mp3",
        columns: 3,
        options: [
          { value: "mp3", label: "MP3", description: "Universal" },
          { value: "wav", label: "WAV", description: "Lossless" },
          { value: "m4a", label: "M4A", description: "Apple/AAC" },
          { value: "ogg", label: "OGG", description: "Open, small" },
          { value: "flac", label: "FLAC", description: "Lossless" },
          { value: "aac", label: "AAC", description: "Compact" },
        ],
      },
      BITRATE_CONTROL,
    ],
    action: "Convert audio",
    processingLabel: "Converting audio…",
    downloadLabel: "Download file",
  },
  {
    slug: "mp3-converter",
    name: "MP3 Converter",
    category: "media",
    icon: AudioLines,
    processing: "client",
    engine: "mp3-converter",
    runner: "convert",
    short: "Convert any audio or video file to MP3.",
    title: "MP3 Converter - Convert to MP3 Free Online",
    metaDescription:
      "Free online MP3 converter. Convert audio and video files to MP3 in your browser with no uploads and no sign-up. Fast, private, and works on any device.",
    h1: "MP3 Converter",
    heroSubtitle: "Convert any audio or video file to MP3, directly in your browser.",
    keywords: ["mp3 converter", "convert to mp3", "audio to mp3", "online mp3 converter", "wav to mp3", "free mp3 converter"],
    intro: [
      "MP3 is the most widely supported audio format there is — it plays on every phone, computer, car stereo and music app. Converting your audio or video files to MP3 makes them easy to share and play absolutely anywhere.",
      "This converter encodes your file to MP3 inside your browser, so nothing is uploaded. It's a fast, private way to standardise a mixed collection of audio files into one reliable format.",
    ],
    steps: [
      { title: "Add a file", text: "Drag in any audio or video file, or click to browse for one." },
      { title: "Set the quality", text: "Choose Standard, High or Best for the MP3 output." },
      { title: "Convert and download", text: "Click Convert to MP3 and your MP3 downloads when it's ready." },
    ],
    faqs: [
      { q: "What can I convert to MP3?", a: "Most audio formats (WAV, M4A, AAC, OGG, FLAC and more) and the audio from common video files can all be converted to MP3." },
      { q: "Is the MP3 converter free?", a: "Yes. It's completely free with no sign-up, no limits and no watermark." },
      { q: "Does converting upload my files?", a: "No. The conversion runs locally in your browser, so your files stay on your device." },
      { q: "What's the difference from the Audio Converter?", a: "This tool always outputs MP3, with a simple quality choice. The Audio Converter lets you target other formats like WAV, M4A, OGG and FLAC too." },
    ],
    related: ["audio-converter", "video-to-mp3", "mp4-to-mp3", "audio-trimmer"],
    accept: AV_ACCEPT,
    acceptLabel: "audio or video files",
    maxSizeMb: 300,
    controls: [BITRATE_CONTROL],
    action: "Convert to MP3",
    processingLabel: "Converting to MP3…",
    downloadLabel: "Download MP3",
  },
  {
    slug: "video-compressor",
    name: "Video Compressor",
    category: "media",
    icon: Minimize2,
    processing: "client",
    engine: "video-compressor",
    runner: "convert",
    short: "Make video files smaller while keeping them watchable.",
    title: "Video Compressor - Reduce Video File Size Free",
    metaDescription:
      "Compress video files free in your browser. Reduce video size for email, upload and sharing with no uploads and no sign-up. Private and fast on any device.",
    h1: "Video Compressor",
    heroSubtitle: "Shrink large video files so they're easy to share — right in your browser.",
    keywords: ["video compressor", "compress video", "reduce video size", "make video smaller", "compress mp4", "shrink video online"],
    intro: [
      "Large video files are awkward to email, slow to upload and quick to fill up storage. Compressing a video re-encodes it more efficiently, cutting the file size while keeping it clear enough to watch comfortably.",
      "The compression runs in your browser, so your footage is never uploaded. Choose how hard to compress and download a smaller MP4 you can share without hitting size limits.",
    ],
    steps: [
      { title: "Add your video", text: "Drag a video file into the box, or click to select it from your device." },
      { title: "Choose a compression level", text: "Light keeps the most quality; Strong makes the smallest file. Balanced is a good default." },
      { title: "Compress and download", text: "Click Compress video and download the smaller MP4 when it's done." },
    ],
    faqs: [
      { q: "How much smaller will my video get?", a: "It depends on the source. High-bitrate phone and screen recordings often shrink a lot, while already-compressed videos save less. The output is an efficient MP4 (H.264)." },
      { q: "Will compressing reduce quality?", a: "Some quality is traded for size. Light barely changes it; Strong is noticeably smaller with more visible compression. Balanced suits most sharing." },
      { q: "Is my video uploaded anywhere?", a: "No. Compression happens entirely in your browser, so your video stays private on your device." },
      { q: "Why does compressing take a while?", a: "Re-encoding video is intensive and runs on your own device, so larger or longer videos take longer. A progress bar shows how it's going." },
    ],
    related: ["video-to-mp3", "mp4-to-mp3", "audio-converter", "audio-trimmer"],
    accept: VIDEO_ACCEPT,
    acceptLabel: "video files",
    maxSizeMb: 500,
    controls: [
      {
        kind: "select",
        key: "level",
        label: "Compression",
        default: "balanced",
        columns: 3,
        options: [
          { value: "light", label: "Light", description: "Best quality" },
          { value: "balanced", label: "Balanced", description: "Recommended" },
          { value: "strong", label: "Strong", description: "Smallest file" },
        ],
      },
    ],
    action: "Compress video",
    processingLabel: "Compressing video…",
    downloadLabel: "Download video",
  },
  {
    slug: "audio-trimmer",
    name: "Audio Trimmer",
    category: "media",
    icon: Scissors,
    processing: "client",
    engine: "audio-trimmer",
    runner: "trim",
    short: "Cut a clip from an audio file by start and end time.",
    title: "Audio Trimmer - Cut & Trim Audio Free Online",
    metaDescription:
      "Trim audio files free in your browser. Cut a clip by start and end time with no uploads and no sign-up. Private, fast audio trimming on desktop and mobile.",
    h1: "Audio Trimmer",
    heroSubtitle: "Cut a clip from an audio or video file by start and end time, in your browser.",
    keywords: ["audio trimmer", "trim audio", "cut audio", "audio cutter", "trim mp3", "cut mp3 online"],
    intro: [
      "Sometimes you only need a piece of an audio file — a ringtone, a single quote, the chorus of a song, or the useful part of a long recording. An audio trimmer lets you keep just that section and drop the rest.",
      "Set a start and end time and the trimmer cuts your clip and saves it as an MP3 — all in your browser, with nothing uploaded. It also works on video files, taking the audio between your chosen times.",
    ],
    steps: [
      { title: "Add your file", text: "Drag in an audio or video file, or click to select one from your device." },
      { title: "Set start and end", text: "Enter the start and end times (in seconds or MM:SS) for the part you want to keep." },
      { title: "Trim and download", text: "Click Trim audio and download your clip as an MP3." },
    ],
    faqs: [
      { q: "How do I enter the times?", a: "Use whole seconds (e.g. 45) or a MM:SS / HH:MM:SS timestamp (e.g. 1:30). Leave the end time blank to trim from your start point to the end of the file." },
      { q: "What format is the clip?", a: "The trimmed clip is saved as an MP3, which plays on virtually any device or app." },
      { q: "Is my file uploaded?", a: "No. Trimming happens in your browser, so your audio or video never leaves your device." },
      { q: "Can I trim the audio from a video?", a: "Yes. Drop in a video file and the trimmer will cut the audio between your start and end times." },
    ],
    related: ["audio-converter", "mp3-converter", "video-to-mp3", "video-compressor"],
    accept: AV_ACCEPT,
    acceptLabel: "audio or video files",
    maxSizeMb: 300,
    action: "Trim audio",
    processingLabel: "Trimming…",
    downloadLabel: "Download clip",
  },
];

const mediaBySlug = new Map(mediaTools.map((t) => [t.slug, t]));

export function getMediaTool(slug: string): MediaToolDefinition | undefined {
  return mediaBySlug.get(slug);
}

export function getRelatedMediaTools(slug: string): MediaToolDefinition[] {
  const tool = getMediaTool(slug);
  if (!tool) return [];
  return tool.related
    .map((s) => mediaBySlug.get(s))
    .filter((t): t is MediaToolDefinition => Boolean(t));
}

export const mediaToolSlugs = mediaTools.map((t) => t.slug);
