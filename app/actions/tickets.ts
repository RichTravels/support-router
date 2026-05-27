"use server";

import { revalidatePath } from "next/cache";

import { createServiceClient } from "@/utils/supabase/service";

export async function overrideTicketDepartment(
  ticketId: string,
  departmentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!ticketId || !departmentId) {
    return { ok: false, error: "Missing ticket or department." };
  }

  try {
    const supabase = createServiceClient();

    const { error } = await supabase
      .from("tickets")
      .update({
        department_id: departmentId,
        ai_routed: false,
      })
      .eq("id", ticketId);

    if (error) {
      console.error("[overrideTicketDepartment] update failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return { ok: false, error: error.message };
    }

    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unexpected server error.";
    console.error("[overrideTicketDepartment]", msg);
    return { ok: false, error: msg };
  }
}
