"use client";

import { useState } from "react";
import piexif from "piexifjs";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { validateFiles } from "@/lib/files";
import { Loader2, Trash2, FileEdit, Download } from "lucide-react";
import type { MediaToolDefinition } from "@/lib/media/tools";
import { ToolPanel } from "@/components/tools/tool-ui";
import { FilePill } from "@/components/tools/shared";

// Common EXIF fields to expose
const EDITABLE_FIELDS = [
  { key: "ImageDescription", label: "Image Description", ifd: "0th", tag: piexif.ImageIFD.ImageDescription },
  { key: "Make", label: "Camera Make", ifd: "0th", tag: piexif.ImageIFD.Make },
  { key: "Model", label: "Camera Model", ifd: "0th", tag: piexif.ImageIFD.Model },
  { key: "Software", label: "Software", ifd: "0th", tag: piexif.ImageIFD.Software },
  { key: "DateTime", label: "Date & Time", ifd: "0th", tag: piexif.ImageIFD.DateTime },
  { key: "Artist", label: "Artist / Author", ifd: "0th", tag: piexif.ImageIFD.Artist },
  { key: "Copyright", label: "Copyright", ifd: "0th", tag: piexif.ImageIFD.Copyright },
] as const;

export function EditMetadataRunner({ tool }: { tool: MediaToolDefinition }) {
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [exifObj, setExifObj] = useState<any>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  function add(files: File[]) {
    const { valid, error } = validateFiles(files, {
      accept: tool.accept,
      multiple: false,
      maxSizeMb: tool.maxSizeMb,
    });
    if (error) {
      setErr(error);
      return;
    }
    setErr(null);
    const f = valid[0];
    setFile(f);
    loadExif(f);
  }

  function loadExif(f: File) {
    setLoading(true);
    
    // If not a JPEG, we must first convert it to a JPEG DataURL via Canvas
    // because piexifjs only supports manipulating JPEG binary structures.
    if (f.type !== "image/jpeg") {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setErr("Failed to initialize canvas.");
          setLoading(false);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const jpegData = canvas.toDataURL("image/jpeg", 1.0);
        URL.revokeObjectURL(url);
        processJpegData(jpegData);
      };
      img.onerror = () => {
        setErr("Failed to load image for conversion.");
        setLoading(false);
      };
      img.src = url;
      return;
    }
    
    // If it's already a JPEG, just read it directly
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result as string;
      processJpegData(data);
    };
    reader.onerror = () => {
      setErr("Failed to read file.");
      setLoading(false);
    };
    reader.readAsDataURL(f);
  }

  function processJpegData(data: string) {
    try {
      setDataUrl(data);
      
      let loadedExif;
      try {
        loadedExif = piexif.load(data);
      } catch (err) {
        loadedExif = { "0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null };
      }
      
      setExifObj(loadedExif);
      
      const initialForm: Record<string, string> = {};
      for (const field of EDITABLE_FIELDS) {
        const raw = (loadedExif as any)[field.ifd]?.[field.tag];
        if (raw) {
          initialForm[field.key] = raw;
        } else {
          initialForm[field.key] = "";
        }
      }
      setFormValues(initialForm);
    } catch (e: any) {
      setErr("Could not parse image data.");
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!exifObj || !dataUrl || !file) return;
    
    try {
      const newExif = { ...exifObj };
      if (!newExif["0th"]) newExif["0th"] = {};
      
      // Update EXIF object with form values
      for (const field of EDITABLE_FIELDS) {
        const val = formValues[field.key];
        if (val && val.trim() !== "") {
          (newExif as any)[field.ifd][field.tag] = val;
        } else {
          // If cleared, delete from EXIF
          delete (newExif as any)[field.ifd][field.tag];
        }
      }
      
      // Generate binary EXIF and insert into JPEG
      const exifBytes = piexif.dump(newExif);
      const newJpegDataUrl = piexif.insert(exifBytes, dataUrl);
      
      // Convert Data URL back to Blob for download
      const binaryMatch = newJpegDataUrl.match(/,(.*)$/);
      if (!binaryMatch) throw new Error("Invalid data URL");
      
      const byteString = atob(binaryMatch[1]);
      const mimeString = newJpegDataUrl.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: mimeString });
      
      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.name.replace(/\.[^/.]+$/, "")}-tagged.jpg`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (e: any) {
      setErr("Failed to save EXIF data. The image might be corrupted or unsupported.");
    }
  }

  function reset() {
    setFile(null);
    setErr(null);
    setDataUrl(null);
    setExifObj(null);
    setFormValues({});
  }

  return (
    <ToolPanel>
      <div className="flex items-center justify-between p-6">
        <div>
          <h2 className="text-xl font-semibold leading-none tracking-tight">{tool.h1}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tool.heroSubtitle}</p>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30 p-6">
        {!file && (
          <div className="space-y-4">
            {err && <div className="text-sm font-medium text-destructive">{err}</div>}
            <Dropzone
              onFiles={add}
              multiple={false}
              accept={tool.accept}
              acceptLabel={tool.acceptLabel}
            />
          </div>
        )}

        {file && !exifObj && loading && (
          <div className="flex min-h-[200px] flex-col items-center justify-center space-y-4 rounded-xl border border-dashed border-border bg-background p-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm font-medium">Reading EXIF segments...</p>
          </div>
        )}

        {file && exifObj && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <FilePill name={file.name} size={file.size} onRemove={reset} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <Trash2 className="mr-2 size-4" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Download className="mr-2 size-4" />
                  Save & Download
                </Button>
              </div>
            </div>

            {err && <div className="text-sm font-medium text-destructive">{err}</div>}

            <div className="rounded-xl border border-border bg-background shadow-sm p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-4 mb-4">
                <FileEdit className="size-5 text-primary" />
                <h3 className="font-semibold">Edit Metadata Tags</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {EDITABLE_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      value={formValues[field.key] || ""}
                      onChange={(e) => setFormValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolPanel>
  );
}
