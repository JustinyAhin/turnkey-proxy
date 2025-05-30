import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { handleSnsLogin } from "./auth.js";
import { cors } from "hono/cors";

const app = new Hono();

app.use("*", cors());

app.post("/auth/snsLogin", async (c) => {
  const { oidcToken, indexedDbClientPublicKey } = await c.req.json();

  const session = await handleSnsLogin({
    oidcToken,
    indexedDbClientPublicKey,
  });

  if (!session) {
    return c.json({ error: "Failed to login" }, 400);
  }

  return c.json({ session });
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
