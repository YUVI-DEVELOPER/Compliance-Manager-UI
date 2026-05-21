import React, { useEffect, useMemo, useState } from "react";
import { BellRing, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

import {
  AuditReviewNotification,
  AuditReviewReportDetail,
  dismissAuditReviewNotification,
  listAuditReviewReportNotifications,
  prepareAuditReviewNotifications,
  sendAuditReviewReportNotifications,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  formatAuditReviewRating,
  getAuditReviewRatingBadgeClass,
} from "./AuditReviewScoreCard";

interface AuditReviewNotificationsPanelProps {
  report: AuditReviewReportDetail;
  defaultActor?: string | null;
  onNotificationsChanged?: () => void;
}

type NotificationAction = "prepare" | "send" | "refresh" | "dismiss" | null;

const ESCALATION_MATRIX: Record<string, { priority: string; requiredAction: string; stakeholderRoles: string[] }> = {
  COMPLIANT: {
    priority: "LOW",
    requiredAction: "Document and close. Schedule next review.",
    stakeholderRoles: ["System Owner"],
  },
  MINOR_FINDINGS: {
    priority: "MEDIUM",
    requiredAction: "Observation report; CAPA within 30 days.",
    stakeholderRoles: ["QA Manager", "IT Compliance"],
  },
  MAJOR_FINDINGS: {
    priority: "HIGH",
    requiredAction: "Formal CAPA + Deviation; escalate in 7 days.",
    stakeholderRoles: ["QA Director", "Regulatory Affairs"],
  },
  CRITICAL_RISK: {
    priority: "CRITICAL",
    requiredAction: "Immediate escalation; system suspension review.",
    stakeholderRoles: ["VP Quality", "Executive Leadership", "Regulatory Authority"],
  },
};

const SENDABLE_STATUSES = new Set(["PENDING", "READY"]);

const formatLabel = (value?: string | null): string => {
  if (!value) return "-";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      return upper.length <= 4 ? upper : upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getPriorityBadgeClass = (priority?: string | null): string => {
  if (priority === "CRITICAL") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "HIGH") return "border-orange-200 bg-orange-50 text-orange-700";
  if (priority === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "LOW") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const getStatusBadgeClass = (status?: string | null): string => {
  if (status === "SENT") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "READY" || status === "PENDING") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "DISMISSED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

const getChannelLabel = (channel?: string | null): string => {
  if (channel === "IN_APP") return "In-app";
  return formatLabel(channel);
};

export function AuditReviewNotificationsPanel({
  report,
  onNotificationsChanged,
}: AuditReviewNotificationsPanelProps) {
  const [notifications, setNotifications] = useState<AuditReviewNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<NotificationAction>(null);
  const [error, setError] = useState<string | null>(null);

  const rating = report.rating || String(report.report_summary?.rating || "");
  const escalation = ESCALATION_MATRIX[String(rating || "").toUpperCase()] ?? null;
  const isApproved = report.status === "APPROVED";
  const hasSendableNotifications = notifications.some((notification) => SENDABLE_STATUSES.has(notification.status));

  const statusSummary = useMemo(() => {
    const counts = notifications.reduce<Record<string, number>>((accumulator, notification) => {
      accumulator[notification.status] = (accumulator[notification.status] ?? 0) + 1;
      return accumulator;
    }, {});

    return ["READY", "PENDING", "SENT", "FAILED", "DISMISSED"]
      .filter((status) => counts[status])
      .map((status) => `${formatLabel(status)} ${counts[status]}`)
      .join(" | ") || "No notifications prepared";
  }, [notifications]);

  const loadNotifications = async (mode: NotificationAction = "refresh") => {
    setAction(mode);
    setLoading(mode === "refresh");
    setError(null);
    try {
      const rows = await listAuditReviewReportNotifications(report.report_id);
      setNotifications(rows);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Notification history could not be loaded.";
      setError(message);
    } finally {
      setAction(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    setNotifications([]);
    setError(null);
    void loadNotifications("refresh");
  }, [report.report_id]);

  const handlePrepare = async () => {
    setAction("prepare");
    setError(null);
    try {
      const prepared = await prepareAuditReviewNotifications(report.report_id, {
        regenerate: false,
        delivery_channel: "IN_APP",
      });
      setNotifications(prepared);
      toast.success(isApproved ? "Final notifications prepared" : "Draft notification preview prepared");
      onNotificationsChanged?.();
    } catch (prepareError) {
      const message = prepareError instanceof Error ? prepareError.message : "Notifications could not be prepared.";
      setError(message);
      toast.error(message);
    } finally {
      setAction(null);
    }
  };

  const handleSendAll = async () => {
    setAction("send");
    setError(null);
    try {
      const result = await sendAuditReviewReportNotifications(report.report_id, {});
      setNotifications(result.notifications.length ? result.notifications : await listAuditReviewReportNotifications(report.report_id));
      if (result.message) {
        toast.info(result.message);
      } else {
        toast.success(`${result.sent} notification${result.sent === 1 ? "" : "s"} marked as sent`);
      }
      onNotificationsChanged?.();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Notifications could not be sent.";
      setError(message);
      toast.error(message);
    } finally {
      setAction(null);
    }
  };

  const handleDismiss = async (notificationId: string) => {
    setAction("dismiss");
    setError(null);
    try {
      const updated = await dismissAuditReviewNotification(notificationId, {
        reason: "Dismissed from audit review workspace.",
      });
      setNotifications((previous) =>
        previous.map((notification) =>
          notification.notification_id === updated.notification_id ? updated : notification,
        ),
      );
      toast.success("Notification dismissed");
      onNotificationsChanged?.();
    } catch (dismissError) {
      const message = dismissError instanceof Error ? dismissError.message : "Notification could not be dismissed.";
      setError(message);
      toast.error(message);
    } finally {
      setAction(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review notifications and escalation">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Notifications & Escalation</h3>
              <Badge variant="outline" className={getPriorityBadgeClass(escalation?.priority)}>
                {escalation?.priority ?? "Unmapped"}
              </Badge>
              <Badge variant="outline" className={getAuditReviewRatingBadgeClass(rating)}>
                {formatAuditReviewRating(rating)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">{statusSummary}</p>
            {!isApproved ? (
              <p className="mt-1 text-xs font-medium text-amber-700">
                Notifications for non-approved reports are draft/preliminary.
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handlePrepare} disabled={Boolean(action)}>
            {action === "prepare" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
            {isApproved ? "Prepare Final Notifications" : "Prepare Draft Notification Preview"}
          </Button>
          {hasSendableNotifications ? (
            <Button type="button" size="sm" variant="outline" onClick={handleSendAll} disabled={Boolean(action)}>
              {action === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Notifications
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadNotifications("refresh")} disabled={Boolean(action)}>
            {action === "refresh" || loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        {escalation ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Required Action</p>
              <p className="mt-1 text-sm font-medium leading-6 text-slate-900">{escalation.requiredAction}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Stakeholder Roles</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {escalation.stakeholderRoles.map((role) => (
                  <Badge key={role} variant="outline" className="border-slate-200 bg-white text-slate-700">
                    {role}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            Notification escalation is not mapped for this rating.
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="font-semibold">Priority</TableHead>
                <TableHead className="font-semibold">Recipient Role</TableHead>
                <TableHead className="font-semibold">Channel</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Created Date</TableHead>
                <TableHead className="font-semibold">Sent Date</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                    Loading notification history...
                  </TableCell>
                </TableRow>
              ) : notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                    No notifications have been prepared for this report.
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification) => (
                  <TableRow key={notification.notification_id} className="hover:bg-slate-50">
                    <TableCell>
                      <Badge variant="outline" className={getPriorityBadgeClass(notification.priority)}>
                        {formatLabel(notification.priority)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-700">{notification.recipient_role}</TableCell>
                    <TableCell className="text-slate-700">{getChannelLabel(notification.delivery_channel)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusBadgeClass(notification.status)}
                        title={notification.error_message ?? undefined}
                      >
                        {formatLabel(notification.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600" title={notification.created_dt}>
                      {formatDateTime(notification.created_dt)}
                    </TableCell>
                    <TableCell className="text-slate-600" title={notification.sent_dt ?? undefined}>
                      {formatDateTime(notification.sent_dt)}
                    </TableCell>
                    <TableCell>
                      {notification.status !== "DISMISSED" && notification.status !== "SENT" ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void handleDismiss(notification.notification_id)}
                          disabled={Boolean(action)}
                        >
                          {action === "dismiss" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Dismiss
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
}
