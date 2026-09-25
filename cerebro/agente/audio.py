from pathlib import PurePosixPath
from urllib.parse import urlparse

import httpx
from openai import OpenAI

MODELO = "gpt-4o-mini-transcribe"
USD_POR_MINUTO = 0.003
TETO_BYTES = 10 * 1024 * 1024


def baixar(url: str, cliente: httpx.Client) -> bytes:
    # A URL chega no corpo do pedido; só https, para ninguém usar o cérebro contra a rede interna.
    if not url.startswith("https://"):
        raise ValueError("áudio só por https")
    dados = bytearray()
    with cliente.stream("GET", url) as r:
        r.raise_for_status()
        for bloco in r.iter_bytes():
            dados += bloco
            if len(dados) > TETO_BYTES:
                raise ValueError("áudio acima do teto")
    return bytes(dados)


def transcrever(url: str, segundos: int) -> dict:
    with httpx.Client(timeout=15, follow_redirects=True) as c:
        dados = baixar(url, c)
    # A OpenAI deduz o formato pela extensão; nota de voz do WhatsApp é ogg.
    nome = PurePosixPath(urlparse(url).path).name or "audio.ogg"
    if "." not in nome:
        nome += ".ogg"
    t = OpenAI(timeout=30, max_retries=1).audio.transcriptions.create(model=MODELO, file=(nome, dados), language="pt")
    return {"texto": t.text.strip(), "custo_usd": USD_POR_MINUTO * segundos / 60}
