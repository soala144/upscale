import { publicLeadSchema } from "@/lib/leads/input";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { createLead } from "@/server/leads/create";
import { allowPublicSubmission, getPublicFormContext } from "@/server/leads/public-form";

export const runtime = "nodejs";

/** Unauthenticated lead capture. Organization comes from the URL slug, never from the body. */
export const POST = trackRequest(
  "api.public.leads.create",
  async (request: Request, context: { params: Promise<{ slug: string }> }) => {
    try {
      const { slug } = await context.params;
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      if (!allowPublicSubmission(`${ip}:${slug}`)) {
        return Response.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
      }
      const parsed = publicLeadSchema.safeParse(await request.json());
      if (!parsed.success) {
        return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
      }
      const form = await getPublicFormContext(slug);
      if (!form) return Response.json({ error: "This form is not available." }, { status: 404 });

      const input = parsed.data;
      const result = await createLead(
        form.organizationId,
        {
          name: input.name,
          phone: input.phone,
          email: input.email ?? null,
          need: input.need,
          location: input.location || null,
          budget: input.budget ?? null,
          timeline: null,
          decisionMaker: null,
          notes: null,
        },
        input.source ? `FORM:${input.source}` : "FORM",
      );
      return Response.json(
        {
          ok: true,
          // Only a lead created by this very submission is linked to the visitor's Telegram.
          // For an existing lead (same phone or email) its id is never revealed.
          telegramUrl: form.botUsername
            ? `https://t.me/${form.botUsername}${result.created ? `?start=f_${result.id}` : ""}`
            : null,
        },
        { status: 201 },
      );
    } catch (error) {
      return apiErrorResponse(error, "public.leads.create");
    }
  },
);
