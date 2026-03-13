
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────
// COLE SUA CHAVE GROQ AQUI
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// ─────────────────────────────────────────

const PROMPTS = {
  SOAP: `Você é um assistente clínico veterinário especializado em documentação de prontuários.
Estruture as informações recebidas em uma evolução clínica profissional no formato SOAP.

REGRAS:
1. Organize em formato SOAP completo: Subjetivo, Objetivo, Avaliação, Plano
2. Use linguagem técnica veterinária profissional
3. Seja preciso e objetivo
4. Se uma informação não foi fornecida, NÃO invente — escreva "Não informado" ou omita
5. No Plano, liste medicamentos com dose/via/frequência se disponível
6. Inclua "DATA/HORA: [a preencher]" se não fornecido
7. Se houver ficha anterior, use como contexto e atualize
8. Ao final adicione STATUS: ESTÁVEL / EM MELHORA / ESTÁVEL SEM MELHORA / GRAVE / ALTA
9. Responda APENAS com a evolução formatada, sem comentários adicionais

FORMATO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVOLUÇÃO CLÍNICA — SOAP | [ESPECIALIDADE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Paciente: [nome]   Espécie/Raça: [espécie/raça]
Responsável: [tutor]     Data/Hora: [a preencher]
─────────────────────────────────
S — SUBJETIVO
[apetite, comportamento, queixas relatadas pelo tutor]

O — OBJETIVO
[temperatura, FC, FR, TPC, peso, achados ao exame físico, resultados de exames]

A — AVALIAÇÃO
[diagnóstico, hipóteses, evolução em relação ao quadro anterior]

P — PLANO
[medicações com dose/via/frequência, procedimentos, exames solicitados, dieta, orientações]

─────────────────────────────────
STATUS: [ESTÁVEL / EM MELHORA / ESTÁVEL SEM MELHORA / GRAVE / ALTA]
Assinatura: _________________________________ CRMV: _______
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,

  SBAR: `Você é um assistente clínico veterinário especializado em documentação de prontuários hospitalares.
Estruture as informações recebidas em uma evolução clínica profissional no formato SBAR, amplamente utilizado em ambiente hospitalar veterinário para comunicação clínica entre equipes.

REGRAS:
1. Organize em formato SBAR completo: Situation, Background, Assessment, Recommendation
2. Use linguagem técnica veterinária profissional e objetiva
3. Se uma informação não foi fornecida, NÃO invente — escreva "Não informado" ou omita
4. Em Recommendation, seja específico: medicamentos com dose/via/frequência, exames, condutas
5. Inclua "DATA/HORA: [a preencher]" se não fornecido
6. Se houver registro anterior, use como contexto e atualize
7. Ao final adicione STATUS: ESTÁVEL / EM MELHORA / ESTÁVEL SEM MELHORA / GRAVE / ALTA
8. Responda APENAS com a evolução formatada, sem comentários adicionais

FORMATO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVOLUÇÃO CLÍNICA — SBAR | [ESPECIALIDADE]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Paciente: [nome]   Espécie/Raça: [espécie/raça]
Responsável: [tutor]     Data/Hora: [a preencher]
─────────────────────────────────
S — SITUATION (Situação atual)
[O que está acontecendo agora: queixa principal, estado geral, motivo da comunicação]

B — BACKGROUND (Contexto / Histórico)
[Diagnóstico, histórico relevante, tratamento em curso, evolução desde a internação]

A — ASSESSMENT (Avaliação clínica)
[Parâmetros vitais atuais: T, FC, FR, TPC, peso. Achados ao exame físico. Interpretação clínica do quadro]

R — RECOMMENDATION (Recomendação / Conduta)
[O que deve ser feito: ajuste de medicações com posologia, exames solicitados, procedimentos, dieta, orientações à equipe]

─────────────────────────────────
STATUS: [ESTÁVEL / EM MELHORA / ESTÁVEL SEM MELHORA / GRAVE / ALTA]
Assinatura: _________________________________ CRMV: _______
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
};

app.post('/gerar', async (req, res) => {
  const { fichaAnterior, novasInfos, especialidade, especie, formato } = req.body;

  if (!novasInfos) {
    return res.status(400).json({ error: 'Informações novas são obrigatórias.' });
  }

  let userMessage = `ESPECIALIDADE: ${especialidade}\nESPÉCIE: ${especie}\n\n`;
  if (fichaAnterior) userMessage += `=== FICHA / EVOLUÇÃO ANTERIOR ===\n${fichaAnterior}\n\n`;
  userMessage += `=== INFORMAÇÕES NOVAS (brutas) ===\n${novasInfos}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: PROMPTS[formato] || PROMPTS.SOAP },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json({ error: err.error?.message || 'Erro na API Groq' });
    }

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content || '';
    res.json({ result: text });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('✅ VetEvolve backend rodando em http://localhost:3000');
});
