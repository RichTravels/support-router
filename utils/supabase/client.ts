import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * Browser client. Only the publishable key belongs here.
 * Do not read SUPABASE_SERVICE_ROLE_KEY from client code.
 */
export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!);
