-- Enforce private-account visibility for shared cloud posts.

alter table public.profiles
  add column if not exists is_private boolean not null default false;

update public.profiles p
set is_private = true
from public.user_app_state s
where s.user_id = p.id
  and (
    s.payload #>> '{collections,app_settings,isPrivate}' = 'true'
    or exists (
      select 1
      from jsonb_array_elements(
        case
          when jsonb_typeof(s.payload #> '{collections,users}') = 'array'
            then s.payload #> '{collections,users}'
          else '[]'::jsonb
        end
      ) as u(user_doc)
      where u.user_doc->>'id' = p.id::text
        and u.user_doc->>'isPrivate' = 'true'
    )
  );

drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts for select
  using (
    author_id = auth.uid()
    or (
      not is_archived
      and not exists (
        select 1
        from public.profiles p
        where p.id = posts.author_id
          and p.is_private
      )
    )
  );
