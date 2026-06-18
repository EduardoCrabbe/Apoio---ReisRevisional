"""Integração com o Google Gemini — Etapa 7.

Gera resumo de áudio/vídeo de atendimento em PRIMEIRA PESSOA, omitindo CPFs.
O nome do modelo vem de GEMINI_MODEL (default gemini-2.5-flash) — nunca hardcode.
Modo mock (GEMINI_MOCK=1) devolve um resumo fictício, sem chamar a API real.
"""

import os

import models

# Fallback usado quando system_settings["ai_prompt"] não está definido.
DEFAULT_PROMPT = (
    "Você é um assistente que resume gravações de atendimento ao cliente de um "
    "escritório de revisão de contratos. Escreva o resumo em PRIMEIRA PESSOA, como "
    "o próprio atendente (ex.: \"Liguei para o cliente e expliquei...\"). Seja "
    "objetivo, em português do Brasil, em um parágrafo curto. NUNCA inclua CPF, "
    "RG ou qualquer documento: se algum número de documento for dito no áudio, "
    "OMITA-O completamente do resumo."
)

MODELO_DEFAULT = "gemini-2.5-flash"


class GeminiError(Exception):
    """Falha ao falar com a API do Gemini."""


def get_ai_prompt(db) -> str:
    ss = db.query(models.SystemSettings).filter_by(key="ai_prompt").first()
    if ss is not None and ss.value:
        return ss.value
    return DEFAULT_PROMPT


def set_ai_prompt(db, valor: str) -> str:
    ss = db.query(models.SystemSettings).filter_by(key="ai_prompt").first()
    if ss is None:
        db.add(models.SystemSettings(key="ai_prompt", value=valor))
    else:
        ss.value = valor
    db.commit()
    return valor


def _modelo() -> str:
    return os.getenv("GEMINI_MODEL", MODELO_DEFAULT)


def _resumo_mock() -> str:
    return (
        "Liguei para o cliente e expliquei a proposta de revisão do contrato. "
        "Ele confirmou interesse, esclareci as dúvidas sobre prazos e valores e "
        "combinei o envio do boleto para a quitação. Nenhum dado pessoal sensível "
        "foi registrado."
    )


def gerar_resumo(caminho_arquivo: str, prompt: str) -> str:
    """Retorna o resumo do arquivo. Em GEMINI_MOCK=1 não chama a API real."""
    if os.getenv("GEMINI_MOCK") == "1":
        return _resumo_mock()
    return _chamar_gemini(caminho_arquivo, prompt)


def _chamar_gemini(caminho_arquivo: str, prompt: str) -> str:
    """Chamada real ao Gemini. O arquivo enviado é SEMPRE deletado no finally."""
    try:
        from google import genai  # import lazy: módulo carrega sem a lib instalada
    except Exception as exc:  # pragma: no cover
        raise GeminiError(f"SDK do Gemini indisponível: {exc}")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise GeminiError("GEMINI_API_KEY não configurada.")

    client = genai.Client(api_key=api_key)
    arquivo_remoto = None
    try:
        arquivo_remoto = client.files.upload(file=caminho_arquivo)
        resposta = client.models.generate_content(
            model=_modelo(),
            contents=[prompt, arquivo_remoto],
        )
        texto = getattr(resposta, "text", None)
        if not texto:
            raise GeminiError("Resposta vazia do Gemini.")
        return texto
    except GeminiError:
        raise
    except Exception as exc:
        raise GeminiError(f"Falha na API do Gemini: {exc}")
    finally:
        # Deleta o arquivo enviado ao Gemini mesmo em caso de erro.
        if arquivo_remoto is not None:
            try:
                client.files.delete(name=arquivo_remoto.name)
            except Exception:
                pass
