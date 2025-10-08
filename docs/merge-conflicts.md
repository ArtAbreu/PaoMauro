# Resolving the GitHub "This branch has conflicts" banner

When GitHub shows the warning pictured in the screenshot, it means that the branch you are trying to merge (por exemplo, `work`) and the base branch (`main`) touched the **mesmas linhas** nos mesmos arquivos desde o último ponto comum entre eles. GitHub não consegue decidir sozinho qual versão manter, então o merge automático é bloqueado até que os conflitos sejam resolvidos manualmente.

No nosso caso, praticamente todos os arquivos principais (`backend/app.py`, `frontend/app.js`, etc.) foram editados tanto na branch `main` quanto na `work` depois que você criou o pull request. Como resultado, cada um desses arquivos aparece na lista de conflitos.

## Como resolver

1. **Atualize sua branch local** com as alterações mais recentes da branch base.

   ```bash
   git checkout work
   git fetch origin
   git merge origin/main
   ```

   > Se a branch base tiver outro nome (por exemplo, `master`), troque `main` por esse nome.

2. O Git vai parar no primeiro arquivo conflitante e inserir marcadores `<<<<<<<`, `=======` e `>>>>>>>` indicando o trecho que diverge entre as duas versões. Edite cada arquivo listando e escolha manualmente qual conteúdo deve ficar (ou combine trechos das duas versões).

3. Depois de revisar um arquivo, remova os marcadores de conflito e salve. Você pode usar `git status` para conferir quais arquivos ainda têm conflitos pendentes.

4. Quando todos os conflitos forem resolvidos:

   ```bash
   git add <arquivo-resolvido>
   git commit
   ```

   O commit pode ter uma mensagem como `Resolve merge conflicts with main`.

5. Por fim, envie a branch atualizada para o GitHub:

   ```bash
   git push origin work
   ```

Após o push, o pull request será atualizado automaticamente e o alerta de conflitos deve desaparecer. Se preferir usar a interface web, você pode abrir o botão "Resolve conflicts" no GitHub, fazer as mesmas edições diretamente no navegador e confirmar.

## Dicas

- Faça um backup (por exemplo, `git branch backup/work-before-merge work`) antes de começar, para conseguir voltar atrás caso algo dê errado.
- Trabalhe em pequenas partes: resolva um arquivo por vez e execute os testes para garantir que nada foi quebrado.
- Depois do merge, execute o aplicativo localmente para confirmar que tudo continua funcionando como esperado.

Assim que os conflitos forem resolvidos, o botão **Merge** voltará a ficar ativo.
