"use client";

import { useEffect, useState } from "react";
import { Bus, Clock, User, Pencil, Loader2 } from "lucide-react";
import { useApiGet } from "@/lib/client/use-api";
import { apiGet, apiMutate } from "@/lib/client/api";
import { PageHeader } from "@/components/common/page-header";
import { LoadingBlock, ErrorBlock, EmptyState } from "@/components/common/state-blocks";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { TransportInfo, RouteWithStops } from "@/lib/api-types";

function ChangeRouteDialog({ open, onOpenChange, current, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; current: TransportInfo; onSaved: () => void }) {
  const [routes, setRoutes] = useState<RouteWithStops[] | null>(null);
  const [routeId, setRouteId] = useState<string>("");
  const [stopId, setStopId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before fetching fresh routes for this dialog session
    setRoutes(null);
    apiGet<{ routes: RouteWithStops[] }>("/api/transport/routes").then((d) => {
      setRoutes(d.routes);
      // Set the current selection only once the Select's items exist, so its
      // trigger resolves the label the same way a user pick would.
      setRouteId(current?.routeId ? String(current.routeId) : "");
      setStopId(current?.stopId ? String(current.stopId) : "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedRoute = routes?.find((r) => r.id === Number(routeId));

  async function save() {
    if (!routeId || !stopId) return;
    setSaving(true);
    try {
      await apiMutate("/api/transport", { method: "PATCH", body: { routeId: Number(routeId), stopId: Number(stopId) } });
      toast.success("Transport preference updated.");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current ? "Change route & stop" : "Request a transport route"}</DialogTitle>
          <DialogDescription>Pick a route and your preferred boarding stop.</DialogDescription>
        </DialogHeader>
        {!routes ? (
          <LoadingBlock rows={2} />
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Route</Label>
              <Select
                items={Object.fromEntries(routes.map((r) => [String(r.id), `${r.name} (${r.code})`]))}
                value={routeId}
                onValueChange={(v) => {
                  setRouteId(v ?? "");
                  setStopId("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a route" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name} ({r.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Boarding stop</Label>
              <Select
                items={Object.fromEntries((selectedRoute?.stops ?? []).map((s) => [String(s.id), `${s.name} · ${s.arrivalTime}`]))}
                value={stopId}
                onValueChange={(v) => setStopId(v ?? "")}
                disabled={!selectedRoute}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a stop" />
                </SelectTrigger>
                <SelectContent>
                  {selectedRoute?.stops.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} · {s.arrivalTime}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={save} disabled={saving || !routeId || !stopId} className="gap-1.5">
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TransportPage() {
  const { data, loading, error, reload } = useApiGet<{ info: TransportInfo }>("/api/transport");
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Transport" description="Your assigned campus bus route." />

      {loading && <LoadingBlock rows={2} />}
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {data && !data.info && (
        <div className="max-w-md">
          <EmptyState icon={Bus} title="No route assigned" description="You're not currently assigned to a transport route." />
          <Button size="sm" className="mt-3 gap-1.5" onClick={() => setDialogOpen(true)}>
            <Pencil className="size-3.5" /> Request a route
          </Button>
        </div>
      )}

      {data?.info && (
        <div className="max-w-md card-surface p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-secondary">
                <Bus className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{data.info.routeName}</p>
                <p className="text-xs text-muted-foreground">
                  {data.info.routeCode} · Vehicle {data.info.vehicleNumber}
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDialogOpen(true)}>
              <Pencil className="size-3.5" /> Change
            </Button>
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Boarding point:</span> <span>{data.info.stopName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Arrival:</span> <span>{data.info.arrivalTime}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Driver:</span> <span>{data.info.driverName}</span>
            </div>
          </div>
        </div>
      )}

      {data && <ChangeRouteDialog open={dialogOpen} onOpenChange={setDialogOpen} current={data.info} onSaved={reload} />}
    </div>
  );
}
