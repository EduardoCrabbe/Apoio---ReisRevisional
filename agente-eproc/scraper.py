from DrissionPage import ChromiumPage, ChromiumOptions
from DrissionPage.common import Actions
from DrissionPage.errors import ElementNotFoundError
import time
import os
import traceback

URL_CONSULTA = (
    "https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php"
    "?acao=tjsp@consulta_publica_eproc/consultar&tipoConsulta=CP"
    "&hash=f3c28e42b825498235ed8a74b028a6bc"
)


class MuitosProcessosError(Exception):
    """CPF com volume de processos acima do permitido pela consulta pública."""


class ProcessoNaoLocalizadoError(Exception):
    """Nenhum processo da lista do CPF bate com o número esperado da planilha."""


def so_digitos(texto) -> str:
    """Normaliza um número de processo: mantém só dígitos (remove pontos, traços,
    espaços). Permite comparar formatos visuais diferentes do mesmo processo."""
    return "".join(c for c in str(texto if texto is not None else "") if c.isdigit())


def log_msg(msg):
    log_path = os.path.join(os.path.expanduser("~"), "robo_monitoramento.log")
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {msg}\n")
    print(msg)

class EprocScraper:
    def __init__(self, headless=True):
        self.headless = headless
        self.page = None

    def __enter__(self):
        log_msg(" [SISTEMA] Inicializando motor web DrissionPage (Bypass Nativo)...")
        co = ChromiumOptions()
        
        if self.headless:
            co.headless()

        try:
            self.page = ChromiumPage(co)
        except Exception as e:
            log_msg(f" [ERRO FATAL] Falha ao iniciar DrissionPage: {e}\n{traceback.format_exc()}")
            raise e
        
        # Timeout global implicito
        self.page.set.timeouts(base=10)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            try:
                self.page.quit()
                log_msg(" [SISTEMA] Navegador fechado. Memoria liberada.")
            except Exception as e:
                log_msg(f" [ERRO] Erro ao fechar navegador: {e}")
            
        if exc_type:
            log_msg(f" [FALHA CRITICA] Execucao interrompida: {exc_val}")

        # HTML de debug só existe durante a execução — apaga ao fim.
        if os.path.exists("page_source.html"):
            os.remove("page_source.html")

    def consultar_processo(self, numero_processo: str = None, cpf: str = None, processo_esperado: str = None):
        if not numero_processo and not cpf:
            raise ValueError("E obrigatorio fornecer o Numero do Processo ou o CPF.")

        if os.path.exists("page_source.html"):
            os.remove("page_source.html")

        print(" Acessando portal Eproc SP...")
        self.page.get("https://eproc-consulta.tjsp.jus.br/consulta_1g/externo_controlador.php?acao=tjsp@consulta_publica_eproc/consultar&tipoConsulta=CP&hash=f3c28e42b825498235ed8a74b028a6bc")
        
        try:
            print(" Aguardando carregamento do seletor de pesquisa...")
            sel_tipo = self.page.ele('#selTipoPesquisa')
            
            if numero_processo:
                print(f" Prioridade 1: Buscando pelo Seletor NU (Processo: {numero_processo})")
                sel_tipo.select.by_value('NU')
                input_nu = self.page.ele('#numNrProcesso')
                input_nu.clear()
                input_nu.input(numero_processo)
            elif cpf:
                print(f" Fallback: Buscando pelo Seletor CP (CPF: {cpf})")
                sel_tipo.select.by_value('CP')
                input_cp = self.page.ele('@name=strDocParte')
                # Digita como humano
                input_cp.clear()
                for char in cpf:
                    input_cp.input(char)
                    time.sleep(0.05)
                
            print(" Preenchimento concluido.")
            
            print(" Clicando em 'Consultar' com interacao humana...")
            btn = self.page.ele('#sbmConsultar')
            
            # Movimentacao de mouse natural
            ac = Actions(self.page)
            ac.move_to(btn).click()
            
            # Lida com o alerta de "Aguarde a verificacao do captcha" caso surja
            alert_text = self.page.handle_alert(accept=True, timeout=2)
            if alert_text:
                print(f" Alerta detectado: {alert_text}. Aguardando mais 5s...")
                time.sleep(5)
                # Tenta clicar de novo apos alerta
                if self.page.ele('#sbmConsultar'):
                    self.page.ele('#sbmConsultar').click()
                
            print(" Aguardando a lista de resultados carregar com margem segura...")
            self.page.wait.load_start()
            time.sleep(4)
            
            if processo_esperado:
                print(f" Tentando clicar automaticamente no processo {processo_esperado} na lista...")
                link_processo = self.page.ele(f'text:{processo_esperado}')
                if link_processo:
                    print(f" Clicando no processo {processo_esperado}...")
                    link_processo.click()
                    time.sleep(2)
                    
                    if self.page.handle_alert(accept=True, timeout=2):
                        print(f" Alerta tardio detectado na lista.")
                        print(f" FALHA: Cloudflare bloqueou o acesso aos autos do processo {processo_esperado}.")
                        return "FALHA - CAPTCHA/CLOUDFLARE"
                else:
                    print(f" FALHA: Processo {processo_esperado} NAO encontrado na pagina.")
            
            # Fecha nova aba se houver (lógica funcional — sempre).
            # A captura do HTML é APENAS de debug: só sob a flag DEBUG.
            if self.page.tabs_count > 1:
                latest_tab = self.page.latest_tab
                if os.getenv("DEBUG"):
                    print(" Capturando codigo-fonte da nova aba para analise estatica...")
                    with open("page_source.html", "w", encoding="utf-8") as f:
                        f.write(latest_tab.html)
                latest_tab.close()
                # Retorna foco para a aba principal
                self.page = self.page.get_tab(self.page.tabs_ids[0])
            else:
                if os.getenv("DEBUG"):
                    print(" Capturando codigo-fonte da pagina principal para analise estatica...")
                    with open("page_source.html", "w", encoding="utf-8") as f:
                        f.write(self.page.html)

            if os.getenv("DEBUG"):
                print(" HTML salvo em page_source.html!")
            
        except ElementNotFoundError as e:
            print(f" [TIMEOUT/ERRO] Elemento nao encontrado: {e}")
        except Exception as e:
            err_msg = str(e).encode('ascii', 'ignore').decode()
            tb = traceback.format_exc().encode('ascii', 'ignore').decode()
            print(f" [ERRO] Falha durante a consulta: {err_msg}\n{tb}")
            raise e

    def consultar_por_cpf(self, cpf: str, processo_esperado: str) -> dict:
        """Fluxo REAL (MODO_SIMULADO=0): pesquisa por CPF/CNPJ, cruza com o
        processo esperado da planilha e devolve a ÚLTIMA movimentação.

        Retorna {"classe", "data_movimentacao", "descricao"}.
        Lança:
          - MuitosProcessosError      → CPF não consultável (excesso de processos);
          - ProcessoNaoLocalizadoError → nenhum processo bate com o esperado.
        O agente trata ambas como falha DESTE cliente (loga e segue pro próximo).

        ⚠️ VALIDAÇÃO MANUAL OBRIGATÓRIA (headless=False, 1-2 CPFs) antes de
        produção: os seletores do Eproc/TJSP podem mudar sem aviso. Ver
        docs/obsidian/Etapa 8 - Agente Eproc.md > "Busca real".
        """
        if not cpf:
            raise ValueError("CPF obrigatório para a busca real.")

        print(" Acessando portal Eproc SP (pesquisa por CPF/CNPJ)...")
        self.page.get(URL_CONSULTA)

        # (1) Tipo de Pesquisa = CPF/CNPJ ('CP'), NÃO Número do Processo ('NU').
        sel_tipo = self.page.ele('#selTipoPesquisa')
        sel_tipo.select.by_value('CP')

        # (2) Insere o CPF (digitação "humana") e submete.
        input_cp = self.page.ele('@name=strDocParte')
        input_cp.clear()
        for char in str(cpf):
            input_cp.input(char)
            time.sleep(0.05)

        btn = self.page.ele('#sbmConsultar')
        Actions(self.page).move_to(btn).click()

        alert_text = self.page.handle_alert(accept=True, timeout=2)
        if alert_text:
            print(f" Alerta detectado: {alert_text}. Aguardando 5s e tentando de novo...")
            time.sleep(5)
            if self.page.ele('#sbmConsultar'):
                self.page.ele('#sbmConsultar').click()

        self.page.wait.load_start()
        time.sleep(4)

        # (3) Erro de excesso de processos → falha controlada deste cliente.
        corpo = (self.page.html or "").upper()
        if "MUITOS PROCESSOS" in corpo or "NAO PODEM SER CONSULTADAS" in corpo or "NÃO PODEM SER CONSULTADAS" in corpo:
            raise MuitosProcessosError(
                "entidades com muitos processos não podem ser consultadas (CPF ignorado)"
            )

        # (4) Cruza pelo número de processo esperado (normalizado).
        alvo = so_digitos(processo_esperado)
        if not alvo:
            raise ProcessoNaoLocalizadoError("número de processo esperado ausente na planilha")

        link_processo = None
        for a in self.page.eles('tag:a'):
            txt = so_digitos(a.text)
            if txt and (txt == alvo or alvo in txt):
                link_processo = a
                break

        # (5) Não encontrou → falha controlada deste cliente.
        if link_processo is None:
            raise ProcessoNaoLocalizadoError(
                f"processo não localizado para este CPF (esperado {processo_esperado})"
            )

        # (6) Abre o processo e captura a última movimentação.
        print(f" Processo correspondente encontrado. Abrindo autos...")
        link_processo.click()
        time.sleep(2)
        if self.page.handle_alert(accept=True, timeout=2):
            raise RuntimeError("Cloudflare/Captcha bloqueou o acesso aos autos.")

        # O Eproc costuma abrir os autos em nova aba — passa o foco pra ela.
        if self.page.tabs_count > 1:
            self.page = self.page.get_tab(self.page.latest_tab.tab_id)
            time.sleep(1)

        return self._extrair_ultima_movimentacao()

    def _extrair_ultima_movimentacao(self) -> dict:
        """Lê a classe e a movimentação MAIS RECENTE dos autos abertos.

        Defensivo: tenta seletores conhecidos e, na ausência, cai para heurística
        de tabela. Seletores são candidatos a quebrar — validar manualmente.
        """
        classe = ""
        try:
            el_classe = self.page.ele('#txtClasse', timeout=2) or self.page.ele('text:Classe', timeout=2)
            if el_classe:
                classe = (el_classe.text or "").replace("Classe", "").strip()
        except Exception:
            pass

        data_mov, descricao = "", ""
        try:
            # Tabela de eventos/movimentações. A linha mais recente costuma ser a
            # primeira (data desc) — se o tribunal listar em ordem crescente,
            # ajustar para a última linha na validação manual.
            tabela = self.page.ele('#tblEventos', timeout=3) or self.page.ele('tag:table', timeout=3)
            if tabela:
                linhas = tabela.eles('tag:tr')
                # pula o cabeçalho (linhas[0]) quando houver mais de uma linha
                alvo = linhas[1] if len(linhas) > 1 else (linhas[0] if linhas else None)
                if alvo:
                    celulas = [c.text.strip() for c in alvo.eles('tag:td')]
                    if celulas:
                        data_mov = next((c for c in celulas if any(ch.isdigit() for ch in c)), celulas[0])
                        descricao = max(celulas, key=len)  # a célula mais longa ~ descrição
        except Exception as e:
            print(f" [AVISO] Não consegui extrair a movimentação estruturada: {e}")

        return {
            "classe": classe,
            "data_movimentacao": data_mov or time.strftime("%Y-%m-%d"),
            "descricao": descricao,
        }

    def aplicar_triagem(self, acao: str, movimentacao: str) -> str:
        acao = acao.upper()
        movimentacao = movimentacao.upper()
        
        classes_permitidas = [
            "BUSCA E APREENSAO",
            "EXECUCAO DE TITULO EXTRAJUDICIAL",
            "ACAO MONITORIA",
            "MONITORIA",
            "ACAO DE COBRANCA",
            "COBRANCA"
        ]
        
        eh_permitida = any(c in acao for c in classes_permitidas)
        if not eh_permitida:
            return " IGNORADO (OUTRA CLASSE)"
        
        if "BUSCA E APREENSAO" in acao:
            if "PETICAO" in movimentacao or "MANDADO" in movimentacao:
                return " ALERTA VERMELHO"
        
        return " REGISTRO NORMAL"

if __name__ == "__main__":
    with EprocScraper(headless=False) as scraper:
        scraper.consultar_processo(cpf="00.000.000/0001-91")
        alerta = scraper.aplicar_triagem("Busca e Apreensao", "Juntada de Peticao Intermediaria")
        print(f"Status da Triagem Mockada: {alerta}")
