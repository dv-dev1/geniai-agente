create table if not exists contatos (
  id text primary key,
  phone text not null,
  nome_whatsapp text,
  lead jsonb not null default '{}',
  score int not null default 0,
  temperatura text not null default 'frio',
  etapa text not null default 'novo',
  status_comercial text not null default 'a_contatar'
    check (status_comercial in ('a_contatar', 'contatado', 'reuniao', 'fechado', 'perdido')),
  pausado_ate timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists mensagens (
  id text primary key,
  contato_id text not null references contatos (id),
  autor text not null check (autor in ('cliente', 'bot', 'humano')),
  texto text not null,
  respondida boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists mensagens_contato on mensagens (contato_id, criado_em);
