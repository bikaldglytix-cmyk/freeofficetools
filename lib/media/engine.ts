/**
 * Browser-side media engine.
 *
 * `processMediaFile(engine, files, options)` is the single, implementation-
 * agnostic entry point every media tool calls. Today it runs FFmpeg.wasm in
 * the browser; tomorrow a given engine could `fetch('/api/media/...')` instead
 * — the return shape (`ProcessResult`) and the tool UI would not change.
 */
import { fetchFile } from "@ffmpeg/util";
import type { ProcessResult, ProcessContext } from "@/lib/process/types";
import { baseName, sanitizeFilename } from "@/lib/files";
import { getFFmpeg } from "@/lib/media/ffmpeg";

export type MediaEngine =
  | "video-to-mp3"
  | "mp4-to-mp3"
  | "mp3-converter"
  | "audio-converter"
  | "video-compressor"
  | "audio-trimmer";

export interface MediaOptions {
  /** Audio bitrate for lossy output, e.g. "192k". */
  audioBitrate?: string;
  /** Target container for the audio converter: mp3 | wav | m4a | aac | ogg | flac. */
  format?: string;
  /** Compression strength for the video compressor: light | balanced | strong. */
  level?: string;
  /** Trim window (whole seconds or HH:MM:SS) for the audio trimmer. */
  start?: string;
  end?: string;
}

interface Command {
  args: string[];
  outFsName: string;
  outExt: string;
  mime: string;
  /** Optional suffix added to the download name, e.g. "-compressed". */
  suffix?: string;
}

const AUDIO_FORMATS: Record<string, { ext: string; mime: string; codec: string[]; lossy: boolean }> = {
  mp3: { ext: "mp3", mime: "audio/mpeg", codec: ["-c:a", "libmp3lame"], lossy: true },
  wav: { ext: "wav", mime: "audio/wav", codec: ["-c:a", "pcm_s16le"], lossy: false },
  m4a: { ext: "m4a", mime: "audio/mp4", codec: ["-c:a", "aac"], lossy: true },
  aac: { ext: "aac", mime: "audio/aac", codec: ["-c:a", "aac"], lossy: true },
  ogg: { ext: "ogg", mime: "audio/ogg", codec: ["-c:a", "libvorbis"], lossy: true },
  flac: { ext: "flac", mime: "audio/flac", codec: ["-c:a", "flac"], lossy: false },
};

const CRF_BY_LEVEL: Record<string, string> = {
  light: "23",
  balanced: "28",
  strong: "32",
};

function fileExtension(name: string): string {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  return m ? `.${m[1].toLowerCase()}` : "";
}

function buildCommand(engine: MediaEngine, input: string, options: MediaOptions): Command {
  switch (engine) {
    case "video-to-mp3":
    case "mp4-to-mp3":
    case "mp3-converter": {
      const bitrate = options.audioBitrate ?? "192k";
      return {
        args: ["-i", input, "-vn", "-c:a", "libmp3lame", "-b:a", bitrate, "output.mp3"],
        outFsName: "output.mp3",
        outExt: "mp3",
        mime: "audio/mpeg",
      };
    }
    case "audio-converter": {
      const fmt = AUDIO_FORMATS[options.format ?? "mp3"] ?? AUDIO_FORMATS.mp3;
      const out = `output.${fmt.ext}`;
      const bitrate =
        fmt.lossy && options.audioBitrate ? ["-b:a", options.audioBitrate] : [];
      return {
        args: ["-i", input, "-vn", ...fmt.codec, ...bitrate, out],
        outFsName: out,
        outExt: fmt.ext,
        mime: fmt.mime,
      };
    }
    case "video-compressor": {
      const crf = CRF_BY_LEVEL[options.level ?? "balanced"] ?? "28";
      return {
        args: [
          "-i", input,
          "-c:v", "libx264",
          "-crf", crf,
          "-preset", "veryfast",
          "-c:a", "aac",
          "-b:a", "128k",
          "-movflags", "+faststart",
          "output.mp4",
        ],
        outFsName: "output.mp4",
        outExt: "mp4",
        mime: "video/mp4",
        suffix: "-compressed",
      };
    }
    case "audio-trimmer": {
      const start = (options.start ?? "0").trim() || "0";
      const end = (options.end ?? "").trim();
      return {
        args: [
          "-i", input,
          "-ss", start,
          ...(end ? ["-to", end] : []),
          "-c:a", "libmp3lame",
          "-b:a", options.audioBitrate ?? "192k",
          "output.mp3",
        ],
        outFsName: "output.mp3",
        outExt: "mp3",
        mime: "audio/mpeg",
        suffix: "-trimmed",
      };
    }
    default: {
      const exhaustive: never = engine;
      throw new Error(`Unknown media engine: ${String(exhaustive)}`);
    }
  }
}

async function safeDelete(ffmpeg: Awaited<ReturnType<typeof getFFmpeg>>, name: string): Promise<void> {
  try {
    await ffmpeg.deleteFile(name);
  } catch {
    /* file may not exist if the command failed — ignore */
  }
}

export async function processMediaFile(
  engine: MediaEngine,
  files: File[],
  options: MediaOptions = {},
  ctx: ProcessContext = {},
): Promise<ProcessResult> {
  const file = files[0];
  if (!file) throw new Error("Please add a file first.");

  const ffmpeg = await getFFmpeg();
  const inputName = `input${fileExtension(file.name) || ".bin"}`;
  const { args, outFsName, outExt, mime, suffix } = buildCommand(engine, inputName, options);

  const onProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress) && progress >= 0) {
      ctx.onProgress?.(Math.min(1, progress));
    }
  };
  ffmpeg.on("progress", onProgress);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));
    await ffmpeg.exec(args);

    let data: Uint8Array;
    try {
      data = (await ffmpeg.readFile(outFsName)) as Uint8Array;
    } catch {
      throw new Error("This file couldn't be converted. It may be corrupted or in an unsupported format.");
    }
    if (!data || data.length === 0) {
      throw new Error("The conversion produced an empty file. Please try a different file.");
    }

    const blob = new Blob([data as BlobPart], { type: mime });
    const downloadName = `${sanitizeFilename(baseName(file.name))}${suffix ?? ""}.${outExt}`;
    return {
      outputs: [{ name: downloadName, blob }],
      meta: { inputSize: file.size, outputSize: blob.size },
    };
  } finally {
    ffmpeg.off("progress", onProgress);
    await safeDelete(ffmpeg, inputName);
    await safeDelete(ffmpeg, outFsName);
  }
}
