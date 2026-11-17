"""Regenerate the section index in each role skill's SKILL.md.
Run from repo root after editing any references/original-guidance.md:
    python .claude/tools/reindex-skill-refs.py
Index = '##' headings with Read offset/limit, so agents load only needed sections."""
import glob, os, re
ALWAYS = re.compile(r'modification boundaries|fundamental principle', re.I)
for ref in sorted(glob.glob('.claude/skills/*/references/original-guidance.md')):
    sk = os.path.join(os.path.dirname(os.path.dirname(ref)), 'SKILL.md')
    lines = open(ref, encoding='utf-8').read().split('\n')
    if lines and lines[-1] == '': lines.pop()
    heads = [(i + 1, l[3:].strip()) for i, l in enumerate(lines) if l.startswith('## ')]
    rows = []
    for n, (start, name) in enumerate(heads):
        end = heads[n + 1][0] - 1 if n + 1 < len(heads) else len(lines)
        assert lines[start - 1].startswith('## ' + name[:5]), (ref, name)
        rows.append((name, start, end - start + 1, bool(ALWAYS.search(name))))
    s = open(sk, encoding='utf-8').read()
    fm_end = s.index('---', 3) + 3
    head = s[:fm_end]
    title = re.search(r'^# .+$', s, re.M).group(0)
    body = [head, '', title, '',
            'Do not read `references/original-guidance.md` whole. Read `*` sections first, then only the sections the task needs, via Read(offset, limit). Stay evidence-based and in scope.', '',
            'Sections (name — offset, limit):']
    for name, start, cnt, always in rows:
        body.append(f'- {"*" if always else ""}{name} — {start}, {cnt}')
    body.append('')
    body.append('Index stale after editing the reference? Run `python .claude/tools/reindex-skill-refs.py`.')
    open(sk, 'w', encoding='utf-8', newline='\n').write('\n'.join(body) + '\n')
print('reindexed', len(glob.glob('.claude/skills/*/references/original-guidance.md')))
