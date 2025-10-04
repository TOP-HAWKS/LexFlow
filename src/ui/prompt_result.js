import { saveHistory } from '../db.js';
import { summarizeOnDevice, promptOnDevice } from '../ai/chrome-ai.js';
import { PRESETS } from './presets.js';

const $ = s=>document.querySelector(s);

function fillPresets(){
  $('#preset').innerHTML = PRESETS.map((p,i)=>`<option value="${i}">${p.name}</option>`).join('');
}
function buildSystemPrompt(preset, custom){
  const base = [
    "You are a legal text assistant for lawyers.",
    "Always preserve meaning and legal intent.",
    "If you reference laws, cite article numbers explicitly from the provided CONTEXT only.",
    "Be concise and structured."
  ].join('\n');
  return [base, preset.system || '', (custom||'').trim()].filter(Boolean).join('\n\n');
}
function buildUserText(params, context, preset){
  const header = `TASK: ${preset.task}\n\nPARAMS:\n${params||'(none)'}\n\nCONTEXT (citations only from here):\n`;
  return header + (context || '(no context provided)');
}

$('#run').addEventListener('click', async ()=>{
  const idx = Number($('#preset').value || 0);
  const preset = PRESETS[idx];
  const params = $('#params').value.trim();
  const custom = $('#custom').value.trim();
  const context = $('#context').value.trim();

  $('#output').value = 'Running…';
  try{
    const systemPrompt = buildSystemPrompt(preset, custom);
    const userText = buildUserText(params, context, preset);

    let out;
    if(preset.kind === 'summary'){
      out = await summarizeOnDevice(userText);
    } else {
      out = await promptOnDevice(systemPrompt, userText);
    }

    $('#output').value = (out || '').trim();
    await saveHistory({ ts: Date.now(), preset: preset.name, params, output: out, contextSize: context.length });
  }catch(e){
    $('#output').value = `Error: ${e.message}\n\nMake sure Chrome Canary flags for built-in AI are enabled.`;
  }
});

$('#copy').addEventListener('click', ()=>{
  navigator.clipboard.writeText($('#output').value || '');
  alert('Copied.');
});

function init(){
  fillPresets();
  $('#context').value = sessionStorage.getItem('lexflow_context') || '';
}
init();