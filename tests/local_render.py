"""Render local HTML with inlined assets. No network or browser-policy changes.
The container browser cannot navigate URLs, so render source in about:blank.
Layout, DOM events and scripts are real Chromium; hosting remains a separate test.
"""
from pathlib import Path
from bs4 import BeautifulSoup
import base64, mimetypes
ROOT=Path(__file__).resolve().parent.parent
SITE=ROOT/'docs'
def inline_page(filename='index.html', config_override=None):
    soup=BeautifulSoup((SITE/filename).read_text(), 'html.parser')
    scripts=[]
    for tag in list(soup.find_all('script',src=True)):
        src=tag['src']
        text=(SITE/src).read_text()
        if src.endswith('config.js') and config_override is not None:
            import json
            text='window.WP_CONFIG = '+json.dumps(config_override)+';'
        scripts.append(text); tag.decompose()
    for link in list(soup.find_all('link')):
        if link.get('rel')==['stylesheet']:
            text=(SITE/link['href']).read_text(); tag=soup.new_tag('style'); tag.string=text; link.replace_with(tag)
        elif any(i in link.get('rel',[]) for i in ['manifest','icon','apple-touch-icon']): link.decompose()
    for tag in soup.find_all(['img','image']):
        attr='src' if tag.name=='img' else 'href'
        value=tag.get(attr,'')
        if value.startswith('assets/'):
            path=SITE/value
            mime=mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
            tag[attr]='data:'+mime+';base64,'+base64.b64encode(path.read_bytes()).decode()
    for script in scripts:
        tag=soup.new_tag('script'); tag.string=script; soup.body.append(tag)
    return str(soup)
