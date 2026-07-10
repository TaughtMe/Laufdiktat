-- Nach erfolgreichem 4.0.4-Frontend-Deployment anwenden. Die alten, nicht
-- teilnehmertokengebundenen RPCs bleiben als Definition fuer eine einfache
-- Rueckverfolgbarkeit bestehen, sind aus Browserrollen aber nicht mehr
-- ausfuehrbar. Alle 4.0.4-Clients verwenden die *_secure-Funktionen.

revoke all on function public.open_room(jsonb) from public, anon, authenticated;
revoke all on function public.find_active_room(text) from public, anon, authenticated;
revoke all on function public.get_room_state(uuid) from public, anon, authenticated;
revoke all on function public.update_session(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.end_room(uuid, text) from public, anon, authenticated;
revoke all on function public.upsert_progress(uuid, text, text, int, int, int, int, boolean, int, jsonb, text, int)
  from public, anon, authenticated;
revoke all on function public.get_my_progress(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_room_students(uuid, text) from public, anon, authenticated;
revoke all on function public.cleanup_abandoned_rooms() from public, anon, authenticated;

grant execute on function public.cleanup_abandoned_rooms() to service_role;
