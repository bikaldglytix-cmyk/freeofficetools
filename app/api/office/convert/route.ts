/**
 * Office conversion seam.
 *
 * Proxies a multipart conversion request to the document-conversion backend
 * (LibreOffice-class) named by OFFICE_BACKEND_URL. Keeping this on our own
 * origin means the frontend URL never changes when the backend moves from
 * Render to a VPS, and the backend URL is never exposed to the browser.
 *
 * Until OFFICE_BACKEND_URL is set, it returns 501 so the UI can stay honest
 * rather than fake a conversion.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const backend = process.env.OFFICE_BACKEND_URL?.trim();
  if (!backend) {
    return Response.json(
      { error: "Office conversion backend is not configured." },
      { status: 501 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const engine = form.get("engine");
  if (!(file instanceof File) || typeof engine !== "string") {
    return Response.json({ error: "A file and engine are required." }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("engine", engine);
  upstream.append("file", file);

  // Shared secret so only this app can drive the backend (it's a public URL).
  const headers: Record<string, string> = {};
  const token = process.env.OFFICE_BACKEND_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${backend.replace(/\/$/, "")}/convert`, {
      method: "POST",
      body: upstream,
      headers,
    });
    if (!res.ok) {
      const status = res.status === 413 ? 413 : 502;
      return Response.json({ error: "Conversion failed." }, { status });
    }
    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
        "X-Filename": res.headers.get("X-Filename") ?? "",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Could not reach the conversion backend." }, { status: 502 });
  }
}
