"""Dependency-free checks for the current docs/ publishing source."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import unittest
ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'docs'
class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.ids=[]; self.links=[]; self.h1=0; self.imgs=[]; self.attrs=[]; self.selects={}; self.select=None; self.option_text=False
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        self.attrs.append((tag,a))
        if tag=='select':
            self.select=a.get('id'); self.selects[self.select]=[]
        if tag=='option' and self.select:
            self.selects[self.select].append(a.get('value',''))
            self.option_text='value' not in a
        if a.get('id'): self.ids.append(a['id'])
        if tag=='h1': self.h1+=1
        if tag=='img': self.imgs.append(a)
        for k in ['src','href']:
            if a.get(k): self.links.append(a[k])
    def handle_endtag(self, tag):
        if tag=='select': self.select=None
        if tag=='option': self.option_text=False
    def handle_data(self, data):
        if self.select and self.option_text:
            self.selects[self.select][-1]+=data
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
    def test_event_choices_reach_the_form(self):
        page=Page((SITE/'index.html').read_text())
        self.assertEqual(page.selects['duration'],['3–5 hours','Full day','Something else'])
        events=[a['data-event'] for _,a in page.attrs if 'data-event' in a]
        self.assertEqual(len(events),6)
        for event in events:
            self.assertIn(event,page.selects['event-type'])
    def test_user_supplied_social_and_video(self):
        page=Page((SITE/'index.html').read_text())
        self.assertIn('https://www.instagram.com/wycombepunchmachine/',page.links)
        frames=[a for tag,a in page.attrs if tag=='iframe']
        self.assertEqual(len(frames),0)
        videos=[a for tag,a in page.attrs if tag=='video']
        self.assertEqual(len(videos),1)
        self.assertIn('muted',videos[0])
        self.assertIn('playsinline',videos[0])
        self.assertIn('controls',videos[0])
        self.assertIn('assets/how-punch-machines-work.mp4',page.links)
if __name__=='__main__': unittest.main()
