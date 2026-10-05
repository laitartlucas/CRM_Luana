import { useState } from 'react';
import { WhatsappApi } from '../../api/endpoints';
import { errorMessage, useToast } from '../ui/Toast';

interface SimulatedMessage {
  id: string;
  direction: 'IN' | 'OUT';
  content: string;
}

/** Simulador de conversa do bot (só ADMIN — o backend nega os demais papéis). */
export function WhatsappSimulatorCard() {
  const toast = useToast();
  const [phone, setPhone] = useState('+5511999990000');
  const [text, setText] = useState('1');
  const [log, setLog] = useState<SimulatedMessage[]>([]);
  const [sending, setSending] = useState(false);

  async function handleSimulate() {
    setSending(true);
    try {
      const res = await WhatsappApi.simulateInbound(phone, text);
      setLog(((res.data as { messages?: SimulatedMessage[] })?.messages ?? []).slice().reverse());
    } catch (err) {
      toast.error(errorMessage(err, 'Não foi possível enviar a mensagem simulada.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card">
      <h2 className="section-title" style={{ marginTop: 0 }}>WhatsApp — simulador de conversa</h2>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
        Enquanto a conta Meta Business não está aprovada, use este simulador para testar o fluxo de agendar/remarcar/cancelar
        do jeito que uma cliente veria no WhatsApp de verdade (ver <code>WHATSAPP_PROVIDER=mock</code> no backend).
      </p>
      <div className="form-grid">
        <label className="field">
          Telefone simulado
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="field">
          Mensagem
          <input value={text} onChange={(e) => setText(e.target.value)} />
        </label>
      </div>
      <button className="btn" style={{ marginTop: '0.75rem' }} onClick={handleSimulate} disabled={sending}>
        {sending ? 'Enviando...' : 'Enviar mensagem simulada'}
      </button>
      <div style={{ marginTop: '1rem' }}>
        {log.map((m) => (
          <div key={m.id} className="appointment-row">
            <span>
              {m.direction === 'IN' ? '👤' : '🤖'} {m.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
