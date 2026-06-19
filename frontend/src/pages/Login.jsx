import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2, Shield, User } from 'lucide-react';
import { api, setSession } from '../services/api';

const DEMO = {
  gerente: {
    email: import.meta.env.VITE_DEMO_GERENTE_EMAIL || 'gerente@reisrevisional.com.br',
    senha: import.meta.env.VITE_DEMO_GERENTE_SENHA || 'demo1234',
  },
  cs: {
    email: import.meta.env.VITE_DEMO_CS_EMAIL || 'cs@reisrevisional.com.br',
    senha: import.meta.env.VITE_DEMO_CS_SENHA || 'demo1234',
  },
};

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const autenticar = async (mail, senha) => {
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/api/auth/login', { email: mail, password: senha });
      setSession(data.access_token, data.user); // token + papel vêm do backend
      onLogin(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Erro ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    autenticar(email, password);
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
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Atalhos de demonstração — login sem digitar senha no palco. */}
        <div className="w-full mt-6 pt-6 border-t border-slate-100">
          <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3">Acesso rápido (demo)</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => autenticar(DEMO.gerente.email, DEMO.gerente.senha)}
              className="flex items-center justify-center gap-2 border border-slate-200 hover:border-brand-bronze text-brand-navy font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
            >
              <Shield className="w-4 h-4 text-brand-bronze" /> Gerente
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => autenticar(DEMO.cs.email, DEMO.cs.senha)}
              className="flex items-center justify-center gap-2 border border-slate-200 hover:border-brand-bronze text-brand-navy font-bold py-3 rounded-xl text-sm disabled:opacity-60 transition-colors"
            >
              <User className="w-4 h-4 text-brand-bronze" /> CS
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
