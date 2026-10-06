export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Nur POST erlaubt'}),{status:405,headers:{'content-type':'application/json'}});
  const key = process.env.OPENAI_API_KEY;
  if (!key) return new Response(JSON.stringify({error:'Bildanalyse ist noch nicht aktiviert: OPENAI_API_KEY fehlt in Vercel.'}),{status:503,headers:{'content-type':'application/json'}});
  try {
    const {image,context={}} = await req.json();
    if (!image || !String(image).startsWith('data:image/')) throw new Error('Kein gültiges Bild übermittelt.');
    const prompt = `Analysiere dieses Foto eines technischen Typenschilds/Anlagenbauteils. Kontext: DIN 276: ${context.din276||'unbekannt'}, Anlage: ${context.system||'unbekannt'}, Teilanlage: ${context.subsystem||'unbekannt'}, Bauteil: ${context.component||'unbekannt'}.
Extrahiere nur tatsächlich lesbare Daten. Nichts erfinden. Antworte ausschließlich als JSON-Objekt mit:
{"manufacturer":"","model":"","serial":"","year":"","technicalData":[{"key":"","value":""}]}
technicalData soll relevante weitere technische Werte enthalten, z.B. Leistung, Spannung, Strom, Frequenz, Volumenstrom, Druck, Förderhöhe, Kältemittel, Füllmenge, Schutzart, Drehzahl. Werte mit Einheit zusammen ausgeben. Nicht erkannte Standardfelder als leere Strings ausgeben.`;
    const body={model:'gpt-5-mini',input:[{role:'user',content:[{type:'input_text',text:prompt},{type:'input_image',image_url:image}]}],text:{format:{type:'json_object'}}};
    const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'authorization':'Bearer '+key,'content-type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error?.message||'KI-Dienst nicht erreichbar.');
    const out=d.output_text || (d.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||'').join('');
    const parsed=JSON.parse(out);
    return new Response(JSON.stringify(parsed),{status:200,headers:{'content-type':'application/json'}});
  } catch(e) {
    return new Response(JSON.stringify({error:e.message||'Bildanalyse fehlgeschlagen.'}),{status:400,headers:{'content-type':'application/json'}});
  }
}