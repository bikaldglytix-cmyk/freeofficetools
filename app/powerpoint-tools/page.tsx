import type { Metadata } from "next";
import { getOfficeCategory } from "@/lib/office/tools";
import { buildMetadata } from "@/lib/seo";
import { OfficeCategoryView } from "@/components/office/office-category-view";

const category = getOfficeCategory("powerpoint-tools")!;

export const metadata: Metadata = buildMetadata({
  title: category.title,
  description: category.metaDescription,
  path: "/powerpoint-tools",
  keywords: category.keywords,
});

export default function PowerPointToolsPage() {
  return <OfficeCategoryView category={category} />;
}
