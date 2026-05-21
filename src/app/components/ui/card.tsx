import * as React from "react";

import { cn } from "./utils";

interface CardProps extends React.ComponentProps<"div"> {
  padding?: "default" | "none";
}

function Card({ className, padding = "default", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border",
        padding === "none" ? "gap-0" : "",
        className,
      )}
      {...props}
    />
  );
}

interface CardHeaderProps extends React.ComponentProps<"div"> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

function CardHeader({ className, title, description, action, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-6 pt-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    >
      {(title || description || action) && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {title && (
              <h4
                data-slot="card-title"
                className="text-base font-semibold leading-none"
              >
                {title}
              </h4>
            )}
          </div>
          {action && <div data-slot="card-action" className="shrink-0">{action}</div>}
        </div>
      )}
    </div>
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <h4
      data-slot="card-title"
      className={cn("leading-none", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <p
      data-slot="card-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 [&:last-child]:pb-6", className)}
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex flex-wrap items-center px-6 pb-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

interface KPICardProps extends React.ComponentProps<"div"> {
  title?: string;
  value?: string;
  change?: string;
  changeDirection?: "up" | "down" | "neutral";
  description?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  onClick?: () => void;
}

function KPICard({ className, title, value, change, changeDirection = "up", description, icon, iconBg, onClick, ...props }: KPICardProps) {
  const trendColors = {
    up: "text-green-500",
    down: "text-red-500",
    neutral: "text-slate-500",
  };

  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-2 rounded-xl border p-6 cursor-pointer hover:shadow-md transition-shadow",
        onClick && "hover:border-blue-300",
        className,
      )}
      onClick={onClick}
      {...props}
    >
      <div className="flex items-start justify-between">
        {title && <div className="text-sm text-muted-foreground">{title}</div>}
        {icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", iconBg || "bg-blue-50")}>
            {icon}
          </div>
        )}
      </div>
      {value && <div className="text-3xl font-bold">{value}</div>}
      {change && (
        <div className={`text-sm ${trendColors[changeDirection]}`}>
          {change}
        </div>
      )}
    </div>
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardBody,
  KPICard,
};
