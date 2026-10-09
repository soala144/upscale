import { relations } from "drizzle-orm";

import { appointments } from "./schema/appointments";
import { account, session, user, verification } from "./schema/auth";
import {
  broadcastCampaigns,
  broadcastRecipients,
  messageTemplates,
} from "./schema/broadcast";
import { bachsWebhookEvents } from "./schema/bachs-webhook-events";
import { conversations } from "./schema/conversations";
import { leads } from "./schema/leads";
import { messages } from "./schema/messages";
import {
  invitations,
  members,
  organizations,
} from "./schema/organizations";
import { payments } from "./schema/payments";
import { subscriptions } from "./schema/subscriptions";
import { telegramConnections } from "./schema/telegram-connections";
import { telegramUpdates } from "./schema/telegram-updates";

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
  memberships: many(members),
  sentInvitations: many(invitations, { relationName: "invitationInviter" }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  activeOrganization: one(organizations, {
    fields: [session.activeOrganizationId],
    references: [organizations.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const verificationRelations = relations(verification, () => ({}));
export const bachsWebhookEventsRelations = relations(
  bachsWebhookEvents,
  () => ({}),
);

export const organizationRelations = relations(
  organizations,
  ({ many }) => ({
    members: many(members),
    invitations: many(invitations),
    subscriptions: many(subscriptions),
    payments: many(payments),
    telegramConnections: many(telegramConnections),
    telegramUpdates: many(telegramUpdates),
    leads: many(leads),
    conversations: many(conversations),
    messages: many(messages),
    sessions: many(session),
  }),
);

export const memberRelations = relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
  user: one(user, {
    fields: [members.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  inviter: one(user, {
    fields: [invitations.inviterId],
    references: [user.id],
    relationName: "invitationInviter",
  }),
}));

export const subscriptionRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
}));

export const paymentRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [payments.leadId],
    references: [leads.id],
  }),
}));

export const telegramConnectionRelations = relations(
  telegramConnections,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [telegramConnections.organizationId],
      references: [organizations.id],
    }),
    leads: many(leads),
    updates: many(telegramUpdates),
  }),
);

export const telegramUpdateRelations = relations(
  telegramUpdates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [telegramUpdates.organizationId],
      references: [organizations.id],
    }),
    connection: one(telegramConnections, {
      fields: [telegramUpdates.connectionId],
      references: [telegramConnections.id],
    }),
    lead: one(leads, {
      fields: [telegramUpdates.leadId],
      references: [leads.id],
    }),
    conversation: one(conversations, {
      fields: [telegramUpdates.conversationId],
      references: [conversations.id],
    }),
    userMessage: one(messages, {
      fields: [telegramUpdates.userMessageId],
      references: [messages.id],
      relationName: "telegramUpdateUserMessage",
    }),
    assistantMessage: one(messages, {
      fields: [telegramUpdates.assistantMessageId],
      references: [messages.id],
      relationName: "telegramUpdateAssistantMessage",
    }),
  }),
);

export const leadRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [leads.organizationId],
    references: [organizations.id],
  }),
  telegramConnection: one(telegramConnections, {
    fields: [leads.telegramConnectionId],
    references: [telegramConnections.id],
  }),
  conversations: many(conversations),
  payments: many(payments),
}));

export const conversationRelations = relations(
  conversations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [conversations.organizationId],
      references: [organizations.id],
    }),
    lead: one(leads, {
      fields: [conversations.leadId],
      references: [leads.id],
    }),
    messages: many(messages),
  }),
);

export const messageRelations = relations(messages, ({ one }) => ({
  organization: one(organizations, {
    fields: [messages.organizationId],
    references: [organizations.id],
  }),
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  telegramUserUpdate: one(telegramUpdates, {
    fields: [messages.id],
    references: [telegramUpdates.userMessageId],
    relationName: "telegramUpdateUserMessage",
  }),
  telegramAssistantUpdate: one(telegramUpdates, {
    fields: [messages.id],
    references: [telegramUpdates.assistantMessageId],
    relationName: "telegramUpdateAssistantMessage",
  }),
}));

export const messageTemplateRelations = relations(
  messageTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [messageTemplates.organizationId],
      references: [organizations.id],
    }),
    campaigns: many(broadcastCampaigns),
  }),
);

export const broadcastCampaignRelations = relations(
  broadcastCampaigns,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [broadcastCampaigns.organizationId],
      references: [organizations.id],
    }),
    template: one(messageTemplates, {
      fields: [broadcastCampaigns.templateId],
      references: [messageTemplates.id],
    }),
    recipients: many(broadcastRecipients),
  }),
);

export const broadcastRecipientRelations = relations(
  broadcastRecipients,
  ({ one }) => ({
    campaign: one(broadcastCampaigns, {
      fields: [broadcastRecipients.campaignId],
      references: [broadcastCampaigns.id],
    }),
    lead: one(leads, {
      fields: [broadcastRecipients.leadId],
      references: [leads.id],
    }),
  }),
);

export const appointmentRelations = relations(appointments, ({ one }) => ({
  organization: one(organizations, {
    fields: [appointments.organizationId],
    references: [organizations.id],
  }),
  lead: one(leads, {
    fields: [appointments.leadId],
    references: [leads.id],
  }),
  assignee: one(user, {
    fields: [appointments.assignedToUserId],
    references: [user.id],
  }),
}));

export const schema = {
  messageTemplates,
  broadcastCampaigns,
  broadcastRecipients,
  appointments,
  messageTemplateRelations,
  broadcastCampaignRelations,
  broadcastRecipientRelations,
  appointmentRelations,
  user,
  session,
  account,
  verification,
  bachsWebhookEvents,
  organizations,
  members,
  invitations,
  subscriptions,
  payments,
  telegramConnections,
  telegramUpdates,
  leads,
  conversations,
  messages,
  userRelations,
  sessionRelations,
  accountRelations,
  verificationRelations,
  bachsWebhookEventsRelations,
  organizationRelations,
  memberRelations,
  invitationRelations,
  subscriptionRelations,
  paymentRelations,
  telegramConnectionRelations,
  telegramUpdateRelations,
  leadRelations,
  conversationRelations,
  messageRelations,
};
