import { getDatabase } from "../db/index.ts";
import { getAuth } from "./auth.ts";
import { HttpError } from "./http.ts";

type JwtUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
};

export async function jwtUserFromRequest(request: Request): Promise<JwtUser | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer(?:\s|$)/i.test(authorization)) return null;

  const match = /^Bearer\s+(\S+)$/i.exec(authorization);
  const token = match?.[1];
  if (!token || token.length > 8192)
    throw new HttpError(401, "INVALID_TOKEN", "O token de acesso é inválido.");

  const { payload } = await getAuth().api.verifyJWT({
    body: { token },
    headers: request.headers,
  });
  if (!payload?.sub)
    throw new HttpError(401, "INVALID_TOKEN", "O token de acesso expirou ou é inválido.");

  const user = getDatabase()
    .prepare<[string], JwtUser>('SELECT id, email, name, image FROM "user" WHERE id = ? LIMIT 1')
    .get(payload.sub);
  if (!user) throw new HttpError(401, "INVALID_TOKEN", "A conta deste token não está ativa.");
  return user;
}
