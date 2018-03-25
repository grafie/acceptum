(function() {

  if (window.acceptumCSInjected) {
    return;
  }
  window.acceptumCSInjected = true;

  function getWindowAsCanvasDataURL() {
    let x = 0;
    let y = 0;

    let body = document.body;
    let html = document.documentElement;

    let h = Math.max(//https://stackoverflow.com/questions/1145850/how-to-get-height-of-entire-document-with-javascript
      window.outerHeight,
      body.scrollHeight,
      body.offsetHeight,
      html.clientHeight,
      html.scrollHeight,
      html.offsetHeight
    );
    let w = Math.max(
      window.outerWidth,
      body.scrollWidth,
      body.offsetWidth,
      html.clientWidth,
      html.scrollWidth,
      html.offsetWidth
    );

    let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

    canvas.width = w;
    canvas.height = h;

    let ctx = canvas.getContext('2d');

    ctx.clearRect(x, y, w, h);
    ctx.save();
    ctx.drawWindow(window, x, y, w, h, "rgba(0,0,0,0)");
    ctx.restore();
    return canvas.toDataURL('image/png');
  }

  browser.runtime.onMessage.addListener((message) => {
    browser.runtime.sendMessage({"data": getWindowAsCanvasDataURL(), "settings": message.settings});
  });
})();
