import { supabase } from '../supabase';

/*
 * runCoParentMatch — links two parents who are both managing the same child in GlycoGuard.
 *
 * Matching logic:
 *   Current user sets child.coParentEmail → the other parent's email.
 *   The other parent sets their child.coParentEmail → current user's email.
 *   When both sides have set the reciprocal email, this function finds them and connects the rows.
 *
 * Postgres RLS does not support case-insensitive string matching at the policy
 * level, so name equality is checked in JavaScript after filtering by dob and
 * co_parent_email (the "co-parent match read" policy makes the other parent's
 * row visible once they've named this user's email as their co-parent).
 */
export async function runCoParentMatch(userId, childId, child) {
  if (!child?.coParentEmail) return null;

  const { data: { user } } = await supabase.auth.getUser();
  const currentEmail = user?.email?.toLowerCase();
  if (!currentEmail) return null;

  const { data: candidates, error } = await supabase
    .from('children')
    .select('*')
    .eq('dob', child.dob)
    .eq('co_parent_email', currentEmail);

  if (error) {
    console.error('runCoParentMatch query error:', error);
    return null;
  }

  const childNameLower = child.name?.toLowerCase().trim() ?? '';
  const match = candidates?.find(c =>
    c.owner_id !== userId && c.name?.toLowerCase().trim() === childNameLower
  );

  if (match) {
    const [a, b] = await Promise.all([
      supabase.from('children').update({
        co_parent_uid: match.owner_id,
        co_parent_child_id: match.id,
        co_parent_status: 'connected',
      }).eq('id', childId),
      supabase.from('children').update({
        co_parent_uid: userId,
        co_parent_child_id: childId,
        co_parent_status: 'connected',
      }).eq('id', match.id),
    ]);
    if (a.error || b.error) console.error('runCoParentMatch link error:', a.error || b.error);

    return { matched: true, coParentUid: match.owner_id, coParentChildId: match.id };
  }

  await supabase.from('children').update({ co_parent_status: 'pending' }).eq('id', childId);
  return { matched: false };
}

export default runCoParentMatch;
