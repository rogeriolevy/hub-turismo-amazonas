# Uso local — Hub Turismo Amazonas

Esta etapa funciona somente no computador Windows, em `http://127.0.0.1:3005`. Hospedagem e domínio ficam para uma etapa futura. O site publicado anteriormente continua independente.

## Abrir e iniciar

Se o site já abre, use normalmente; não inicie outro servidor na mesma porta.

Para iniciar depois de reiniciar o computador, abra o PowerShell:

```powershell
cd "C:\Users\User\Documents\Projeto Hotel\hub-turismo-amazonas-node"
npm start
```

Mantenha esse terminal aberto durante o uso. `Ctrl+C` encerra o servidor. A aplicação não inicia automaticamente com o Windows.

- Site: http://127.0.0.1:3005
- Contato: http://127.0.0.1:3005/#contato
- Contatos: http://127.0.0.1:3005/painel/contato (`/admin` redireciona para esta página)
- Administração da plataforma: http://127.0.0.1:3005/painel/plataforma
- Minha conta: http://127.0.0.1:3005/minha-conta
- Cadastro básico: http://127.0.0.1:3005/cadastro
- Catálogos: http://127.0.0.1:3005/hospedagens e http://127.0.0.1:3005/passeios
- Verificação de disponibilidade: http://127.0.0.1:3005/api/health

O painel utiliza `rogerio1kg@gmail.com` e a senha definida localmente. Não é a senha do site publicado ou de outro serviço. O formulário salva mensagens; a resposta continua manual pelo aplicativo de e-mail.

## Ativar empresas e reservas

A migração 002 já foi aplicada nesta instalação, com backup anterior em `backups/hub-2026-09-29T15-54-33-812Z.sqlite`. A conta e os contatos existentes foram preservados. Comece por **Administração da plataforma → Empresas**; crie a empresa, vincule equipes se necessário, cadastre quartos/passeios/saídas e publique. Os catálogos ficam vazios até o cadastro real. O roteiro completo está em [PLATAFORMA.md](PLATAFORMA.md).

As reservas aguardam aprovação pelo hotel ou operador. FNRH é apenas o registro local de chegada/saída nesta etapa. Não há cobrança online ou confirmação de e-mail automática.

## Depois de alterar o código

Pare o servidor com `Ctrl+C`. Na pasta do projeto, execute:

```powershell
npm run build
npm start
```

Para desenvolvimento com atualização automática, use `npm run dev` em vez de `npm start`, mantendo apenas um servidor na porta 3005. O script usa Webpack porque o projeto está em uma unidade FAT32, que não oferece suporte às junctions usadas pelo Turbopack. Para atualizar dependências a partir do lockfile, use `npm ci` com o servidor parado. Migrações necessárias são executadas por `npm run db:migrate` depois de um backup.

O build também usa Webpack. Em unidades FAT32 ou exFAT, `npm run build` prepara o código e as dependências em uma pasta temporária NTFS, migra um banco descartável e copia o resultado para `.next` no projeto. `.env.local`, `data/` e `backups/` não são copiados; o banco temporário é criado do zero. A unidade temporária precisa ter espaço livre e ser NTFS.

## Banco e backup

O banco fica em `data/hub.sqlite`; a configuração está em `.env.local`. Esses arquivos não entram no Git. Preserve-os ao atualizar o código. A configuração contém o segredo de autenticação e também deve ser guardada com acesso restrito.

Para criar uma cópia consistente do banco, mesmo com o site em execução:

```powershell
npm run db:backup
```

O comando informa o caminho do novo arquivo em `backups/`. Mantenha uma cópia em outro disco ou local protegido. Backups incluem mensagens e dados de autenticação; não os publique nem envie por chat. Uma cópia somente neste computador não protege contra perda do disco.

Foi criado e verificado um backup em 29/09/2026: `backups/hub-2026-09-29T15-13-35-299Z.sqlite`. Sua restauração de teste confirmou integridade e contagens de registros. O arquivo temporário de teste foi removido; o banco ativo foi preservado.

## Recuperar acesso

```powershell
npm run admin:password -- rogerio1kg@gmail.com
```

Digite e confirme uma nova senha de 12 a 128 caracteres. A alteração é verificada no banco e encerra sessões anteriores. Confira maiúsculas e espaços; o painel oferece “Mostrar senha”. Se houver limitação por tentativas, aguarde um minuto antes de tentar novamente.

Para uma conta de turista ou equipe, o responsável pela instalação pode executar `npm run account:password -- EMAIL`. Confirme a identidade antes de redefinir. Esse comando também encerra sessões anteriores, sem criar contas ou mudar permissões.

## Restaurar um backup

1. Pare o servidor e preserve o banco atual. Faça uma cópia da configuração `.env.local` em local protegido.
2. Restaure para um **arquivo novo**. Substitua o nome abaixo pelo backup escolhido:

```powershell
npm run db:restore -- "backups/NOME-DO-BACKUP.sqlite" "data/restaurado.sqlite"
```

3. Com o servidor parado, edite `.env.local` e defina `DATABASE_PATH=data/restaurado.sqlite`.
4. Execute `npm run db:migrate`. Para cada administrador, redefina a senha com `npm run admin:password -- EMAIL` para encerrar as sessões restauradas.
5. Execute `npm start`, abra o painel e confira as mensagens.

O comando recusa sobrescrever arquivos. Não substitua um banco aberto nem copie somente `hub.sqlite` enquanto houver gravações; use o backup consistente.

## Rever a interface sem usar dados reais

```powershell
npm run qa:preview
```

Após os testes, abra http://127.0.0.1:3100/__qa/layout. A revisão oferece início, contato, privacidade, administração, catálogos, cadastro, conta e painéis, nas larguras de 320, 375, 768 e 1280 pixels. Ela usa banco temporário e contas fictícias; não altera o banco da porta 3005.

`Ctrl+C` encerra a prévia. As portas 3005 e 3100 podem coexistir, mas não execute duas prévias de QA ao mesmo tempo. Use `npm run build` antes se houver alterações de código. A ferramenta verifica o espaço disponível; não emula um telefone e não substitui testes em aparelhos e leitores de tela.

## Problemas comuns

| Situação                                  | Ação                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O navegador não consegue conectar         | Inicie com `npm start` e mantenha o terminal aberto.                                                                                                          |
| Porta 3005 já está em uso                 | Confira se o site já está aberto; evite iniciar uma segunda instância.                                                                                        |
| As alterações não aparecem                | Pare, execute `npm run build` e reinicie.                                                                                                                     |
| Origem do login não autorizada            | Use `http://127.0.0.1:3005` ou `http://localhost:3005`. Outros nomes/portas precisam corresponder a `SITE_URL`; em produção, use o domínio HTTPS configurado. |
| E-mail ou senha incorretos                | Confira a digitação ou use o comando de recuperação acima.                                                                                                    |
| Contato enviado não aparece na porta 3005 | Confira se o envio ocorreu no site real local, e não na prévia isolada da porta 3100.                                                                         |

## Limites desta etapa

Não há agendamento de backup, início automático com o Windows, envio automático de e-mails ou publicação na VPS. A aplicação escuta apenas em `127.0.0.1`, então não fica disponível para outros dispositivos da rede. Esses recursos devem ser definidos numa etapa própria.
