-- Disable the acceptance RPC surface without destroying legal evidence.
-- Execute only as an explicit recovery migration, not during normal deployment.
revoke execute on function public.get_legal_acceptance_status() from authenticated;
revoke execute on function public.accept_current_legal(text,text,text,boolean,boolean) from authenticated;
revoke execute on function jysen_private.legal_status() from authenticated;
revoke execute on function jysen_private.accept_legal(text,text,text,boolean,boolean) from authenticated;
-- Preserve archives, acceptance records and own-record SELECT access.
