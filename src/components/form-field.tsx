import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Shared Label+control wrapper — every form in the app was defining its own
// near-identical local `Field` function. One shared version so spacing and
// label styling stay consistent as more modules get redesigned.
export function FormField({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
