export async function api<T>(action: string, init?: RequestInit): Promise<T> {
  const response = await fetch("/api/cadastur/" + action, init);
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message || "Não foi possível concluir. Tente novamente.");
  return result.data;
}

export const post = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});
