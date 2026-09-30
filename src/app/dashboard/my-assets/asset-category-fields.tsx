import { FormField } from "@/components/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type AssetCategory = "LAPTOP" | "CHARGER" | "MONITOR" | "OTHER";

export type AssetDefaults = {
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  processor?: string | null;
  ram?: string | null;
  operatingSystem?: string | null;
  assetTag?: string | null;
  otherDescription?: string | null;
  notes?: string | null;
};

/**
 * The set of fields relevant to each category is genuinely different (a
 * charger has nothing to say about RAM), so this renders only the fields
 * that apply instead of showing every possible field for every category.
 * Shared between the add form and each card's inline edit form so the two
 * never drift apart.
 */
export function AssetCategoryFields({
  category,
  defaults,
  idPrefix,
}: {
  category: AssetCategory;
  defaults?: AssetDefaults;
  /** Distinguishes label `htmlFor`/input `id` across multiple forms on the same page (add form vs. N edit forms). */
  idPrefix: string;
}) {
  const id = (field: string) => `${idPrefix}-${field}`;

  if (category === "LAPTOP") {
    return (
      <>
        <FormField label="Brand" htmlFor={id("brand")}>
          <Input id={id("brand")} name="brand" defaultValue={defaults?.brand ?? ""} placeholder="Dell" />
        </FormField>
        <FormField label="Model" htmlFor={id("model")}>
          <Input
            id={id("model")}
            name="model"
            defaultValue={defaults?.model ?? ""}
            placeholder="Latitude 5440"
          />
        </FormField>
        <FormField label="Serial No." htmlFor={id("serialNumber")}>
          <Input id={id("serialNumber")} name="serialNumber" defaultValue={defaults?.serialNumber ?? ""} />
        </FormField>
        <FormField label="Processor" htmlFor={id("processor")}>
          <Input
            id={id("processor")}
            name="processor"
            defaultValue={defaults?.processor ?? ""}
            placeholder="Intel i5-1335U"
          />
        </FormField>
        <FormField label="RAM" htmlFor={id("ram")}>
          <Input id={id("ram")} name="ram" defaultValue={defaults?.ram ?? ""} placeholder="16GB" />
        </FormField>
        <FormField label="Operating system" htmlFor={id("operatingSystem")}>
          <Input
            id={id("operatingSystem")}
            name="operatingSystem"
            defaultValue={defaults?.operatingSystem ?? ""}
            placeholder="Windows 11"
          />
        </FormField>
      </>
    );
  }

  if (category === "CHARGER") {
    return (
      <FormField label="Serial No." htmlFor={id("serialNumber")} className="sm:col-span-2">
        <Input id={id("serialNumber")} name="serialNumber" defaultValue={defaults?.serialNumber ?? ""} />
      </FormField>
    );
  }

  if (category === "MONITOR") {
    return (
      <>
        <FormField label="Serial No." htmlFor={id("serialNumber")}>
          <Input id={id("serialNumber")} name="serialNumber" defaultValue={defaults?.serialNumber ?? ""} />
        </FormField>
        <FormField label="Asset tag" htmlFor={id("assetTag")}>
          <Input id={id("assetTag")} name="assetTag" defaultValue={defaults?.assetTag ?? ""} />
        </FormField>
      </>
    );
  }

  // OTHER
  return (
    <>
      <FormField label="What is it?" htmlFor={id("otherDescription")} className="sm:col-span-2">
        <Input
          id={id("otherDescription")}
          name="otherDescription"
          defaultValue={defaults?.otherDescription ?? ""}
          placeholder="Keyboard, mouse, headset…"
        />
      </FormField>
      <FormField label="Serial No. (optional)" htmlFor={id("serialNumber")}>
        <Input id={id("serialNumber")} name="serialNumber" defaultValue={defaults?.serialNumber ?? ""} />
      </FormField>
      <FormField label="Notes (optional)" htmlFor={id("notes")} className="sm:col-span-2">
        <Textarea id={id("notes")} name="notes" defaultValue={defaults?.notes ?? ""} rows={2} />
      </FormField>
    </>
  );
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  LAPTOP: "Laptop",
  CHARGER: "Charger",
  MONITOR: "Monitor",
  OTHER: "Other",
};
