import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: [".env.local"], quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: t } = await db.from("tenants").select("id").eq("is_demo", true).eq("country_code", "VE").single();
const { data: s } = await db.from("services").select("id, duration_minutes").eq("tenant_id", t!.id).limit(1).single();
const { data: c } = await db.from("contacts").select("id").eq("tenant_id", t!.id).limit(1).single();
const ayer = new Date(Date.now() - 26 * 3600_000);
const { error } = await db.from("appointments").insert({
  tenant_id: t!.id, contact_id: c!.id, service_id: s!.id,
  starts_at: ayer.toISOString(),
  ends_at: new Date(ayer.getTime() + s!.duration_minutes * 60_000).toISOString(),
  status: "CONFIRMED", confirmed_at: new Date(Date.now() - 30 * 3600_000).toISOString(),
  created_by_ai: true, is_demo: true,
});
console.log(error ? error.message : "Cita pasada creada para probar el cierre");
