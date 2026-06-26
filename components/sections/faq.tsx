"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function Faq({ faqs, title = "Frequently asked questions" }: { faqs: { q: string; a: string }[]; title?: string }) {
  return (
    <section aria-labelledby={title ? "faq-heading" : undefined} aria-label={title ? undefined : "Frequently asked questions"}>
      {title ? (
        <h2 id="faq-heading" className="text-2xl font-semibold tracking-tight">
          {title}
        </h2>
      ) : null}
      <Accordion type="single" collapsible className={title ? "mt-4" : undefined}>
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger>{faq.q}</AccordionTrigger>
            <AccordionContent>{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
