import { db } from "@/lib/db/client";
import { roomAssignments, rooms, hostels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AccessContext, resolveStudentIdForAccess } from "./context";

export async function getHostelInfo(ctx: AccessContext, requestedStudentId?: number) {
  const studentId = await resolveStudentIdForAccess(ctx, "hostel.view", requestedStudentId);
  const row = await db
    .select({
      hostelName: hostels.name,
      block: hostels.block,
      warden: hostels.warden,
      roomNumber: rooms.roomNumber,
      capacity: rooms.capacity,
      assignedAt: roomAssignments.assignedAt,
    })
    .from(roomAssignments)
    .innerJoin(rooms, eq(roomAssignments.roomId, rooms.id))
    .innerJoin(hostels, eq(rooms.hostelId, hostels.id))
    .where(and(eq(roomAssignments.studentId, studentId), eq(roomAssignments.status, "active")))
    .get();

  return row ?? null;
}
