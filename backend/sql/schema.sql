-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.calendar_event_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  calendar_id text NOT NULL DEFAULT 'primary'::text,
  google_event_id text NOT NULL,
  sync_status text NOT NULL DEFAULT 'synced'::text CHECK (sync_status = ANY (ARRAY['synced'::text, 'pending_create'::text, 'pending_update'::text, 'pending_delete'::text, 'deleted'::text, 'failed'::text])),
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT calendar_event_links_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_event_links_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT calendar_event_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.calendarsync (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL UNIQUE,
  google_access_token text,
  google_refresh_token text,
  sync_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT calendarsync_pkey PRIMARY KEY (id),
  CONSTRAINT calendarsync_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL,
  title text NOT NULL DEFAULT '새 대화'::text,
  last_message_preview text,
  last_message_at timestamp with time zone,
  is_pinned boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  mode text NOT NULL DEFAULT 'edit'::text,
  CONSTRAINT chat_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT chat_conversations_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  client_message_id text,
  role text NOT NULL CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])),
  kind text NOT NULL DEFAULT 'text'::text CHECK (kind = ANY (ARRAY['text'::text, 'intro'::text, 'result'::text, 'error'::text, 'ownership-required'::text])),
  status text NOT NULL DEFAULT 'complete'::text CHECK (status = ANY (ARRAY['pending'::text, 'complete'::text, 'error'::text])),
  content text NOT NULL DEFAULT ''::text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id)
);
CREATE TABLE public.event_change_request_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  decision_status text NOT NULL DEFAULT 'pending'::text CHECK (decision_status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])),
  decision_reason text,
  decided_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  dismissed_at timestamp with time zone,
  CONSTRAINT event_change_request_targets_pkey PRIMARY KEY (id),
  CONSTRAINT event_change_request_targets_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.event_change_requests(id),
  CONSTRAINT event_change_request_targets_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT event_change_request_targets_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.event_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  requester_user_id uuid NOT NULL,
  request_type text NOT NULL CHECK (request_type = ANY (ARRAY['update_proposal'::text, 'delete_request'::text])),
  request_status text NOT NULL CHECK (request_status = ANY (ARRAY['pending_creator_review'::text, 'pending_participant_approval'::text, 'completed'::text, 'rejected'::text, 'cancelled'::text, 'expired'::text])),
  creator_decision_status text NOT NULL DEFAULT 'pending'::text CHECK (creator_decision_status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'auto_approved'::text])),
  creator_decision_reason text,
  creator_decided_at timestamp with time zone,
  source_text text,
  parsed_payload jsonb,
  before_snapshot jsonb NOT NULL,
  after_snapshot jsonb,
  expires_at timestamp with time zone,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT event_change_requests_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_change_requests_requester_user_id_fkey FOREIGN KEY (requester_user_id) REFERENCES public.users(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  title text NOT NULL DEFAULT ''::text,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  location text,
  description text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  lifecycle_status text NOT NULL DEFAULT 'active'::text CHECK (lifecycle_status = ANY (ARRAY['active'::text, 'pending_delete'::text, 'deleted'::text])),
  deleted_at timestamp with time zone,
  parent_event_id uuid,
  duration_minutes integer,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT fk_creator FOREIGN KEY (creator_id) REFERENCES public.users(id),
  CONSTRAINT events_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.events(id)
);
CREATE TABLE public.invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL UNIQUE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text])),
  sent_at timestamp without time zone DEFAULT now(),
  responded_at timestamp without time zone,
  dismissed_at timestamp with time zone,
  CONSTRAINT invitations_pkey PRIMARY KEY (id),
  CONSTRAINT invitations_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id)
);
CREATE TABLE public.mention_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  display_name text NOT NULL,
  team_name text,
  nickname text,
  searchable_text text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT mention_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT mention_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid,
  name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'withdrawn'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  dismissed_at timestamp with time zone,
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
);
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL DEFAULT ''::text UNIQUE,
  name text NOT NULL DEFAULT ''::text,
  profile_image text,
  profile_change_count integer NOT NULL DEFAULT 0,
  profile_change_started_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscription_catalog (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  accent_key text,
  icon_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_catalog_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_catalog_code_key UNIQUE (code)
);
CREATE TABLE public.subscription_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_code text NOT NULL,
  provider text NOT NULL,
  external_event_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  detail_url text,
  image_url text,
  google_event_id text,
  calendar_id text NOT NULL DEFAULT 'primary'::text,
  sync_status text NOT NULL DEFAULT 'synced'::text,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT subscription_calendar_events_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT subscription_calendar_events_subscription_code_fkey FOREIGN KEY (subscription_code) REFERENCES public.subscription_catalog(code),
  CONSTRAINT subscription_calendar_events_user_provider_external_key UNIQUE (user_id, provider, external_event_id)
);
CREATE TABLE public.user_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id),
  CONSTRAINT user_subscriptions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscription_catalog(id),
  CONSTRAINT user_subscriptions_user_subscription_key UNIQUE (user_id, subscription_id)
);
