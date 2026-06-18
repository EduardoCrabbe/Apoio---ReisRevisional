from DrissionPage import ChromiumPage, ChromiumOptions
from DrissionPage.common import Actions
from DrissionPage.errors import ElementNotFoundError
import time
import os
import traceback

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
