import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ngkcjydsqlizhtazhdao.supabase.co',
  'sb_publishable_N3NW1ixhu_lfpfYgDQtGng_wR-bWFsh'
);

export async function saveTap(lat, lng) {
  const { data, error } = await supabase
    .from('feeding_events')
    .insert([{ lat, lng, created_at: new Date().toISOString() }])
    .select();

  if (error) throw new Error(`Supabase insert error: ${error.message}`);
  return data[0];
}

export async function deleteTap(id) {
  const { error } = await supabase
    .from('feeding_events')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Supabase delete error: ${error.message}`);
}

export async function getTaps() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('feeding_events')
    .select('*')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return data;
}
