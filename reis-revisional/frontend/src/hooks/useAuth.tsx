import { createContext, useContext, useState, ReactNode } from 'react'
import type { AuthContextType, LoginResponse, Perfil } from '../types/auth'

const AuthContext = createContext<AuthContextType | null>(null)

/** Chaves usadas no localStorage para persistir sessão entre reloads. */
const CHAVE_TOKEN = 'rr_token'
const CHAVE_NOME = 'rr_nome'

/** Perfis reconhecidos pelo sistema — qualquer outro valor é tratado como inválido. */
const PERFIS_VALIDOS: ReadonlyArray<string> = ['gerente', 'cs']

/**
 * Extrai o campo `perfil` do payload JWT sem validar assinatura.
 * A assinatura é validada pelo backend em cada chamada autenticada.
 * Retorna null se o token for inválido, mal-formado, expirado ou sem perfil reconhecido.
 */
function extrairPerfilDoToken(token: string): Perfil | null {
  try {
    const partes = token.split('.')
    if (partes.length !== 3) return null
    // Base64url → Base64 (substitui chars e restaura padding)
    const base64 = partes[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(base64))
    // Rejeita token expirado — o backend também rejeita, mas evita estado inconsistente no boot
    if (typeof json.exp === 'number' && json.exp * 1000 < Date.now()) return null
    if (PERFIS_VALIDOS.includes(json.perfil)) return json.perfil as Perfil
    return null
  } catch {
    return null
  }
}

/**
 * Provedor de autenticação. Envolve toda a árvore em App.tsx.
 * O perfil é derivado exclusivamente do payload JWT — jamais lido diretamente do localStorage.
 * Tokens inválidos ou expirados são descartados no boot antes de qualquer render.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    const tokenSalvo = localStorage.getItem(CHAVE_TOKEN)
    if (!tokenSalvo || !extrairPerfilDoToken(tokenSalvo)) {
      // Token ausente, inválido ou expirado — limpa storage de forma proativa
      localStorage.removeItem(CHAVE_TOKEN)
      localStorage.removeItem(CHAVE_NOME)
      return null
    }
    return tokenSalvo
  })

  const [perfil, setPerfil] = useState<Perfil | null>(() => {
    const tokenSalvo = localStorage.getItem(CHAVE_TOKEN)
    return tokenSalvo ? extrairPerfilDoToken(tokenSalvo) : null
  })

  const [nome, setNome] = useState<string | null>(() => localStorage.getItem(CHAVE_NOME))

  /** Salva sessão no estado e no localStorage após login bem-sucedido. */
  function login(dados: LoginResponse) {
    localStorage.setItem(CHAVE_TOKEN, dados.token)
    localStorage.setItem(CHAVE_NOME, dados.nome)
    setToken(dados.token)
    setPerfil(extrairPerfilDoToken(dados.token))
    setNome(dados.nome)
  }

  /** Remove sessão do estado e do localStorage; o router redireciona para /. */
  function logout() {
    localStorage.removeItem(CHAVE_TOKEN)
    localStorage.removeItem(CHAVE_NOME)
    setToken(null)
    setPerfil(null)
    setNome(null)
  }

  return (
    <AuthContext.Provider value={{ token, perfil, nome, autenticado: !!token && !!perfil, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Hook para consumir o contexto de autenticação em qualquer componente. Lança erro se usado fora de AuthProvider. */
export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
