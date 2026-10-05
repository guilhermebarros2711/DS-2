"""
Lógica do Sistema de Biblioteca em Python.

A interface web do projeto pode ser feita com qualquer tecnologia.
Este módulo concentra as regras de negócio da biblioteca em Python:
cadastros, empréstimos, devoluções, avaliação de usuários, limites
de empréstimos e estatísticas.

Regras de avaliação:
- Nota inicial: 10
- Empréstimo atualmente atrasado: -2 pontos
- Devolução feita depois do prazo: -1 ponto
- Multa pendente: -1 ponto

Limites por nota:
- 8.0 a 10.0 -> até 5 livros
- 6.0 a 7.9  -> até 4 livros
- 4.0 a 5.9  -> até 2 livros
- 0.0 a 3.9  -> até 1 livro
"""

from __future__ import annotations

import os
from collections import Counter
from datetime import date, timedelta
from typing import Any, Optional

from supabase import Client, create_client


# ---------------------------------------------------------------------------
# Conexão
# ---------------------------------------------------------------------------

def conectar_supabase() -> Client:
    """Cria e retorna a conexão com o Supabase usando variáveis de ambiente."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_KEY")
        or os.getenv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    )

    if not url or not key:
        raise RuntimeError(
            "Configure SUPABASE_URL e SUPABASE_KEY nas variáveis de ambiente."
        )

    return create_client(url, key)


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _normalizar_status(valor: Any) -> str:
    return str(valor or "").strip().lower()


def _emprestimo_devolvido(emprestimo: dict) -> bool:
    status = _normalizar_status(emprestimo.get("status"))
    return bool(emprestimo.get("data_devolucao")) or status in {
        "devolvido",
        "finalizado",
    }


def _para_data(valor: Any) -> Optional[date]:
    if not valor:
        return None

    texto = str(valor)[:10]
    try:
        return date.fromisoformat(texto)
    except ValueError:
        return None


def _emprestimo_atrasado(emprestimo: dict) -> bool:
    if _emprestimo_devolvido(emprestimo):
        return False

    if _normalizar_status(emprestimo.get("status")) == "atrasado":
        return True

    prevista = _para_data(emprestimo.get("data_prevista_devolucao"))
    return bool(prevista and prevista < date.today())


def _devolvido_com_atraso(emprestimo: dict) -> bool:
    if not _emprestimo_devolvido(emprestimo):
        return False

    prevista = _para_data(emprestimo.get("data_prevista_devolucao"))
    devolucao = _para_data(emprestimo.get("data_devolucao"))

    return bool(prevista and devolucao and devolucao > prevista)


def limite_por_nota(nota: float) -> int:
    """Retorna quantos livros o usuário pode manter simultaneamente."""
    if nota >= 8:
        return 5
    if nota >= 6:
        return 4
    if nota >= 4:
        return 2
    return 1


# ---------------------------------------------------------------------------
# Usuários
# ---------------------------------------------------------------------------

def listar_usuarios(supabase: Client) -> list[dict]:
    resposta = (
        supabase.table("usuarios")
        .select("id,nome,email,usuario")
        .order("id")
        .execute()
    )
    return resposta.data or []


def cadastrar_usuario(
    supabase: Client,
    nome: str,
    email: str,
    usuario: str,
    senha: str,
) -> dict:
    if not all([nome.strip(), email.strip(), usuario.strip(), senha]):
        raise ValueError("Nome, e-mail, usuário e senha são obrigatórios.")

    dados = {
        "nome": nome.strip(),
        "email": email.strip(),
        "usuario": usuario.strip(),
        "senha": senha,
    }

    resposta = supabase.table("usuarios").insert(dados).execute()
    return (resposta.data or [dados])[0]


def editar_usuario(
    supabase: Client,
    id_usuario: int,
    *,
    nome: Optional[str] = None,
    email: Optional[str] = None,
    usuario: Optional[str] = None,
) -> dict:
    alteracoes = {
        chave: valor.strip()
        for chave, valor in {
            "nome": nome,
            "email": email,
            "usuario": usuario,
        }.items()
        if valor is not None and valor.strip()
    }

    if not alteracoes:
        raise ValueError("Informe pelo menos um campo para editar.")

    resposta = (
        supabase.table("usuarios")
        .update(alteracoes)
        .eq("id", id_usuario)
        .execute()
    )
    return (resposta.data or [alteracoes])[0]


def remover_usuario(supabase: Client, id_usuario: int) -> None:
    ativos = [
        item
        for item in relatorio_emprestimos(supabase, id_usuario=id_usuario)
        if not _emprestimo_devolvido(item)
    ]

    if ativos:
        raise ValueError(
            "Não é possível remover um usuário com empréstimos em aberto."
        )

    supabase.table("usuarios").delete().eq("id", id_usuario).execute()


# ---------------------------------------------------------------------------
# Livros
# ---------------------------------------------------------------------------

def listar_livros(supabase: Client) -> list[dict]:
    resposta = supabase.table("livros").select("*").order("id").execute()
    return resposta.data or []


def cadastrar_livro(
    supabase: Client,
    titulo: str,
    autor: str,
    quantidade: int,
    preco: float,
    id_categoria: Optional[int] = None,
    id_editora: Optional[int] = None,
) -> dict:
    if not titulo.strip() or not autor.strip():
        raise ValueError("Título e autor são obrigatórios.")

    if quantidade < 0 or preco < 0:
        raise ValueError("Quantidade e preço não podem ser negativos.")

    dados = {
        "titulo": titulo.strip(),
        "autor": autor.strip(),
        "quantidade": quantidade,
        "preco": preco,
        "id_categoria": id_categoria,
        "id_editora": id_editora,
    }

    resposta = supabase.table("livros").insert(dados).execute()
    return (resposta.data or [dados])[0]


def editar_livro(
    supabase: Client,
    id_livro: int,
    **alteracoes: Any,
) -> dict:
    permitidos = {
        "titulo",
        "autor",
        "quantidade",
        "preco",
        "id_categoria",
        "id_editora",
    }

    dados = {
        chave: valor
        for chave, valor in alteracoes.items()
        if chave in permitidos and valor is not None
    }

    if not dados:
        raise ValueError("Nenhum campo válido foi informado.")

    resposta = (
        supabase.table("livros")
        .update(dados)
        .eq("id", id_livro)
        .execute()
    )
    return (resposta.data or [dados])[0]


def aumentar_quantidade(
    supabase: Client,
    id_livro: int,
    quantidade: int = 1,
) -> int:
    if quantidade <= 0:
        raise ValueError("A quantidade adicionada deve ser maior que zero.")

    livro = (
        supabase.table("livros")
        .select("quantidade")
        .eq("id", id_livro)
        .single()
        .execute()
        .data
    )

    if not livro:
        raise ValueError("Livro não encontrado.")

    nova_quantidade = int(livro.get("quantidade") or 0) + quantidade

    (
        supabase.table("livros")
        .update({"quantidade": nova_quantidade})
        .eq("id", id_livro)
        .execute()
    )

    return nova_quantidade


def alterar_preco(supabase: Client, id_livro: int, novo_preco: float) -> float:
    if novo_preco < 0:
        raise ValueError("O preço não pode ser negativo.")

    (
        supabase.table("livros")
        .update({"preco": novo_preco})
        .eq("id", id_livro)
        .execute()
    )

    return novo_preco


def remover_livro(supabase: Client, id_livro: int) -> None:
    ativos = [
        item
        for item in relatorio_emprestimos(supabase)
        if int(item.get("id_livro") or -1) == int(id_livro)
        and not _emprestimo_devolvido(item)
    ]

    if ativos:
        raise ValueError(
            "Não é possível remover um livro que está emprestado."
        )

    supabase.table("livros").delete().eq("id", id_livro).execute()


# ---------------------------------------------------------------------------
# Avaliação automática do usuário
# ---------------------------------------------------------------------------

def calcular_nota_usuario(supabase: Client, id_usuario: int) -> dict:
    """
    Calcula a nota do usuário a partir do histórico da biblioteca.

    Retorna também os fatores usados no cálculo e o limite de livros.
    """
    emprestimos = relatorio_emprestimos(
        supabase,
        id_usuario=id_usuario,
    )

    multas_resposta = (
        supabase.table("multas")
        .select("*")
        .eq("id_usuario", id_usuario)
        .execute()
    )
    multas = multas_resposta.data or []

    atrasados_abertos = sum(
        1 for item in emprestimos if _emprestimo_atrasado(item)
    )

    devolucoes_atrasadas = sum(
        1 for item in emprestimos if _devolvido_com_atraso(item)
    )

    multas_pendentes = sum(
        1
        for multa in multas
        if _normalizar_status(multa.get("status"))
        not in {"paga", "pago", "quitada", "quitado"}
    )

    nota = (
        10
        - (atrasados_abertos * 2)
        - devolucoes_atrasadas
        - multas_pendentes
    )
    nota = max(0.0, min(10.0, float(nota)))

    limite = limite_por_nota(nota)

    ativos = sum(
        1 for item in emprestimos if not _emprestimo_devolvido(item)
    )

    return {
        "id_usuario": id_usuario,
        "nota": nota,
        "limite": limite,
        "emprestimos_ativos": ativos,
        "atrasados_abertos": atrasados_abertos,
        "devolucoes_atrasadas": devolucoes_atrasadas,
        "multas_pendentes": multas_pendentes,
        "pode_emprestar": ativos < limite,
    }


def avaliar_usuario(supabase: Client, id_usuario: int) -> dict:
    """Alias simples para a função de avaliação automática."""
    return calcular_nota_usuario(supabase, id_usuario)


def pode_realizar_emprestimo(
    supabase: Client,
    id_usuario: int,
) -> tuple[bool, str, dict]:
    avaliacao = calcular_nota_usuario(supabase, id_usuario)

    if avaliacao["emprestimos_ativos"] >= avaliacao["limite"]:
        mensagem = (
            f"Empréstimo bloqueado. Nota {avaliacao['nota']:.1f}/10; "
            f"limite de {avaliacao['limite']} livro(s); "
            f"o usuário já possui {avaliacao['emprestimos_ativos']}."
        )
        return False, mensagem, avaliacao

    return True, "Usuário liberado para novo empréstimo.", avaliacao


# ---------------------------------------------------------------------------
# Empréstimos e devoluções
# ---------------------------------------------------------------------------

def realizar_emprestimo(
    supabase: Client,
    id_usuario: int,
    id_livro: int,
    prazo_dias: int = 14,
) -> dict:
    permitido, motivo, avaliacao = pode_realizar_emprestimo(
        supabase,
        id_usuario,
    )

    if not permitido:
        raise ValueError(motivo)

    livro = (
        supabase.table("livros")
        .select("id,titulo,quantidade,preco")
        .eq("id", id_livro)
        .single()
        .execute()
        .data
    )

    if not livro:
        raise ValueError("Livro não encontrado.")

    quantidade = int(livro.get("quantidade") or 0)

    if quantidade <= 0:
        raise ValueError("Livro sem unidades disponíveis.")

    hoje = date.today()
    prevista = hoje + timedelta(days=prazo_dias)

    dados = {
        "id_usuario": id_usuario,
        "id_livro": id_livro,
        "id_exemplar": None,
        "data_emprestimo": hoje.isoformat(),
        "data_prevista_devolucao": prevista.isoformat(),
        "data_devolucao": None,
        "status": "emprestado",
    }

    resposta = (
        supabase.table("emprestimos")
        .insert(dados)
        .execute()
    )

    criado = (resposta.data or [dados])[0]

    try:
        (
            supabase.table("livros")
            .update({"quantidade": quantidade - 1})
            .eq("id", id_livro)
            .execute()
        )
    except Exception:
        if criado.get("id") is not None:
            (
                supabase.table("emprestimos")
                .delete()
                .eq("id", criado["id"])
                .execute()
            )
        raise

    return {
        **criado,
        "nota_usuario": avaliacao["nota"],
        "limite_usuario": avaliacao["limite"],
    }


def registrar_devolucao(
    supabase: Client,
    id_emprestimo: int,
) -> dict:
    emprestimo = (
        supabase.table("emprestimos")
        .select("*")
        .eq("id", id_emprestimo)
        .single()
        .execute()
        .data
    )

    if not emprestimo:
        raise ValueError("Empréstimo não encontrado.")

    if _emprestimo_devolvido(emprestimo):
        raise ValueError("Esse empréstimo já foi devolvido.")

    hoje = date.today().isoformat()

    (
        supabase.table("emprestimos")
        .update({
            "status": "devolvido",
            "data_devolucao": hoje,
        })
        .eq("id", id_emprestimo)
        .execute()
    )

    id_livro = emprestimo.get("id_livro")

    if id_livro is None and emprestimo.get("id_exemplar") is not None:
        exemplar = (
            supabase.table("exemplares")
            .select("id_livro")
            .eq("id", emprestimo["id_exemplar"])
            .single()
            .execute()
            .data
        )
        id_livro = exemplar.get("id_livro") if exemplar else None

    if id_livro is not None:
        livro = (
            supabase.table("livros")
            .select("quantidade")
            .eq("id", id_livro)
            .single()
            .execute()
            .data
        )

        if livro:
            nova_quantidade = int(livro.get("quantidade") or 0) + 1
            (
                supabase.table("livros")
                .update({"quantidade": nova_quantidade})
                .eq("id", id_livro)
                .execute()
            )

    return {
        **emprestimo,
        "status": "devolvido",
        "data_devolucao": hoje,
    }


def relatorio_emprestimos(
    supabase: Client,
    *,
    id_usuario: Optional[int] = None,
    situacao: Optional[str] = None,
) -> list[dict]:
    consulta = supabase.table("emprestimos").select("*")

    if id_usuario is not None:
        consulta = consulta.eq("id_usuario", id_usuario)

    resposta = consulta.order("id").execute()
    dados = resposta.data or []

    if situacao == "abertos":
        dados = [
            item for item in dados
            if not _emprestimo_devolvido(item)
        ]
    elif situacao == "devolvidos":
        dados = [
            item for item in dados
            if _emprestimo_devolvido(item)
        ]
    elif situacao == "atrasados":
        dados = [
            item for item in dados
            if _emprestimo_atrasado(item)
        ]

    return dados


# ---------------------------------------------------------------------------
# Estatísticas
# ---------------------------------------------------------------------------

def ranking_livros_mais_emprestados(
    supabase: Client,
) -> list[dict]:
    emprestimos = relatorio_emprestimos(supabase)

    exemplares = (
        supabase.table("exemplares")
        .select("id,id_livro")
        .execute()
        .data
        or []
    )
    mapa_exemplares = {
        int(item["id"]): int(item["id_livro"])
        for item in exemplares
        if item.get("id") is not None and item.get("id_livro") is not None
    }

    contador: Counter[int] = Counter()

    for emprestimo in emprestimos:
        id_livro = emprestimo.get("id_livro")

        if id_livro is None and emprestimo.get("id_exemplar") is not None:
            id_livro = mapa_exemplares.get(int(emprestimo["id_exemplar"]))

        if id_livro is not None:
            contador[int(id_livro)] += 1

    livros = {
        int(item["id"]): item
        for item in listar_livros(supabase)
        if item.get("id") is not None
    }

    ranking = []
    for id_livro, total in contador.most_common():
        livro = livros.get(id_livro, {})
        ranking.append({
            "id_livro": id_livro,
            "titulo": livro.get("titulo", f"Livro #{id_livro}"),
            "autor": livro.get("autor"),
            "total_emprestimos": total,
        })

    return ranking


def livro_mais_emprestado(supabase: Client) -> Optional[dict]:
    ranking = ranking_livros_mais_emprestados(supabase)
    return ranking[0] if ranking else None


# ---------------------------------------------------------------------------
# Exemplo de uso
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    banco = conectar_supabase()

    print("=== Biblioteca DS ===")
    print("Livro mais emprestado:", livro_mais_emprestado(banco))

    usuarios = listar_usuarios(banco)
    if usuarios:
        exemplo = calcular_nota_usuario(banco, usuarios[0]["id"])
        print("Avaliação do primeiro usuário:", exemplo)
