import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js";
import axiod from "https://deno.land/x/axiod/mod.ts";

import { corsHeaders } from "../_shared/cors.ts";

const contentTypeHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const postUserInfo = async (
  supabase: SupabaseClient,
  { code, redirect_uri }: { code: string; redirect_uri: string },
) => {
  if (!code) {
    return new Response(
      JSON.stringify({ error: "token is missing" }),
      {
        status: 400,
        headers: contentTypeHeaders,
      },
    );
  }

  const tokenResponse = await fetch(
    "https://kauth.kakao.com/oauth/token",
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: Deno.env.get("KAKAO_RESTAPI_KEY") || "",
        redirect_uri,
        code,
        client_secret: Deno.env.get("KAKAO_CLIENT_SECRET") || "",
      }),

      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    },
  );

  const response = await tokenResponse.json();

  console.log(response);

  const { data: { user, session }, error } = await supabase.auth
    .signInWithIdToken({
      provider: "kakao",
      token: response?.id_token,
    });

  if (error) {
    console.log(error);

    return new Response(
      JSON.stringify({ error: "Authentication failed", code: "K01" }),
      {
        status: 403,
        headers: contentTypeHeaders,
      },
    );
  }

  if (!session) {
    return new Response(
      JSON.stringify({ error: "Authentication failed", code: "S01" }),
      {
        status: 403,
        headers: contentTypeHeaders,
      },
    );
  }

  if (!user) {
    return new Response(
      JSON.stringify({ error: "Authentication failed", code: "U01" }),
      {
        status: 403,
        headers: contentTypeHeaders,
      },
    );
  }

  console.log(user);
  console.log(session);

  const { data: storedUser, error: storeError } = await supabase
    .from("user")
    .upsert({
      id: user.id,
      email: user.email,
      provider_id: user.user_metadata.provider_id,
      last_log_in: new Date().toISOString(),
    })
    .select();

  if (storeError) {
    console.error(storeError);
  }

  return new Response(
    JSON.stringify({
      message: "Login successful",
      user: storedUser || user,
    }),
    {
      status: 200,
      headers: contentTypeHeaders,
    },
  );
};

Deno.serve(async (req) => {
  const { method } = req;

  if (method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (
    method !== "GET" &&
    method !== "POST" &&
    method !== "DELETE" &&
    method !== "PUT"
  ) {
    return new Response(JSON.stringify({ message: "Invalid method" }), {
      headers: contentTypeHeaders,
      status: 401,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization")!,
          },
        },
      },
    );

    const { code, redirect_uri } = await req.json();

    return postUserInfo(supabaseClient, { code, redirect_uri });
  } catch (e) {
    console.log(e);

    return new Response(JSON.stringify({ message: e.message }), {
      headers: contentTypeHeaders,
      status: 500,
    });
  }
});
