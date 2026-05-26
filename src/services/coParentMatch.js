import { collectionGroup, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

/*
 * runCoParentMatch — links two parents who are both managing the same child in GlycoGuard.
 *
 * Matching logic:
 *   Current user sets child.coParentEmail → the other parent's email.
 *   The other parent sets their child.coParentEmail → current user's email.
 *   When both sides have set the reciprocal email, this function finds them and connects the docs.
 *
 * Firestore collection group query required.
 * Create a composite index in the Firebase Console:
 *   Collection group: children
 *   Fields:          dob ASC, coParentEmail ASC
 *   Query scope:     Collection group
 *
 * Firestore does not support case-insensitive string matching, so name equality
 * is checked in JavaScript after filtering by dob and coParentEmail.
 */
export async function runCoParentMatch(userId, childId, child) {
  if (!child?.coParentEmail) return null;

  const currentEmail = auth.currentUser?.email?.toLowerCase();
  if (!currentEmail) return null;

  const q = query(
    collectionGroup(db, 'children'),
    where('dob', '==', child.dob),
    where('coParentEmail', '==', currentEmail)
  );

  const snap = await getDocs(q);
  const childNameLower = child.name?.toLowerCase().trim() ?? '';

  let matchDoc = null;
  for (const d of snap.docs) {
    // Path: users/{uid}/children/{childId} — segment index 1 is the other user's uid
    const otherUserId = d.ref.path.split('/')[1];
    if (otherUserId === userId) continue;

    if (d.data().name?.toLowerCase().trim() === childNameLower) {
      matchDoc = d;
      break;
    }
  }

  const currentChildRef = doc(db, 'users', userId, 'children', childId);

  if (matchDoc) {
    const otherUserId  = matchDoc.ref.path.split('/')[1];
    const otherChildId = matchDoc.id;

    await Promise.all([
      updateDoc(currentChildRef, {
        coParentUid:     otherUserId,
        coParentChildId: otherChildId,
        coParentStatus:  'connected',
      }),
      updateDoc(matchDoc.ref, {
        coParentUid:     userId,
        coParentChildId: childId,
        coParentStatus:  'connected',
      }),
    ]);

    return { matched: true, coParentUid: otherUserId, coParentChildId: otherChildId };
  }

  await updateDoc(currentChildRef, { coParentStatus: 'pending' });
  return { matched: false };
}

export default runCoParentMatch;
