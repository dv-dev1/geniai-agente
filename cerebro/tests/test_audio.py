import httpx
import pytest

from agente.audio import TETO_BYTES, baixar, cliente_http


def cliente_que_devolve(corpo: bytes) -> httpx.Client:
    return cliente_http(transport=httpx.MockTransport(lambda _: httpx.Response(200, content=corpo)))


def test_baixa_o_audio():
    assert baixar("https://z/a.ogg", cliente_que_devolve(b"ogg")) == b"ogg"


def test_recusa_url_sem_https():
    with pytest.raises(ValueError):
        baixar("http://169.254.169.254/latest", cliente_que_devolve(b""))


def test_recusa_audio_acima_do_teto():
    with pytest.raises(ValueError):
        baixar("https://z/a.ogg", cliente_que_devolve(b"x" * (TETO_BYTES + 1)))


def test_recusa_redirecionamento_para_http():
    def servidor(pedido: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"Location": "http://169.254.169.254/latest"})
    with pytest.raises(ValueError):
        baixar("https://z/a.ogg", cliente_http(transport=httpx.MockTransport(servidor)))
