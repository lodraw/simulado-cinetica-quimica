// =====================================================================
//  LaTeX con KaTeX + mhchem. Empaquetado en el build: funciona sin internet.
// =====================================================================
import katex from 'katex';
import 'katex/contrib/mhchem';
import 'katex/dist/katex.min.css';

const opciones = { throwOnError: false, strict: false };

export const tex = (fuente, bloque = false) => katex.renderToString(fuente, { ...opciones, displayMode: bloque });

// Solo vuelve a renderizar si la fórmula cambió (la animación llama esto cada cuadro)
export function ponerTex(el, fuente, bloque = false) {
  if (el._tex === fuente) return;
  el._tex = fuente;
  el.innerHTML = tex(fuente, bloque);
}

// Texto normal con fórmulas entre $...$
export const conTex = texto => texto.replace(/\$([^$]+)\$/g, (_, f) => tex(f));

// Renderiza lo que viene escrito en el HTML: data-tex (en línea) y data-tex-bloque
export function renderizarEstaticos(raiz = document) {
  raiz.querySelectorAll('[data-tex]').forEach(el => ponerTex(el, el.dataset.tex));
  raiz.querySelectorAll('[data-tex-bloque]').forEach(el => ponerTex(el, el.dataset.texBloque, true));
}
