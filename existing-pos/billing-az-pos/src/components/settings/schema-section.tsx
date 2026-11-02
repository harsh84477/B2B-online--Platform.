import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ColorField,
  GroupGrid,
  SaveBar,
  SectionSkeleton,
  SelectField,
  SettingsCard,
  TextAreaField,
  TextField,
  ToggleRow,
} from "./kit";
import type { FieldDef, SectionSchema } from "@/lib/settings-schema";
import { schemaDefaults } from "@/lib/settings-schema";
import { useSettingsSection } from "@/lib/settings-store";
import { cn } from "@/lib/utils";

/** Renders any declarative settings section: tabs → cards → fields. */
export function SchemaSection({
  schema,
  canEdit,
  extra,
}: {
  schema: SectionSchema;
  canEdit: boolean;
  /** Optional custom panel rendered above the generic groups of a tab. */
  extra?: Record<string, React.ReactNode>;
}) {
  const defaults = useMemo(() => schemaDefaults(schema), [schema]);
  const state = useSettingsSection(schema.key, defaults);
  const [tab, setTab] = useState(schema.tabs[0]?.id ?? "");
  const readOnly = !canEdit;

  if (state.loading) return <SectionSkeleton />;

  const renderField = (f: FieldDef) => {
    const value = state.values[f.key];
    const common = { disabled: readOnly };
    switch (f.type) {
      case "switch":
        return (
          <ToggleRow
            key={f.key}
            label={f.label}
            {...(f.help ? { help: f.help } : {})}
            checked={!!value}
            onChange={(v) => state.set(f.key, v)}
            {...common}
          />
        );
      case "select":
        return (
          <SelectField
            key={f.key}
            label={f.label}
            value={value}
            options={f.options ?? []}
            {...(f.help ? { help: f.help } : {})}
            onChange={(v) => state.set(f.key, v)}
            {...common}
          />
        );
      case "textarea":
        return (
          <div key={f.key} className={cn(f.span === 3 && "sm:col-span-2 lg:col-span-3")}>
            <TextAreaField
              label={f.label}
              value={value}
              {...(f.help ? { help: f.help } : {})}
              {...(f.placeholder ? { placeholder: f.placeholder } : {})}
              onChange={(v) => state.set(f.key, v)}
              {...common}
            />
          </div>
        );
      case "color":
        return (
          <ColorField key={f.key} label={f.label} value={value} onChange={(v) => state.set(f.key, v)} {...common} />
        );
      case "number":
        return (
          <TextField
            key={f.key}
            label={f.label}
            type="number"
            value={value}
            {...(f.help ? { help: f.help } : {})}
            {...(f.placeholder ? { placeholder: f.placeholder } : {})}
            onChange={(v) => state.set(f.key, v === "" ? 0 : Number(v))}
            {...common}
          />
        );
      default:
        return (
          <TextField
            key={f.key}
            label={f.label}
            type={f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}
            value={value}
            {...(f.help ? { help: f.help } : {})}
            {...(f.placeholder ? { placeholder: f.placeholder } : {})}
            onChange={(v) => state.set(f.key, v)}
            {...common}
          />
        );
    }
  };

  const body = (tabId: string) => {
    const t = schema.tabs.find((x) => x.id === tabId);
    if (!t) return null;
    return (
      <div className="space-y-5">
        {extra?.[tabId]}
        {t.groups.map((g) => (
          <SettingsCard key={g.title} title={g.title} {...(g.description ? { description: g.description } : {})}>
            <GroupGrid columns={g.columns ?? 2}>{g.fields.map(renderField)}</GroupGrid>
          </SettingsCard>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {schema.tabs.length > 1 ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            {schema.tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {schema.tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-5">
              {body(t.id)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        body(schema.tabs[0]?.id ?? "")
      )}

      <SaveBar
        dirty={state.dirty}
        saving={state.saving}
        onSave={state.save}
        onDiscard={state.discard}
        onRestore={state.restoreDefaults}
        readOnly={readOnly}
      />
    </div>
  );
}
