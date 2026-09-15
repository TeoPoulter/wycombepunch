from pathlib import Path
import sys, time, io, base64
from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
from local_render import ROOT,SITE,inline_page
P=ROOT/'previews'

def font(size,bold=False):
    return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',size)
def frame_image(canvas, image, box, phone=False):
    draw=ImageDraw.Draw(canvas)
    x,y,w,h=box
    draw.rounded_rectangle((x-2,y-2,x+w+2,y+h+38),radius=19,fill='#17171e',outline='#494954',width=2)
    draw.rounded_rectangle((x,y,x+w,y+36),radius=16,fill='#23232c')
    draw.rectangle((x,y+20,x+w,y+37),fill='#23232c')
    if phone:
        draw.rounded_rectangle((x+w//2-35,y+11,x+w//2+35,y+18),radius=4,fill='#494954')
    else:
        for k,col in enumerate(['#ff2848','#777784','#777784']):draw.ellipse((x+15+k*15,y+13,x+21+k*15,y+19),fill=col)
        draw.text((x+82,y+7),'wycombepunch.com',font=font(13),fill='#babac7')
    im=image.resize((w,h),Image.Resampling.LANCZOS).convert('RGB')
    canvas.paste(im,(x,y+36))

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    def load(filename):
        page.goto('about:blank');page.set_content(inline_page(filename));page.wait_for_timeout(300)
    def reveal():
        page.evaluate("document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in-view'))")
        page.wait_for_timeout(900)
    load('index.html')
    page.locator('#hero-machine').evaluate('(el)=>el.click()');page.wait_for_timeout(1250)
    page.screenshot(path=str(P/'desktop-top.png'))
    reveal();page.screenshot(path=str(P/'desktop-full.png'),full_page=True)
    print('desktop height',page.evaluate('document.documentElement.scrollHeight'))
    for section,name in [('#occasions','events-desktop.png'),('#coverage','coverage-desktop.png'),('#enquire','enquiry-desktop.png')]:
        page.locator(section).screenshot(path=str(P/name))
    # A real motion capture of the homepage cabinet.
    page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(450)
    stage=page.locator('.hero-stage')
    imgs=[Image.open(io.BytesIO(stage.screenshot())).convert('RGB').resize((480,540),Image.Resampling.LANCZOS)]
    page.locator('#hero-machine').evaluate('(el)=>el.click()')
    for _ in range(17):
        page.wait_for_timeout(55)
        imgs.append(Image.open(io.BytesIO(stage.screenshot())).convert('RGB').resize((480,540),Image.Resampling.LANCZOS))
    durations=[650]+[95]*16+[950]
    imgs[0].save(P/'bag-interaction.gif',save_all=True,append_images=imgs[1:],duration=durations,loop=0,optimize=True)
    # Game capture from actual interactions.
    load('play.html')
    for delay in [675,550,450]:
        page.locator('#game-button').click();page.wait_for_timeout(delay);page.locator('#game-button').click()
    page.wait_for_timeout(900)
    page.evaluate('window.scrollTo(0,0)');page.wait_for_timeout(400)
    page.screenshot(path=str(P/'game-desktop.png'))
    page.screenshot(path=str(P/'game-desktop-full.png'),full_page=True)
    # Mobile views.
    page.set_viewport_size({'width':390,'height':1000})
    load('index.html');page.locator('#hero-machine').evaluate('(el)=>el.click()');page.wait_for_timeout(1250)
    page.screenshot(path=str(P/'mobile-top.png'))
    reveal();page.screenshot(path=str(P/'mobile-full.png'),full_page=True)
    print('mobile height',page.evaluate('document.documentElement.scrollHeight'))
    page.set_viewport_size({'width':390,'height':844})
    load('play.html');page.screenshot(path=str(P/'game-mobile.png'))
    # Owner brand kit.
    page.set_viewport_size({'width':1440,'height':1000});load('brand-kit.html')
    page.screenshot(path=str(P/'brand-kit.png'),full_page=True)
    # Social card, no live reviews or availability claims.
    logo='data:image/webp;base64,'+base64.b64encode((SITE/'assets/logo-small.webp').read_bytes()).decode()
    svg=(SITE/'assets/machine.svg').read_text().replace('href="logo-small.webp"',f'href="{logo}"')
    style=(SITE/'assets/styles.css').read_text()
    social=f'''<!doctype html><html><head><style>{style}</style><style>body{{margin:0;width:1200px;height:630px;overflow:hidden;background:#0b0b0e}}.social{{position:relative;width:1200px;height:630px;padding:45px 54px;border:1px solid #392331;background:radial-gradient(ellipse at 80% 60%,#52102744,transparent 50%),#0b0b0e}}.social .brand img{{width:56px;height:56px}}.social .brand > span{{font-size:20px}}.social .brand strong{{font-size:32px}}.social .eyebrow{{margin-top:40px;font-size:11px}}.social h1{{font-size:88px;line-height:.96;letter-spacing:-.025em;position:relative;z-index:1}}.social .cabinet{{position:absolute;width:467px;right:-4px;top:1px}}.social .bottom{{position:absolute;bottom:0;left:0;right:0;padding:20px 54px;background:#ff2848;color:#0b0b0e;display:flex;justify-content:space-between;font:700 12px Arial}}.social p:not(.eyebrow){{margin-top:24px;font-size:14px}}.social .machine-svg{{filter:drop-shadow(0 15px 20px #000)}}.social .led-segment{{fill:#39121d}}.social .led-segment.lit{{fill:#ff3a55}}</style></head><body><div class="social"><div class="brand"><img src="{logo}" alt=""><span>WYCOMBE<strong>PUNCH<span class="red">.</span></strong></span></div><p class="eyebrow">BOXING MACHINE HIRE / BUCKINGHAMSHIRE</p><h1>BRING YOUR<br><em>COMPETITIVE</em><br>SIDE<span class="red">.</span></h1><p>Good company. Great competition.</p><div class="cabinet">{svg}</div><div class="bottom"><span>WEDDINGS &amp; WALIMAS · FAMILY · COMMUNITY</span><span>wycombepunch.com</span></div></div></body></html>'''
    page.set_viewport_size({'width':1200,'height':630});page.goto('about:blank');page.set_content(social);page.wait_for_timeout(200)
    page.screenshot(path=str(SITE/'assets/social-share.jpg'),type='jpeg',quality=91)
    browser.close()

# Lightweight self-contained browser previews, with navigation to the real site files.
for file,name in [('index.html','interactive-home.html'),('play.html','interactive-game.html')]:
    soup=BeautifulSoup(inline_page(file),'html.parser')
    for a in soup.find_all('a',href=True):
        href=a['href']
        if not href.startswith(('http','mailto:','#')):a['href']='../site/'+href
    (P/name).write_text(str(soup))

# Desktop + mobile presentation board.
board=Image.new('RGB',(1800,1370),'#0f0f14');d=ImageDraw.Draw(board)
d.text((57,43),'WYCOMBE PUNCH',font=font(43,True),fill='#f5f3ef')
d.text((58,103),'REDESIGN 02  /  INTERACTIVE CABINET  /  BUCKINGHAMSHIRE EVENT HIRE',font=font(15),fill='#a4a4af')
d.rounded_rectangle((1470,49,1738,85),radius=18,fill='#34151f',outline='#733043')
d.text((1495,58),'NEW DESIGN + FREE GAME',font=font(12,True),fill='#ff536b')
frame_image(board,Image.open(P/'desktop-top.png'),(58,164,1260,963))
frame_image(board,Image.open(P/'mobile-top.png'),(1370,164,368,944),phone=True)
d.text((58,1222),'A real bag interaction. A proper timing game. A complete brand system.',font=font(22,True),fill='#f5f3ef')
d.text((58,1264),'Your approved emblem · Faith-conscious event copy · No music, betting or prize mechanics',font=font(16),fill='#a4a4af')
d.text((58,1300),'Browser-rendered previews. The sample machine artwork is illustrative.',font=font(13),fill='#888893')
board.save('/mnt/data/wycombe-punch-v2-preview.png')
board.save(P/'design-overview.png')
# Game presentation board.
gameboard=Image.new('RGB',(1800,1370),'#0f0f14');d=ImageDraw.Draw(gameboard)
d.text((57,43),'THE 999 CHALLENGE',font=font(43,True),fill='#f5f3ef')
d.text((58,103),'THREE ROUNDS  /  TIMING-BASED SCORES  /  FREE TO PLAY',font=font(15),fill='#ff536b')
frame_image(gameboard,Image.open(P/'game-desktop.png'),(58,164,1260,963))
frame_image(gameboard,Image.open(P/'game-mobile.png'),(1370,164,368,796),phone=True)
d.text((1370,1038),'Tap. Time. Try again.',font=font(22,True),fill='#f5f3ef')
d.text((58,1222),'The cabinet reacts to your timing. Your best round is the score to beat.',font=font(22,True),fill='#f5f3ef')
d.text((58,1264),'Keyboard + touch controls · Copy your score · Reduced-motion alternative · No public leaderboard',font=font(16),fill='#a4a4af')
d.text((58,1300),'Screenshots show actual local browser play. This is not a physical strength test.',font=font(13),fill='#888893')
gameboard.save('/mnt/data/wycombe-punch-v2-game-preview.png')
gameboard.save(P/'game-overview.png')
# Keep a copy of social art in the brand package.
import shutil
shutil.copyfile(SITE/'assets/social-share.jpg',ROOT/'brand-assets/social-share-1200x630.jpg')
print('Previews, motion capture and social artwork created.')
