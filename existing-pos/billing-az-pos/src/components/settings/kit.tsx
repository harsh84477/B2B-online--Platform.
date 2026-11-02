import type { ReactNode } from "react";
import { AlertCircle, HelpCircle, RotateCcw, Save, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Help" className="text-muted-foreground/70 hover:text-foreground">
            <HelpCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SettingsCard({
  title,
  description,
  children,
  actions,
  footer,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-border/80 shadow-sm transition-shadow hover:shadow-md", className)}>
      <CardContent className="p-5 sm:p-6">
        {(title || actions) && (
          <div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}
        {children}
      </CardContent>
      {footer}
    </Card>
  );
}

/** Sticky action bar shown at the bottom of every editable section. */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  onRestore,
  readOnly,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onRestore: () => void;
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <div className="sticky bottom-0 z-20 flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
        <AlertCircle className="size-4" /> You have view-only access to this section.
      </div>
    );
  }
  return (
    <div className="sticky bottom-0 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur">
      <p className="min-w-0 truncate text-sm text-muted-foreground">
        {dirty ? (
          <span className="inline-flex items-center gap-2 font-medium text-foreground">
            <span className="size-2 shrink-0 rounded-full bg-amber-500" /> Unsaved changes
          </span>
        ) : (
          "All changes saved"
        )}
      </p>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <ConfirmButton
          label="Restore defaults"
          icon={<RotateCcw className="size-4" />}
          title="Restore factory defaults?"
          description="Every field in this section returns to its shipped value. You still need to save to apply."
          onConfirm={onRestore}
        />
        <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty}>
          <Undo2 className="size-4" /> Discard
        </Button>
        <Button size="sm" onClick={onSave} disabled={!dirty || saving}>
          <Save className="size-4" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export function ConfirmButton({
  label,
  icon,
  title,
  description,
  onConfirm,
  variant = "ghost",
  destructive,
}: {
  label: string;
  icon?: ReactNode;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: "ghost" | "outline" | "destructive" | "secondary";
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm">
          {icon} {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            onClick={onConfirm}
          >
            Confirm
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function FieldShell({
  label,
  help,
  children,
  className,
}: {
  label: string;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {help && <HelpTip text={help} />}
      </Label>
      {children}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  help,
  disabled,
  className,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  help?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <FieldShell label={label} {...(help ? { help } : {})} {...(className ? { className } : {})}>
      <Input
        type={type}
        value={String(value ?? "")}
        placeholder={placeholder ?? ""}
        disabled={!!disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  help,
  disabled,
}: {
  label: string;
  value: unknown;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  help?: string;
  disabled?: boolean;
}) {
  return (
    <FieldShell label={label} {...(help ? { help } : {})}>
      <Select value={String(value ?? "")} onValueChange={onChange} disabled={!!disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  );
}

export function ToggleRow({
  label,
  help,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/60">
      <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
        <span className="truncate">{label}</span>
        {help && <HelpTip text={help} />}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={!!disabled} className="shrink-0" />
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  help,
  placeholder,
  disabled,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  rows?: number;
  help?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <FieldShell label={label} {...(help ? { help } : {})}>
      <Textarea
        rows={rows}
        value={String(value ?? "")}
        placeholder={placeholder ?? ""}
        disabled={!!disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  );
}

export function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: unknown;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <FieldShell label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={String(value ?? "#000000")}
          disabled={!!disabled}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent"
        />
        <Input value={String(value ?? "")} disabled={!!disabled} onChange={(e) => onChange(e.target.value)} />
      </div>
    </FieldShell>
  );
}

export function UploadField({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value?: string;
  onChange: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  return (
    <FieldShell label={label}>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/60",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        {value ? (
          <img src={value} alt={label} className="size-10 shrink-0 rounded-md object-contain" />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-background text-xs">IMG</span>
        )}
        <span className="min-w-0 flex-1 truncate">{value ? "Replace image" : (hint ?? "Click to upload (PNG/JPG)")}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!!disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange(String(reader.result));
            reader.readAsDataURL(file);
          }}
        />
      </label>
    </FieldShell>
  );
}

export function SectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function GroupGrid({ columns = 2, children }: { columns?: 1 | 2 | 3; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        columns === 1 && "grid-cols-1",
        columns === 2 && "sm:grid-cols-2",
        columns === 3 && "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}
