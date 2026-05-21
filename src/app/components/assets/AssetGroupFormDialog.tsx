import React, { useEffect, useMemo, useState } from "react";

import type { AssetGroupRecord, AssetGroupType } from "../../../services/assetGrouping.service";
import type { OrgOption } from "./assetForm.shared";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

interface AssetGroupFormValues {
  group_name: string;
  group_code: string;
  group_type: AssetGroupType;
  description: string;
  parent_group_id: string;
  org_node_id: string;
  is_active: boolean;
}

interface AssetGroupFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialGroup?: AssetGroupRecord | null;
  defaultType?: AssetGroupType;
  defaultParentGroupId?: string | null;
  availableSystems: AssetGroupRecord[];
  orgOptions: OrgOption[];
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: AssetGroupFormValues) => Promise<void> | void;
}

type FieldErrors = Partial<Record<keyof AssetGroupFormValues, string>>;

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-sm text-slate-900 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const buildInitialState = (
  initialGroup?: AssetGroupRecord | null,
  defaultType: AssetGroupType = "SYSTEM",
  defaultParentGroupId?: string | null,
): AssetGroupFormValues => ({
  group_name: initialGroup?.group_name ?? "",
  group_code: initialGroup?.group_code ?? "",
  group_type: initialGroup?.group_type ?? defaultType,
  description: initialGroup?.description ?? "",
  parent_group_id: initialGroup?.parent_group_id ?? defaultParentGroupId ?? "",
  org_node_id: initialGroup?.org_node_id ?? "",
  is_active: initialGroup?.is_active ?? true,
});

export function AssetGroupFormDialog({
  open,
  mode,
  initialGroup = null,
  defaultType = "SYSTEM",
  defaultParentGroupId = null,
  availableSystems,
  orgOptions,
  saving = false,
  onOpenChange,
  onSubmit,
}: AssetGroupFormDialogProps) {
  const [values, setValues] = useState<AssetGroupFormValues>(() =>
    buildInitialState(initialGroup, defaultType, defaultParentGroupId),
  );
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setValues(buildInitialState(initialGroup, defaultType, defaultParentGroupId));
    setErrors({});
  }, [defaultParentGroupId, defaultType, initialGroup, open]);

  const parentOptions = useMemo(
    () => availableSystems.filter((group) => group.id !== initialGroup?.id),
    [availableSystems, initialGroup?.id],
  );

  const typeLocked = mode === "edit" && (initialGroup?.child_group_count ?? 0) > 0;

  const validate = (): FieldErrors => {
    const nextErrors: FieldErrors = {};

    if (!values.group_name.trim()) {
      nextErrors.group_name = "Group name is required";
    }
    if (values.group_type === "SYSTEM" && values.parent_group_id) {
      nextErrors.parent_group_id = "SYSTEM groups cannot have a parent";
    }

    return nextErrors;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    await onSubmit({
      ...values,
      group_name: values.group_name.trim(),
      group_code: values.group_code.trim(),
      description: values.description.trim(),
      parent_group_id: values.group_type === "SYSTEM" ? "" : values.parent_group_id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit"
              ? "Edit Asset Group"
              : defaultType === "SYSTEM"
                ? "Create System"
                : "Create Sub-system"}
          </DialogTitle>
          <DialogDescription>
            Systems can hold direct assets and sub-systems. Sub-systems can hold direct assets and optionally belong to a
            parent system.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1.5 md:col-span-2">
            <Input
              label="Group Name"
              value={values.group_name}
              onChange={(event) => setValues((current) => ({ ...current, group_name: event.target.value }))}
              placeholder="e.g. Packaging Line A"
              disabled={saving}
            />
            {errors.group_name && <p className="text-xs text-red-600">{errors.group_name}</p>}
          </div>

          <Input
            label="Group Code"
            value={values.group_code}
            onChange={(event) => setValues((current) => ({ ...current, group_code: event.target.value.toUpperCase() }))}
            placeholder="e.g. SYS-PACK-A"
            disabled={saving}
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Group Type</label>
            <select
              className={selectClassName}
              value={values.group_type}
              onChange={(event) => {
                const nextType = event.target.value as AssetGroupType;
                setValues((current) => ({
                  ...current,
                  group_type: nextType,
                  parent_group_id: nextType === "SYSTEM" ? "" : current.parent_group_id,
                }));
              }}
              disabled={saving || typeLocked}
            >
              <option value="SYSTEM">System</option>
              <option value="SUB_SYSTEM">Sub-system</option>
            </select>
            {typeLocked && (
              <p className="text-xs text-slate-500">This group type is locked because the selected group already has child groups.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Parent System</label>
            <select
              className={selectClassName}
              value={values.parent_group_id}
              onChange={(event) => setValues((current) => ({ ...current, parent_group_id: event.target.value }))}
              disabled={saving || values.group_type === "SYSTEM"}
            >
              <option value="">No parent system</option>
              {parentOptions.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.group_name}
                  {group.group_code ? ` (${group.group_code})` : ""}
                </option>
              ))}
            </select>
            {errors.parent_group_id && <p className="text-xs text-red-600">{errors.parent_group_id}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Organization Scope</label>
            <select
              className={selectClassName}
              value={values.org_node_id}
              onChange={(event) => setValues((current) => ({ ...current, org_node_id: event.target.value }))}
              disabled={saving}
            >
              <option value="">All organizations</option>
              {orgOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Status</label>
            <select
              className={selectClassName}
              value={values.is_active ? "ACTIVE" : "INACTIVE"}
              onChange={(event) => setValues((current) => ({ ...current, is_active: event.target.value === "ACTIVE" }))}
              disabled={saving}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="asset-group-description">
              Description
            </label>
            <Textarea
              id="asset-group-description"
              value={values.description}
              onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
              placeholder="Describe the connected assets or operational boundary for this group."
              rows={4}
              disabled={saving}
            />
          </div>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Create Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { AssetGroupFormValues };
