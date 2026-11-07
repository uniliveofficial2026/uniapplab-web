begin;
select plan(9);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', 'authenticated', 'authenticated', 'active@example.test', now(), now()),
  ('22222222-2222-2222-2222-222222222222', 'authenticated', 'authenticated', 'muted@example.test', now(), now()),
  ('33333333-3333-3333-3333-333333333333', 'authenticated', 'authenticated', 'banned@example.test', now(), now()),
  ('44444444-4444-4444-4444-444444444444', 'authenticated', 'authenticated', 'other@example.test', now(), now())
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.profiles (id, username, display_name, muted_until, banned_at)
values
  ('11111111-1111-1111-1111-111111111111', 'active_user', 'Active User', null, null),
  ('22222222-2222-2222-2222-222222222222', 'muted_user', 'Muted User', now() + interval '1 hour', null),
  ('33333333-3333-3333-3333-333333333333', 'banned_user', 'Banned User', null, now()),
  ('44444444-4444-4444-4444-444444444444', 'other_user', 'Other User', null, null)
on conflict (id) do update
set
  muted_until = excluded.muted_until,
  banned_at = excluded.banned_at;

insert into public.chat_threads (id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
on conflict (id) do nothing;

insert into public.chat_thread_members (thread_id, user_id)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444')
on conflict do nothing;

insert into public.chat_messages (thread_id, sender_id, body)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', 'private to other thread');

insert into public.posts (id, author_id, payload)
values ('banned-existing-post', '33333333-3333-3333-3333-333333333333', '{"seeded": true}'::jsonb)
on conflict (id) do update
set payload = excluded.payload;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$insert into public.chat_messages (thread_id, sender_id, body)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'allowed')$$,
  'active chat member can insert a message'
);
select lives_ok(
  $$insert into public.posts (id, author_id, payload)
    values ('active-post', '11111111-1111-1111-1111-111111111111', '{}'::jsonb)$$,
  'active user can insert a post'
);
select results_eq(
  $$select count(*) from public.chat_threads where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  array[1::bigint],
  'active user can select their own chat thread'
);
select results_eq(
  $$select count(*) from public.chat_thread_members where thread_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  array[0::bigint],
  'active user cannot read another thread membership row'
);
select results_eq(
  $$select count(*) from public.chat_messages where thread_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  array[0::bigint],
  'active user cannot read another thread messages'
);
select throws_ok(
  $$insert into public.chat_messages (thread_id, sender_id, body)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'cross-thread injection')$$,
  '42501',
  null,
  'active user cannot insert into another thread'
);

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select throws_ok(
  $$insert into public.chat_messages (thread_id, sender_id, body)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'blocked while muted')$$,
  '42501',
  null,
  'muted chat member cannot insert messages directly'
);

select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$insert into public.posts (id, author_id, payload)
    values ('banned-post', '33333333-3333-3333-3333-333333333333', '{}'::jsonb)$$,
  '42501',
  null,
  'banned user cannot insert posts directly'
);
update public.posts
set payload = '{"edited": true}'::jsonb
where id = 'banned-existing-post';
select results_eq(
  $$select payload = '{"seeded": true}'::jsonb from public.posts where id = 'banned-existing-post'$$,
  array[true],
  'banned user cannot update existing posts directly'
);

reset role;

select * from finish();
rollback;
