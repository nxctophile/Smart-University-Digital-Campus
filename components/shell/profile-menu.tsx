"use client";

import { useSession } from "@/lib/client/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GraduationCap, Users, User, ShieldCheck, Briefcase, LogOut } from "lucide-react";
import type { Role } from "@/lib/types";

const ROLE_META: Record<Role, { label: string; icon: typeof User }> = {
  student: { label: "Student", icon: GraduationCap },
  faculty: { label: "Faculty", icon: Users },
  parent: { label: "Parent", icon: User },
  admin: { label: "Administrator", icon: ShieldCheck },
  employee: { label: "Staff", icon: Briefcase },
};

export function ProfileMenu() {
  const { ctx, logout, loggingOut } = useSession();
  const meta = ROLE_META[ctx.role];
  const Icon = meta.icon;
  const primaryRoleName = ctx.roles[0]?.name ?? meta.label;

  const initials = ctx.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 hover:bg-secondary">
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
        </Avatar>
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="text-sm font-medium">{ctx.name.split(" ")[0]}</span>
          <span className="text-[10px] text-muted-foreground">{primaryRoleName}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex items-start gap-2.5">
              <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{ctx.name}</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {ctx.roles.map((r) => r.name).join(", ") || meta.label}
                  {ctx.departmentName ? ` · ${ctx.departmentName}` : ""}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()} disabled={loggingOut} className="gap-2 text-destructive focus:text-destructive">
          <LogOut className="size-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
