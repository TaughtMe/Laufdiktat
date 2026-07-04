/**
 * Kleiner, sicherer (kein eval) Ausdrucks-Parser für komplexere manuelle
 * Mathe-Eingaben: Grundrechenarten samt Klammern, Potenzen (^) sowie Brüche
 * und Wurzeln in LaTeX-ähnlicher Schreibweise (\frac{}{}, \sqrt{}, \sqrt[n]{}).
 * Nur für die manuelle Eingabe gedacht (siehe mathTasks.ts) – der
 * Zufallsgenerator bleibt bei einfachen Grundrechenarten mit ganzen Zahlen.
 *
 * Grammatik (Punkt-vor-Strich, Potenz bindet stärker, rechtsassoziativ):
 *   expr   := term (('+' | '-') term)*
 *   term   := power (('*' | '/') power)*
 *   power  := unary ('^' power)?
 *   unary  := '-' unary | atom
 *   atom   := NUMBER | '\frac{' expr '}{' expr '}'
 *           | '\sqrt{' expr '}' | '\sqrt[' expr ']{' expr '}'
 *           | '(' expr ')'
 */

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' | 'rparen' | 'lbrace' | 'rbrace' | 'lbracket' | 'rbracket' }
  | { type: 'frac' | 'sqrt' };

// Dieselben Operator-Aliase wie im einfachen Modus (mathTasks.ts): +, -, − für
// Minus, *, ×, · für Mal, /, :, ÷ für Geteilt.
const OP_ALIASES: Record<string, '+' | '-' | '*' | '/'> = {
  '+': '+', '-': '-', '−': '-',
  '*': '*', '×': '*', '·': '*',
  '/': '/', ':': '/', '÷': '/',
};

const tokenize = (input: string): Token[] | null => {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '\\') {
      if (input.startsWith('\\frac', i)) { tokens.push({ type: 'frac' }); i += 5; continue; }
      if (input.startsWith('\\sqrt', i)) { tokens.push({ type: 'sqrt' }); i += 5; continue; }
      return null; // unbekannter LaTeX-Befehl
    }
    if (c === '{') { tokens.push({ type: 'lbrace' }); i++; continue; }
    if (c === '}') { tokens.push({ type: 'rbrace' }); i++; continue; }
    if (c === '[') { tokens.push({ type: 'lbracket' }); i++; continue; }
    if (c === ']') { tokens.push({ type: 'rbracket' }); i++; continue; }
    if (c === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (c === ')') { tokens.push({ type: 'rparen' }); i++; continue; }
    if (c === '^') { tokens.push({ type: 'op', value: '^' }); i++; continue; }
    if (OP_ALIASES[c] !== undefined) { tokens.push({ type: 'op', value: OP_ALIASES[c] }); i++; continue; }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < input.length && /[0-9]/.test(input[j])) j++;
      if (input[j] === '.' || input[j] === ',') {
        j++;
        while (j < input.length && /[0-9]/.test(input[j])) j++;
      }
      const raw = input.slice(i, j).replace(',', '.');
      tokens.push({ type: 'num', value: parseFloat(raw) });
      i = j;
      continue;
    }
    return null; // unbekanntes Zeichen
  }
  return tokens;
};

class Parser {
  private pos = 0;
  private tokens: Token[];
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private next(): Token | undefined { return this.tokens[this.pos++]; }
  private expect(type: Token['type']): boolean {
    const t = this.next();
    return !!t && t.type === type;
  }

  atEnd(): boolean { return this.pos === this.tokens.length; }

