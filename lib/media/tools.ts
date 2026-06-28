import type { LucideIcon } from "lucide-react";
import { Music, FileAudio, AudioLines, Headphones, Minimize2, Scissors, Video, Eraser, ScanSearch, FileEdit, ImageIcon, Shrink } from "lucide-react";

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
  runner: "convert" | "trim" | "inspect" | "edit" | "image-convert" | "image-compress";

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
    title: "MP4 to MP3 — Free & Private Converter",
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
    title: "Audio Converter — MP3, WAV, M4A, OGG, FLAC",
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
    title: "Compress Video — Reduce File Size Free",
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
    title: "Audio Trimmer — Cut Audio Free & Online",
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
  {
    slug: "mov-to-mp4",
    name: "MOV to MP4",
    category: "media",
    icon: Video,
    processing: "client",
    engine: "mov-to-mp4",
    runner: "convert",
    short: "Convert Apple MOV videos to universally compatible MP4 files.",
    title: "MOV to MP4 — Free Online Video Converter",
    metaDescription:
      "Convert MOV videos to MP4 format instantly in your browser. Fast, private, and free. No server uploads.",
    h1: "Convert MOV to MP4",
    heroSubtitle: "Make your Apple videos playable anywhere.",
    keywords: ["mov to mp4", "convert mov to mp4", "free mov converter", "apple to mp4"],
    intro: [
      "MOV files are great for Apple devices, but they don't always play nicely on Windows, Android, or older TVs. This converter changes your MOV to an MP4, the most widely supported video format in the world.",
      "The conversion happens entirely in your browser using WebAssembly. Your videos never leave your device, ensuring total privacy and saving you from slow upload times.",
    ],
    steps: [
      { title: "Select video", text: "Drag a .mov file into the box, or click to browse your device." },
      { title: "Convert to MP4", text: "Click Convert to MP4 and wait a few seconds." },
      { title: "Download", text: "Save your universally playable MP4 file." },
    ],
    faqs: [
      { q: "Is the video quality reduced?", a: "No. The converter preserves high-quality visuals and audio while changing the container to MP4." },
      { q: "Is this really private?", a: "Yes. The conversion happens entirely on your own device. Your videos are never uploaded to our servers." },
      { q: "Will the MP4 play on Windows?", a: "Yes. MP4 is the most universally supported video format and will play natively on Windows, Android, smart TVs, and all web browsers." },
    ],
    related: ["video-compressor", "video-to-mp3"],
    accept: ".mov,video/quicktime",
    acceptLabel: "MOV video files",
    maxSizeMb: 1000,
    action: "Convert to MP4",
    processingLabel: "Converting…",
    downloadLabel: "Download MP4",
  },
  {
    slug: "ai-metadata-remover",
    name: "AI Metadata Remover",
    category: "media",
    icon: Eraser,
    processing: "client",
    engine: "ai-metadata-remover",
    runner: "convert",
    short: "Completely strip all EXIF, XMP, and AI-generated metadata from images.",
    title: "AI Metadata Remover — Clean Image EXIF",
    metaDescription:
      "Remove AI generation tags, EXIF data, GPS locations, and hidden metadata from your images. 100% private, no uploads, works instantly in your browser.",
    h1: "AI Metadata Remover",
    heroSubtitle: "Strip all hidden data and AI generation prompts from your images.",
    keywords: ["ai metadata remover", "remove exif data", "remove image metadata", "strip ai tags", "clean image metadata", "remove midjourney metadata"],
    intro: [
      "Every time you take a photo or generate an image with AI (like Midjourney or Stable Diffusion), hidden metadata is embedded into the file. This can include your GPS location, camera settings, or the exact text prompts used to create the AI image.",
      "Our AI Metadata Remover physically strips 100% of this hidden data. It works by painting your image onto a blank canvas and saving only the raw pixels, permanently destroying any embedded EXIF, XMP, or IPTC profiles. The process runs locally in your browser for absolute privacy."
    ],
    steps: [
      { title: "Select image", text: "Drag a JPG or PNG into the box, or click to browse." },
      { title: "Clean metadata", text: "Click Remove Metadata. The tool will instantly strip all hidden tags." },
      { title: "Download", text: "Save your clean, untraceable image file." },
    ],
    faqs: [
      { q: "Does this remove AI generation prompts?", a: "Yes. AI generators embed prompts and model data into XMP metadata tags. This tool completely destroys all XMP tags." },
      { q: "Is the image quality affected?", a: "The visual quality remains identical. We simply extract the raw pixels and save them without the hidden metadata blocks." },
      { q: "Is my image uploaded?", a: "No. The metadata removal happens entirely on your device inside your web browser. Your images are never sent to a server." },
    ],
    related: ["video-compressor"],
    accept: "image/jpeg,image/png,image/webp",
    acceptLabel: "image files (JPG, PNG, WebP)",
    maxSizeMb: 50,
    action: "Remove Metadata",
    processingLabel: "Cleaning…",
    downloadLabel: "Download clean image",
  },
  {
    slug: "metadata-checker",
    name: "Metadata Checker",
    category: "media",
    icon: ScanSearch,
    processing: "client",
    engine: "ai-metadata-remover", // We don't actually use the engine, but it satisfies the type
    runner: "inspect",
    short: "Instantly view all EXIF, XMP, and hidden metadata in your image.",
    title: "Image Metadata Checker — View EXIF Data",
    metaDescription:
      "Check EXIF data, GPS locations, camera settings, and hidden AI generation prompts in your images. 100% private, no uploads.",
    h1: "Metadata Checker",
    heroSubtitle: "View all hidden EXIF and AI tags embedded in your image.",
    keywords: ["metadata checker", "view exif data", "read image metadata", "check ai tags", "exif viewer", "midjourney metadata viewer"],
    intro: [
      "Digital images contain a surprising amount of hidden information. This includes the camera settings, GPS location, copyright information, and for AI-generated images, the exact prompts used to create them.",
      "Our Metadata Checker instantly extracts and displays every piece of EXIF, XMP, and IPTC data hidden in your file. The analysis happens entirely in your web browser, ensuring your image is never uploaded to any server."
    ],
    steps: [
      { title: "Select image", text: "Drag a JPG or PNG into the box, or click to browse." },
      { title: "Extract data", text: "The tool instantly reads the embedded metadata headers." },
      { title: "Analyze", text: "View the complete breakdown of all hidden tags." },
    ],
    faqs: [
      { q: "Can it read AI generation prompts?", a: "Yes. If the image was generated by Stable Diffusion, Midjourney, or DALL-E and hasn't been scrubbed, the prompts will appear in the XMP or EXIF data." },
      { q: "Is my image uploaded?", a: "No. The extraction runs completely locally in your browser. Your image is never transmitted." },
      { q: "What if no metadata is shown?", a: "Then the image has been scrubbed (e.g. by our AI Metadata Remover, or by a social media platform that automatically strips EXIF data)." },
    ],
    related: ["ai-metadata-remover", "video-compressor"],
    accept: "image/jpeg,image/png,image/webp,image/tiff,image/heic",
    acceptLabel: "image files (JPG, PNG, WebP, HEIC)",
    maxSizeMb: 50,
    action: "Check Metadata",
    processingLabel: "Reading…",
    downloadLabel: "",
  },
  {
    slug: "metadata-editor",
    name: "Metadata Editor",
    category: "media",
    icon: FileEdit,
    processing: "client",
    engine: "ai-metadata-remover", // Satisfies type
    runner: "edit",
    short: "Edit or inject custom EXIF metadata into your JPEG images.",
    title: "EXIF Metadata Editor — Edit Image Tags",
    metaDescription:
      "Easily add, modify, or remove EXIF data like Author, Copyright, and Description from your JPEG images. Runs privately in your browser.",
    h1: "Metadata Editor",
    heroSubtitle: "Inject or modify custom EXIF tags in your JPEG images.",
    keywords: ["metadata editor", "edit exif data", "change image metadata", "exif writer", "add copyright to image"],
    intro: [
      "Digital images contain EXIF data headers that store details like the camera settings, date taken, and copyright information.",
      "Our Metadata Editor allows you to directly manipulate these binary headers to add your own Author, Copyright, or Description tags to any JPEG image. All modifications are made instantly in your browser without uploading your files."
    ],
    steps: [
      { title: "Select image", text: "Drag a JPEG file into the box." },
      { title: "Edit tags", text: "Modify the EXIF properties like Author or Copyright." },
      { title: "Save", text: "Download your newly tagged image instantly." },
    ],
    faqs: [
      { q: "Which formats are supported?", a: "Standard JPEG (.jpg or .jpeg), PNG, and WebP files are supported. Non-JPEG files will be instantly converted to high-quality JPEGs to inject the EXIF data." },
      { q: "Is my image uploaded?", a: "No. The EXIF modification runs completely locally in your browser. Your image is never transmitted." },
    ],
    related: ["metadata-checker", "ai-metadata-remover"],
    accept: "image/jpeg,image/png,image/webp",
    acceptLabel: "JPG, PNG, WebP",
    maxSizeMb: 50,
    action: "Edit Metadata",
    processingLabel: "Saving…",
    downloadLabel: "Download tagged image",
  },
  {
    slug: "png-to-jpg",
    name: "PNG to JPG",
    category: "media",
    icon: ImageIcon,
    processing: "client",
    engine: "ai-metadata-remover", // Satisfies type
    runner: "image-convert",
    short: "Instantly convert PNG images to JPG right in your browser.",
    title: "PNG to JPG — Free Image Converter",
    metaDescription:
      "Convert PNG to JPG free in your browser. Shrink large PNG screenshots and photos into compact, widely supported JPG files — no uploads, no sign-up.",
    h1: "Convert PNG to JPG",
    heroSubtitle: "Turn bulky PNGs into compact, share-ready JPGs.",
    keywords: ["png to jpg", "convert png to jpg", "png to jpeg", "reduce png size", "png to jpg converter"],
    intro: [
      "PNG is a lossless format that keeps images pixel-perfect, but that also makes photos and screenshots several times larger than they need to be. Converting to JPG re-encodes the image with efficient compression, often cutting the file size by 50–80% with no difference you can see at normal viewing size.",
      "JPG (also called JPEG) is the format email clients, web forms and older devices expect, so switching from PNG clears up “file too large” and “unsupported format” problems in one step. One thing to know: JPG has no transparency, so any see-through areas in your PNG are placed on a white background.",
      "Everything runs on your device — the PNG is drawn to a canvas and re-encoded as a JPG right in your browser, so nothing is uploaded and there's no watermark or quality cap.",
    ],
    steps: [
      { title: "Select your PNG", text: "Drag a PNG into the box, or click to choose one from your device." },
      { title: "Convert to JPG", text: "Your image is instantly redrawn and re-encoded as a JPG in the browser." },
      { title: "Download", text: "Save the smaller, widely compatible JPG file." },
    ],
    faqs: [
      { q: "Will the JPG be smaller than my PNG?", a: "Almost always — JPG's compression typically shrinks photos and screenshots by 50–80% compared with the same image saved as a PNG." },
      { q: "What happens to transparent areas?", a: "JPG doesn't support transparency, so any transparent pixels are flattened onto a solid white background during conversion." },
      { q: "Will I lose image quality?", a: "JPG is lossy, but at normal quality the change is invisible for photos. For logos, line art or text, PNG usually looks crisper — keep those as PNG." },
      { q: "Does it work on iPhone and Android?", a: "Yes. The converter runs in any modern mobile or desktop browser, with nothing to install." },
      { q: "Are my images uploaded?", a: "No. The conversion happens entirely in your browser, so your images never leave your device." },
    ],
    related: ["jpg-to-png"],
    accept: "image/png",
    acceptLabel: "PNG images",
    maxSizeMb: 50,
    action: "Convert to JPG",
    processingLabel: "Converting…",
    downloadLabel: "Download JPG",
  },
  {
    slug: "jpg-to-png",
    name: "JPG to PNG",
    category: "media",
    icon: ImageIcon,
    processing: "client",
    engine: "ai-metadata-remover", // Satisfies type
    runner: "image-convert",
    short: "Instantly convert JPG images to lossless PNG.",
    title: "JPG to PNG — Free Image Converter",
    metaDescription:
      "Convert JPG to PNG free in your browser. Get a lossless PNG for editing, graphics and transparency support — no uploads, no sign-up, no quality cap.",
    h1: "Convert JPG to PNG",
    heroSubtitle: "Turn JPGs into clean, lossless PNGs.",
    keywords: ["jpg to png", "convert jpg to png", "jpeg to png", "lossless image", "jpg to png converter"],
    intro: [
      "PNG is a lossless format, so once your image is a PNG it won't pick up any more JPG compression artifacts when you edit and re-save it. That makes PNG the better choice for screenshots, logos, diagrams and any image you plan to mark up or layer in a design tool.",
      "Converting a JPG to PNG also gives you a format that supports transparency, so you can later erase a background or composite the image cleanly. Keep in mind PNG is lossless: the resulting file is usually larger than the JPG, which is the trade-off for that extra clarity and flexibility.",
      "The conversion happens in your browser — your JPG is decoded and re-saved as a PNG on your own device, with no uploads, no watermark and no sign-up.",
    ],
    steps: [
      { title: "Select your JPG", text: "Drag a JPG into the box, or click to choose one from your device." },
      { title: "Convert to PNG", text: "Your image is redrawn and saved as a lossless PNG in the browser." },
      { title: "Download", text: "Save your new PNG file." },
    ],
    faqs: [
      { q: "Will converting recover quality lost by JPG?", a: "No. Detail already lost to JPG compression can't be restored, but a PNG stops any further quality loss when you edit and re-save the image." },
      { q: "Will the PNG have transparency?", a: "The image itself stays opaque, but PNG supports transparency, so you can erase or cut out a background afterwards in an editor." },
      { q: "Why is my PNG larger than the JPG?", a: "PNG is lossless, so it stores every pixel exactly. That's great for clarity but means photos in particular end up bigger than the compressed JPG." },
      { q: "Are my images uploaded?", a: "No. The conversion runs entirely in your browser, so your images stay on your device." },
    ],
    related: ["png-to-jpg"],
    accept: "image/jpeg",
    acceptLabel: "JPEG images",
    maxSizeMb: 50,
    action: "Convert to PNG",
    processingLabel: "Converting…",
    downloadLabel: "Download PNG",
  },
  {
    slug: "heic-to-jpg",
    name: "HEIC to JPG",
    category: "media",
    icon: ImageIcon,
    processing: "client",
    engine: "ai-metadata-remover",
    runner: "image-convert",
    short: "Convert Apple HEIC photos to standard JPG instantly.",
    title: "HEIC to JPG — Free iPhone Photo Converter",
    metaDescription:
      "Convert iPhone HEIC photos to JPG free in your browser. Make Apple photos open on Windows, Android and the web — no uploads, no app, no sign-up.",
    h1: "Convert HEIC to JPG",
    heroSubtitle: "Make iPhone photos open and share anywhere.",
    keywords: ["heic to jpg", "convert heic to jpg", "iphone photo to jpg", "heic to jpeg", "apple photo converter"],
    intro: [
      "Since iOS 11, iPhones save photos as HEIC — a modern format that keeps quality at about half the file size. The catch is that many Windows PCs, Android phones, web uploaders and older apps still can't open HEIC, so the photos show up as “unsupported”.",
      "Converting HEIC to JPG turns those Apple photos into the format everything understands, so you can attach them to email, upload them to forms and websites, or share them with anyone regardless of device. JPG's compression also keeps the files small and quick to send.",
      "The HEIC file is decoded and re-encoded to JPG directly in your browser, so your photos are never uploaded to a server — handy for personal pictures you'd rather keep private.",
    ],
    steps: [
      { title: "Select your HEIC photo", text: "Drag a HEIC/HEIF photo into the box, or click to choose one." },
      { title: "Convert to JPG", text: "The photo is decoded and re-encoded as a standard JPG in your browser." },
      { title: "Download", text: "Save a JPG that opens on any device." },
    ],
    faqs: [
      { q: "Why won't my HEIC photos open on Windows?", a: "HEIC is an Apple-first format and older Windows and Android versions lack the codec. Converting to JPG makes the photo open everywhere without extra software." },
      { q: "Does converting reduce photo quality?", a: "The JPG is encoded at high quality, so the result looks the same to the eye. JPG is lossy, but the difference from the HEIC original isn't visible at normal sizes." },
      { q: "Should I convert to JPG or PNG?", a: "Choose JPG for small, easy-to-share photos. If you need a lossless copy for editing, use HEIC to PNG instead." },
      { q: "Are my photos uploaded?", a: "No. HEIC decoding and JPG encoding happen on your device, so your photos never leave it." },
    ],
    related: ["heic-to-png", "png-to-jpg"],
    accept: "image/heic,image/heic-sequence,.heic,.heif",
    acceptLabel: "HEIC images",
    maxSizeMb: 50,
    action: "Convert to JPG",
    processingLabel: "Decoding…",
    downloadLabel: "Download JPG",
  },
  {
    slug: "heic-to-png",
    name: "HEIC to PNG",
    category: "media",
    icon: ImageIcon,
    processing: "client",
    engine: "ai-metadata-remover",
    runner: "image-convert",
    short: "Convert Apple HEIC photos to lossless PNG instantly.",
    title: "HEIC to PNG — Free iPhone Photo Converter",
    metaDescription:
      "Convert iPhone HEIC photos to lossless PNG free in your browser. Best for editing and graphics work — no uploads, no app, no sign-up, no quality cap.",
    h1: "Convert HEIC to PNG",
    heroSubtitle: "Turn iPhone photos into lossless, editable PNGs.",
    keywords: ["heic to png", "convert heic to png", "iphone photo to png", "heic to png converter", "apple photo converter"],
    intro: [
      "iPhones save photos as HEIC, which most Windows PCs, Android devices and websites can't open. Converting to PNG fixes that compatibility problem — and unlike JPG, PNG is lossless, so the converted image is stored pixel-for-pixel with no compression artifacts.",
      "That makes HEIC → PNG the right choice when you plan to edit the photo, drop it into a design or document, or need the crispest possible copy. If you just want a small file to email or share, HEIC → JPG is usually the better pick, since PNG copies of photos are noticeably larger.",
      "Your HEIC photo is decoded and re-saved as a PNG entirely in your browser, with no uploads, so even personal photos stay on your own device.",
    ],
    steps: [
      { title: "Select your HEIC photo", text: "Drag a HEIC/HEIF photo into the box, or click to choose one." },
      { title: "Convert to PNG", text: "The photo is decoded and saved as a lossless PNG in your browser." },
      { title: "Download", text: "Save a high-quality PNG that opens anywhere." },
    ],
    faqs: [
      { q: "Should I choose PNG or JPG?", a: "Pick PNG for editing or maximum quality; pick JPG for a small, easy-to-share file. PNG is lossless and larger; JPG is compressed and smaller." },
      { q: "Will the PNG keep full quality?", a: "Yes. PNG is lossless, so the converted image preserves all the detail decoded from the HEIC photo." },
      { q: "Why is the PNG file large?", a: "Lossless compression stores every pixel exactly, so PNG copies of photos are bigger than HEIC or JPG. That's the cost of no quality loss." },
      { q: "Are my photos uploaded?", a: "No. The HEIC decoding and PNG export run entirely in your browser, so your photos never leave your device." },
    ],
    related: ["heic-to-jpg", "jpg-to-png"],
    accept: "image/heic,image/heic-sequence,.heic,.heif",
    acceptLabel: "HEIC images",
    maxSizeMb: 50,
    action: "Convert to PNG",
    processingLabel: "Decoding…",
    downloadLabel: "Download PNG",
  },
  {
    slug: "image-compressor",
    name: "Image Compressor",
    category: "media",
    icon: Shrink,
    processing: "client",
    engine: "ai-metadata-remover", // unused for custom runner
    runner: "image-compress",
    short: "Reduce image file size while keeping visual quality.",
    title: "Image Compressor — Shrink JPG, PNG, WebP",
    metaDescription:
      "Compress JPG, PNG, WebP and HEIC images free in your browser. Pick a quality level or a target file size in MB — no uploads, no sign-up, private and fast.",
    h1: "Image Compressor",
    heroSubtitle: "Shrink images by quality level or to an exact target size.",
    keywords: ["image compressor", "compress image", "reduce image size", "compress jpg", "compress png", "compress image to target size"],
    intro: [
      "Oversized images are the most common reason a page loads slowly or an email bounces back. Compressing an image re-encodes it more efficiently — and, when needed, scales down its dimensions — so the file gets dramatically smaller while still looking good on screen.",
      "You can compress two ways: choose a quality level for a quick result, or set a target file size in megabytes and the tool searches for the highest quality that still fits just under your limit. JPG and WebP produce the smallest files; PNG and HEIC inputs are re-encoded to an efficient format for you.",
      "All compression runs locally in your browser, so your images are never uploaded. There's no watermark, no batch limit and no sign-up.",
    ],
    steps: [
      { title: "Select your image", text: "Drag a JPG, PNG, WebP or HEIC image into the box, or click to choose one." },
      { title: "Pick quality or a target size", text: "Choose a quality preset, or enter a target size in MB to compress just under a limit." },
      { title: "Download", text: "Save your smaller image, ready to upload, email or post." },
    ],
    faqs: [
      { q: "How much smaller will my image get?", a: "It depends on the source. Large photos and screenshots often shrink by 70–90%; already-optimized images save less. Target-size mode lets you set an exact ceiling." },
      { q: "Will compressing reduce quality?", a: "Some detail is traded for size. At higher quality the change is hard to notice; pushing for a very small target or low quality will soften fine detail." },
      { q: "Can I compress to a specific file size?", a: "Yes. Switch to target-size mode and enter a size in MB — the tool lowers quality, and scales dimensions if needed, to land just under it." },
      { q: "Which formats are supported?", a: "JPG, PNG, WebP and HEIC inputs are accepted. Photos compress smallest as JPG or WebP; PNG/WebP keep transparency." },
      { q: "Are my images uploaded?", a: "No. Compression happens entirely in your browser, so your images stay on your device." },
    ],
    related: ["png-to-jpg", "heic-to-jpg", "jpg-to-png"],
    accept: "image/jpeg,image/png,image/webp,image/heic,image/heic-sequence,.jpg,.jpeg,.png,.webp,.heic,.heif",
    acceptLabel: "image files",
    maxSizeMb: 50,
    action: "Compress Image",
    processingLabel: "Compressing…",
    downloadLabel: "Download Image",
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
