import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-slate-700 dark:bg-slate-900",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