  parseExpr(): number | null {
    let value = this.parseTerm();
    if (value === null) return null;
    for (;;) {
      const t = this.peek();
      if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.next();
        const rhs = this.parseTerm();
        if (rhs === null) return null;
        value = t.value === '+' ? value + rhs : value - rhs;
      } else break;
    }
    return value;
  }

  private parseTerm(): number | null {
    let value = this.parseUnary();
    if (value === null) return null;
    for (;;) {
      const t = this.peek();
      if (t?.type === 'op' && (t.value === '*' || t.value === '/')) {
        this.next();
        const rhs = this.parseUnary();
        if (rhs === null) return null;
        if (t.value === '/') {
          if (rhs === 0) return null;
          value = value / rhs;
        } else {
          value = value * rhs;
        }
      } else break;
    }
    return value;
  }

  // Unäres Minus bindet SCHWÄCHER als Potenz (Schulkonvention: -2^2 = -(2^2)
  // = -4, nicht (-2)^2 = 4) und wird deshalb "außerhalb" von parsePower
  // aufgerufen statt umgekehrt.
  private parseUnary(): number | null {
    const t = this.peek();
    if (t?.type === 'op' && t.value === '-') {
      this.next();
      const v = this.parseUnary();
      return v === null ? null : -v;
    }
    return this.parsePower();
  }

  private parsePower(): number | null {
    const base = this.parseAtom();
    if (base === null) return null;
    const t = this.peek();
    if (t?.type === 'op' && t.value === '^') {
      this.next();
      // Exponent über parseUnary: erlaubt sowohl ein Vorzeichen (2^-1) als
      // auch rechtsassoziative Ketten (2^3^2 = 2^(3^2)), da parseUnary bei
      // fehlendem Minus direkt zu parsePower zurückverzweigt.
      const exp = this.parseUnary();
      if (exp === null) return null;
      return Math.pow(base, exp);
    }
    return base;
  }

  private parseAtom(): number | null {
    const t = this.next();
    if (!t) return null;
    if (t.type === 'num') return t.value;
    if (t.type === 'lparen') {
      const v = this.parseExpr();
      if (v === null || !this.expect('rparen')) return null;
      return v;
    }
    // Geschweifte Klammern gruppieren wie runde (z. B. 2^{3+1}) – außerhalb
    // von \frac{}{} / \sqrt{}, die ihre eigenen Klammern selbst konsumieren.
    if (t.type === 'lbrace') {
      const v = this.parseExpr();
      if (v === null || !this.expect('rbrace')) return null;
      return v;
    }
    if (t.type === 'frac') {
      if (!this.expect('lbrace')) return null;
      const num = this.parseExpr();
      if (num === null || !this.expect('rbrace')) return null;
      if (!this.expect('lbrace')) return null;
      const den = this.parseExpr();
      if (den === null || !this.expect('rbrace')) return null;
      if (den === 0) return null;
      return num / den;
    }
    if (t.type === 'sqrt') {
      // Optionaler Grad in eckigen Klammern: \sqrt[3]{8} = Kubikwurzel.
      let degree = 2;
      if (this.peek()?.type === 'lbracket') {
        this.next();
        const d = this.parseExpr();
        if (d === null || !this.expect('rbracket')) return null;
        degree = d;
      }
      if (!this.expect('lbrace')) return null;
      const radicand = this.parseExpr();
      if (radicand === null || !this.expect('rbrace')) return null;
      if (radicand < 0 && degree % 2 === 0) return null; // gerade Wurzel aus negativer Zahl
      return radicand < 0
        ? -Math.pow(-radicand, 1 / degree)
        : Math.pow(radicand, 1 / degree);
    }
    return null;
  }
}

/**
 * Wertet eine (teilweise) LaTeX-ähnliche Eingabe aus: Grundrechenarten,
 * Klammern, Potenzen (^) sowie \frac{}{} und \sqrt{}/\sqrt[n]{}. Gibt null
 * bei ungültiger Syntax, Division/Wurzel durch/aus 0, geradzahliger Wurzel
 * aus einer negativen Zahl oder unvollständigem Ausdruck zurück.
 */
export const evaluateLatexExpr = (input: string): number | null => {
  const tokens = tokenize(input.trim());
  if (!tokens || tokens.length === 0) return null;
  const parser = new Parser(tokens);
  const value = parser.parseExpr();
  if (value === null || !Number.isFinite(value)) return null;
  if (!parser.atEnd()) return null; // überzählige Zeichen -> unvollständig geparst
  return value;
};
