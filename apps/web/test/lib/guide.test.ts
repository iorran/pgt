import { describe, it, expect } from 'vitest';
import { parseGuide, findSection, helpSectionFor, matches, GUIDES } from '@/lib/guide';

const md = `---
title: Test
---

# Guia
<sub><em>Guide</em></sub>

Intro pt.
<sub><em>Intro en.</em></sub>

## Primeiros Passos
<sub><em>Getting Started</em></sub>

### Entrar
<sub><em>Sign In</em></sub>

1. Toque em **"Entrar"**
   <sub><em>Tap "Entrar" (Log In)</em></sub>

> [!tip] Dica boa
> <sub><em>Good tip</em></sub>

![Tela](./assets/user-guide/unauth/login-page.png)

## Famílias
<sub><em>Families</em></sub>

Texto da família.
`;

describe('parseGuide', () => {
  it('splits on level-2 headings, keeps the intro and drops frontmatter and the title', () => {
    const g = parseGuide(md, 'pt-BR');
    expect(g.intro.trim()).toBe('Intro pt.');
    expect(g.sections.map((s) => s.id)).toEqual(['Primeiros Passos', 'Famílias']);
    expect(g.sections[0].title).toBe('Primeiros Passos');
  });

  it('keeps Portuguese lines and drops the English subtitles in pt-BR', () => {
    const body = parseGuide(md, 'pt-BR').sections[0].body;
    expect(body).toContain('### Entrar');
    expect(body).toContain('1. Toque em **"Entrar"**');
    expect(body).not.toContain('<sub>');
    expect(body).not.toContain('Tap');
  });

  it('swaps each line for its English subtitle in en, keeping the markdown prefix and the Portuguese ids', () => {
    const g = parseGuide(md, 'en');
    expect(g.intro.trim()).toBe('Intro en.');
    expect(g.sections[0]).toMatchObject({ id: 'Primeiros Passos', title: 'Getting Started' });
    expect(g.sections[0].body).toContain('### Sign In');
    expect(g.sections[0].body).toContain('1. Tap "Entrar" (Log In)');
    expect(g.sections[1].body).toContain('Texto da família.'); // no subtitle → kept as is
  });

  it('turns Obsidian callouts into a bold blockquote title', () => {
    expect(parseGuide(md, 'pt-BR').sections[0].body).toContain('> **Dica boa**');
    expect(parseGuide(md, 'en').sections[0].body).toContain('> **Good tip**');
  });
});

describe('findSection', () => {
  const { sections } = parseGuide(md, 'pt-BR');
  it('finds a section by its id or by one of its level-3 headings', () => {
    expect(findSection(sections, 'Famílias')?.id).toBe('Famílias');
    expect(findSection(sections, 'Entrar')?.id).toBe('Primeiros Passos');
    expect(findSection(sections, 'Nada')).toBeUndefined();
  });
});

describe('matches', () => {
  it('ignores case and accents', () => {
    const s = parseGuide(md, 'pt-BR').sections[1];
    expect(matches(s, 'FAMILIA')).toBe(true);
    expect(matches(s, 'entrar')).toBe(false);
  });
});

describe('helpSectionFor', () => {
  it('maps a screen to its guide section, most specific path first', () => {
    expect(helpSectionFor('/students/families', 'owner')).toBe('Famílias');
    expect(helpSectionFor('/students/123', 'owner')).toBe('Gerenciando Alunos');
    expect(helpSectionFor('/billing/payments', 'owner')).toBe('Financeiro');
    expect(helpSectionFor('/me/billing', 'student')).toBe('Pagamentos');
    expect(helpSectionFor('/me/language', 'student')).toBe('Minha conta');
    expect(helpSectionFor('/nowhere', 'student')).toBeUndefined();
  });

  it('only points at sections that exist in the real guides', () => {
    for (const guide of ['owner', 'student'] as const) {
      const ids = parseGuide(GUIDES[guide], 'pt-BR').sections.map((s) => s.id);
      for (const path of ['/', '/pending', '/students', '/students/families', '/classes', '/billing', '/marketplace', '/gamification', '/tournaments', '/settings', '/me', '/me/billing']) {
        const id = helpSectionFor(path, guide);
        if (id) {
          expect(ids, `${guide} ${path}`).toContain(id);
        }
      }
    }
  });
});
