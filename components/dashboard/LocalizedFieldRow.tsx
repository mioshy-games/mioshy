"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  DASHBOARD_LANGUAGES,
  type DashboardLanguage,
} from "@/lib/dashboard-languages";
import { cn } from "@/lib/utils";

type LocalizedFieldRowProps<T extends FieldValues> = {
  control: Control<T>;
  /** Field base without suffix, e.g. "name" → name_he, name_en */
  fieldBase: string;
  multiline?: boolean;
  languages?: DashboardLanguage[];
  className?: string;
};

export function LocalizedFieldRow<T extends FieldValues>({
  control,
  fieldBase,
  multiline = false,
  languages = DASHBOARD_LANGUAGES,
  className,
}: LocalizedFieldRowProps<T>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:grid md:grid-cols-2 md:items-stretch md:gap-4",
        className,
      )}
    >
      {/* Mobile: Hebrew first (rtl), then English — order by putting he before en in mobile stack */}
      {[...languages]
        .sort((a, b) => {
          if (a.code === "he") return -1;
          if (b.code === "he") return 1;
          return 0;
        })
        .map((lang) => (
          <div
            key={lang.code}
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-1.5",
              "md:order-none",
              lang.code === "en" && "md:order-1 md:col-start-1",
              lang.code === "he" && "md:order-2 md:col-start-2",
            )}
            dir={lang.dir}
          >
            <Label className="text-muted-foreground text-xs font-medium">
              {lang.label}
            </Label>
            <Controller
              control={control}
              name={`${fieldBase}${lang.fieldSuffix}` as FieldPath<T>}
              render={({ field }) =>
                multiline ? (
                  <Textarea
                    {...field}
                    className="min-h-[100px] flex-1 resize-y md:min-h-[120px]"
                  />
                ) : (
                  <Input {...field} className="h-10" />
                )
              }
            />
          </div>
        ))}
    </div>
  );
}
