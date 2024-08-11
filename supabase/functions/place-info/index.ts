// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

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

// cacheData 유효성 검사 함수
const isCacheDataValid = (cacheData: any): boolean => {
  if (!cacheData) return false;

  const updatedAt = new Date(cacheData.updated_at);
  const currentTime = new Date();
  const timeDifference = currentTime.getTime() - updatedAt.getTime();
  const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

  return timeDifference < oneDayInMilliseconds;
};

const getPlaceInfo = async (
  supabase: SupabaseClient,
  id = "",
) => {
  if (!id) {
    return new Response(JSON.stringify({ message: "invalid place id" }), {
      headers: contentTypeHeaders,
      status: 403,
    });
  }

  const { data: cacheData, error } = await supabase
    .from("place-info")
    .select(
      `
      id,
      created_at,
      updated_at,
      main_photo_url,
      score,
      score_count
    `,
    )
    .eq("id", id).select();

  console.log(cacheData);

  if (error) {
    return new Response(JSON.stringify({ message: error.message }), {
      headers: contentTypeHeaders,
      status: 500,
    });
  }

  if (isCacheDataValid(cacheData[0])) {
    return new Response(JSON.stringify({ data: cacheData[0] }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  const { data } = await axiod.get(
    `https://hallowed-port-432100-s2.uw.r.appspot.com/place-info/${id}`,
  );

  const { main_photo_url, score, score_count } = data.response;

  const { data: upsertData, error: upsertError } = await supabase
    .from("place-info")
    .upsert({
      id,
      main_photo_url,
      score,
      score_count,
      updated_at: new Date(),
    })
    .eq("id", id)
    .select();

  if (upsertError) {
    return new Response(JSON.stringify({ message: upsertError.message }), {
      headers: contentTypeHeaders,
      status: 501,
    });
  }

  return new Response(JSON.stringify({ data: upsertData[0] }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
};

Deno.serve((req) => {
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
      status: 403,
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

    const url = new URL(req.url);

    const placeInfoPattern = new URLPattern({ pathname: "/place-info/:id" });
    const matchingPath = placeInfoPattern.exec(url.href);
    const id = matchingPath?.pathname.groups.id;

    if (method === "GET") {
      return getPlaceInfo(supabaseClient, id);
    }

    return new Response(JSON.stringify({ message: "not found" }), {
      headers: contentTypeHeaders,
      status: 404,
    });
  } catch (e) {
    console.log(e);

    return new Response(JSON.stringify({ message: e.message }), {
      headers: contentTypeHeaders,
      status: 500,
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/place-info' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
