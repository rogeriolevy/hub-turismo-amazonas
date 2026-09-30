import { betterAuth } from "better-auth";
import { getDatabase } from "../db/index.ts";
import { authOptions } from "./auth-config.ts";
function createAuth() {
  return betterAuth(authOptions(getDatabase()));
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  return (auth ??= createAuth());
}
