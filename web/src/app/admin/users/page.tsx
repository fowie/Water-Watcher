"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { AuthGuard } from "@/components/auth-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, timeAgo } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  getAdminUsers,
  updateAdminUserRole,
  type AdminUser,
} from "@/lib/api";
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Mountain,
  Loader2,
} from "lucide-react";

const ROLES = ["user", "admin"] as const;
const PAGE_SIZE = 10;

function AdminUsersContent() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const loadUsers = useCallback(async (searchTerm: string, offset: number) => {
    try {
      setLoading(true);
      const data = await getAdminUsers({
        search: searchTerm || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers(search, page * PAGE_SIZE);
  }, [loadUsers, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      loadUsers(value, 0);
    }, 300);
  }, [loadUsers]);

  const handleRoleChange = useCallback(async (userId: string, newRole: string) => {
    setUpdatingId(userId);
    try {
      const updated = await updateAdminUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: updated.role } : u)));
      toast({ title: "Role updated", description: `User role changed to ${newRole}`, variant: "success" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update role",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  }, [toast]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Admin role check
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  if (userRole && userRole !== "admin") {
    return (
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center">
            <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-[var(--destructive)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              You need admin privileges to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" aria-hidden="true" />
          User Management
        </h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Manage user accounts and roles
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or email..."
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      {/* Total info */}
      <p className="text-sm text-[var(--muted-foreground)]">
        {total} user{total !== 1 ? "s" : ""} total
        {search && ` matching "${search}"`}
      </p>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y divide-[var(--border)]">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48 hidden sm:block" />
                  <Skeleton className="h-6 w-16 ml-auto" />
                  <Skeleton className="h-4 w-20 hidden md:block" />
                  <Skeleton className="h-4 w-8 hidden md:block" />
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-8 w-8 mx-auto mb-3 text-[var(--muted-foreground)] opacity-50" aria-hidden="true" />
              <p className="text-sm text-[var(--muted-foreground)]">
                {search ? `No users matching "${search}"` : "No users found"}
              </p>
            </div>
          ) : (
            <>
              {/* Header row */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_1.5fr_auto_auto_auto] gap-4 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--muted)]/50 text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
                <span>Name</span>
                <span>Email</span>
                <span className="w-24 text-center">Role</span>
                <span className="w-28 text-center hidden md:block">Joined</span>
                <span className="w-16 text-center hidden md:block">Rivers</span>
              </div>

              {/* User rows */}
              <div className="divide-y divide-[var(--border)]" role="list" aria-label="User list">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:grid sm:grid-cols-[1fr_1.5fr_auto_auto_auto] gap-2 sm:gap-4 sm:items-center px-4 py-3 hover:bg-[var(--secondary)]/30 transition-colors"
                    role="listitem"
                  >
                    {/* Name */}
                    <div className="font-medium text-sm truncate">
                      {user.name || <span className="text-[var(--muted-foreground)] italic">No name</span>}
                    </div>

                    {/* Email */}
                    <div className="text-sm text-[var(--muted-foreground)] truncate">
                      {user.email}
                    </div>

                    {/* Role selector */}
                    <div className="w-24 flex justify-center">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        disabled={updatingId === user.id || user.id === session?.user?.id}
                        aria-label={`Role for ${user.name || user.email}`}
                        className={cn(
                          "text-xs font-medium rounded-full px-3 py-1 border cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)]",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          user.role === "admin"
                            ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
                            : "bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]"
                        )}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                      {updatingId === user.id && (
                        <Loader2 className="h-3 w-3 ml-1 animate-spin text-[var(--muted-foreground)]" aria-label="Updating role" />
                      )}
                    </div>

                    {/* Created date */}
                    <div className="w-28 text-center hidden md:block">
                      <span className="text-xs text-[var(--muted-foreground)]" title={new Date(user.createdAt).toLocaleString()}>
                        {timeAgo(user.createdAt)}
                      </span>
                    </div>

                    {/* Tracked rivers count */}
                    <div className="w-16 flex justify-center hidden md:flex">
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Mountain className="h-3 w-3" aria-hidden="true" />
                        {user.trackedRiverCount}
                      </Badge>
                    </div>

                    {/* Mobile extra info */}
                    <div className="flex items-center gap-3 sm:hidden text-xs text-[var(--muted-foreground)]">
                      <span>{timeAgo(user.createdAt)}</span>
                      <span className="flex items-center gap-1">
                        <Mountain className="h-3 w-3" aria-hidden="true" />
                        {user.trackedRiverCount} rivers
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--muted-foreground)]">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthGuard>
      <AdminUsersContent />
    </AuthGuard>
  );
}
