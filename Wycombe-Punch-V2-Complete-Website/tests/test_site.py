"""Local Chromium QA. Run: python tests/test_site.py
Uses inlined local files because this environment blocks browser URL navigation.
No policies are modified. Live DNS, host, inbox and provider delivery are NOT tested.
"""
from pathlib import Path
import re, json, time, math
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from local_render import ROOT, SITE, inline_page

results=[]
def check(name, condition, detail=''):
    results.append({'name':name,'passed':bool(condition),'detail':str(detail)})
    if not condition: print('FAIL',name,detail)

# Static source checks and internal links.
files=list(SITE.glob('*.html'))
for path in files:
    soup=BeautifulSoup(path.read_text(),'html.parser')
    ids=[e['id'] for e in soup.select('[id]')]
    check(f'{path.name}: unique IDs',len(ids)==len(set(ids)))
    check(f'{path.name}: one H1',len(soup.find_all('h1'))==1)
    check(f'{path.name}: language/title/description',soup.html.get('lang')=='en-GB' and bool(soup.title) and bool(soup.find('meta',attrs={'name':'description'})))
    check(f'{path.name}: no media or tracking embeds',not soup.find_all(['audio','video','iframe']))
    missing=[]
    for el in soup.find_all(['a','img','image','script','link']):
        url=el.get('src') or el.get('href')
        if not url or url.startswith(('http:','https:','mailto:','tel:','data:')): continue
        filename,_,frag=url.partition('#')
        target=SITE/(filename or path.name)
        if not target.exists(): missing.append(url)
        elif frag and target.suffix=='.html':
            target_soup=soup if target==path else BeautifulSoup(target.read_text(),'html.parser')
            if not target_soup.find(id=frag): missing.append(url)
    check(f'{path.name}: internal targets exist',not missing,missing)
    check(f'{path.name}: images have alt text',all(i.has_attr('alt') for i in soup.find_all('img')))
    public_text=soup.get_text(' ',strip=True).lower()
    check(f'{path.name}: no party/nightlife promotion',not re.search(r'\b(parties|party|nightclubs?|pubs?|alcohol|disco|dancefloor)\b',public_text))

# Contrast of primary UI combinations (not a complete WCAG audit).
def luminance(hexc):
    c=[int(hexc[i:i+2],16)/255 for i in (1,3,5)]
    c=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in c]
    return sum(a*b for a,b in zip(c,[.2126,.7152,.0722]))
def contrast(a,b):
    l=sorted([luminance(a),luminance(b)])
    return (l[1]+.05)/(l[0]+.05)
