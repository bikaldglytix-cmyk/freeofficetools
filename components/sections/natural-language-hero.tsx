"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ArrowRight } from "lucide-react";
import { tools } from "@/lib/tools";
import { cn } from "@/lib/utils";

export function NaturalLanguageHero() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedToolSlug, setSelectedToolSlug] = useState("merge-pdf");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const selectedTool = tools.find((t) => t.slug === selectedToolSlug) || tools[0];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center py-20 px-4 text-center">
      
      {/* The Sentence */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-foreground leading-tight max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-6">
        <span>I want to</span>
        
        {/* Interactive Dropdown Toggle */}
        <div className="relative inline-block" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border-b-4 border-primary/20 bg-primary/5 px-6 py-2 text-primary transition-all hover:bg-primary/10 hover:border-primary/40 focus:outline-none",
              isOpen && "bg-primary/10 border-primary/40 ring-4 ring-primary/10"
            )}
          >
            <span>{selectedTool.name.replace(" PDF", "").toLowerCase()}</span>
            <ChevronDown className={cn("size-6 transition-transform duration-300", isOpen && "rotate-180")} />
          </button>

          {/* Dropdown Menu */}
          {isOpen && (
            <div className="absolute left-1/2 top-full z-50 mt-4 w-[280px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border/50 bg-background/95 p-2 shadow-lift backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="max-h-[300px] overflow-y-auto pr-1 text-left">
                {tools.map((tool) => {
                  const actionWord = tool.name.replace(" PDF", "").toLowerCase();
                  return (
                    <button
                      key={tool.slug}
                      onClick={() => {
                        setSelectedToolSlug(tool.slug);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-lg font-medium transition-colors",
                        selectedToolSlug === tool.slug
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      )}
                    >
                      <tool.icon className="size-5" />
                      {actionWord}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        <span>my PDF files.</span>
      </h1>

      {/* Dynamic Subtitle / CTA */}
      <div className="mt-16 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150 fill-mode-both">
        <p className="max-w-xl text-lg text-muted-foreground">
          {selectedTool.intro[0]}
        </p>
        
        <Link
          href={`/pdf-tools/${selectedTool.slug}`}
          className="group mt-8 flex items-center gap-3 rounded-full bg-foreground px-8 py-4 text-lg font-medium text-background transition-transform hover:scale-105 shadow-lift"
        >
          Start {selectedTool.name}
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

    </div>
  );
}
