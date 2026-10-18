import { createClient } from "@supabase/supabase-js";

const required = [
  "VITE_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OWNER_EMAIL",
  "OWNER_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`seed-owner: missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const email = process.env.OWNER_EMAIL.trim().toLowerCase();
const admin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const findUserByEmail = async () => {
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
};

const ensureUser = async () => {
  const existing = await findUserByEmail();
  if (existing) return existing.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: process.env.OWNER_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
};

const { data: ownerRole, error: roleError } = await admin
  .from("roles")
  .select("id")
  .eq("key", "owner")
  .single();
if (roleError) throw roleError;

const userId = await ensureUser();
const { data: current } = await admin
  .from("profiles")
  .select("status, role_id")
  .eq("id", userId)
  .maybeSingle();
if (current?.status === "approved" && current.role_id === ownerRole.id) {
  console.log(`seed-owner: ${email} is already an approved owner, nothing to do.`);
  process.exit(0);
}

const { error: profileError } = await admin.from("profiles").upsert(
  {
    id: userId,
    full_name: "Proprietário",
    email,
    status: "approved",
    kind: "internal",
    role_id: ownerRole.id,
  },
  { onConflict: "id", ignoreDuplicates: false },
);
if (profileError) throw profileError;

console.log(`seed-owner: ${email} is an approved owner.`);
