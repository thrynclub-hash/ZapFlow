// ZapFlow — recebe o redirect do Mercado Livre após o cliente autorizar.
// Troca `code` por token e grava em marketplace_channels (platform:
// 'mercadolivre') via service role. Mesmo padrão do bling-oauth-callback.
//
// Deploy: supabase functions deploy ml-oauth-callback --no-verify-jwt
// Configurar no app ML (developers.mercadolivre.com.br > sua aplicação):
// Redirect URI = https://bhiggyigsrqfabqhutne.supabase.co/functions/v1/ml-oauth-callback

import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const mlClientId = Deno.env.get("ML_CLIENT_ID") ?? "";
const mlClientSecret = Deno.env.get("ML_CLIENT_SECRET") ?? "";
const appUrl = Deno.env.get("APP_URL") ?? "https://zap-flow-smoky.vercel.app";
const redirectUri = `${supabaseUrl}/functions/v1/ml-oauth-callback`;

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(mlClientSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function redirect(status: "success" | "error", message?: string) {
  const url = new URL(`${appUrl}/admin/clients`);
  url.searchParams.set("ml", status);
  if (message) url.searchParams.set("msg", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? "";
    const [clientId, sig] = state.split(".");

    if (!code || !clientId || !sig) return redirect("error", "parametros_invalidos");
    const expectedSig = await hmac(clientId);
    if (sig !== expectedSig) return redirect("error", "state_invalido");

    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: `grant_type=authorization_code&client_id=${encodeURIComponent(mlClientId)}&client_secret=${encodeURIComponent(mlClientSecret)}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData?.access_token) return redirect("error", tokenData?.message || "token_falhou");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: existing } = await supabase.from("marketplace_channels").select("id").eq("client_id", clientId).eq("platform", "mercadolivre").maybeSingle();

    const credentials = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      user_id: tokenData.user_id,
    };
    if (existing) {
      await supabase.from("marketplace_channels").update({ credentials, active: true }).eq("id", existing.id);
    } else {
      await supabase.from("marketplace_channels").insert({ client_id: clientId, platform: "mercadolivre", credentials, active: true });
    }

    return redirect("success");
  } catch (e) {
    return redirect("error", String(e).slice(0, 100));
  }
});
