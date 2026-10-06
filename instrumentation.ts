export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { getServerEnv } = await import("./src/lib/env/server");
  const env = getServerEnv();
  const { initializeWatchup } = await import(
    "./src/server/integrations/watchup/client"
  );

  initializeWatchup(env.WATCHUP_API_KEY);
}
