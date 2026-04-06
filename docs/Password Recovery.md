# Recuperacao de Senha

## Fluxo do Usuario

1. Na tela de login, o usuario clica em **"Esqueceu a senha?"**
2. E redirecionado para `/forgot-password`
3. Insere o email e clica em enviar
4. Uma mensagem de sucesso e exibida (independente do email existir ou nao — seguranca contra enumeracao)
5. O usuario recebe um email com um link de recuperacao
6. Ao clicar no link, e redirecionado para `/reset-password?token=xxx`
7. Insere a nova senha e confirmacao
8. Ao confirmar, e redirecionado para `/login` com mensagem de sucesso

## Diagrama

```
Tela de Login
    |
    +-- "Esqueceu a senha?"
    |
    v
/forgot-password
    | digita email -> enviar
    |
    v
Mensagem: "Se o email existir, enviaremos um link"
    |
    | (usuario verifica caixa de entrada)
    |
    v
Email com link de recuperacao
    | clica no link
    |
    v
/reset-password?token=xxx
    | nova senha + confirmacao -> enviar
    |
    v
/login (com mensagem de sucesso)
```

## Arquitetura

- **BetterAuth** gerencia tokens de reset (geracao, expiracao ~1h, validacao)
- **Resend** envia os emails via adapter (pode ser trocado por outro provider)
- **EmailService** camada de servico com templates e logica de dominio
- **EmailProvider** interface generica — implementacao atual: `ResendEmailProvider`

## Paginas

| Pagina | Rota | Descricao |
|--------|------|-----------|
| Esqueci a senha | `/forgot-password` | Formulario com campo de email |
| Redefinir senha | `/reset-password` | Formulario com nova senha + confirmacao (recebe token via URL) |

## Email

- Idioma: pt-BR
- Assunto: "PGT — Recuperacao de Senha"
- Conteudo: saudacao, botao com link de reset, aviso de expiracao
