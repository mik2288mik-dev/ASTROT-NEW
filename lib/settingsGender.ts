import type { UserProfile } from '../types';

export type ProfileGender = 'male' | 'female' | 'unspecified';

export async function saveServerAuthoritativeGender(
  profile: UserProfile,
  gender: ProfileGender,
  persist: (profile: UserProfile) => Promise<void>,
  apply: (profile: UserProfile) => void,
): Promise<void> {
  const updated = { ...profile, gender };
  await persist(updated);
  apply(updated);
}
