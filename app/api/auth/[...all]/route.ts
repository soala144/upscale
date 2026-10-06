import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";
import { trackRequest } from "@/server/integrations/watchup";

const handlers = toNextJsHandler(auth);

export const GET = trackRequest("api.auth.get", handlers.GET);
export const POST = trackRequest("api.auth.post", handlers.POST);
