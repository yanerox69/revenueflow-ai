import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: [".env.local"], quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const { data } = await db.from("leads").select("status, urgency, service_type, intent_summary, intent_confidence, created_at, contacts(name, phone_e164)").order("created_at", { ascending: false }).limit(4);
for (const l of data ?? []) {
  const c = l.contacts as any;
  console.log(`\n${c?.phone_e164 ?? "?"}  ${c?.name ?? ""}`);
  console.log(`  estado:    ${l.status}`);
  console.log(`  servicio:  ${l.service_type ?? "(ninguno)"}`);
  console.log(`  confianza: ${l.intent_confidence}`);
  console.log(`  resumen:   ${l.intent_summary ?? "(vacio)"}`);
}
