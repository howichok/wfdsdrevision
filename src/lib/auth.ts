import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, multiSession } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { authRoles } from "@/lib/auth/roles";

function getTrustedOrigins(): string[] {
  const origins = new Set<string>(["http://localhost:3000"]);
  for (const value of [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
  ]) {
    if (value) origins.add(value.replace(/\/$/, ""));
  }
  return [...origins];
}

async function maybeBootstrapSpecialAdmin(userId: string, email: string | null | undefined) {
  const bootstrapEmail = process.env.BOOTSTRAP_SA_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail || !email || email.toLowerCase() !== bootstrapEmail) return;

  const existingSa = await db.query.users.findFirst({
    where: eq(schema.users.role, "SA"),
  });
  if (existingSa && existingSa.id !== userId) return;

  await db
    .update(schema.users)
    .set({ role: "SA", updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
}

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === "development" ? "dev-better-auth-secret-local-only" : undefined),
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  trustedOrigins: getTrustedOrigins(),
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await maybeBootstrapSpecialAdmin(user.id, user.email);
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "SU",
        input: false,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    additionalFields: {
      deviceLabel: { type: "string", required: false, input: false },
      deviceFingerprint: { type: "string", required: false, input: false },
      userDeviceId: { type: "string", required: false, input: false },
      lastActiveAt: { type: "date", required: false, input: false },
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret",
    },
  },
  plugins: [
    multiSession({ maximumSessions: 10 }),
    admin({
      defaultRole: "SU",
      adminRoles: ["SA"],
      roles: authRoles,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
