import React, { useState, useRef } from 'react';
import { UploadCloud, Plus, Loader2 } from 'lucide-react';

export default function Commissioning() {
  const [formData, setFormData] = useState({ customer: '', type: 'Quitacao', file: null });
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.type === 'Atendimento_Rotina' || formData.type === 'Video_Depoimento') {
      if (!formData.file) {
        alert("Por favor, anexe o arquivo de áudio ou vídeo para a IA analisar.");
        return;
      }
      
      setLoading(true);
      const data = new FormData();
      data.append('file', formData.file);

      try {
        const response = await fetch('http://localhost:8000/api/ai/summarize', {
          method: 'POST',
          body: data
        });
        
        const result = await response.json();
        setSummary(result.summary);
      } catch (error) {
        console.error("Erro na API:", error);
        setSummary("Falha ao se conectar com a API de IA do backend.");
      } finally {
        setLoading(false);
      }
    } else {
      alert("Lançamento comum registrado (sem processamento de IA)!");
    }
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  return (
    <div className="animate-fade-in">
      <header className="page-header">
        <h1 className="page-title">Lançar Atendimento</h1>
        <p className="page-subtitle">Registre suas quitações, depoimentos e áudios para comissionamento.</p>
      </header>

      <div style={{ display: 'flex', gap: '32px' }}>
        <div className="glass-panel" style={{ padding: '32px', flex: 1 }}>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">ID DataJuri do Cliente</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Ex: DJ-12345" 
                value={formData.customer}
                onChange={e => setFormData({...formData, customer: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipo de Lançamento</label>
              <select 
                className="form-input" 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
              >
                <option value="Quitacao">Quitação (R$ 5 / R$ 10)</option>
                <option value="Comentario_Google">Avaliação Google (R$ 5 / R$ 10)</option>
                <option value="Reclame_Aqui">Reclame Aqui (R$ 10 / R$ 15)</option>
                <option value="Foto_Boleto">Foto com Boleto (R$ 5 / R$ 10)</option>
                <option value="Video_Depoimento">Depoimento em Vídeo (R$ 15 / R$ 20)</option>
                <option value="Atendimento_Rotina">Atendimento / Ligação (Gerar Resumo IA)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Anexar Evidência (Áudio, Vídeo ou Imagem)</label>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              <div 
                onClick={handleFileClick}
                style={{ 
                  border: formData.file ? '2px solid var(--primary)' : '2px dashed var(--border-color)', 
                  padding: '32px', 
                  textAlign: 'center',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  background: formData.file ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.1)',
                  transition: 'all 0.3s'
                }}
              >
                <UploadCloud size={48} color="var(--primary)" style={{ marginBottom: '16px', margin: '0 auto' }} />
                <p style={{ marginTop: '16px', fontWeight: formData.file ? 'bold' : 'normal' }}>
                  {formData.file ? formData.file.name : "Clique ou arraste o arquivo aqui"}
                </p>
                <small style={{ color: 'var(--text-muted)' }}>MP3, WAV, JPG, PNG, MP4</small>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
              {loading ? "Processando IA..." : "Registrar e Processar"}
            </button>
          </form>
        </div>

        <div className="glass-panel" style={{ padding: '32px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ marginBottom: '16px', fontWeight: 600 }}>Preview do Relatório (IA)</h3>
          <div style={{ 
            flex: 1, 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '8px', 
            padding: '24px',
            color: summary ? 'var(--text-main)' : 'var(--text-muted)',
            fontStyle: summary ? 'normal' : 'italic',
            border: '1px solid var(--border-color)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            overflowY: 'auto'
          }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                <Loader2 className="animate-spin" /> A IA está ouvindo o áudio e redigindo o relatório...
              </div>
            ) : summary ? (
              summary
            ) : (
              "Nenhum áudio ou vídeo processado no momento. Faça o upload do atendimento para que o Gemini gere o relatório formatado na primeira pessoa."
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
