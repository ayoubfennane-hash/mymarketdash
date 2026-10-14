"""Lecture seule du catalogue public MYMARKET.ma, sans API Admin ni données clients."""
import json, time, unicodedata, re
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from datetime import datetime, timezone
import requests

ROOT = Path(__file__).resolve().parents[1]
RAYONS = [
 ('Marché et Boucherie', 'marche-et-boucherie'),
 ('Boissons', 'boissons'),
 ('Épicerie salée', 'epicerie-salee'),
 ('Épicerie sucrée', 'epicerie-sucree'),
 ('Petit Déjeuner', 'petit-dejeuner'),
 ('Hygiène et Beauté', 'hygiene-et-beaute'),
 ('Entretien et Maison', 'entretien-et-maison'),
 ('Pains et Pâtisserie', 'pains-et-patisserie'),
 ('Bébé', 'bebe'),
 ('Animaux', 'animaux'),
 ('Alimentation', 'alimentation'),
]

def fetch_collection(pair):
 name, handle = pair
 products = []; page = 1
 while page <= 60:
  url = f'https://www.mymarket.ma/collections/{handle}/products.json?limit=250&page={page}'
  for attempt in range(3):
   try:
    r = requests.get(url,timeout=45); r.raise_for_status()
    batch = r.json()['products']; break
   except (requests.RequestException, ValueError, KeyError):
    if attempt == 2: raise
    time.sleep(2 * (attempt + 1))
  if not isinstance(batch,list): raise ValueError(f'Réponse non conforme: {handle}')
  products.extend(batch)
  print(f'{name} · page {page} · {len(batch)} produits',flush=True)
  if len(batch) < 250: return name, handle, products
  page += 1
  time.sleep(.2)
 raise RuntimeError(f'Pagination excessive: {handle}')

entries = {}; counts = {}
with ThreadPoolExecutor(max_workers=3) as pool:
 futures = [pool.submit(fetch_collection, pair) for pair in RAYONS]
 for f in as_completed(futures):
  name,handle,products=f.result(); counts[name]=len(products)
  for p in products:
   key=str(p['id'])
   if key not in entries:
    entries[key]={'id':key,'title':p['title'],'handle':p['handle'],'skus':sorted(set(str(v.get('sku','')).strip() for v in p.get('variants',[]) if v.get('sku'))),'categories':[]}
   if name not in entries[key]['categories']: entries[key]['categories'].append(name)
# Collections transversales conservées. Alimentation n'est affiché que si aucun rayon plus précis ne convient.
order={n:i for i,(n,h) in enumerate(RAYONS)}
for p in entries.values():
 p['categories'].sort(key=lambda n:order[n])
 if len(p['categories'])>1 and 'Alimentation' in p['categories']:p['categories'].remove('Alimentation')
output={'source':'https://www.mymarket.ma/','retrievedAt':datetime.now(timezone.utc).isoformat(),'collections':[{'name':n,'url':f'https://www.mymarket.ma/collections/{h}','count':counts[n]} for n,h in RAYONS], 'products': [{k:v for k,v in p.items() if k != 'id'} for p in sorted(entries.values(),key=lambda p:p['id'])]}
path=ROOT/'src'/'catalog-categories.json';path.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':'))+'\n')
print(f'Catalogue enregistré: {len(entries)} produits; {path.stat().st_size} octets',flush=True)
