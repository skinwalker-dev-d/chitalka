import json, re, calendar

with open(r'C:\Users\Yaroslav.Khodun\Desktop\MyLib\to_compare\site-books-ids', 'r', encoding='utf-8') as f:
    ids_data = json.load(f)

with open(r'C:\Users\Yaroslav.Khodun\Desktop\MyLib\to_compare\phone_books.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Build normalized title -> id (first occurrence = lower id = regular edition)
def norm(s): return re.sub(r'\s+', ' ', s.lower().strip())
site_by_norm = {}
for b in ids_data:
    n = norm(b['title'])
    if n not in site_by_norm:
        site_by_norm[n] = b['id']

# Explicit overrides: phone title -> site id
# Handles title mismatches and collector/duplicate editions
explicit = {
    # title mismatches
    norm('Скованные (коллекционное издание)'):           131,
    norm('И после восьми - дыши'):                       153,
    norm('Гарри Поттер и узник Азкабана'):               117,  # regular (March)
    norm('Голодные игры. И вспыхнет пламя'):              44,
    norm('Голодные игры. Сойка пересмешница'):            45,
    norm('Хоронили Нарнии 1 том'):                        61,
    norm('Морана и тень. Плетущая'):                      88,
    norm('Морана и тень. Видящий'):                       89,
    norm('Королевство стужи и звездного света'):         100,
    # HP collector editions -> higher duplicate ids
    norm('Гарри Поттер и философский камень (коллекционка)'): 126,
    norm('Гарри Поттер и тайная комната (коллекционка)'):     127,
    norm('Гарри Поттер и узник Азкабана (коллекционное издание)'): 128,
}

MONTHS = {'Январь':1,'Февраль':2,'Март':3,'Апрель':4,'Май':5,'Июнь':6,
          'Июль':7,'Август':8,'Сентябрь':9,'Октябрь':10,'Ноябрь':11,'Декабрь':12}

phone_books = []
cur_year = cur_month = None
for line in lines:
    s = line.strip()
    m = re.match(r'^(\d{4})', s)
    if m: cur_year = int(m.group(1)); cur_month = None; continue
    m = re.match(r'^(' + '|'.join(MONTHS) + r')', s)
    if m: cur_month = MONTHS[m.group(1)]; continue
    clean = re.sub(r'^[\u2022\u2023\u2043\-\u2013\u2014\u00b7\t\u00a0 \u2010\u2212]+', '', s)
    if clean and cur_year and cur_month:
        phone_books.append((clean, cur_year, cur_month))

rows, unmatched = [], []
for title, yr, mo in phone_books:
    n = norm(title)
    sid = explicit.get(n) or site_by_norm.get(n)
    if sid:
        last_day = calendar.monthrange(yr, mo)[1]
        rows.append((sid, title, f'{yr}-{mo:02d}-{last_day}'))
    else:
        unmatched.append(title)

print(f'Matched: {len(rows)}, Unmatched: {len(unmatched)}')
if unmatched:
    print('UNMATCHED:')
    for t in unmatched: print(f'  {t}')

sql_lines = [
    '-- Updates completed_at for all 72 read books based on phone reading log',
    '-- Run in Supabase SQL Editor',
    '',
    'UPDATE public.books SET completed_at = v.completed_at',
    'FROM (VALUES',
]
for i, (sid, title, date) in enumerate(rows):
    comma = '' if i == len(rows) - 1 else ','
    sql_lines.append(f"  ({sid}, '{date}'::date){comma}  -- {title}")
sql_lines += [
    ') AS v(id, completed_at)',
    'WHERE books.id = v.id;',
]

output = '\n'.join(sql_lines)
with open(r'C:\Users\Yaroslav.Khodun\Desktop\MyLib\supabase\seeds\update_completed_at.sql', 'w', encoding='utf-8') as f:
    f.write(output)
print('Written to update_completed_at.sql')
