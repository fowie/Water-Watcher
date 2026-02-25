# Skill: NextAuth.js v5 Role-Based Access Control

## Pattern
Add a `role` field to the User model and propagate it through NextAuth callbacks into the JWT and session, then create reusable admin gate helpers.

## Steps

### 1. Schema
Add `role String @default("user")` to User in Prisma. Mirror in SQLAlchemy.

### 2. Auth Config (`auth.ts`)
```ts
// In authorize():
return { id: user.id, ..., role: user.role };

// In jwt callback:
if (user) { token.role = (user as { role?: string }).role ?? "user"; }

// In session callback:
(session.user as { role?: string }).role = token.role as string;
```

### 3. Admin Helper (`admin.ts`)
```ts
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin")
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return { user: { id: session.user.id, role: "admin", ... } };
}

export function isAdminError(result): result is NextResponse {
  return result instanceof NextResponse;
}
```

### 4. Usage in API Routes
```ts
export async function GET() {
  const adminResult = await requireAdmin();
  if (isAdminError(adminResult)) return adminResult;
  // adminResult.user is typed and safe
}
```

### 5. Middleware (`middleware.ts`)
```ts
export default auth((req) => {
  const role = (req.auth?.user as { role?: string })?.role;
  if (isAdminRoute(pathname) && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }
});
```

## Gotchas
- NextAuth v5 types don't include custom fields like `role` — use type assertions
- Role is cached in JWT; changes don't take effect until re-auth
- Middleware runs on Edge Runtime — keep it lightweight, no Prisma calls
