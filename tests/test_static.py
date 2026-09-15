"""Dependency-free checks for the current docs/ publishing source."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import unittest
ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'docs'
class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.ids=[]; self.links=[]; self.h1=0; self.imgs=[]
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if a.get('id'): self.ids.append(a['id'])
        if tag=='h1': self.h1+=1
        if tag=='img': self.imgs.append(a)
        for k in ['src','href']:
            if a.get(k): self.links.append(a[k])
class SiteTests(unittest.TestCase):
    def test_pages_and_links(self):
        for path in SITE.glob('*.html'):
            with self.subTest(page=path.name):
                page=Page(path.read_text())
                self.assertEqual(page.h1,1)
                self.assertEqual(len(page.ids),len(set(page.ids)))
                self.assertTrue(all('alt' in img for img in page.imgs))
                for link in page.links:
                    u=urlsplit(link)
                    if u.scheme or u.netloc: continue
                    target=(path.parent / unquote(u.path)) if u.path else path
                    self.assertTrue(target.exists(),(path.name,link))
                    if u.fragment and target.suffix=='.html':
                        self.assertIn(u.fragment,Page(target.read_text()).ids,(path.name,link))
    def test_publishing_domain_preserved(self):
        self.assertEqual((SITE/'CNAME').read_text().strip(),'wycombepunch.com')
        self.assertEqual((ROOT/'CNAME').read_text().strip(),'wycombepunch.com')
    def test_retired_labels_removed(self):
        for path in SITE.glob('*.html'):
            source=path.read_text()
            for old in ['WP—01','A LITTLE FRIENDLY COMPETITION','Interactive illustration. Sample scores','Good company.','999 Challenge','pre-launch website']:
                self.assertNotIn(old,source,(path.name,old))
if __name__=='__main__': unittest.main()
