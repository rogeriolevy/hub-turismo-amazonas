export const profileAvatarKeys = ["sol", "rio", "folha", "brisa", "barro", "nuvem"] as const;
export type ProfileAvatarKey = (typeof profileAvatarKeys)[number];
export const profileAvatars = [
  { key: profileAvatarKeys[0], label: "Sol" },
  { key: profileAvatarKeys[1], label: "Rio" },
  { key: profileAvatarKeys[2], label: "Folha" },
  { key: profileAvatarKeys[3], label: "Brisa" },
  { key: profileAvatarKeys[4], label: "Barro" },
  { key: profileAvatarKeys[5], label: "Nuvem" },
] as const;

export function profileAvatarUrl(key: ProfileAvatarKey) {
  return `/avatars/${key}.svg`;
}

export function avatarKeyFromImage(image: string | null | undefined): ProfileAvatarKey | null {
  const avatar = profileAvatars.find(({ key }) => image === profileAvatarUrl(key));
  return avatar?.key ?? null;
}

export function defaultAvatarForUser(userId: string): ProfileAvatarKey {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1)
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0;
  return profileAvatars[hash % profileAvatars.length].key;
}
