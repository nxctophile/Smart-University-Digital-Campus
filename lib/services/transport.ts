import { db } from "@/lib/db/client";
import { transportAssignments, transportRoutes, transportStops } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AccessContext, resolveStudentIdForAccess } from "./context";

export async function getTransportInfo(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "transport.view", requestedStudentId);
  const row = await db
    .select({
      routeId: transportRoutes.id,
      routeName: transportRoutes.name,
      routeCode: transportRoutes.code,
      vehicleNumber: transportRoutes.vehicleNumber,
      driverName: transportRoutes.driverName,
      stopId: transportStops.id,
      stopName: transportStops.name,
      arrivalTime: transportStops.arrivalTime,
    })
    .from(transportAssignments)
    .innerJoin(transportRoutes, eq(transportAssignments.routeId, transportRoutes.id))
    .innerJoin(transportStops, eq(transportAssignments.stopId, transportStops.id))
    .where(eq(transportAssignments.studentId, studentId))
    .get();

  return row ?? null;
}

export async function listRoutesWithStops() {
  const routes = await db.select().from(transportRoutes);
  const stops = await db.select().from(transportStops);
  return routes.map((route) => ({
    ...route,
    stops: stops.filter((s) => s.routeId === route.id).sort((a, b) => a.sequence - b.sequence),
  }));
}

export async function updateTransportAssignment(
  ctx: AccessContext,
  input: { routeId: number; stopId: number },
  requestedStudentId?: number,
) {
  const studentId = await resolveStudentIdForAccess(ctx, "transport.update", requestedStudentId);
  const stop = await db.query.transportStops.findFirst({ where: eq(transportStops.id, input.stopId) });
  if (!stop || stop.routeId !== input.routeId) throw new Error("That stop doesn't belong to the selected route.");

  const existing = await db.query.transportAssignments.findFirst({ where: eq(transportAssignments.studentId, studentId) });
  if (existing) {
    db.update(transportAssignments)
      .set({ routeId: input.routeId, stopId: input.stopId })
      .where(eq(transportAssignments.id, existing.id))
      .run();
  } else {
    db.insert(transportAssignments).values({ studentId, routeId: input.routeId, stopId: input.stopId }).run();
  }

  return getTransportInfo(ctx, studentId);
}
