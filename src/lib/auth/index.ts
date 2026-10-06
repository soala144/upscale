import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";

import { getDatabase } from "@/db";
import {
  account,
  session,
  user,
  verification,
} from "@/db/schema/auth";
import {
  invitations,
  members,
  organizations,
} from "@/db/schema/organizations";
import { getServerEnv } from "@/lib/env/server";

const env = getServerEnv();

export const auth = betterAuth({
  appName: "UPSCALE",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: drizzleAdapter(getDatabase(), {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
      organization: organizations,
      organizations,
      member: members,
      members,
      invitation: invitations,
      invitations,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    organization({
      creatorRole: "owner",
      schema: {
        organization: {
          modelName: "organizations",
          additionalFields: {
            industry: { type: "string", required: false },
            description: { type: "string", required: false },
            plan: {
              type: "string",
              required: true,
              defaultValue: "BASIC",
              input: false,
            },
            subscriptionStatus: {
              type: "string",
              required: true,
              defaultValue: "TRIALING",
              input: false,
            },
            agentName: {
              type: "string",
              required: true,
              defaultValue: "Helen",
              input: false,
            },
            agentPrompt: {
              type: "string",
              required: false,
              input: false,
              returned: false,
            },
            notificationEmail: {
              type: "string",
              required: false,
              input: false,
            },
            bachsAccountId: {
              type: "string",
              required: false,
              input: false,
              returned: false,
            },
            bachsAccountStatus: {
              type: "string",
              required: false,
              input: false,
            },
          },
        },
        member: {
          modelName: "members",
        },
        invitation: {
          modelName: "invitations",
        },
      },
    }),
  ],
});
