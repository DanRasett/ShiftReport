insert into public.settings (id)
values (1)
on conflict (id) do nothing;
