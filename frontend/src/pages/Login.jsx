import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Erro ao fazer login.');
        return;
      }

      onLogin(data.user);
      navigate('/dashboard');
    } catch {
      setError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-navy">
      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center text-center">

        <div className="mb-10 flex flex-col items-center">
          <h1 className="text-4xl font-serif tracking-widest text-brand-navy border-b-2 border-brand-bronze/50 pb-2 px-8">APOIO</h1>
          <span className="text-sm tracking-[0.4em] mt-3 text-brand-navy font-medium">ao CS</span>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold text-brand-navy mb-3">Bem-vindo</h2>
          <p className="text-brand-bronze text-sm px-4 leading-relaxed">
            Acesso restrito a colaboradores da Reis Revisional.
          </p>
        </div>

        <form onSubmit={handleLogin} className="w-full space-y-4">
          <div className="text-left">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@reisrevisional.com.br"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-brand-navy focus:outline-none focus:border-brand-bronze transition-colors"
            />
          </div>

          <div className="text-left">
            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-brand-navy focus:outline-none focus:border-brand-bronze transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-left">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-bronze hover:bg-[#7a5f3b] disabled:opacity-60 text-white font-bold py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ArrowRight className="w-5 h-5" />
            )}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

      </div>
    </div>
  );
}
