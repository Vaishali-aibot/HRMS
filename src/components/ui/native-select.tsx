import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// A plain <select> styled to match Input, rather than shadcn's Select
// primitive — the forms that use this submit via a Server Action against
// FormData (name + defaultValue on a real form control), which the
// Base UI Select doesn't render as. Use this wherever a dropdown needs to
// participate in a native <form action={...}> submission.
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent px-2.5 py-1 pr-7 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
