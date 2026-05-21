import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Drawer } from "../ui/Modal";
import { SupplierRecord, getSupplierById } from "../../../services/supplier.service";

interface SupplierDetailDrawerProps {
  open: boolean;
  supplierId: string | null;
  onClose: () => void;
}

const mapAxiosErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Unexpected error occurred";
  }
  const status = error.response?.status;
  const data = error.response?.data as { message?: string } | undefined;
  if (status === 404) return data?.message || "Supplier not found";
  return data?.message || error.message || "Failed to load supplier detail";
};

const formatValue = (value?: string | null): string => {
  if (value === undefined || value === null || String(value).trim() === "") return "-";
  return String(value);
};

export function SupplierDetailDrawer({
  open,
  supplierId,
  onClose,
}: SupplierDetailDrawerProps) {
  const [supplier, setSupplier] = useState<SupplierRecord | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !supplierId) return;
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        const detail = await getSupplierById(supplierId);
        if (!cancelled) setSupplier(detail);
      } catch (error) {
        if (!cancelled) {
          toast.error(mapAxiosErrorMessage(error));
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, supplierId, onClose]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Supplier Detail"
      description="Read-only supplier snapshot"
      width="w-[42rem] max-w-[96vw]"
    >
      <div className="p-5">
        {loading ? (
          <p className="text-sm text-slate-600">Loading supplier details...</p>
        ) : !supplier ? (
          <p className="text-sm text-slate-600">No supplier selected.</p>
        ) : (
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Basic Information</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs text-slate-500">Supplier Name</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_name)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Supplier Type</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_type)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Enrolled Date</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.enrolled_dt)}</p>
                </div>
              </div>
            </div>

            {/* Address Info */}
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Address</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">Address Line 1</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_add1)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">Address Line 2</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_add2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">City</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_city)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pincode</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_pincode)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">State</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_state)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Country</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.supplier_country)}</p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Contact Information</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs text-slate-500">Contact Name</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.contact_name)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Contact Email</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.contact_email)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Contact Phone</p>
                  <p className="text-sm font-medium text-slate-900">{formatValue(supplier.contact_phone)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

