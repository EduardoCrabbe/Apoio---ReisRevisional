/**
 * Wrapper único de acesso à API do backend — Etapa 9.
 *
 * Responsabilidades:
 *  - baseURL configurável (VITE_API_URL; default ''=mesma origem).
 *  - injeta automaticamente o JWT do localStorage no header Authorization.
 *  - interceptor: resposta 401 (com token presente) → limpa a sessão e
 *    redireciona para /login. Assim nenhuma tela precisa tratar expiração.
 *  - normaliza erros (inclui o `detail` do FastAPI, mesmo quando é lista 422).
 *
 * Nenhum dado de negócio mora no localStorage — só token e o usuário logado.
 */

export const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY));
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearApiCache(); // logout: descarta todo o cache em memória
}

// ------------------------------------------------------------------ cache (GET)
//
// Cache em memória SÓ para GET, por URL completa (inclui query string). TTL por
// rota (ms); qualquer mutação bem-sucedida (POST/PUT/DELETE) limpa o cache inteiro
// — ver request() — e o notifyDataChanged() também invalida (ver services/refresh).

const TTL_POR_ROTA = {
  '/api/dashboard/stats': 20000,
  '/api/equipe': 30000,
  '/api/comissoes/tabela': 120000,
  '/api/clientes': 15000,
  '/api/tarefas': 15000,
  '/api/bonus/extrato': 20000,
  '/api/quitacoes': 20000,
};
const TTL_PADRAO = 30000;

const _cache = new Map(); // url -> { data, timestamp }

function _ttl(path) {
  const base = path.split('?')[0];
  return TTL_POR_ROTA[base] ?? TTL_PADRAO;
}

export function clearApiCache() {
  _cache.clear();
}

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function extrairDetalhe(data, status) {
  if (data && Array.isArray(data.detail)) {
    // Erros de validação do FastAPI (422): lista de {loc, msg, ...}.
    return data.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
  }
  if (data && typeof data.detail === 'string') return data.detail;
  if (typeof data === 'string' && data) return data;
  return `Erro ${status}.`;
}

async function request(path, { method = 'GET', body, headers = {}, skipCache = false } = {}) {
  const token = getToken();

  // Cache hit (só GET): devolve a cópia quente se ainda dentro do TTL.
  if (method === 'GET' && !skipCache) {
    const hit = _cache.get(path);
    if (hit && Date.now() - hit.timestamp < _ttl(path)) {
      return hit.data;
    }
  }

  const opts = { method, headers: { ...headers } };

  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      opts.body = body; // o browser define o boundary do multipart
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, opts);
  } catch {
    throw new ApiError(
      'Não foi possível conectar ao servidor. Verifique se o backend está rodando.',
      0,
      null,
    );
  }

  // Sessão expirada/inválida: só dispara o redirect se HAVIA token (não no login).
  if (res.status === 401 && token) {
    clearSession();
    if (!window.location.hash.startsWith('#/login')) {
      window.location.hash = '#/login';
      window.location.reload();
    }
    throw new ApiError('Sessão expirada. Faça login novamente.', 401, null);
  }

  let data = null;
  const texto = await res.text();
  if (texto) {
    try {
      data = JSON.parse(texto);
    } catch {
      data = texto;
    }
  }

  if (!res.ok) {
    throw new ApiError(extrairDetalhe(data, res.status), res.status, data);
  }

  if (method === 'GET') {
    _cache.set(path, { data, timestamp: Date.now() }); // memoriza a resposta fresca
  } else {
    clearApiCache(); // mutação OK → todo GET cacheado pode estar velho
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  request,
};

export default api;
