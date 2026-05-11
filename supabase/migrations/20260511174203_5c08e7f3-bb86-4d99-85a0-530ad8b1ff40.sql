
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  user_id uuid PRIMARY KEY,
  email text NOT NULL,
  password text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (server functions) can read/write.
