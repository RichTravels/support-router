import { NextResponse } from "next/server";

import { getOperator } from "@/utils/auth";
import { createServiceClient } from "@/utils/supabase/service";

function noStoreJson(body: unknown, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET() {
  const operator = await getOperator();
  if (!operator) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("departments").select("id, name");

    if (error) {
      console.error("[test-db]", error.message);
      return noStoreJson({ error: "Could not read departments." }, 500);
    }

    return noStoreJson(data, 200);
  } catch (error) {
    console.error(
      "[test-db]",
      error instanceof Error ? error.message : "unknown error",
    );
    return noStoreJson({ error: "Could not read departments." }, 500);
  }
}
