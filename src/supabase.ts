import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://aqhhcwasolqrynpictng.supabase.co"; // ✅ MUST start with https
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFxaGhjd2Fzb2xxcnlucGljdG5nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMzkzOTAsImV4cCI6MjA5MTcxNTM5MH0.75xPOz9_h-lPhuZzgMK28e8RdNd1jGsONfj2hUMCb6A"; // ✅ long key

export const supabase = createClient(supabaseUrl, supabaseKey);
