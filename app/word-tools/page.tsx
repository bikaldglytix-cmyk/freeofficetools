import type { Metadata } from "next";
import { getOfficeCategory } from "@/lib/office/tools";
import { buildMetadata } from "@/lib/seo";
import { OfficeCategoryView } from "@/components/office/office-category-view";

const category = getOfficeCategory("word-tools")!;

export const metadata: Metadata = buildMetadata({
  title: category.title,
  description: category.metaDescription,
  path: "/word-tools",
  keywords: category.keywords,
});

export default function WordToolsPage() {
  return <OfficeCategoryView category={category} />;
}
