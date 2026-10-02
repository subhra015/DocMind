-- DocMind — Initial database schema
-- Run with: supabase db push
-- Or paste into Supabase SQL Editor

-- Extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- Types
create type document_status as enum (
  'queued',
  'processing',
  'ready',
  'failed',
  'deleted'
);

-- Documents table
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  original_filename text not null,
  storage_path text not null unique,
  mime_type text not null default 'application/pdf',
  file_size bigint not null,
  checksum text,
  total_pages integer,
  status document_status not null default 'queued',
  processing_stage text,
  processing_progress integer not null default 0,
  error_message text,
  retry_count integer not null default 0,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deduplicate by checksum per user
create unique index if not exists documents_user_checksum_idx
on documents(user_id, checksum)
where checksum is not null;

create index if not exists documents_user_id_idx
on documents(user_id);

create index if not exists documents_status_idx
on documents(status);

-- Document chunks table (vector store)
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  page_number integer not null,
  chunk_index integer not null,
  token_count integer,
  character_count integer,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz not null default now(),
  unique(document_id, page_number, chunk_index)
);

create index if not exists document_chunks_user_id_idx
on document_chunks(user_id);

create index if not exists document_chunks_document_id_idx
on document_chunks(document_id);

-- HNSW index for vector search (better than ivfflat for new data)
create index if not exists document_chunks_embedding_idx
on document_chunks
using hnsw (embedding vector_cosine_ops)
with (m = 16, ef_construction = 200);

-- Conversations
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  document_id uuid references documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conversations_user_id_idx
on conversations(user_id);

-- Messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '[]'::jsonb,
  token_usage jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx
on messages(conversation_id);

-- ─────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────

alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Documents policies
create policy "Users can view their own documents"
on documents for select
using (user_id = auth.uid());

create policy "Users can create their own documents"
on documents for insert
with check (user_id = auth.uid());

create policy "Users can update their own documents"
on documents for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own documents"
on documents for delete
using (user_id = auth.uid());

-- Document chunks policies
create policy "Users can view their own chunks"
on document_chunks for select
using (user_id = auth.uid());

create policy "Users can create their own chunks"
on document_chunks for insert
with check (user_id = auth.uid());

create policy "Users can update their own chunks"
on document_chunks for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own chunks"
on document_chunks for delete
using (user_id = auth.uid());

-- Conversations policies
create policy "Users can view their own conversations"
on conversations for select
using (user_id = auth.uid());

create policy "Users can create their own conversations"
on conversations for insert
with check (user_id = auth.uid());

create policy "Users can update their own conversations"
on conversations for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete their own conversations"
on conversations for delete
using (user_id = auth.uid());

-- Messages policies
create policy "Users can view their own messages"
on messages for select
using (user_id = auth.uid());

create policy "Users can create their own messages"
on messages for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from conversations
    where conversations.id = messages.conversation_id
    and conversations.user_id = auth.uid()
  )
);

create policy "Users can delete their own messages"
on messages for delete
using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Secure vector search RPC
-- ─────────────────────────────────────────────────────────────

create or replace function match_document_chunks(
  query_embedding vector(768),
  requested_user_id uuid,
  requested_document_id uuid default null,
  similarity_threshold float default 0.25,
  match_count integer default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page_number integer,
  chunk_index integer,
  similarity float,
  metadata jsonb
)
language sql stable
security invoker
set search_path = public
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.page_number,
    dc.chunk_index,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.metadata
  from document_chunks dc
  where dc.user_id = requested_user_id
    and requested_user_id = auth.uid()
    and dc.embedding is not null
    and (
      requested_document_id is null
      or dc.document_id = requested_document_id
    )
    and 1 - (dc.embedding <=> query_embedding) >= similarity_threshold
  order by dc.embedding <=> query_embedding
  limit least(match_count, 20);
$$;