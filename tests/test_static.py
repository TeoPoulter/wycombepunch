"""Dependency-free checks for the current docs/ publishing source."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import unittest
ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'docs'
class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(); self.ids=[]; self.links=[]; self.h1=0; self.imgs=[]; self.attrs=[]; self.selects={}; self.select=None; self.option_text=False; self.choice_groups={}; self.choice_group=None; self.choice_depth=0
        self.feed(source)
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        self.attrs.append((tag,a))
        if 'data-choice-group' in a:
            self.choice_group=a['data-choice-group']; self.choice_depth=1
            self.choice_groups[self.choice_group]={'attrs':a,'choices':[]}
        elif self.choice_group and tag=='div':
            self.choice_depth+=1
        if self.choice_group and 'data-choice' in a:
            self.choice_groups[self.choice_group]['choices'].append((tag,a))
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
        if tag=='div' and self.choice_group:
            self.choice_depth-=1
            if self.choice_depth==0: self.choice_group=None
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
        self.assertEqual(set(page.choice_groups),{'event-type','duration'})
        values={name:[a['data-choice'] for _,a in group['choices']] for name,group in page.choice_groups.items()}
        self.assertEqual(values['duration'],['3–5 hours','Full day','Something else'])
        for name,group in page.choice_groups.items():
            self.assertEqual(group['attrs']['role'],'radiogroup')
            self.assertTrue(group['attrs'].get('aria-label'))
            self.assertEqual(len(values[name]),len(set(values[name])))
            for tag,choice in group['choices']:
                self.assertEqual((tag,choice.get('type'),choice.get('role')),('button','button','radio'))
            backing=[a for tag,a in page.attrs if tag=='input' and a.get('id')==name]
            self.assertEqual(len(backing),1)
            self.assertEqual((backing[0]['type'],backing[0]['name']),('hidden',name))
        events=[a['data-event'] for _,a in page.attrs if 'data-event' in a]
        self.assertEqual(len(events),6)
        for event in events:
            self.assertIn(event,values['event-type'])
    def test_form_questions_and_production_contract(self):
        page=Page((SITE/'index.html').read_text())
        steps=[a for _,a in page.attrs if 'form-step' in a.get('class','').split()]
        self.assertEqual([a['data-step'] for a in steps],[str(i) for i in range(9)])
        self.assertTrue(all(a.get('aria-labelledby') in page.ids for a in steps))
        phone=next(a for _,a in page.attrs if a.get('id')=='phone')
        self.assertEqual((phone['type'],phone['name']),('hidden','phone'))
        national=next(a for _,a in page.attrs if a.get('id')=='phone-national')
        country=next(a for _,a in page.attrs if a.get('id')=='phone-country')
        self.assertIn('required',national)
        self.assertIn('required',country)
        self.assertEqual((national['type'],national['autocomplete']),('tel','tel-national'))
        self.assertEqual((country['value'],country['autocomplete']),('+44','tel-country-code'))
        self.assertNotIn('name',national)
        self.assertNotIn('name',country)
        form=next(a for tag,a in page.attrs if tag=='form' and a.get('id')=='enquiry-form')
        self.assertEqual(form['action'],'https://formspree.io/f/xppwapkw')
        self.assertEqual(form['method'].upper(),'POST')
        self.assertIn('novalidate',form)
        for tag,a in page.attrs:
            if any(key in a for key in ['data-calendar-prev','data-calendar-next','data-review-step']) or a.get('id')=='date-undecided':
                self.assertEqual((tag,a.get('type')),('button','button'))
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
