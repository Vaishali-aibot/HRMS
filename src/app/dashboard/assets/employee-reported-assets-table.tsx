import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORY_LABELS: Record<string, string> = {
  LAPTOP: "Laptop",
  CHARGER: "Charger",
  MONITOR: "Monitor",
  OTHER: "Other",
};

type ReportedAsset = {
  id: string;
  category: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  processor: string | null;
  ram: string | null;
  operatingSystem: string | null;
  assetTag: string | null;
  otherDescription: string | null;
  notes: string | null;
  employee: { employeeCode: string; fullName: string };
};

function detailSummary(a: ReportedAsset): string {
  const parts: string[] = [];
  if (a.brand || a.model) parts.push([a.brand, a.model].filter(Boolean).join(" "));
  if (a.otherDescription) parts.push(a.otherDescription);
  if (a.processor) parts.push(`Processor: ${a.processor}`);
  if (a.ram) parts.push(`RAM: ${a.ram}`);
  if (a.operatingSystem) parts.push(`OS: ${a.operatingSystem}`);
  if (a.serialNumber) parts.push(`Serial: ${a.serialNumber}`);
  if (a.assetTag) parts.push(`Asset tag: ${a.assetTag}`);
  if (a.notes) parts.push(a.notes);
  return parts.join(" · ") || "—";
}

export function EmployeeReportedAssetsTable({ assets }: { assets: ReportedAsset[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              {a.employee.employeeCode} — {a.employee.fullName}
            </TableCell>
            <TableCell>{CATEGORY_LABELS[a.category] ?? a.category}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{detailSummary(a)}</TableCell>
          </TableRow>
        ))}
        {assets.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
              No employee-reported assets yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
