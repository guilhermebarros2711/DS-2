# Lógica da Biblioteca em Python

A interface web do projeto está em Next.js, mas as regras de negócio principais também estão implementadas em Python neste diretório.

O arquivo `biblioteca.py` contém funções para:

- cadastrar, editar, listar e remover usuários;
- cadastrar, editar, listar e remover livros;
- alterar quantidade e preço;
- realizar empréstimos;
- registrar devoluções;
- consultar empréstimos por situação ou usuário;
- calcular automaticamente a nota de cada usuário;
- definir o limite de livros permitido pela nota;
- bloquear novos empréstimos quando o limite for atingido;
- gerar o ranking dos livros mais emprestados;
- identificar o livro mais emprestado.

## Regra da nota

A nota começa em 10.

- empréstimo atualmente atrasado: -2;
- devolução feita depois do prazo: -1;
- multa pendente: -1.

O limite de empréstimos é calculado pela nota:

| Nota | Limite simultâneo |
| --- | --- |
| 8 a 10 | 5 livros |
| 6 a 7,9 | 4 livros |
| 4 a 5,9 | 2 livros |
| abaixo de 4 | 1 livro |

A interface web reproduz essas mesmas regras visualmente.
