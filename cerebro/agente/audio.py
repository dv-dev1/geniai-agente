from pathlib import PurePosixPath
from urllib.parse import urlparse

import httpx
from openai import OpenAI

MODELO = "gpt-4o-mini-transcribe"
USD_POR_MINUTO = 0.003
TETO_BYTES = 10 * 1024 * 1024
FORMATOS = {"flac", "m4a", "mp3", "mp4", "mpeg", "mpga", "ogg", "wav", "webm"}


def _so_https(pedido: httpx.Request) -> None:
    # A URL chega no corpo do pedido: só https, em cada redirecionamento, para ninguém usar o cérebro contra a rede interna.
    if pedido.url.scheme != "https":
        raise ValueError("áudio só por https")


def cliente_http(**extra) -> httpx.Client:
    return httpx.Client(timeout=8, follow_redirects=True, event_hooks={"request": [_so_https]}, **extra)


def baixar(url: str, cliente: httpx.Client) -> bytes:
    dados = bytearray()
    with cliente.stream("GET", url) as r:
        r.raise_for_status()
        for bloco in r.iter_bytes():
            dados += bloco
            if len(dados) > TETO_BYTES:
                raise ValueError("áudio acima do teto")
    return bytes(dados)


def nome_do_arquivo(url: str) -> str:
    # A OpenAI deduz o formato pela extensão e recusa as que não conhece; nota de voz do WhatsApp é ogg.
    nome = PurePosixPath(urlparse(url).path).name
    return nome if nome.rpartition(".")[2].lower() in FORMATOS else "audio.ogg"


def transcrever(url: str, segundos: int) -> dict:
    with cliente_http() as c:
        dados = baixar(url, c)
    # Download (8 s) + duas tentativas de 12 s cabem nos 45 s que o web espera.
    t = OpenAI(timeout=12, max_retries=1).audio.transcriptions.create(
        model=MODELO, file=(nome_do_arquivo(url), dados), language="pt"
    )
    return {"texto": t.text.strip(), "custo_usd": USD_POR_MINUTO * segundos / 60}