for label,a,b in [('red button','#0b0b0e','#ff2848'),('body copy','#a4a4af','#141419'),('red accent','#ff2848','#0b0b0e'),('main text','#f5f3ef','#0b0b0e')]:
    ratio=contrast(a,b);check(f'Contrast: {label} >= 4.5:1',ratio>=4.5,round(ratio,2))

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.set_default_timeout(6000)
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    def load(filename='index.html'):
        page.goto('about:blank');page.set_content(inline_page(filename));page.wait_for_timeout(80)
    # Every page at small mobile, mobile, tablet, desktop and wide desktop.
    widths=[320,360,390,430,580,581,768,800,801,1024,1280,1440,1920]
    for filename in ['index.html','play.html','privacy.html','booking-information.html','brand-kit.html','404.html','thank-you.html']:
        load(filename)
        for width in widths:
            page.set_viewport_size({'width':width,'height':900})
            page.wait_for_timeout(20)
            actual=page.evaluate('document.documentElement.scrollWidth')
            check(f'{filename}: no overflow at {width}px',actual<=width+1,f'scrollWidth={actual}')
    page.set_viewport_size({'width':1440,'height':1000})
    load()
    check('Hero enabled by JS',page.locator('#hero-machine').is_enabled())
    page.locator('#hero-machine').evaluate('(el)=>el.click()')
    page.wait_for_timeout(220)
    transform=page.locator('.bag-assembly').first.evaluate('(el)=>getComputedStyle(el).transform')
    check('Tap swings the hero bag',transform not in ['none','matrix(1, 0, 0, 1, 0, 0)'],transform)
    page.screenshot(path=str(ROOT/'previews'/'bag-in-motion.png'))
    page.wait_for_timeout(1000)
    check('Hero sample score ends at 847',page.locator('#hero-score').inner_text()=='847')
    check('LED matches the hero score',page.locator('#hero-machine svg').first.get_attribute('data-score')=='847')
    check('Bag settles after hit',not page.locator('#hero-machine svg').first.evaluate("el=>el.classList.contains('is-hit')"))
    check('Demo explicitly labelled', 'not a strength test' in page.locator('#hero-demo-note').inner_text())
    page.locator('[data-motion-toggle]').click()
    check('Motion toggle applies class',page.locator('html').get_attribute('class').find('motion-reduced')>=0)
    page.locator('#hero-machine').evaluate('(el)=>el.click()')
    check('Reduced-motion score is instant',page.locator('#hero-score').inner_text()=='912')
    check('Reduced mode has no bag swing',page.locator('.bag-assembly').first.evaluate('(el)=>getComputedStyle(el).transform') in ['none','matrix(1, 0, 0, 1, 0, 0)'])
    check('Marquee pauses under reduced motion',page.locator('.ribbon-track').evaluate('(el)=>getComputedStyle(el).animationName')=='none')
    page.locator('[data-motion-toggle]').click()
    page.locator('[data-town="Marlow"]').evaluate('(el)=>el.click()')
    check('Coverage selection fills location',page.locator('#venue').input_value()=='Marlow')
    check('Coverage button records active state',page.locator('[data-town="Marlow"]').get_attribute('aria-pressed')=='true')
    page.locator('[data-event="Community event"]').evaluate('(el)=>el.click()')
    check('Event card fills occasion',page.locator('#event-type').input_value()=='Community event')
    # Prepare and copy a complete enquiry without a network call.
    page.evaluate("() => {window.__fetches=0; window.fetch=()=>{window.__fetches++;throw new Error('Unexpected test fetch');};}")
    page.locator('#event-type').select_option('')
    page.locator('#form-next').click()
    check('Step 1 rejects no event',page.locator('#enquiry-form').get_attribute('data-step')=='0')
    page.locator('#event-type').select_option('Family gathering')
    page.locator('#event-date').fill('2020-01-01')
    page.locator('#form-next').click()
    check('Past event date is rejected',page.locator('#enquiry-form').get_attribute('data-step')=='0')
    page.locator('#event-date').fill('')
    page.locator('#form-next').click()
    check('Date is genuinely optional',page.locator('#enquiry-form').get_attribute('data-step')=='1')
    page.locator('#venue').fill('   ')
    page.locator('#form-next').click()
    check('Whitespace-only venue rejected',page.locator('#enquiry-form').get_attribute('data-step')=='1')
    page.locator('#venue').fill('Marlow community venue')
    page.locator('#message').fill('Indoor gathering. Please confirm access requirements.')
    page.locator('#form-next').click()
    check('Builder reaches contact step',page.locator('#enquiry-form').get_attribute('data-step')=='2')
    check('Summary shows selected event',page.locator('[data-summary="event"]').inner_text()=='Family gathering')
    check('Summary shows chosen location',page.locator('[data-summary="venue"]').inner_text()=='Marlow community venue')
    page.locator('#name').fill('Demo Booker')
    page.locator('#email').fill('not-an-email')
    page.locator('#submit-enquiry').click()
    check('Invalid email prevents result',page.locator('#form-result').is_hidden())
    page.locator('#email').fill('demo@example.test')
    page.locator('#submit-enquiry').click()
    check('Preview reports not sent','not sent' in page.locator('#form-result-title').inner_text())
    check('Preview performs zero fetches',page.evaluate('window.__fetches')==0)
    page.locator('#copy-enquiry').click()
    # Browser clipboard is blocked by policy; test the built-in manual fallback.
    page.wait_for_timeout(200)
    check('Blocked clipboard has selectable fallback',page.locator('#copy-fallback').is_visible())
    check('Copied draft contains the event', 'Family gathering' in page.locator('#copy-fallback').input_value())
    check('Copied draft says not a booking','not a confirmed booking' in page.locator('#copy-fallback').input_value())
    # All FAQ items expand natively.
    page.locator('.faq summary').first.evaluate('(el)=>el.click()')
    check('FAQ expands natively',page.locator('.faq').first.get_attribute('open') is not None)
    # Mobile menu focus and dismissal.
    page.set_viewport_size({'width':390,'height':844});page.evaluate('window.scrollTo(0,0)')
    page.locator('.menu-toggle').click()
    check('Mobile menu opens',page.locator('.menu-toggle').get_attribute('aria-expanded')=='true')
    check('Background becomes inert',page.locator('main').evaluate('(el)=>el.inert'))
    page.keyboard.press('Escape')
    check('Escape closes menu',page.locator('.menu-toggle').get_attribute('aria-expanded')=='false')
    check('Focus returns to toggle',page.locator('.menu-toggle').evaluate('(el)=>el===document.activeElement'))
    check('Background no longer inert',not page.locator('main').evaluate('(el)=>el.inert'))
    # Game logic, real input, score completion and reset.
    page.set_viewport_size({'width':1440,'height':1000});load('play.html')
    values=page.evaluate('''() => { const m=WP_GAME_MATH; return [m.scoreForPosition(0),m.scoreForPosition(.5),m.scoreForPosition(1),m.scoreForElapsed(0),m.scoreForElapsed(1000),m.scoreForElapsed(2000)]; }''')
    check('Game maths: edges and perfect scores',values==[0,999,0,0,999,0],values)
    bounded=page.evaluate('''() => Array.from({length:401},(_,i)=>i/100-1).every(x=>{let s=WP_GAME_MATH.scoreForPosition(x);return Number.isInteger(s)&&s>=0&&s<=999;})''')
    check('Scores stay within 000–999',bounded)
    check('Game starts idle',page.locator('#game-arena').get_attribute('data-state')=='idle')
    page.locator('#game-button').click()
    check('Start enters aiming state',page.locator('#game-arena').get_attribute('data-state')=='aiming')
    page.wait_for_timeout(320)
    check('Timing cursor moves',page.locator('#meter-cursor').evaluate('(el)=>parseFloat(el.style.left)')>0)
    page.locator('#game-button').click()
    check('Stop records round one',page.locator('#game-arena').get_attribute('data-state')=='scored' and page.locator('[data-round-score="0"]').inner_text()!='—')
    for wait in [580,485]:
        page.locator('#game-button').click();page.wait_for_timeout(wait);page.locator('#game-button').click()
    page.wait_for_timeout(720)
    check('Exactly three rounds complete',page.locator('#game-arena').get_attribute('data-state')=='complete')
    values=[int(page.locator(f'[data-round-score="{i}"]').inner_text()) for i in range(3)]
    check('Final score is best round',int(page.locator('#final-score').inner_text())==max(values),values)
    check('Result panel becomes visible',page.locator('#game-result').is_visible())
    check('Session best matches actual scores',int(page.locator('#session-best').inner_text())==max(values))
    page.locator('#share-score').click();page.wait_for_timeout(150)
    check('Score-copy fallback works',page.locator('#score-share-fallback').is_visible() and 'timing challenge' in page.locator('#score-share-fallback').input_value())
    page.locator('#game-reset').click()
    check('Reset clears all three rounds',all(page.locator(f'[data-round-score="{i}"]').inner_text()=='—' for i in range(3)))
    check('Reset preserves visit best',int(page.locator('#session-best').inner_text())==max(values))
    # Keyboard launch/stop through the actual button.
    page.locator('#game-button').focus();page.keyboard.press('Space')
    check('Space starts round',page.locator('#game-arena').get_attribute('data-state')=='aiming')
    page.wait_for_timeout(200);page.keyboard.press('Enter')
    check('Enter stops round',page.locator('#game-arena').get_attribute('data-state')=='scored')
    page.locator('[data-motion-toggle]').click()
    check('Motion toggle resets set safely',page.locator('#game-arena').get_attribute('data-state')=='idle')
    check('Motion-free mode hides moving bar',page.locator('#timing-meter').is_hidden())
    check('Motion-free instructions shown',page.locator('#reduced-game-instructions').is_visible())
    page.locator('#game-button').click();page.wait_for_timeout(975);page.locator('#game-button').click();page.wait_for_timeout(50)
    score=int(page.locator('[data-round-score="0"]').inner_text())
    check('Motion-free mode has real timing score',score>=700,score)
    check('Reduced game score is instant',int(page.locator('#game-score').inner_text())==score)
    # Device preference respected at initial load.
    page.emulate_media(reduced_motion='reduce');load('play.html')
    check('Device reduced-motion preference respected',page.locator('#timing-meter').is_hidden())
    page.locator('[data-motion-toggle]').click()
    check('Toggle does not override device request',page.locator('#timing-meter').is_hidden())
    page.emulate_media(reduced_motion='no-preference')
    # Timeout under a controlled browser clock, no 12-second wall-clock wait.
    timeout_page=browser.new_page(viewport={'width':1000,'height':1000})
    timeout_page.clock.install()
    timeout_page.set_content(inline_page('play.html'))
    timeout_page.locator('#game-button').click()
    timeout_page.clock.fast_forward(13000)
    check('Unfinished round times out safely',timeout_page.locator('#game-arena').get_attribute('data-state')=='scored' and timeout_page.locator('[data-round-score="0"]').inner_text()=='000')
    timeout_page.close()
    # No-JS page remains readable with no pretend interactive controls.
    nojs=browser.new_context(java_script_enabled=False,viewport={'width':390,'height':844})
    n=nojs.new_page();n.set_content(inline_page('index.html'))
    check('No-JS headline visible',n.locator('#hero-heading').is_visible())
    check('No-JS content is not reveal-hidden',n.locator('#experience .reveal').first.evaluate('(el)=>getComputedStyle(el).opacity')=='1')
    check('No-JS form remains disabled',n.locator('#enquiry-fields').evaluate('(el)=>el.disabled') and n.locator('#event-type').is_disabled())
    check('No-JS mobile navigation accessible',n.locator('#main-nav').is_visible())
    nojs.close()
    check('No JavaScript runtime errors',not errors,errors)
    browser.close()

report={'passed':sum(r['passed'] for r in results),'failed':sum(not r['passed'] for r in results),'total':len(results),'environment':'Chromium; local source rendered via inlining; browser URL navigation blocked by environment. Live hosting, real inbox delivery and device hardware not tested.','results':results}
(ROOT/'tests'/'qa-results.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
