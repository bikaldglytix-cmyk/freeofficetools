import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ToolGrid } from "@/components/sections/tool-card";
import { tools } from "@/lib/tools";

export default function NotFound() {
  return (
    <div className="container-page py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Page not found</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved. Try one of our tools
          instead.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link href="/pdf-tools">Browse all tools</Link>
          </Button>
        </div>
      </div>
      <div className="mt-14">
        <h2 className="mb-4 text-center text-lg font-semibold">Popular tools</h2>
        <ToolGrid tools={tools.slice(0, 6)} />
      </div>
    </div>
  );
}
