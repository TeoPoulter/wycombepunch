from pathlib import Path
from playwright.sync_api import sync_playwright
from local_render import inline_page, ROOT
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 def load(file):
  page.goto('about:blank'); page.set_content(inline_page(file)); page.wait_for_timeout(800)
 load('index.html')
 page.screenshot(path=str(ROOT/'previews'/'desktop-top.png'))
 print('desktop hero',page.locator('#hero-heading').bounding_box(),'scroll width',page.evaluate('document.documentElement.scrollWidth'))
 load('play.html')
 page.screenshot(path=str(ROOT/'previews'/'game-desktop.png'))
 page.set_viewport_size({'width':390,'height':844})
 load('index.html')
 page.screenshot(path=str(ROOT/'previews'/'mobile-top.png'))
 print('mobile hero',page.locator('#hero-heading').bounding_box(),'scroll width',page.evaluate('document.documentElement.scrollWidth'))
 load('play.html')
 page.screenshot(path=str(ROOT/'previews'/'game-mobile.png'))
 print('Errors',errors)
 browser.close()
