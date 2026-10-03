# Sessões, JWT e verificação antirobô

## Sessões e tokens JWT

O navegador continua usando uma sessão em cookie HTTP-only. O site não guarda tokens de autenticação em `localStorage`.

Clientes de API podem obter um JWT de uma sessão autenticada:

```http
GET /api/auth/token
Cookie: <sessão autenticada>
```

O token dura 15 minutos. Use-o nas APIs protegidas com `Authorization: Bearer <token>`. As chaves públicas para validar a assinatura ficam em `GET /api/auth/jwks`. O emissor e o público do token correspondem à origem configurada em `SITE_URL`.

As rotas de conta, plataforma, Cadastur, imagens administrativas e contatos de administração aceitam sessão por cookie ou JWT válido. A cada chamada autenticada, a aplicação busca novamente a conta no banco e aplica as permissões atuais. Serviços externos que validam o token somente com JWKS devem considerar a validade máxima de 15 minutos; sair do site não revoga imediatamente um JWT já emitido.

As chaves de assinatura ficam na tabela `jwks` do Better Auth. Execute `npm run db:migrate` após instalar esta versão e use banco persistente em produção. A rotação das chaves ocorre a cada 30 dias, com período de compatibilidade de 30 dias para tokens e caches já emitidos.

## Verificação antirobô (Turnstile)

No ambiente local, se `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` estiverem vazias, o projeto usa as chaves públicas de teste do Cloudflare. Esse widget aceita o desafio automaticamente e serve para testar a integração visual e o fluxo HTTP; ele não detecta nem bloqueia robôs. Isso explica por que a verificação parecia passar sem validar o comportamento de um robô.

Para proteção real, crie um widget Turnstile no painel Cloudflare, autorize o domínio e configure as variáveis `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` no ambiente do servidor. O site key é público e aparece no formulário; a secret key fica somente no servidor. Em produção, o login e o cadastro falham de forma segura se as chaves não estiverem configuradas.
