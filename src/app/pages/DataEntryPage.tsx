import React, { useState } from "react";
import { Card, CardHeader, CardBody, CardFooter } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Textarea, Select, Toggle, Checkbox } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Tabs } from "../components/ui/Tabs";

interface FormSectionProps {
  number: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  complete?: boolean;
}

function FormSection({ number, title, description, children, complete }: FormSectionProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${complete ? "bg-green-100 text-green-700 ring-1 ring-green-300" : "bg-blue-100 text-blue-700 ring-1 ring-blue-200"}`}>
          {complete ? "✓" : number}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function DataEntryPage() {
  const [activeTab, setActiveTab] = useState("org-node");
  const [isActive, setIsActive] = useState(true);
  const [notify, setNotify] = useState(false);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Data Entry Form Pattern</h1>
          <p className="text-sm text-slate-500 mt-0.5">Reusable 4-section form structure used across all modules</p>
        </div>
        <Badge variant="info">Design Pattern Reference</Badge>
      </div>

      {/* Form variant tabs */}
      <Card padding="none">
        <div className="px-5 pt-3">
          <Tabs
            tabs={[
              { key: "org-node", label: "Org Node Form" },
              { key: "supplier", label: "Supplier Form" },
              { key: "lookup", label: "Lookup Form" },
            ]}
            active={activeTab}
            onChange={setActiveTab}
            variant="underline"
          />
        </div>
      </Card>

      <div className="flex gap-5">
        {/* Main form */}
        <div className="flex-1 space-y-4">
          {/* Section 1 */}
          <FormSection number="1" title="Basic Information" description="Required fields — minimum for form submission" complete>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Entity Name" placeholder="e.g. Chennai Manufacturing Plant" required />
              <Select label="Entity Type" required placeholder="Select type" options={["Corporate","Region","Division","Plant","Section","Department"].map(v => ({ value: v.toLowerCase(), label: v }))} />
              <Input label="Entity Code" placeholder="e.g. SG-IN-CHN-P01" required hint="Auto-generated or enter manually" />
              <Input label="Short Name / Alias" placeholder="Optional short name" />
              <div className="col-span-2 grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <Select label="Parent / Owner" placeholder="Select parent node" options={[{ value: "sciagen-india", label: "Sciagen India" }, { value: "chennai-division", label: "Chennai Division" }]} hint="Determines hierarchy context" />
                </div>
                <Select label="Status" required options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, { value: "pending", label: "Pending Approval" }]} />
              </div>
              <div className="col-span-2 flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-sm font-medium text-slate-700">Active Record</div>
                  <div className="text-xs text-slate-400 mt-0.5">Toggle to mark this record as active or inactive</div>
                </div>
                <Toggle checked={isActive} onChange={setIsActive} />
              </div>
              <Textarea label="Description / Notes" placeholder="Describe the purpose or context of this record..." className="col-span-2" rows={3} />
            </div>
          </FormSection>

          {/* Section 2 */}
          <FormSection number="2" title="Address Information" description="Required for Org Nodes and Suppliers">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Address Line 1" placeholder="Street address" required className="col-span-2" />
              <Input label="Address Line 2" placeholder="Suite, floor, building (optional)" className="col-span-2" />
              <Input label="City" placeholder="City" required />
              <Select label="State / Province" required placeholder="Select state" options={[{ value: "tn", label: "Tamil Nadu" }, { value: "mh", label: "Maharashtra" }, { value: "tx", label: "Texas" }, { value: "wa", label: "Washington" }]} />
              <Select label="Country" required placeholder="Select country" options={[{ value: "in", label: "India" }, { value: "us", label: "United States" }, { value: "gb", label: "United Kingdom" }]} />
              <Input label="Postal / ZIP Code" placeholder="e.g. 600032" />
              <Input label="Latitude" placeholder="e.g. 13.0827" hint="GPS coordinate — decimal degrees" />
              <Input label="Longitude" placeholder="e.g. 80.2707" hint="GPS coordinate — decimal degrees" />
              <Select label="Timezone" placeholder="Select timezone" options={[{ value: "ist", label: "IST (UTC+5:30)" }, { value: "est", label: "EST (UTC-5)" }, { value: "pst", label: "PST (UTC-8)" }]} />
              <Select label="Geographic Region" placeholder="Select region" options={[{ value: "apac", label: "APAC" }, { value: "amer", label: "AMERICAS" }, { value: "emea", label: "EMEA" }]} />
            </div>
          </FormSection>

          {/* Section 3 */}
          <FormSection number="3" title="Contact Information" description="Primary and alternate contacts">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Primary Contact Name" placeholder="Full name" required />
              <Input label="Contact Role / Title" placeholder="e.g. Plant Manager" />
              <Input label="Contact Email" type="email" placeholder="contact@company.com" required />
              <Input label="Contact Phone" placeholder="+1-555-000-0000" />
              <Input label="Alternate Contact Name" placeholder="Full name" />
              <Input label="Alternate Email" type="email" placeholder="alt@company.com" />
              <Input label="Website / URL" placeholder="https://company.com" className="col-span-2" />
              <div className="col-span-2">
                <Checkbox
                  label="Enable Email Notifications"
                  description="Send automated notifications to this contact when records are modified"
                  checked={notify}
                  onChange={e => setNotify(e.target.checked)}
                />
              </div>
            </div>
          </FormSection>

          {/* Section 4 */}
          <FormSection number="4" title="Audit Information" description="System-generated fields — read-only">
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Record ID", value: "SYS-00248" },
                { label: "Created By", value: "admin@system" },
                { label: "Created Date", value: "Feb 26, 2026" },
                { label: "Version", value: "v1.4" },
                { label: "Modified By", value: "admin@system" },
                { label: "Modified Date", value: "Feb 26, 2026 09:30" },
                { label: "IP Address", value: "192.168.x.x" },
                { label: "Checksum", value: "a1b2c3d4..." },
              ].map(({ label, value }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
                  <div className="mt-1 h-9 flex items-center px-3 rounded-md bg-slate-50 border border-dashed border-slate-200">
                    <span className="text-sm text-slate-500 font-mono text-xs">{value}</span>
                  </div>
                </div>
              ))}
            </div>
          </FormSection>
        </div>

        {/* Sidebar */}
        <div className="w-56 shrink-0 space-y-4">
          {/* Completion status */}
          <Card padding="none">
            <CardHeader title="Form Progress" />
            <CardBody padding="sm">
              <div className="mb-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-slate-500">Overall completion</span>
                  <span className="text-xs font-semibold text-slate-700">60%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: "60%" }} />
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { section: "Basic Info", status: "complete", pct: 100 },
                  { section: "Address Info", status: "partial", pct: 50 },
                  { section: "Contact Info", status: "empty", pct: 0 },
                  { section: "Audit Info", status: "system", pct: 100 },
                ].map(({ section, status, pct }) => (
                  <div key={section} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs ${
                      status === "complete" ? "bg-green-100 text-green-600" :
                      status === "partial" ? "bg-amber-100 text-amber-600" :
                      status === "system" ? "bg-slate-200 text-slate-500" :
                      "bg-slate-100 text-slate-300"
                    }`}>
                      {status === "complete" || status === "system" ? "✓" : status === "partial" ? "!" : "○"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{section}</div>
                      <div className="h-1 bg-slate-100 rounded-full mt-0.5">
                        <div className={`h-full rounded-full ${status === "complete" || status === "system" ? "bg-green-500" : status === "partial" ? "bg-amber-400" : "bg-slate-200"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Field legend */}
          <Card padding="none">
            <CardHeader title="Field Types" />
            <CardBody padding="sm">
              <div className="space-y-2">
                {[
                  { type: "Text Input", desc: "Free form text" },
                  { type: "Select / Dropdown", desc: "From lookup values" },
                  { type: "Date Picker", desc: "Calendar selector" },
                  { type: "Toggle", desc: "Boolean on/off" },
                  { type: "Checkbox", desc: "Multi-select option" },
                  { type: "Textarea", desc: "Multi-line text" },
                  { type: "Read-only", desc: "System generated" },
                ].map(({ type, desc }) => (
                  <div key={type} className="flex flex-col">
                    <span className="text-xs font-medium text-slate-700">{type}</span>
                    <span className="text-xs text-slate-400">{desc}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Design notes */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
            <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <span>📌</span> Design Notes
            </div>
            <ul className="space-y-1.5 text-xs text-amber-700">
              {[
                "All forms follow this 4-section pattern",
                "Dropdowns source from Lookup Values",
                "* marks required fields",
                "Audit section is always read-only",
                "Validates on Save press",
                "Unsaved changes prompt on nav",
              ].map((note, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className="shrink-0">—</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-6 py-3 -mx-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-sm text-slate-500">Unsaved changes · Auto-saved 2 min ago</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">↺ Reset</Button>
          <Button variant="secondary" size="sm">✕ Cancel</Button>
          <div className="w-px h-5 bg-slate-200" />
          <Button variant="secondary" size="sm">Save Draft</Button>
          <Button size="sm">Save & Submit</Button>
        </div>
      </div>
    </div>
  );
}
