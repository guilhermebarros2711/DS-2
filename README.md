# Biblioteca DS

Sistema de Biblioteca do 2º DS, com interface web em Next.js, banco de dados no Supabase e regras de negócio implementadas em Python.

## Organização

- `app/` — interface web em Next.js;
- `python/biblioteca.py` — funções Python do sistema;
- `python/requirements.txt` — dependência do Supabase para Python;
- `python/README.md` — resumo das funções e das regras de avaliação.

## Funções em Python

A lógica principal está em `python/biblioteca.py`, incluindo:

- cadastro, edição, consulta e remoção de usuários;
- cadastro, edição, consulta e remoção de livros;
- alteração de quantidade e preço;
- realização de empréstimos;
- registro de devoluções;
- relatórios de empréstimos;
- cálculo automático da nota do usuário;
- limite de empréstimos baseado na nota;
- bloqueio quando o usuário atinge o limite;
- ranking de livros;
- identificação do livro mais emprestado.

A interface web apresenta essas regras de forma visual e utiliza o mesmo banco de dados do projeto.
