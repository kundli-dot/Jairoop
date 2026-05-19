#!/usr/bin/env python3
import re

path = '/workspace/google-apps-script/Index.html'
with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

html = re.sub(r'--\s*\d+\s+of\s+\d+\s+--', '', html)
for pat, repl in [
    (r'flex\s+-\s*', 'flex-'), (r'border\s+-\s*', 'border-'), (r'font\s+-\s*', 'font-'),
    (r'text\s+-\s*', 'text-'), (r'margin\s+-\s*', 'margin-'), (r'padding\s+-\s*', 'padding-'),
    (r'align\s+-\s*', 'align-'), (r'justify\s+-\s*', 'justify-'), (r'letter\s+-\s*', 'letter-'),
    (r'line\s+-\s*', 'line-'), (r'max\s+-\s*', 'max-'), (r'grid\s+-\s*', 'grid-'),
    (r'linear\s+-\s*', 'linear-'), (r'var\(\s+--', 'var(--'), (r'--shadow\s+-\s*lg', '--shadow-lg'),
    (r'initial\s+-\s*scale', 'initial-scale'), (r'T\s+extiles', 'Textiles'),
    (r"'DM Sans'\s*,", "'DM Sans',"), (r"'DM Mono'\s*,", "'DM Mono',"),
    (r'background:\s+none', 'background:none'),
]:
    html = re.sub(pat, repl, html)

html = html.replace('IMS TRACKING SYSTEM V6', 'IMS TRACKING SYSTEM V7')
html = html.replace('v6.0 Corporate Edition', 'v7.0 Corporate Edition')

with open(path, 'w', encoding='utf-8') as f:
    f.write(html)
print('Done')
