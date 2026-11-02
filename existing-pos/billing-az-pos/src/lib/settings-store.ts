import { useCallback, useEffect, useMemo, useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SettingsValues } from "./settings-schema";

export const settingsQuery = (section: string) =>
  queryOptions({
    queryKey: ["app_settings", section],
    queryFn: async (): Promise<SettingsValues> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("section", section)
        .maybeSingle();
      if (error) throw error;
      return (data?.value ?? {}) as SettingsValues;
    },
    staleTime: 60_000,
  });

export interface SectionState {
  values: SettingsValues;
  set: (key: string, value: string | number | boolean) => void;
  dirty: boolean;
  saving: boolean;
  loading: boolean;
  save: () => void;
  discard: () => void;
  restoreDefaults: () => void;
}

/**
 * Loads one settings section, merges it over its defaults and tracks local
 * edits so each card can save, discard or restore independently.
 */
export function useSettingsSection(section: string, defaults: SettingsValues): SectionState {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(settingsQuery(section));
  const saved = useMemo(() => ({ ...defaults, ...(data ?? {}) }), [defaults, data]);
  const [values, setValues] = useState<SettingsValues>(saved);

  useEffect(() => {
    setValues(saved);
  }, [saved]);

  const mutation = useMutation({
    mutationFn: async (next: SettingsValues) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ section, value: next as never }, { onConflict: "section" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["app_settings", section] });
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("row-level security") ? "Only admins can change this setting" : e.message),
  });

  const set = useCallback(
    (key: string, value: string | number | boolean) => setValues((v) => ({ ...v, [key]: value })),
    [],
  );

  const dirty = useMemo(() => JSON.stringify(values) !== JSON.stringify(saved), [values, saved]);

  return {
    values,
    set,
    dirty,
    saving: mutation.isPending,
    loading: isLoading,
    save: () => mutation.mutate(values),
    discard: () => setValues(saved),
    restoreDefaults: () => setValues({ ...defaults }),
  };
}
