"use client";

import { Building2, User } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import type { HostelInfo } from "@/lib/api-types";

export default function HostelPage() {
  const { data, loading, error, reload } = useApiGet<{ info: HostelInfo }>("/api/hostel");

  return (
    <div>
      <PageHeader title="Hostel" description="Your room assignment and hostel details." />

      {loading && <LoadingBlock rows={2} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && !data.info && <EmptyState icon={Building2} title="No hostel assignment" description="You're not currently allotted a hostel room." />}

      {data?.info && (
        <div className="max-w-md card-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
              <Building2 className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">{data.info.hostelName}</p>
              <p className="text-xs text-muted-foreground">Room {data.info.roomNumber} · Capacity {data.info.capacity}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm">
            <User className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Warden:</span>
            <span>{data.info.warden}</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Report maintenance or connectivity issues from the AI assistant or the Helpdesk section.
          </p>
        </div>
      )}
    </div>
  );
}
