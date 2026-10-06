"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markWatched(assignmentId: string) {
  const supabase = await createClient();
  await supabase.from("assignments").update({ watched_at: new Date().toISOString() }).eq("id", assignmentId);
  revalidatePath("/student/lessons");
}
