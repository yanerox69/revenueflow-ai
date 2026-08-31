import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: [".env.local"], quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const { data } = await db.from("appointments").select("status, confirmed_at, created_by_ai, starts_at").order("starts_at", { ascending: false }).limit(3);
for (const a of data ?? []) console.log(`  ${a.status.padEnd(11)} confirmada:${a.confirmed_at ? "si" : "no"}  IA:${a.created_by_ai ? "si" : "no"}  ${a.starts_at}`);
